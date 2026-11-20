import { TIMEZONE } from "@/i18n/locale.ts";
import { startOfMonth, subMonths } from "date-fns";

/**
 * The demo data set starts at the beginning of the month two months ago (in Norwegian time), so the two previous
 * months are complete in the month view, and runs until the current minute.
 */
export function getDataStart(nowMs: number = Date.now()): Date {
	return new Date(startOfMonth(subMonths(nowMs, 2, { in: TIMEZONE }), { in: TIMEZONE }).getTime());
}
