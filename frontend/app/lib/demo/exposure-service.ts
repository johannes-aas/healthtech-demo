import type { Exposure } from "@/features/exposure-picker/exposures.ts";
import { DANGER_LEVEL_SEVERITY, type DangerLevel } from "@/lib/danger-levels.ts";
import type { AggregateFnKey, ExposureTypeField, GranularityKey } from "@/lib/dto/exposure.ts";
import type { UserRole } from "@/lib/dto/user.ts";
import {
	calculateDangerLevel,
	clampRequestEndDateToCurrentDateTime,
	clampRequestStartDateForRole,
	type DangerLevels,
	toUtcDateNumber,
} from "./backend-utils.ts";
import { internalServerError } from "./http.ts";
import { getColumnReader, queryView } from "./views.ts";

/**
 * Port of `backend/src/Services/ExposureDataService.cs` and `backend/src/Utils/ExposureUtils.cs`.
 */

/** `ExposureDataRequestDto`, with times as epoch milliseconds. */
export type ExposureRequest = {
	startMs: number;
	endMs: number;
	granularity: GranularityKey;
	function: AggregateFnKey;
	field: ExposureTypeField | null;
};

export type ExposureContext = {
	/** Role of the signed-in user (`SignedInUserContext`), used for the foreman time restriction. */
	signedInRole: UserRole | undefined;
	nowMs: number;
};

/** `ExposureDataDto` */
export type ExposureData = {
	time: number;
	value: number;
	peakValue: number | null;
	dangerLevel: DangerLevel;
	peakDangerLevel: DangerLevel | null;
};

/** `CombinedExposureBucketDto` */
export type CombinedExposureBucket = {
	time: number;
	dangerLevel: DangerLevel;
	exposureDangerLevels: Partial<Record<Exposure, DangerLevel>>;
};

/** `HourDomainDto` */
export type HourDomain = {
	minHourUtc: number;
	maxHourUtc: number;
};

/** `RawExposureData` */
type RawExposureData = {
	time: number;
	value: number;
	avgValue: number;
	maxValue: number;
	sumValue: number;
	userId: string;
};

/** `ExposureUtils.GetAggregateColumnName`. Can produce names that don't exist in the view (e.g. `sample_count_laeq`). */
function getAggregateColumnName(fn: AggregateFnKey, exposure: Exposure, field: ExposureTypeField | null): string {
	// Noise uses laeq for average and lcpk for max
	if (exposure === "noise") {
		if (fn === "avg") {
			return "avg_noise_laeq";
		}
		if (fn === "max") {
			return "max_noise_lcpk";
		}
	}

	let columnName = fn === "count" ? "sample_count" : `${fn}_${exposure}`;

	if (field !== null) {
		columnName += `_${field}`;
	}

	if (exposure === "noise") {
		columnName += fn === "max" ? "_lcpk" : "_laeq";
	}

	return columnName;
}

function getRequiredColumnReader(exposure: Exposure, columnName: string) {
	const reader = getColumnReader(exposure, columnName);

	if (!reader) {
		// In the backend this is a Postgres error (column does not exist), which ends up as a 500
		throw internalServerError();
	}

	return reader;
}

/** `ExposureUtils.CumulateVibrationSumValues`: summed vibration values accumulate over each (UTC) day. */
function cumulateVibrationSumValues(
	exposure: Exposure,
	fn: AggregateFnKey,
	rawData: Array<RawExposureData>,
): Array<RawExposureData> {
	if (exposure !== "vibration" || fn !== "sum") {
		return rawData;
	}

	let cumulativeValue = 0;
	let currentDate: number | null = null;

	return [...rawData]
		.sort((a, b) => a.time - b.time)
		.map((data) => {
			const date = toUtcDateNumber(data.time);
			if (currentDate !== date) {
				cumulativeValue = 0;
				currentDate = date;
			}

			cumulativeValue += data.value;
			return { ...data, value: cumulativeValue };
		});
}

/** `ThresholdUtils.CalculateDangerLevels` */
function calculateDangerLevels(
	exposure: Exposure,
	rawData: Array<RawExposureData>,
	field: ExposureTypeField | null,
): Array<{ data: RawExposureData; dangerLevels: DangerLevels }> {
	// Vibration thresholds are calculated from the cumulative (UTC) daily sum, whatever the requested function
	if (exposure === "vibration") {
		let cumulativeValue = 0;
		let currentDate: number | null = null;

		return [...rawData]
			.sort((a, b) => a.time - b.time)
			.map((data) => {
				const date = toUtcDateNumber(data.time);
				if (currentDate !== date) {
					cumulativeValue = 0;
					currentDate = date;
				}

				cumulativeValue += data.sumValue;
				return { data, dangerLevels: calculateDangerLevel(exposure, cumulativeValue, null, field) };
			});
	}

	return rawData.map((data) => {
		// We only use max value for noise thresholds to calculate peak danger levels
		const maxValue = exposure === "noise" ? data.maxValue : null;
		return { data, dangerLevels: calculateDangerLevel(exposure, data.avgValue, maxValue, field) };
	});
}

/** `GetAggregatedDataAsync` */
export function getAggregatedData(
	request: ExposureRequest,
	userId: string,
	exposure: Exposure,
	context: ExposureContext,
): Array<ExposureData> {
	const readValue = getRequiredColumnReader(
		exposure,
		getAggregateColumnName(request.function, exposure, request.field),
	);
	const readAvg = getRequiredColumnReader(exposure, getAggregateColumnName("avg", exposure, request.field));
	const readMax = getRequiredColumnReader(exposure, getAggregateColumnName("max", exposure, request.field));
	const readSum = getRequiredColumnReader(exposure, getAggregateColumnName("sum", exposure, request.field));

	const startMs = clampRequestStartDateForRole(request.startMs, context.signedInRole, context.nowMs);
	const endMs = clampRequestEndDateToCurrentDateTime(request.endMs, context.nowMs);

	const rawExposureData: Array<RawExposureData> = queryView({
		exposure,
		granularity: request.granularity,
		userIds: [userId],
		startMs,
		endMs,
		nowMs: context.nowMs,
	}).map(({ time, userId: rowUserId, bucket }) => ({
		time,
		value: readValue(bucket),
		avgValue: readAvg(bucket),
		maxValue: readMax(bucket),
		sumValue: readSum(bucket),
		userId: rowUserId,
	}));

	const dataWithCumulatedSumValues = cumulateVibrationSumValues(exposure, request.function, rawExposureData);
	const dataWithDangerLevels = calculateDangerLevels(exposure, dataWithCumulatedSumValues, request.field);

	return dataWithDangerLevels.map(({ data, dangerLevels }) => ({
		time: data.time,
		value: data.value,
		peakValue: exposure === "noise" ? data.maxValue : null,
		dangerLevel: dangerLevels.dangerLevel,
		peakDangerLevel: dangerLevels.peakDangerLevel,
	}));
}

/** `GetOverviewDataAsync`: combines the requested exposures into buckets with the highest danger level per bucket. */
export function getOverviewData(
	requests: Array<[Exposure, ExposureRequest]>,
	userId: string,
	context: ExposureContext,
): Array<CombinedExposureBucket> {
	const combinedData = new Map<number, CombinedExposureBucket>();

	for (const [exposure, request] of requests) {
		for (const exposureData of getAggregatedData(request, userId, exposure, context)) {
			let bucket = combinedData.get(exposureData.time);

			if (!bucket) {
				bucket = {
					time: exposureData.time,
					dangerLevel: exposureData.dangerLevel,
					exposureDangerLevels: {},
				};
				combinedData.set(exposureData.time, bucket);
			}

			bucket.exposureDangerLevels[exposure] = exposureData.dangerLevel;
			bucket.dangerLevel = getHigherDangerLevel(bucket.dangerLevel, exposureData.dangerLevel);
		}
	}

	return [...combinedData.values()].sort((a, b) => a.time - b.time);
}

function getHigherDangerLevel(a: DangerLevel, b: DangerLevel): DangerLevel {
	return DANGER_LEVEL_SEVERITY[b] > DANGER_LEVEL_SEVERITY[a] ? b : a;
}

/**
 * `GetHourDomainForWeekAsync`.
 *
 * Despite the name (and the unused week start/end in the C#), this uses the requested (clamped) time range with hourly
 * granularity.
 */
export function getHourDomainForWeek(
	requests: Array<[Exposure, ExposureRequest]>,
	userId: string,
	context: ExposureContext,
): HourDomain {
	const timestamps = new Set<number>();

	for (const [exposure, request] of requests) {
		const weekRequest: ExposureRequest = {
			...request,
			startMs: clampRequestStartDateForRole(request.startMs, context.signedInRole, context.nowMs),
			endMs: clampRequestEndDateToCurrentDateTime(request.endMs, context.nowMs),
			granularity: "hour",
		};

		for (const dataPoint of getAggregatedData(weekRequest, userId, exposure, context)) {
			timestamps.add(dataPoint.time);
		}
	}

	return getHourDomain([...timestamps]);
}

/**
 * DEMO DEVIATION: the backend returns the UTC hour of the earliest and of the latest timestamp
 * (`timestamps.Min().Hour`, `timestamps.Max().Hour`). With data up to the current time that cuts off the current
 * week during the day (e.g. at 10:00 the latest timestamp is today 09:00, hiding earlier days' afternoons), and at night
 * it can even give min > max. We use the lowest and highest hour across all timestamps instead.
 */
function getHourDomain(timestamps: Array<number>): HourDomain {
	if (timestamps.length === 0) {
		return { minHourUtc: 0, maxHourUtc: 23 };
	}

	const hours = timestamps.map((time) => new Date(time).getUTCHours());

	return { minHourUtc: Math.min(...hours), maxHourUtc: Math.max(...hours) };
}
