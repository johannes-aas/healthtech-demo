import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group.tsx";
import { cn } from "@/lib/utils.ts";
import { useTranslation } from "react-i18next";
import { useView } from "./use-view.ts";
import type { View } from "./utils.ts";
import { DayViewIcon, MonthViewIcon, WeekViewIcon } from "./views.ts";

interface ViewPickerProps {
	className?: string;
	allowedViews?: Array<View>;
}

export function ViewPicker({ className, allowedViews }: ViewPickerProps) {
	const { view, setView } = useView();
	const { t } = useTranslation();
	const views = allowedViews ?? ["day", "week", "month"];

	return (
		<ToggleGroup
			type="single"
			value={view}
			variant="outline"
			className={cn("inline-grid shrink-0 auto-cols-fr grid-flow-col rounded-xl", className)}
			onValueChange={(value: View) => {
				// Value is an empty string when clicking the already selected item, so we need this check to avoid
				// deselecting.
				if (value) {
					setView(value);
				}
			}}
		>
			{views.includes("day") && (
				<ToggleGroupItem
					value="day"
					aria-label={t(($) => $.views.day)}
					className="px-2 first:rounded-l-xl! last:rounded-r-xl! lg:px-3"
				>
					<DayViewIcon className="size-4" />
					<p className="text-sm">{t(($) => $.views.day)}</p>
				</ToggleGroupItem>
			)}

			{views.includes("week") && (
				<ToggleGroupItem
					value="week"
					aria-label={t(($) => $.views.week)}
					className="px-2 first:rounded-l-xl! last:rounded-r-xl! lg:px-3"
				>
					<WeekViewIcon className="size-4" />
					<p className="text-sm">{t(($) => $.views.week)}</p>
				</ToggleGroupItem>
			)}

			{views.includes("month") && (
				<ToggleGroupItem
					value="month"
					aria-label={t(($) => $.views.month)}
					className="px-2 first:rounded-l-xl! last:rounded-r-xl! lg:px-3"
				>
					<MonthViewIcon className="size-4" />
					<p className="text-sm">{t(($) => $.views.month)}</p>
				</ToggleGroupItem>
			)}
		</ToggleGroup>
	);
}
