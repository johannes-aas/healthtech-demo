import {
	dashboardCalendarAsideClassName,
	dashboardGridClassName,
	dashboardHeaderClassName,
	dashboardSideAsideClassName,
	mainPanelClassName,
	mainPanelSeparatorClassName,
} from "@/components/dashboard-layout.ts";
import { DatePickerCard } from "@/components/date-picker-card.tsx";
import { ExposureIcon } from "@/components/exposure-icon.tsx";
import { NotesCard } from "@/components/notes-card.tsx";
import { SelectionSubtitle } from "@/components/selection-subtitle.tsx";
import { Separator } from "@/components/ui/separator.tsx";
import { useDate } from "@/features/date-picker/use-date.ts";
import { ExposureToggle } from "@/features/exposure-picker/exposure-toggle.tsx";
import { LimitExplanation } from "@/features/sidebar/limit-explanation.tsx";
import { ExposureSummary } from "@/features/summary-card.tsx";
import { useView } from "@/features/views/use-view.ts";
import { ViewPicker } from "@/features/views/view-picker.tsx";
import { useCurrentSearchParams } from "@/hooks/use-current-search-params.ts";
import { toExposure } from "@/lib/exposures.ts";
import { useTranslation } from "react-i18next";
import { Outlet, useLocation, useNavigate } from "react-router";

export default function ExposureLayout() {
	const { date, setDate } = useDate();
	const { pathname } = useLocation();
	const searchParams = useCurrentSearchParams();
	const navigate = useNavigate();
	const { view } = useView();
	const { t } = useTranslation();

	// pathname is "/operator" or "/operator/<exposure>"
	const exposure = toExposure(pathname.split("/").at(-1) ?? "");

	return (
		<div
			className={dashboardGridClassName(
				"xl:grid-cols-[calc(var(--spacing)*73)_minmax(0,3fr)_minmax(calc(var(--spacing)*50),1fr)]",
			)}
		>
			<header className={dashboardHeaderClassName}>
				<ViewPicker className="w-full md:w-auto xl:w-73" />

				<ExposureToggle
					value={exposure}
					onValueChange={(value) =>
						navigate({
							pathname: value ? `/operator/${value}` : "/operator",
							search: searchParams.toString(),
						})
					}
				/>
			</header>

			<aside className={dashboardCalendarAsideClassName}>
				<DatePickerCard mode={view} showWeekNumber={true} date={date} onDateChange={setDate} />
			</aside>

			<section className={mainPanelClassName}>
				<div className="flex min-w-0 flex-col gap-3">
					<div className="flex min-w-0 items-center gap-2 md:gap-3">
						<ExposureIcon type={exposure ?? "all"} size="lg" className="shrink-0 border" />
						<h1 className="min-w-0 max-w-prose text-balance font-medium text-lg leading-tight md:text-2xl lg:text-3xl">
							{exposure
								? t(($) => $.operatorHeader.title.yourExposureExposure, {
										exposure: t(($) => $.exposures[exposure]).toLowerCase(),
									})
								: t(($) => $.operatorHeader.title.yourExposure)}
						</h1>
					</div>

					<SelectionSubtitle />

					<Separator className={mainPanelSeparatorClassName} />
				</div>

				<article className="flex min-w-0 flex-col gap-4">
					<ExposureSummary exposureType={exposure ?? "all"} />
					<Outlet />
				</article>
			</section>

			<aside className={dashboardSideAsideClassName}>
				<NotesCard />
				<LimitExplanation />
			</aside>
		</div>
	);
}
