import { Button } from "@/components/ui/button.tsx";
import { TIMEZONE } from "@/i18n/locale.ts";
import { today } from "@/lib/date.ts";
import { cn } from "@/lib/utils.ts";
import type { TZDate } from "@date-fns/tz";
import { isAfter, isBefore, isEqual, isToday } from "date-fns";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useDate } from "./use-date.ts";

interface DateNavigationProps {
	className?: string;
	minDate?: TZDate;
	maxDate?: TZDate;
}

/**
 * Previous / today / next buttons that step the selected date by one unit of the current view.
 */
export function DateNavigation({ className, minDate, maxDate }: DateNavigationProps) {
	const { date, navigate, setDate } = useDate();
	const { t } = useTranslation();

	const previousTarget = minDate && isBefore(navigate.previousValue, minDate) ? minDate : navigate.previousValue;
	const nextTarget = maxDate && isAfter(navigate.nextValue, maxDate) ? maxDate : navigate.nextValue;

	const canNavigatePrevious = !isEqual(previousTarget, date);
	const canNavigateNext = !isEqual(nextTarget, date);

	const isTodayDate = isToday(date, { in: TIMEZONE });

	const previousString = t(($) => $.viewPicker.previous);
	const todayString = t(($) => $.viewPicker.today);
	const nextString = t(($) => $.viewPicker.next);

	return (
		<div className={cn("grid grid-cols-3 items-center gap-2", className)}>
			<Button
				title={previousString}
				size="xs"
				variant="ghost"
				className="px-1!"
				onClick={() => setDate(previousTarget)}
				disabled={!canNavigatePrevious}
			>
				<ChevronLeftIcon className="size-3.5 shrink-0" />
				<p className="truncate text-xs">{previousString}</p>
			</Button>

			<Button
				title={todayString}
				size="xs"
				variant="ghost"
				className="px-1!"
				onClick={() => setDate(today())}
				disabled={isTodayDate}
			>
				<p className="truncate text-xs">{todayString}</p>
			</Button>

			<Button
				title={nextString}
				size="xs"
				variant="ghost"
				className="px-1!"
				onClick={() => setDate(nextTarget)}
				disabled={!canNavigateNext}
			>
				<p className="truncate text-xs">{nextString}</p>
				<ChevronRightIcon className="size-3.5 shrink-0" />
			</Button>
		</div>
	);
}
