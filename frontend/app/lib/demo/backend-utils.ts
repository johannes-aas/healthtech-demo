import type { Exposure } from "@/features/exposure-picker/exposures.ts";
import { DANGER_LEVEL_SEVERITY, type DangerLevel } from "@/lib/danger-levels.ts";
import type { ExposureTypeField } from "@/lib/dto/exposure.ts";
import type { UserRole } from "@/lib/dto/user.ts";
import { getThreshold } from "@/lib/thresholds.ts";

/**
 * Ports of the small helpers in `backend/src/Utils`: AuthorizationUtils, TimeWindowUtils and ThresholdUtils.
 * The threshold values themselves are identical in `backend/src/Models/Threshold.cs` and `lib/thresholds.ts`, so we
 * reuse the frontend's copy.
 */

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60_000;

/** `AuthorizationUtils.ClampRequestStartDateForRole`: foremen can only see data for the past 7 days. */
export function clampRequestStartDateForRole(startMs: number, role: UserRole | undefined, nowMs: number): number {
	if (role === "foreman") {
		const sevenDaysAgo = nowMs - SEVEN_DAYS_MS;
		if (startMs < sevenDaysAgo) {
			return sevenDaysAgo;
		}
	}

	return startMs;
}

/** `TimeWindowUtils.ClampRequestEndDateToCurrentDateTime` */
export function clampRequestEndDateToCurrentDateTime(endMs: number, nowMs: number): number {
	return endMs > nowMs ? nowMs : endMs;
}

export type DangerLevels = {
	dangerLevel: DangerLevel;
	peakDangerLevel: DangerLevel | null;
};

/** `ThresholdUtils.CalculateDangerLevel` */
export function calculateDangerLevel(
	exposure: Exposure,
	value: number,
	maxValue: number | null,
	field?: ExposureTypeField | null,
): DangerLevels {
	const threshold = getThreshold(exposure, field);

	let dangerLevel: DangerLevel = "safe";
	let peakDangerLevel: DangerLevel | null = null;

	if (threshold.peakDanger !== null && maxValue !== null) {
		peakDangerLevel = maxValue >= threshold.peakDanger ? "danger" : "safe";
	}

	if (value >= threshold.danger) {
		dangerLevel = "danger";
	} else if (value >= threshold.warning) {
		dangerLevel = "warning";
	}

	return { dangerLevel, peakDangerLevel };
}

/** `ThresholdUtils.GetHighestDangerLevel`: missing levels are ignored, and the result is at least "safe". */
export function getHighestDangerLevel(...levels: Array<DangerLevel | null | undefined>): DangerLevel {
	let worst: DangerLevel = "safe";

	for (const level of levels) {
		if (level && DANGER_LEVEL_SEVERITY[level] > DANGER_LEVEL_SEVERITY[worst]) {
			worst = level;
		}
	}

	return worst;
}

/** C#'s `DateOnly.FromDateTime` on a UTC `DateTime`: the UTC calendar date, as a comparable number. */
export function toUtcDateNumber(timeMs: number): number {
	return Math.floor(timeMs / (24 * 60 * 60_000));
}
