import type { Exposure } from "@/features/exposure-picker/exposures.ts";
import {
	DUST_CLEAN_SIZE_FACTOR,
	DUST_CLEAN_STEL,
	DUST_CLEAN_TWA,
	DUST_DUSTY_DAY_MAX,
	DUST_DUSTY_DAY_SHARE,
	NOISE_LCPK_OFFSET,
	NOISE_LOUD_DAY_DEVIATION,
	NOISE_LOUD_DAY_LEVEL,
	NOISE_LOUD_DAY_SHARE,
	NOISE_PEAK_LAEQ,
	NOISE_PEAK_LCPK_CAP,
	NOISE_PEAK_LCPK_HIGH_RANGE,
	NOISE_PEAK_LCPK_HIGH_SHARE,
	NOISE_PEAK_LCPK_MAX,
	NOISE_PEAK_SHARE,
	NOISE_QUIET_LAEQ,
	SAMPLE_INTERVAL_MS,
	VIBRATION_HOURLY_SHARE,
	VIBRATION_POINTS,
	VIBRATION_SESSIONS_PER_DAY,
} from "./calibration.ts";
import { getConstantOffset, getUserProfile } from "./profiles.ts";
import { hashString, lerp, sampleQuantile, samplePoisson, unitRandom } from "./random.ts";
import type { DataDay } from "./time.ts";
import { type Bucket, BucketBuilder, VIEW_SOURCES } from "./buckets.ts";

/**
 * Generates the raw sensor rows (like the `NoiseData`, `DustData` and `VibrationData` tables) for one user and one day,
 * and returns them aggregated into minute buckets.
 *
 * Each user has their own random series (seeded by user ID), scaled with the user's `seed_user_profile` (see
 * `profiles.ts`). Day-level properties (loud day, dusty day) are seeded by user and date; per-sample values by user and
 * absolute sample slot, so the same timestamp always gets the same value.
 */

const MINUTE_MS = 60_000;

// Stream IDs, so different quantities of the same user/slot get independent random numbers
const STREAM = {
	noiseDay: 1,
	noiseSample: 2,
	dustDay: 3,
	dustSample: 4,
	vibrationMinute: 5,
	vibrationJitter: 6,
} as const;

function userSeed(userId: string, stream: number): number {
	return hashString(`${userId}#${stream}`);
}

function generateNoise(userId: string, day: DataDay, builder: BucketBuilder) {
	const profile = getUserProfile(userId).noise;
	const offset = getConstantOffset("noise", profile);
	const daySeed = userSeed(userId, STREAM.noiseDay);
	const sampleSeed = userSeed(userId, STREAM.noiseSample);

	const isLoudDay = unitRandom(daySeed, day.dayNumber, 0) < NOISE_LOUD_DAY_SHARE;
	const loudLevel = sampleQuantile(NOISE_LOUD_DAY_LEVEL, unitRandom(daySeed, day.dayNumber, 1));

	const row = new Float64Array(2); // [LCPK, LAEQ]

	for (let time = day.start; time < day.end; time += SAMPLE_INTERVAL_MS) {
		const slot = time / SAMPLE_INTERVAL_MS;
		const lcpkOffset = sampleQuantile(NOISE_LCPK_OFFSET, unitRandom(sampleSeed, slot, 2));
		const loudLaeq =
			loudLevel + lerp(-NOISE_LOUD_DAY_DEVIATION, NOISE_LOUD_DAY_DEVIATION, unitRandom(sampleSeed, slot, 3));

		let lcpk: number;
		let laeq: number;

		if (unitRandom(sampleSeed, slot, 1) < NOISE_PEAK_SHARE) {
			const peak = sampleQuantile(NOISE_PEAK_LAEQ, unitRandom(sampleSeed, slot, 0));
			const isHighPeak = unitRandom(sampleSeed, slot, 4) < NOISE_PEAK_LCPK_HIGH_SHARE;

			lcpk = isHighPeak
				? Math.min(NOISE_PEAK_LCPK_MAX, lerp(...NOISE_PEAK_LCPK_HIGH_RANGE, unitRandom(sampleSeed, slot, 5)))
				: Math.min(NOISE_PEAK_LCPK_CAP, peak + lcpkOffset);
			// Loud days have no LAEQ peaks in the sample data, only LCPK peaks
			laeq = isLoudDay ? loudLaeq : peak;
		} else {
			const quiet = sampleQuantile(NOISE_QUIET_LAEQ, unitRandom(sampleSeed, slot, 0));
			lcpk = quiet + lcpkOffset;
			laeq = isLoudDay ? loudLaeq : quiet;
		}

		row[0] = lcpk * profile.mult + offset;
		row[1] = laeq * profile.mult + offset;
		builder.addSample(time, row);
	}
}

// Same order as VIEW_SOURCES.dust
const DUST_COLUMNS = [
	{ size: "pm1", kind: "stel" },
	{ size: "pm25", kind: "stel" },
	{ size: "pm4", kind: "stel" },
	{ size: "pm10", kind: "stel" },
	{ size: "pm1", kind: "twa" },
	{ size: "pm25", kind: "twa" },
	{ size: "pm4", kind: "twa" },
	{ size: "pm10", kind: "twa" },
] as const;

function generateDust(userId: string, day: DataDay, builder: BucketBuilder) {
	const profile = getUserProfile(userId).dust;
	const offset = getConstantOffset("dust", profile);
	const sampleSeed = userSeed(userId, STREAM.dustSample);

	const isDustyDay = unitRandom(userSeed(userId, STREAM.dustDay), day.dayNumber, 0) < DUST_DUSTY_DAY_SHARE;

	const row = new Float64Array(DUST_COLUMNS.length);

	for (let time = day.start; time < day.end; time += SAMPLE_INTERVAL_MS) {
		const slot = time / SAMPLE_INTERVAL_MS;

		DUST_COLUMNS.forEach(({ size, kind }, index) => {
			const unit = unitRandom(sampleSeed, slot, index);
			const value = isDustyDay
				? unit * DUST_DUSTY_DAY_MAX
				: sampleQuantile(kind === "twa" ? DUST_CLEAN_TWA : DUST_CLEAN_STEL, unit) *
					DUST_CLEAN_SIZE_FACTOR[size][kind];

			row[index] = value * profile.mult + offset;
		});

		builder.addSample(time, row);
	}
}

function getSessionsPerMinute(time: number): number {
	const hourShare = VIBRATION_HOURLY_SHARE[new Date(time).getUTCHours()] ?? 0;
	return (VIBRATION_SESSIONS_PER_DAY * hourShare) / 60;
}

/** Tool connections arrive as a Poisson process; each is one row with a `ConnectedOn` time and an exposure value. */
function generateVibration(userId: string, day: DataDay, builder: BucketBuilder) {
	const profile = getUserProfile(userId).vibration;
	const minuteSeed = userSeed(userId, STREAM.vibrationMinute);
	const jitterSeed = userSeed(userId, STREAM.vibrationJitter);

	const row = new Float64Array(1);
	const firstMinute = Math.floor(day.start / MINUTE_MS) * MINUTE_MS;

	for (let minute = firstMinute; minute < day.end; minute += MINUTE_MS) {
		const minuteIndex = minute / MINUTE_MS;
		const sessions = samplePoisson(getSessionsPerMinute(minute), unitRandom(minuteSeed, minuteIndex, 0));

		// Connection times within the minute, in order
		const connectedOn = Array.from(
			{ length: sessions },
			(_, session) => minute + Math.floor(unitRandom(minuteSeed, minuteIndex, 1 + 2 * session) * MINUTE_MS),
		).sort((a, b) => a - b);

		connectedOn.forEach((time, session) => {
			if (time < day.start || time >= day.end) {
				return;
			}

			const points = sampleQuantile(VIBRATION_POINTS, unitRandom(minuteSeed, minuteIndex, 2 + 2 * session));
			// `random()` per row in seed.sql
			const jitter = unitRandom(jitterSeed, minuteIndex, session) * 2 * profile.jit - profile.jit;

			row[0] = points * profile.mult + jitter;
			builder.addSample(time, row);
		});
	}
}

const GENERATORS: Record<Exposure, (userId: string, day: DataDay, builder: BucketBuilder) => void> = {
	noise: generateNoise,
	dust: generateDust,
	vibration: generateVibration,
};

export function generateMinuteBuckets(exposure: Exposure, userId: string, day: DataDay): Array<Bucket> {
	const builder = new BucketBuilder(MINUTE_MS, VIEW_SOURCES[exposure].length);
	GENERATORS[exposure](userId, day, builder);
	return builder.buckets;
}
