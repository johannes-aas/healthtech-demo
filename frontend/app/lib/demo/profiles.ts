import { SEED_USER_IDS } from "./seed-data.ts";

/**
 * How exposed each operator typically is, so the team shows a realistic mix.
 *
 * DEMO DEVIATION: the seed (`seed_user_profile` in `backend/seed/seed.sql`) scales the sample data by random
 * multipliers, which together with the very loud/dusty sample data put people over the limit on about a third of all
 * days. Instead, each operator gets a hand-picked profile that shifts the day targets in `calibration.ts`.
 * The foreman (Ola) has no sensor data.
 */

export type UserProfile = {
	/** Added to the day's average noise level (dB). */
	noiseOffsetDb: number;
	/** Multiplies the day's average dust level. */
	dustFactor: number;
	/** Multiplies the day's total vibration exposure. */
	vibrationFactor: number;
	/** Multiplies the chance of a day with a peak above the peak limit value. */
	peakFactor: number;
};

const PROFILES: Record<string, UserProfile> = {
	// Welder: fumes, so the most dust; moderate noise and vibration
	[SEED_USER_IDS.kari]: { noiseOffsetDb: 0, dustFactor: 1.4, vibrationFactor: 0.9, peakFactor: 1 },
	// Grinding and hammering: the noisiest job
	[SEED_USER_IDS.per]: { noiseOffsetDb: 2.5, dustFactor: 0.9, vibrationFactor: 1.1, peakFactor: 1.5 },
	// Uses vibrating hand tools the most
	[SEED_USER_IDS.trond]: { noiseOffsetDb: 0, dustFactor: 1.1, vibrationFactor: 1.5, peakFactor: 1 },
	// Average across the board
	[SEED_USER_IDS.gjertrud]: { noiseOffsetDb: -1, dustFactor: 0.8, vibrationFactor: 1, peakFactor: 0.5 },
	// Mostly assembly and inspection: rarely above the action value
	[SEED_USER_IDS.klara]: { noiseOffsetDb: -4, dustFactor: 0.6, vibrationFactor: 0.6, peakFactor: 0 },
};

export function getUserProfile(userId: string): UserProfile | undefined {
	return PROFILES[userId];
}

export function hasSensorData(userId: string): boolean {
	return userId in PROFILES;
}
