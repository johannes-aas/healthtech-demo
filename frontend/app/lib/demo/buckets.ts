import type { Exposure } from "@/features/exposure-picker/exposures.ts";
import type { ExposureTypeField, GranularityKey } from "@/lib/dto/exposure.ts";

/**
 * Aggregated sensor rows, shared by the generator (`generator.ts`) and the materialized view emulation (`views.ts`).
 */

export type ColumnStats = { sum: number; min: number; max: number };

export type Bucket = {
	time: number;
	count: number;
	/** One entry per source column of the view, see `VIEW_SOURCES`. */
	stats: Array<ColumnStats>;
};

const DUST_FIELDS: ReadonlyArray<ExposureTypeField> = [
	"pm1_stel",
	"pm25_stel",
	"pm4_stel",
	"pm10_stel",
	"pm1_twa",
	"pm25_twa",
	"pm4_twa",
	"pm10_twa",
];

/**
 * Source columns per view, in the order the generator writes them.
 * Noise: LCPK, LAEQ. Vibration: Exposure. Dust: PM1S, PM25S, PM4S, PM10S, PM1T, PM25T, PM4T, PM10T.
 */
export const VIEW_SOURCES: Record<Exposure, ReadonlyArray<string>> = {
	noise: ["lcpk", "laeq"],
	vibration: [""],
	dust: DUST_FIELDS,
};

export const GRANULARITY_MS: Record<GranularityKey, number> = {
	minute: 60_000,
	hour: 60 * 60_000,
	day: 24 * 60 * 60_000,
};

/** Accumulates samples into fixed-size UTC-aligned buckets. Samples must be added in time order. */
export class BucketBuilder {
	readonly buckets: Array<Bucket> = [];
	private readonly intervalMs: number;
	private readonly sourceCount: number;
	private current: Bucket | null = null;

	constructor(intervalMs: number, sourceCount: number) {
		this.intervalMs = intervalMs;
		this.sourceCount = sourceCount;
	}

	private getBucket(time: number): Bucket {
		const bucketTime = Math.floor(time / this.intervalMs) * this.intervalMs;

		if (this.current?.time !== bucketTime) {
			this.current = {
				time: bucketTime,
				count: 0,
				stats: Array.from({ length: this.sourceCount }, () => ({
					sum: 0,
					min: Number.POSITIVE_INFINITY,
					max: Number.NEGATIVE_INFINITY,
				})),
			};
			this.buckets.push(this.current);
		}

		return this.current;
	}

	/** Adds one raw row (one value per source column). */
	addSample(time: number, values: ArrayLike<number>) {
		const bucket = this.getBucket(time);
		bucket.count++;

		for (let index = 0; index < this.sourceCount; index++) {
			const stats = bucket.stats[index];
			const value = values[index];
			stats.sum += value;
			stats.min = Math.min(stats.min, value);
			stats.max = Math.max(stats.max, value);
		}
	}

	/** Adds an already aggregated bucket (for rolling up minute buckets into hours/days). */
	addBucket(source: Bucket) {
		const bucket = this.getBucket(source.time);
		bucket.count += source.count;

		for (let index = 0; index < this.sourceCount; index++) {
			const stats = bucket.stats[index];
			const sourceStats = source.stats[index];
			stats.sum += sourceStats.sum;
			stats.min = Math.min(stats.min, sourceStats.min);
			stats.max = Math.max(stats.max, sourceStats.max);
		}
	}
}
