import { createSequentialRandom, lerp } from "./random.ts";
import { UNSCALED_USER_ID, USERS_WITH_SENSOR_DATA } from "./seed-data.ts";

/**
 * Port of `seed_user_profile` in `backend/seed/seed.sql`.
 *
 * In the seed, every user except Kari gets the sample data scaled by a random multiplier plus a random offset:
 *
 *   value = sample * mult + (j * 2 * jit - jit)
 *
 * - Noise and dust use `CROSS JOIN LATERAL (SELECT random() AS j)`. That subquery doesn't reference the outer query,
 *   so Postgres evaluates it once per statement: `j` is a single value shared by every row (and every user), and the
 *   offset is effectively constant per user.
 * - Vibration calls `random()` directly in the select list, so it gets a new offset for every row.
 *
 * Kari is excluded from the profile table and keeps the original values.
 */

export type ExposureProfile = {
	mult: number;
	jit: number;
};

export type UserProfile = {
	noise: ExposureProfile;
	dust: ExposureProfile;
	vibration: ExposureProfile;
};

type SeedProfiles = {
	byUser: Map<string, UserProfile>;
	/** The single `j` used by the noise insert statement. */
	noiseJ: number;
	/** The single `j` used by the dust insert statement. */
	dustJ: number;
};

const UNSCALED_PROFILE: UserProfile = {
	noise: { mult: 1, jit: 0 },
	dust: { mult: 1, jit: 0 },
	vibration: { mult: 1, jit: 0 },
};

// Same insertion order as the VALUES list in seed.sql (Ola, Per, Trond, Gjertrud, Klara, Birgir, Torleif, Bjørnulf)
const PROFILED_USER_IDS = USERS_WITH_SENSOR_DATA.filter((id) => id !== UNSCALED_USER_ID);

// seed.sql: SELECT setseed(0.424242). We can't reproduce Postgres' random(), but we keep the same seed and draw order.
const PROFILE_SEED = "0.424242";

let seedProfiles: SeedProfiles | null = null;

function createSeedProfiles(): SeedProfiles {
	const random = createSequentialRandom(PROFILE_SEED);
	const byUser = new Map<string, UserProfile>();

	for (const userId of PROFILED_USER_IDS) {
		// Column order: mult_noise, jit_noise, mult_dust, jit_dust, mult_vib, jit_vib
		byUser.set(userId, {
			noise: { mult: lerp(0.85, 1.25, random()), jit: lerp(0.3, 1.5, random()) },
			dust: { mult: lerp(0.05, 0.3, random()), jit: lerp(0.02, 0.12, random()) },
			vibration: { mult: lerp(0.6, 2.2, random()), jit: lerp(0.1, 0.8, random()) },
		});
	}

	return { byUser, noiseJ: random(), dustJ: random() };
}

function getSeedProfiles(): SeedProfiles {
	seedProfiles ??= createSeedProfiles();
	return seedProfiles;
}

export function getUserProfile(userId: string): UserProfile {
	return getSeedProfiles().byUser.get(userId) ?? UNSCALED_PROFILE;
}

/** The constant offset `j * 2 * jit - jit` for noise or dust (see above). */
export function getConstantOffset(exposure: "noise" | "dust", profile: ExposureProfile): number {
	const { noiseJ, dustJ } = getSeedProfiles();
	const j = exposure === "noise" ? noiseJ : dustJ;
	return j * 2 * profile.jit - profile.jit;
}

export function hasSensorData(userId: string): boolean {
	return USERS_WITH_SENSOR_DATA.includes(userId);
}
