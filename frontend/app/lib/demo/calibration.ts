import type { QuantileTable } from "./random.ts";

/**
 * Shape of the generated sensor data.
 *
 * Two sources:
 * - Timing and the shape of the signals come from summary statistics of the sample CSVs that seeded the real database
 *   (no rows included): a sample every 30 seconds between 07:00 and 15:00 UTC, ~52 tool connections a day spread over
 *   the shift, and how exposure points per connection are distributed.
 *   To recompute those: `python3 -I frontend/app/lib/demo/scripts/sensor_data_stats.py <folder with the CSVs>`
 * - The *levels* are balanced by hand to look like a realistic workplace. The sample data is much more extreme
 *   (~30 % of days averaging 80-92 dB, ~43 % of days with dust far over the limit), so each day instead gets a target
 *   level drawn from the tables below, and the samples are generated around it.
 *
 * Targets for a typical operator (profile factors 1, see `profiles.ts`), as share of days below the action value /
 * between action and limit value / above the limit value: noise ~80/18/2 %, dust ~90/9/1 %, vibration ~70/28/2 %.
 */

export const SAMPLE_INTERVAL_MS = 30_000;
export const SHIFT_START_UTC_HOUR = 7;
export const SHIFT_END_UTC_HOUR = 15;

// --- Noise (dB) ---
// The day is a mix of quiet background and work bursts (grinding, hammering, ...) of a few minutes each. The share of
// time spent in bursts is chosen so the day's average LAEQ lands on the day's target.

/** Day average LAEQ (action value 80 dB, limit value 85 dB). */
export const NOISE_DAY_AVERAGE: QuantileTable = [
	[0, 62],
	[0.15, 67],
	[0.4, 72],
	[0.65, 76],
	[0.82, 80],
	[0.93, 82.5],
	[0.985, 85],
	[1, 87],
];

export const NOISE_BACKGROUND_RANGE = [50, 57] as const;
export const NOISE_BACKGROUND_SD = 3;
/** Typical level of a work burst; louder days get louder bursts (at least the day average + 3 dB). */
export const NOISE_BURST_LEVEL = 78;
export const NOISE_BURST_LEVEL_ABOVE_AVERAGE = 3;
/** Variation between bursts, and between samples within a burst. */
export const NOISE_BURST_SD = 3;
export const NOISE_SAMPLE_SD = 2;
/** Average burst length, in 30-second samples (8 minutes). */
export const NOISE_BURST_MEAN_SAMPLES = 16;

/** LCPK (C-weighted peak) sits above LAEQ. */
export const NOISE_LCPK_ABOVE_LAEQ = [8, 14] as const;
/** Short impacts during bursts: LAEQ jumps a few dB and LCPK reaches 108-127 dB. */
export const NOISE_IMPACT_SHARE = 0.015;
export const NOISE_IMPACT_LAEQ_INCREASE = [4, 12] as const;
export const NOISE_IMPACT_LCPK = [108, 127] as const;
/** Chance that a day has a single peak above the 130 dB peak limit value. */
export const NOISE_PEAK_LIMIT_DAY_SHARE = 0.02;
export const NOISE_PEAK_LIMIT_LCPK = [130, 133.5] as const;

// --- Dust (µg/m³) ---
// PM1 TWA hovers around the day's target, drifting from hour to hour. Larger particle sizes read a bit higher, and the
// short-term values (STEL) higher still.

/** Day average PM1 TWA (action value 7.5, limit value 15). */
export const DUST_DAY_AVERAGE: QuantileTable = [
	[0, 0.8],
	[0.25, 2],
	[0.5, 3.1],
	[0.75, 4.6],
	[0.9, 6.4],
	[0.96, 8.2],
	[0.99, 11.5],
	[1, 16],
];

export const DUST_HOUR_FACTOR = [0.75, 1.25] as const;
export const DUST_SAMPLE_FACTOR = [0.9, 1.1] as const;
/** Ratio to PM1 per particle size (TWA). */
export const DUST_SIZE_FACTOR = {
	pm1: [1, 1],
	pm25: [1.03, 1.1],
	pm4: [1.1, 1.22],
	pm10: [1.15, 1.35],
} as const;
/** Ratio of STEL to TWA. */
export const DUST_STEL_FACTOR = [1.6, 3] as const;

// --- Vibration (exposure points per tool connection) ---
// ~52 connections per day arriving at random (most of them mid-shift), each with an exposure drawn from the sample
// data's distribution, then scaled so the day adds up to the day's target total.

/** Day total exposure points (action value 100, limit value 400). */
export const VIBRATION_DAY_TOTAL: QuantileTable = [
	[0, 15],
	[0.2, 40],
	[0.5, 70],
	[0.7, 95],
	[0.85, 135],
	[0.95, 200],
	[0.99, 320],
	[1, 480],
];

export const VIBRATION_SESSIONS_PER_DAY = 52.5;

/** Share of the day's connections that start in each UTC hour of the shift. */
export const VIBRATION_HOURLY_SHARE: Record<number, number> = {
	7: 0.1071,
	8: 0.1517,
	9: 0.1818,
	10: 0.1751,
	11: 0.1507,
	12: 0.1195,
	13: 0.076,
	14: 0.0381,
};

/** Relative size of each connection's exposure (from the sample data, before scaling to the day total). */
export const VIBRATION_POINTS: QuantileTable = [
	[0, 0],
	[0.2147, 0],
	[0.25, 0.1935],
	[0.3, 0.4217],
	[0.35, 0.6603],
	[0.4, 0.873],
	[0.45, 1.094],
	[0.5, 1.283],
	[0.55, 1.48],
	[0.6, 1.678],
	[0.65, 1.875],
	[0.7, 2.071],
	[0.75, 2.263],
	[0.8, 2.488],
	[0.85, 2.773],
	[0.9, 3.188],
	[0.92, 7.669],
	[0.94, 14.74],
	[0.95, 18.24],
	[0.96, 21.53],
	[0.97, 25.71],
	[0.98, 50.38],
	[0.99, 68.63],
	[1, 68.63],
];
