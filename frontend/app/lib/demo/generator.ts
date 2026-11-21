import type { Exposure } from "@/features/exposure-picker/exposures.ts";
import { type Bucket, BucketBuilder, VIEW_SOURCES } from "./buckets.ts";
import {
	DUST_DAY_AVERAGE,
	DUST_HOUR_FACTOR,
	DUST_SAMPLE_FACTOR,
	DUST_SIZE_FACTOR,
	DUST_STEL_FACTOR,
	NOISE_BACKGROUND_RANGE,
	NOISE_BACKGROUND_SD,
	NOISE_BURST_LEVEL,
	NOISE_BURST_LEVEL_ABOVE_AVERAGE,
	NOISE_BURST_MEAN_SAMPLES,
	NOISE_BURST_SD,
	NOISE_DAY_AVERAGE,
	NOISE_IMPACT_LAEQ_INCREASE,
	NOISE_IMPACT_LCPK,
	NOISE_IMPACT_SHARE,
	NOISE_LCPK_ABOVE_LAEQ,
	NOISE_PEAK_LIMIT_DAY_SHARE,
	NOISE_PEAK_LIMIT_LCPK,
	NOISE_SAMPLE_SD,
	SAMPLE_INTERVAL_MS,
	SHIFT_END_UTC_HOUR,
	SHIFT_START_UTC_HOUR,
	VIBRATION_DAY_TOTAL,
	VIBRATION_HOURLY_SHARE,
	VIBRATION_POINTS,
	VIBRATION_SESSIONS_PER_DAY,
} from "./calibration.ts";
import { getUserProfile, type UserProfile } from "./profiles.ts";
import { hashString, lerp, normal, samplePoisson, sampleQuantile, unitRandom } from "./random.ts";
import type { DataDay } from "./time.ts";

/**
 * Generates the raw sensor rows (like the `NoiseData`, `DustData` and `VibrationData` tables) for one user and one day,
 * and returns them aggregated into minute buckets.
 *
 * Each day first gets a target level per exposure (`calibration.ts`, shifted by the user's profile), then the samples
 * are generated around it. Randomness is seeded by user, date and sample slot, and a day is always generated from the
 * start of the shift, so the same timestamp always gets the same value (also while "today" is still growing).
 */

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const SHIFT_MS = (SHIFT_END_UTC_HOUR - SHIFT_START_UTC_HOUR) * HOUR_MS;

// Stream IDs, so different quantities of the same user/slot get independent random numbers
const STREAM = {
	noiseDay: 1,
	noiseSample: 2,
	dustDay: 3,
	dustSample: 4,
	vibrationDay: 5,
	vibrationMinute: 6,
} as const;

function userSeed(userId: string, stream: number): number {
	return hashString(`${userId}#${stream}`);
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Quiet background with work bursts of a few minutes, mixed so the day's average lands on the day's target. */
function generateNoise(userId: string, profile: UserProfile, day: DataDay, builder: BucketBuilder) {
	const daySeed = userSeed(userId, STREAM.noiseDay);
	const sampleSeed = userSeed(userId, STREAM.noiseSample);
	const dayUnit = (k: number) => unitRandom(daySeed, day.dayNumber, k);

	const dayAverage = sampleQuantile(NOISE_DAY_AVERAGE, dayUnit(0)) + profile.noiseOffsetDb;
	const background = lerp(...NOISE_BACKGROUND_RANGE, dayUnit(1));
	const burstLevel = Math.max(NOISE_BURST_LEVEL, dayAverage + NOISE_BURST_LEVEL_ABOVE_AVERAGE);
	const burstShare = clamp((dayAverage - background) / (burstLevel - background), 0.03, 0.97);

	// Two-state Markov chain whose long-run share of burst time is `burstShare`
	const stopChance = 1 / NOISE_BURST_MEAN_SAMPLES;
	const startChance = Math.min(1, (burstShare * stopChance) / (1 - burstShare));

	const hasPeakLimitSample = dayUnit(2) < NOISE_PEAK_LIMIT_DAY_SHARE * profile.peakFactor;
	const peakLimitIndex = Math.floor(dayUnit(3) * (SHIFT_MS / SAMPLE_INTERVAL_MS));

	const row = new Float64Array(2); // [LCPK, LAEQ]
	let inBurst = dayUnit(4) < burstShare;
	let burstCenter = burstLevel + NOISE_BURST_SD * normal(dayUnit(5), dayUnit(6));

	for (let time = day.start, index = 0; time < day.end; time += SAMPLE_INTERVAL_MS, index++) {
		const slot = time / SAMPLE_INTERVAL_MS;
		const unit = (k: number) => unitRandom(sampleSeed, slot, k);

		if (index > 0) {
			const wasInBurst = inBurst;
			inBurst = wasInBurst ? unit(0) >= stopChance : unit(0) < startChance;

			if (inBurst && !wasInBurst) {
				burstCenter = burstLevel + NOISE_BURST_SD * normal(unit(1), unit(2));
			}
		}

		let laeq = inBurst
			? burstCenter + NOISE_SAMPLE_SD * normal(unit(3), unit(4))
			: background + NOISE_BACKGROUND_SD * normal(unit(3), unit(4));
		let lcpk = laeq + lerp(...NOISE_LCPK_ABOVE_LAEQ, unit(5));

		if (inBurst && unit(6) < NOISE_IMPACT_SHARE) {
			laeq += lerp(...NOISE_IMPACT_LAEQ_INCREASE, unit(7));
			lcpk = Math.max(lcpk, lerp(...NOISE_IMPACT_LCPK, unit(8)));
		}

		if (hasPeakLimitSample && index === peakLimitIndex) {
			laeq += lerp(...NOISE_IMPACT_LAEQ_INCREASE, unit(7));
			lcpk = lerp(...NOISE_PEAK_LIMIT_LCPK, unit(8));
		}

		row[0] = lcpk;
		row[1] = laeq;
		builder.addSample(time, row);
	}
}

// Same order as VIEW_SOURCES.dust
const DUST_SIZES = ["pm1", "pm25", "pm4", "pm10"] as const;

/** PM1 TWA drifts around the day's target from hour to hour; other sizes and STEL are derived from it. */
function generateDust(userId: string, profile: UserProfile, day: DataDay, builder: BucketBuilder) {
	const sampleSeed = userSeed(userId, STREAM.dustSample);
	const dayAverage =
		sampleQuantile(DUST_DAY_AVERAGE, unitRandom(userSeed(userId, STREAM.dustDay), day.dayNumber, 0)) *
		profile.dustFactor;

	const row = new Float64Array(DUST_SIZES.length * 2); // [PM1S, PM25S, PM4S, PM10S, PM1T, PM25T, PM4T, PM10T]

	for (let time = day.start; time < day.end; time += SAMPLE_INTERVAL_MS) {
		const slot = time / SAMPLE_INTERVAL_MS;
		const unit = (k: number) => unitRandom(sampleSeed, slot, k);

		const hourFactor = lerp(...DUST_HOUR_FACTOR, unitRandom(sampleSeed, Math.floor(time / HOUR_MS), 100));
		const pm1 = dayAverage * hourFactor * lerp(...DUST_SAMPLE_FACTOR, unit(0));

		DUST_SIZES.forEach((size, index) => {
			const [minFactor, maxFactor] = DUST_SIZE_FACTOR[size];
			const twa = pm1 * lerp(minFactor, maxFactor, unit(1 + index));
			row[DUST_SIZES.length + index] = twa;
			row[index] = twa * lerp(...DUST_STEL_FACTOR, unit(5 + index));
		});

		builder.addSample(time, row);
	}
}

function getSessionsPerMinute(time: number): number {
	const hourShare = VIBRATION_HOURLY_SHARE[new Date(time).getUTCHours()] ?? 0;
	return (VIBRATION_SESSIONS_PER_DAY * hourShare) / 60;
}

/**
 * Tool connections arrive as a Poisson process over the whole shift; each is one row with a `ConnectedOn` time and an
 * exposure value, scaled so the full shift adds up to the day's target. Only connections before `day.end` are kept.
 */
function generateVibration(userId: string, profile: UserProfile, day: DataDay, builder: BucketBuilder) {
	const minuteSeed = userSeed(userId, STREAM.vibrationMinute);
	const dayTotal =
		sampleQuantile(VIBRATION_DAY_TOTAL, unitRandom(userSeed(userId, STREAM.vibrationDay), day.dayNumber, 0)) *
		profile.vibrationFactor;

	const sessions: Array<{ time: number; points: number }> = [];

	for (let minute = day.start; minute < day.start + SHIFT_MS; minute += MINUTE_MS) {
		const minuteIndex = minute / MINUTE_MS;
		const count = samplePoisson(getSessionsPerMinute(minute), unitRandom(minuteSeed, minuteIndex, 0));

		for (let session = 0; session < count; session++) {
			sessions.push({
				time: minute + Math.floor(unitRandom(minuteSeed, minuteIndex, 1 + 2 * session) * MINUTE_MS),
				points: sampleQuantile(VIBRATION_POINTS, unitRandom(minuteSeed, minuteIndex, 2 + 2 * session)),
			});
		}
	}

	const rawTotal = sessions.reduce((sum, session) => sum + session.points, 0);
	const scale = rawTotal > 0 ? dayTotal / rawTotal : 0;
	const row = new Float64Array(1);

	for (const session of sessions.sort((a, b) => a.time - b.time)) {
		if (session.time < day.end) {
			row[0] = session.points * scale;
			builder.addSample(session.time, row);
		}
	}
}

const GENERATORS: Record<
	Exposure,
	(userId: string, profile: UserProfile, day: DataDay, builder: BucketBuilder) => void
> = {
	noise: generateNoise,
	dust: generateDust,
	vibration: generateVibration,
};

export function generateMinuteBuckets(exposure: Exposure, userId: string, day: DataDay): Array<Bucket> {
	const builder = new BucketBuilder(MINUTE_MS, VIEW_SOURCES[exposure].length);
	const profile = getUserProfile(userId);

	if (profile) {
		GENERATORS[exposure](userId, profile, day, builder);
	}

	return builder.buckets;
}
