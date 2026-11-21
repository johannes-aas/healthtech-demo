import { Badge } from "@/components/ui/badge.tsx";
import { useDate } from "@/features/date-picker/use-date.ts";
import { useView } from "@/features/views/use-view.ts";
import { useFormatDate } from "@/hooks/use-format-date.ts";
import type { TranslateFn } from "@/i18n/config.ts";
import { TIMEZONE } from "@/i18n/locale.ts";
import { today } from "@/lib/date.ts";
import { capitalize, cn } from "@/lib/utils.ts";
import type { View } from "@/lib/views.ts";
import type { TZDate } from "@date-fns/tz";
import { getISOWeek, isSameMonth, isSameYear, isToday, isYesterday } from "date-fns";
import { useTranslation } from "react-i18next";

type FormatDateFn = ReturnType<typeof useFormatDate>;

interface SelectionSubtitleProps {
	className?: string;
}

/**
 * A single line describing the selected period, e.g. "Today, Sat, Nov 21", "Week 47 · Nov 16–22" or "November 2026".
 */
export function SelectionSubtitle({ className }: SelectionSubtitleProps) {
	const { t, i18n } = useTranslation();
	const { view } = useView();
	const { selection } = useDate();
	const formatDate = useFormatDate();

	const label = getSelectionLabel(t, view, selection, formatDate, i18n.language === "en");

	return (
		<Badge
			variant="secondary"
			className={cn(
				"gap-1.5 border-border bg-card px-2.5 py-1 font-normal text-muted-foreground text-sm dark:border-transparent dark:bg-secondary",
				className,
			)}
		>
			{label}
		</Badge>
	);
}

function getSelectionLabel(
	t: TranslateFn,
	view: View,
	selection: { start: TZDate; end: TZDate },
	formatDate: FormatDateFn,
	isEn: boolean,
) {
	const { start, end } = selection;
	const isCurrentYear = isSameYear(start, today(), { in: TIMEZONE });

	if (view === "month") {
		return capitalize(formatDate(start, "LLLL yyyy"));
	}

	if (view === "week") {
		return t(($) => $.operatorHeader.subtitle.week, {
			week: getISOWeek(start, { in: TIMEZONE }),
			range: formatWeekRange(start, end, formatDate, isEn, isCurrentYear),
		});
	}

	// Day view: weekday and date, with the year only when it isn't the current one
	const dayFormat = isEn
		? isCurrentYear
			? "EEE, MMM d"
			: "EEE, MMM d, yyyy"
		: isCurrentYear
			? "EEE d. MMM"
			: "EEE d. MMM yyyy";
	const date = formatDate(start, dayFormat);

	if (isToday(start, { in: TIMEZONE })) {
		return t(($) => $.operatorHeader.subtitle.today, { date });
	}

	if (isYesterday(start, { in: TIMEZONE })) {
		return t(($) => $.operatorHeader.subtitle.yesterday, { date });
	}

	return capitalize(date);
}

/**
 * Compact date range for a week, only repeating the month and year when they change:
 * "Nov 16–22", "Nov 30 – Dec 6", "Dec 29, 2025 – Jan 4, 2026".
 */
function formatWeekRange(start: TZDate, end: TZDate, formatDate: FormatDateFn, isEn: boolean, isCurrentYear: boolean) {
	if (!isSameYear(start, end, { in: TIMEZONE })) {
		const format = isEn ? "MMM d, yyyy" : "d. MMM yyyy";

		return `${formatDate(start, format)} – ${formatDate(end, format)}`;
	}

	const yearSuffix = isCurrentYear ? "" : isEn ? ", yyyy" : " yyyy";

	if (isSameMonth(start, end, { in: TIMEZONE })) {
		return isEn
			? `${formatDate(start, "MMM d")}–${formatDate(end, `d${yearSuffix}`)}`
			: `${formatDate(start, "d.")}–${formatDate(end, `d. MMM${yearSuffix}`)}`;
	}

	return isEn
		? `${formatDate(start, "MMM d")} – ${formatDate(end, `MMM d${yearSuffix}`)}`
		: `${formatDate(start, "d. MMM")} – ${formatDate(end, `d. MMM${yearSuffix}`)}`;
}
