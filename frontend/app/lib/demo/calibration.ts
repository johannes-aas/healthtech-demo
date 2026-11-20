import type { QuantileTable } from "./random.ts";

/**
 * Shape of the generated sensor data.
 *
 * All numbers are summary statistics (percentiles, shares and rates) computed from the sample CSVs that were used to
 * seed the real database (NoiseData.csv, DustData.csv, VibrationData.csv). No rows from those files are included.
 * In the CSVs, samples come every 30 seconds between 07:00 and 15:00 UTC, which is also what we generate.
 *
 * To recompute them: `python3 -I frontend/app/lib/demo/scripts/sensor_data_stats.py <folder with the CSVs>`
 */

export const SAMPLE_INTERVAL_MS = 30_000;
export const SHIFT_START_UTC_HOUR = 7;
export const SHIFT_END_UTC_HOUR = 15;

// --- Noise (dB) ---
// Days are either "quiet" or "loud". On quiet days LAEQ varies a lot from sample to sample (close to independent);
// on loud days LAEQ sits flat (±1 dB) at a level between ~80 and ~92 dB. LCPK follows the quiet pattern on all days,
// about 1.6 dB above it. On average ~1.7 % of samples are short peaks up to ~130 dB.

export const NOISE_LOUD_DAY_SHARE = 0.3;

export const NOISE_LOUD_DAY_LEVEL: QuantileTable = [
	[0, 80.65],
	[0.1, 81.09],
	[0.25, 82.87],
	[0.5, 84.08],
	[0.6, 86.26],
	[0.75, 88.09],
	[0.9, 90.96],
	[1, 92],
];

export const NOISE_LOUD_DAY_DEVIATION = 1;

export const NOISE_QUIET_LAEQ: QuantileTable = [
	[0, 41.39],
	[0.02, 46.64],
	[0.05, 47.49],
	[0.1, 48.32],
	[0.15, 48.93],
	[0.2, 49.47],
	[0.25, 50.01],
	[0.3, 50.7],
	[0.35, 51.76],
	[0.4, 53.43],
	[0.45, 55.61],
	[0.5, 57.98],
	[0.55, 60.52],
	[0.6, 63.18],
	[0.65, 66.04],
	[0.7, 69.15],
	[0.75, 72.29],
	[0.8, 74.78],
	[0.85, 77.09],
	[0.9, 80.17],
	[0.95, 82.9],
	[0.98, 85.43],
	[1, 92],
];

/** LCPK minus LAEQ on quiet days. */
export const NOISE_LCPK_OFFSET: QuantileTable = [
	[0, 0.75],
	[0.1, 1.087],
	[0.25, 1.384],
	[0.5, 1.645],
	[0.75, 1.798],
	[0.9, 1.9],
	[1, 2.05],
];

export const NOISE_PEAK_SHARE = 0.017;

export const NOISE_PEAK_LAEQ: QuantileTable = [
	[0, 100],
	[0.05, 116.4],
	[0.1, 118.1],
	[0.25, 123.8],
	[0.4, 128.6],
	[0.45, 130],
	[1, 130],
];

/** LCPK peaks almost always top out at 129 dB; a few reach 129.5-130 (≥130 dB is the peak limit value). */
export const NOISE_PEAK_LCPK_CAP = 129;
export const NOISE_PEAK_LCPK_HIGH_SHARE = 0.0166;
export const NOISE_PEAK_LCPK_HIGH_RANGE = [129.5, 130.1] as const;
export const NOISE_PEAK_LCPK_MAX = 130;

// --- Dust (µg/m³) ---
// Days are either "clean" or "dusty". Every field is drawn independently per sample.
// Dusty days: all fields roughly uniform between 0 and 40. Clean days: TWA mostly below ~8, STEL between ~6 and ~69.

export const DUST_DUSTY_DAY_SHARE = 0.43;
export const DUST_DUSTY_DAY_MAX = 40;

export const DUST_CLEAN_TWA: QuantileTable = [
	[0, 0.67],
	[0.05, 0.72],
	[0.1, 0.87],
	[0.25, 1.66],
	[0.5, 4.54],
	[0.75, 7.15],
	[0.9, 7.96],
	[0.95, 8.09],
	[1, 8.16],
];

export const DUST_CLEAN_STEL: QuantileTable = [
	[0, 5.69],
	[0.05, 6.1],
	[0.1, 6.75],
	[0.25, 9.96],
	[0.5, 38.84],
	[0.75, 64.16],
	[0.9, 68.06],
	[0.95, 68.68],
	[1, 69.1],
];

/** Larger particle sizes read a bit higher on clean days (99th percentile per size, relative to PM1). */
export const DUST_CLEAN_SIZE_FACTOR = {
	pm1: { twa: 1, stel: 1 },
	pm25: { twa: 1.07, stel: 1.07 },
	pm4: { twa: 1.19, stel: 1.21 },
	pm10: { twa: 1.22, stel: 1.26 },
} as const;

// --- Vibration (exposure points per tool connection) ---
// ~52 connections per day, with exponentially distributed gaps (median ~5.5 minutes), most of them mid-shift.
// A connection's exposure is often small or zero, with a long tail up to ~69 points; a day sums to ~190 on average.

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
