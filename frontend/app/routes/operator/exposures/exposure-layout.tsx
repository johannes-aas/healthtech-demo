import { DatePicker } from "@/components/date-picker.tsx";
import { ExposureIcon } from "@/components/exposure-icon.tsx";
import { NotesCard } from "@/components/notes-card.tsx";
import { SelectionSubtitle } from "@/components/selection-subtitle.tsx";
import { Separator } from "@/components/ui/separator.tsx";
import { DateNavigation } from "@/features/date-picker/date-navigation.tsx";
import { useDate } from "@/features/date-picker/use-date.ts";
import { ExposureToggle } from "@/features/exposure-picker/exposure-toggle.tsx";
import { LimitExplanation } from "@/features/sidebar/limit-explanation.tsx";
import { ExposureSummary } from "@/features/summary-card.tsx";
import { useView } from "@/features/views/use-view.ts";
import { ViewPicker } from "@/features/views/view-picker.tsx";
import { useCurrentSearchParams } from "@/hooks/use-current-search-params.ts";
import { toExposure } from "@/lib/exposures.ts";
import { Card, CardLabelHeader } from "@/ui/card.tsx";
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
		// Fills the viewport height and cancels the layout's bottom margin so the main panel reaches the bottom edge
		<div
			className="-mb-5 grid w-full flex-1 gap-6"
			style={{
				// 73 comes from w-65 on DatePicker's Calendar + p-4 on its outer div (so 8 spacings for both sides)
				gridTemplateColumns: "calc(var(--spacing) * 73) minmax(0, 3fr) minmax(calc(var(--spacing) * 50), 1fr)",
				gridTemplateRows: "auto 1fr",
			}}
		>
			<header className="col-span-3 row-start-1 flex min-w-0 flex-wrap items-center gap-x-6 gap-y-3">
				<ViewPicker className="w-73" />

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

			<aside className="col-start-1 row-start-2 flex flex-col gap-4">
				<Card muted={true} variant="labeled">
					<CardLabelHeader className="px-2 py-1.5">
						<DateNavigation className="w-full" />
					</CardLabelHeader>
					<div className="p-4">
						<DatePicker mode={view} showWeekNumber={true} date={date} onDateChange={setDate} />
					</div>
				</Card>
			</aside>

			<section className="col-start-2 row-start-2 flex min-w-0 flex-col gap-4 rounded-t-2xl border border-border border-b-0 bg-surface p-6 dark:border-border/40">
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

					{/* Negative inline margin stretches the divider across the section's padding to its borders */}
					<Separator className="-mx-6 mt-1 data-[orientation=horizontal]:w-auto dark:bg-border/40" />
				</div>

				<article className="flex min-w-0 flex-col gap-4">
					<ExposureSummary exposureType={exposure ?? "all"} />
					<Outlet />
				</article>
			</section>

			<aside className="col-start-3 row-start-2 flex flex-col gap-4">
				<NotesCard />
				<LimitExplanation />
			</aside>
		</div>
	);
}
