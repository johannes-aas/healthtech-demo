import type { Exposure } from "@/features/exposure-picker/exposures.ts";
import {
	calculateDangerLevel,
	clampRequestEndDateToCurrentDateTime,
	clampRequestStartDateForRole,
	type DangerLevels,
	getHighestDangerLevel,
	toUtcDateNumber,
} from "./backend-utils.ts";
import type { ExposureContext } from "./exposure-service.ts";
import type { UserExposureStatusDto, UserStatusDto } from "./user-service.ts";
import { getColumnReader, queryView } from "./views.ts";

/**
 * Port of `backend/src/Services/UserStatusService.cs`.
 *
 * Aggregates the minutely views over the whole time range per user:
 * - noise: AVG(avg_noise_laeq) and MAX(max_noise_lcpk)
 * - dust: AVG(max_dust_pm1_twa)
 * - vibration: the highest daily total in the range (see below)
 *
 * DEMO DEVIATION: the backend uses SUM(sum_vibration) over the whole range and compares it with the *daily* thresholds,
 * so in the week view five ordinary days add up to "above the limit value" for almost everyone. The demo uses the
 * highest single-day total instead (days split at midnight UTC, like the cumulative vibration values), so a week shows
 * its worst day, consistent with the day view.
 */

type UserAggRow = { value: number; maxValue: number | null };

type Aggregate = "avg" | "highestDailySum";

function aggregateMinutely({
	exposure,
	valueColumn,
	valueAggregate,
	maxColumn,
	userIds,
	startMs,
	endMs,
	nowMs,
}: {
	exposure: Exposure;
	valueColumn: string;
	valueAggregate: Aggregate;
	maxColumn: string | null;
	userIds: Array<string>;
	startMs: number;
	endMs: number;
	nowMs: number;
}): Map<string, UserAggRow> {
	const readValue = getColumnReader(exposure, valueColumn);
	const readMax = maxColumn ? getColumnReader(exposure, maxColumn) : null;

	if (!readValue) {
		throw new Error(`Unknown column ${valueColumn}`);
	}

	const totals = new Map<
		string,
		{ sum: number; count: number; max: number | null; dailySums: Map<number, number> }
	>();

	// WHERE bucket BETWEEN start AND end AND user_id = ANY(ids) GROUP BY user_id
	for (const { userId, bucket } of queryView({ exposure, granularity: "minute", userIds, startMs, endMs, nowMs })) {
		const total = totals.get(userId) ?? { sum: 0, count: 0, max: null, dailySums: new Map() };
		const value = readValue(bucket);
		const date = toUtcDateNumber(bucket.time);
		total.sum += value;
		total.count++;
		total.dailySums.set(date, (total.dailySums.get(date) ?? 0) + value);

		if (readMax) {
			const max = readMax(bucket);
			total.max = total.max === null ? max : Math.max(total.max, max);
		}

		totals.set(userId, total);
	}

	return new Map(
		[...totals].map(([userId, total]) => [
			userId,
			{
				value: valueAggregate === "avg" ? total.sum / total.count : Math.max(...total.dailySums.values()),
				maxValue: total.max,
			},
		]),
	);
}

/** `TryLevel`: no rows means no level. */
function tryLevel(exposure: Exposure, row: UserAggRow | undefined): Partial<DangerLevels> {
	if (!row) {
		return {};
	}

	return calculateDangerLevel(exposure, row.value, row.maxValue);
}

function toExposureStatus(levels: Partial<DangerLevels>, row: UserAggRow | undefined): UserExposureStatusDto | null {
	if (!levels.dangerLevel) {
		return null;
	}

	return {
		dangerLevel: levels.dangerLevel,
		peakDangerLevel: levels.peakDangerLevel ?? null,
		value: row?.value ?? 0,
		peakValue: row?.maxValue ?? null,
	};
}

/** `GetStatusForUsersInRange` */
export function getStatusForUsersInRange(
	userIds: Array<string>,
	startMs: number,
	endMs: number,
	context: ExposureContext,
): Array<UserStatusDto> {
	const ids = [...new Set(userIds)];

	if (ids.length === 0) {
		return [];
	}

	const range = {
		userIds: ids,
		startMs: clampRequestStartDateForRole(startMs, context.signedInRole, context.nowMs),
		endMs: clampRequestEndDateToCurrentDateTime(endMs, context.nowMs),
		nowMs: context.nowMs,
	};

	const noiseByUser = aggregateMinutely({
		...range,
		exposure: "noise",
		valueColumn: "avg_noise_laeq",
		valueAggregate: "avg",
		maxColumn: "max_noise_lcpk",
	});
	const dustByUser = aggregateMinutely({
		...range,
		exposure: "dust",
		valueColumn: "max_dust_pm1_twa",
		valueAggregate: "avg",
		maxColumn: null,
	});
	const vibrationByUser = aggregateMinutely({
		...range,
		exposure: "vibration",
		valueColumn: "sum_vibration",
		valueAggregate: "highestDailySum",
		maxColumn: null,
	});

	return ids.map((userId) => {
		const noiseRow = noiseByUser.get(userId);
		const dustRow = dustByUser.get(userId);
		const vibrationRow = vibrationByUser.get(userId);

		// The dust/vibration rows have `null as MaxValue`, so they never get a peak level
		const noiseLevel = tryLevel("noise", noiseRow);
		const dustLevel = tryLevel("dust", dustRow && { value: dustRow.value, maxValue: null });
		const vibrationLevel = tryLevel("vibration", vibrationRow && { value: vibrationRow.value, maxValue: null });

		// Peak danger level is its own separate thing and isn't part of the overall users' status
		const overall = getHighestDangerLevel(
			noiseLevel.dangerLevel,
			dustLevel.dangerLevel,
			vibrationLevel.dangerLevel,
		);

		return {
			userId,
			status: overall,
			noise: toExposureStatus(noiseLevel, noiseRow),
			dust: toExposureStatus(dustLevel, dustRow),
			vibration: toExposureStatus(vibrationLevel, vibrationRow),
		};
	});
}
