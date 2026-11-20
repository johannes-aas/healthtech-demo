import type { Exposure } from "@/features/exposure-picker/exposures.ts";
import type { GranularityKey } from "@/lib/dto/exposure.ts";
import { type Bucket, BucketBuilder, type ColumnStats, GRANULARITY_MS, VIEW_SOURCES } from "./buckets.ts";
import { generateMinuteBuckets } from "./generator.ts";
import { hasSensorData } from "./profiles.ts";
import { type DataDay, getDataDays } from "./time.ts";

/**
 * Emulates the TimescaleDB materialized views from `backend/src/Migrations/*_AddMaterializedViews.cs`:
 * `{noise,vibration,dust}_data_{minutely,hourly,daily}`, grouped by `time_bucket(interval, time)` and user, with
 * AVG/SUM/MIN/MAX per source column and `sample_count`.
 *
 * Buckets are UTC-aligned like `time_bucket` (so a "day" bucket starts at 00:00 UTC). Data is generated lazily per
 * user and day, kept as minute buckets, and rolled up into hour/day buckets on demand. Since every bucket keeps
 * count/sum/min/max, rolling up gives exactly the same result as aggregating the raw samples.
 */

export type ViewRow = {
	time: number;
	userId: string;
	bucket: Bucket;
};

// --- Column names ---

type ColumnReader = (bucket: Bucket) => number;

const AGGREGATES = {
	avg: (stats: ColumnStats, count: number) => stats.sum / count,
	sum: (stats: ColumnStats) => stats.sum,
	min: (stats: ColumnStats) => stats.min,
	max: (stats: ColumnStats) => stats.max,
} as const;

function buildColumnReaders(exposure: Exposure): Map<string, ColumnReader> {
	const readers = new Map<string, ColumnReader>();
	readers.set("sample_count", (bucket) => bucket.count);

	VIEW_SOURCES[exposure].forEach((source, index) => {
		for (const [fn, aggregate] of Object.entries(AGGREGATES)) {
			const name = source ? `${fn}_${exposure}_${source}` : `${fn}_${exposure}`;
			readers.set(name, (bucket) => aggregate(bucket.stats[index], bucket.count));
		}
	});

	return readers;
}

const columnReaders: Record<Exposure, Map<string, ColumnReader>> = {
	noise: buildColumnReaders("noise"),
	vibration: buildColumnReaders("vibration"),
	dust: buildColumnReaders("dust"),
};

/** Reads a column (e.g. `avg_noise_laeq`, `sum_vibration`, `max_dust_pm1_twa`). Returns null if the view has no such column. */
export function getColumnReader(exposure: Exposure, columnName: string): ColumnReader | null {
	// Postgres folds unquoted identifiers to lower case
	return columnReaders[exposure].get(columnName.toLowerCase()) ?? null;
}

function rollUp(buckets: Array<Bucket>, granularity: GranularityKey, sourceCount: number): Array<Bucket> {
	const builder = new BucketBuilder(GRANULARITY_MS[granularity], sourceCount);

	for (const bucket of buckets) {
		builder.addBucket(bucket);
	}

	return builder.buckets;
}

// --- Lazy per-day cache ---

type DayCacheEntry = {
	start: number;
	end: number;
	byGranularity: Partial<Record<GranularityKey, Array<Bucket>>>;
};

const dayCache = new Map<string, DayCacheEntry>();

function getDayBuckets(exposure: Exposure, userId: string, day: DataDay, granularity: GranularityKey): Array<Bucket> {
	const key = `${exposure}|${userId}|${day.key}`;
	let entry = dayCache.get(key);

	// Today's window grows over time, so regenerate when it changes
	if (entry?.start !== day.start || entry.end !== day.end) {
		entry = {
			start: day.start,
			end: day.end,
			byGranularity: { minute: generateMinuteBuckets(exposure, userId, day) },
		};
		dayCache.set(key, entry);
	}

	let buckets = entry.byGranularity[granularity];

	if (!buckets) {
		buckets = rollUp(entry.byGranularity.minute ?? [], granularity, VIEW_SOURCES[exposure].length);
		entry.byGranularity[granularity] = buckets;
	}

	return buckets;
}

/**
 * `SELECT ... FROM {exposure}_data_{granularity} WHERE bucket >= start AND bucket <= end AND user_id = ANY(userIds)`,
 * ordered by bucket.
 */
export function queryView({
	exposure,
	granularity,
	userIds,
	startMs,
	endMs,
	nowMs,
}: {
	exposure: Exposure;
	granularity: GranularityKey;
	userIds: Array<string>;
	startMs: number;
	endMs: number;
	nowMs: number;
}): Array<ViewRow> {
	if (startMs > endMs) {
		return [];
	}

	const intervalMs = GRANULARITY_MS[granularity];
	// A bucket that starts within [start, end] can contain samples until `end + interval`
	const days = getDataDays(startMs, endMs + intervalMs, nowMs);
	const rows: Array<ViewRow> = [];

	for (const userId of userIds) {
		if (!hasSensorData(userId)) {
			continue;
		}

		// Usually one bucket per day, but a bucket can span two data days (e.g. a UTC day bucket around midnight)
		const builder = new BucketBuilder(intervalMs, VIEW_SOURCES[exposure].length);

		for (const day of days) {
			for (const bucket of getDayBuckets(exposure, userId, day, granularity)) {
				if (bucket.time >= startMs && bucket.time <= endMs) {
					builder.addBucket(bucket);
				}
			}
		}

		for (const bucket of builder.buckets) {
			rows.push({ time: bucket.time, userId, bucket });
		}
	}

	return rows.sort((a, b) => a.time - b.time);
}
