import { TIMEZONE_NAME } from "@/i18n/locale.ts";
import { TZDate } from "@date-fns/tz";
import { addDays, isWeekend, startOfDay, startOfMonth, subMonths } from "date-fns";
import { SAMPLE_INTERVAL_MS, SHIFT_END_UTC_HOUR, SHIFT_START_UTC_HOUR } from "./calibration.ts";

/**
 * Which days have sensor data, and when.
 *
 * - The data set starts at the beginning of the month two months ago (Norwegian time), so the two previous months are
 *   complete in the month view.
 * - Past days: weekdays only, during the normal shift (07:00-15:00 UTC, like the sample data).
 * - Today: always has data up to the current time, also on weekends and in the evening. Normally from the start of
 *   the shift; before the shift has been going for an hour (e.g. at night), from midnight instead, so "live" and
 *   "today" never look empty.
 */

const HOUR_MS = 60 * 60_000;
const DAY_MS = 24 * HOUR_MS;

/** Before the normal shift has been running for this long, today's data starts at midnight instead. */
const TODAY_SHIFT_GRACE_MS = HOUR_MS;

export type DataDay = {
	/** Calendar date in Norway, `yyyy-MM-dd`. */
	key: string;
	/** Days since 1970-01-01 for the calendar date, used as a seed. */
	dayNumber: number;
	/** First sample time (inclusive, ms). */
	start: number;
	/** Last sample time (exclusive, ms). */
	end: number;
	isToday: boolean;
};

export function getDataStart(nowMs: number = Date.now()): number {
	return startOfMonth(subMonths(new TZDate(nowMs, TIMEZONE_NAME), 2)).getTime();
}

function floorTo(value: number, interval: number): number {
	return Math.floor(value / interval) * interval;
}

function toDataDay(day: TZDate, todayStartMs: number, nowMs: number): DataDay | null {
	const isToday = day.getTime() === todayStartMs;

	if (!isToday && isWeekend(day)) {
		return null;
	}

	const year = day.getFullYear();
	const month = day.getMonth();
	const date = day.getDate();
	const dayNumber = Date.UTC(year, month, date) / DAY_MS;
	const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(date).padStart(2, "0")}`;

	const shiftStart = Date.UTC(year, month, date, SHIFT_START_UTC_HOUR);
	const shiftEnd = Date.UTC(year, month, date, SHIFT_END_UTC_HOUR);

	if (!isToday) {
		return { key, dayNumber, start: shiftStart, end: shiftEnd, isToday };
	}

	const start = nowMs >= shiftStart + TODAY_SHIFT_GRACE_MS ? shiftStart : day.getTime();
	// Include the sample slot that `now` falls in
	const end = floorTo(nowMs, SAMPLE_INTERVAL_MS) + SAMPLE_INTERVAL_MS;

	return { key, dayNumber, start, end, isToday };
}

/** Days with data that may have samples within `[fromMs, toMs]`. */
export function getDataDays(fromMs: number, toMs: number, nowMs: number): Array<DataDay> {
	const first = Math.max(fromMs, getDataStart(nowMs));
	const last = Math.min(toMs, nowMs);

	if (first > last) {
		return [];
	}

	const todayStartMs = startOfDay(new TZDate(nowMs, TIMEZONE_NAME)).getTime();
	const days: Array<DataDay> = [];

	for (let day = startOfDay(new TZDate(first, TIMEZONE_NAME)); day.getTime() <= last; day = addDays(day, 1)) {
		const dataDay = toDataDay(day, todayStartMs, nowMs);

		if (dataDay && dataDay.start < dataDay.end && dataDay.start <= last && dataDay.end > first) {
			days.push(dataDay);
		}
	}

	return days;
}
