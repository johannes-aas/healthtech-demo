import { DatePicker } from "@/components/date-picker.tsx";
import { ExposureIcon } from "@/components/exposure-icon.tsx";
import { NotesCard } from "@/components/notes-card.tsx";
import { OperatorExposureStatusTable } from "@/components/operator-exposure-status-table.tsx";
import { SelectionSubtitle } from "@/components/selection-subtitle.tsx";
import { Card, CardLabelHeader } from "@/components/ui/card.tsx";
import { Separator } from "@/components/ui/separator.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { UserStatusChart } from "@/components/users-status-chart.tsx";
import { AttentionCard } from "@/features/attention-card/attention-card.tsx";
import { PieChartCard } from "@/features/attention-card/pie-chart-card.tsx";
import { DateNavigation } from "@/features/date-picker/date-navigation.tsx";
import { useDate } from "@/features/date-picker/use-date.ts";
import { ExposureToggle } from "@/features/exposure-picker/exposure-toggle.tsx";
import { LimitExplanation } from "@/features/sidebar/limit-explanation.tsx";
import { TeamSummary } from "@/features/sidebar/team-summary.tsx";
import { useUser } from "@/features/user/user-context.tsx";
import { UserSelect } from "@/features/user/user-select.tsx";
import { useView } from "@/features/views/use-view.ts";
import { ViewPicker } from "@/features/views/view-picker.tsx";
import { useCurrentSearchParams } from "@/hooks/use-current-search-params.ts";
import type { TranslateFn } from "@/i18n/config.ts";
import { fetchSubordinatesQueryOptions, fetchThresholdSummaryQueryOptions } from "@/lib/api.ts";
import { today } from "@/lib/date.ts";
import type { ThresholdSummary } from "@/lib/dto/threshold.ts";
import type { User } from "@/lib/dto/user.ts";
import { type Exposure, exposures, parseAsExposure } from "@/lib/exposures.ts";
import { useQuery } from "@tanstack/react-query";
import { subDays } from "date-fns";
import { parseAsString, useQueryState } from "nuqs";
import { useTranslation } from "react-i18next";
import { UserDetails } from "./user-details.tsx";

export default function ForemanOverview() {
	const { t } = useTranslation();
	const { user } = useUser();

	const [exposure, setExposure] = useQueryState("exposure", parseAsExposure.withOptions({ history: "push" }));
	const {
		date,
		setDate,
		selection: { start: startDate, end: endDate },
	} = useDate();
	const [selectedUserId, setSelectedUserId] = useQueryState("userId", parseAsString.withOptions({ history: "push" }));

	const { view } = useView();
	const isWeekly = view === "week";

	// Foremen can only see dates within the last week
	const minSelectableDate = subDays(today(), 7);
	const maxSelectableDate = today();

	const { data: users } = useQuery(fetchSubordinatesQueryOptions(user.id));
	const {
		data: subordinates,
		isLoading: isSubordinatesLoading,
		error: subordinatesError,
	} = useQuery(fetchSubordinatesQueryOptions(user.id, startDate, endDate));
	const { data: thresholdSummary, isLoading: isThresholdSummaryLoading } = useQuery(
		fetchThresholdSummaryQueryOptions(user.id, startDate, endDate),
	);

	const selectedUser = users?.find((subordinate) => subordinate.id === selectedUserId);
	const subordinateCount = subordinates?.length ?? 0;
	const isUserSelected = selectedUser !== undefined;

	const title = resolveForemanOverviewTitle(t, exposure, selectedUser);

	return (
		// Fills the viewport height and cancels the layout's bottom margin so the main panel reaches the bottom edge
		<div className="-mb-5 flex flex-1 flex-col gap-6">
			<header className="flex w-full min-w-0 flex-col gap-4">
				<div className="flex min-w-0 flex-wrap items-center gap-x-6 gap-y-3">
					<ViewPicker allowedViews={["day", "week"]} className="w-73" />

					<ExposureToggle value={exposure} onValueChange={setExposure} />

					{users === undefined || isSubordinatesLoading ? (
						<Skeleton className="h-9 w-73" />
					) : (
						<div className="w-73 min-w-0">
							<UserSelect
								users={users}
								value={selectedUserId}
								onValueChange={setSelectedUserId}
								placeholder={t(($) => $.foremanDashboard.overview.selectUserPlaceholder)}
							/>
						</div>
					)}
				</div>
			</header>

			<div className="flex w-full flex-1 flex-row gap-6">
				<div
					className="grid w-full gap-6"
					style={{
						gridTemplateColumns: "calc(var(--spacing) * 73) minmax(0, 3fr)",
					}}
				>
					<aside className="flex flex-col gap-4">
						<Card muted={true} variant="labeled">
							<CardLabelHeader className="px-2 py-1.5">
								<DateNavigation
									className="w-full"
									minDate={minSelectableDate}
									maxDate={maxSelectableDate}
								/>
							</CardLabelHeader>

							<div className="p-4">
								<DatePicker
									mode={view}
									showWeekNumber={true}
									date={date}
									onDateChange={setDate}
									disabled={{
										before: minSelectableDate,
										after: maxSelectableDate,
									}}
									pagedNavigation={false}
									hideNavigation={true}
									disableNavigation={true}
									captionLayout="label"
								/>
							</div>
						</Card>
					</aside>

					<section className="flex min-w-0 flex-col gap-4 rounded-t-2xl border border-border border-b-0 bg-surface p-6 dark:border-border/40">
						<div className="flex min-w-0 flex-col gap-3">
							<div className="flex min-w-0 items-center gap-2 md:gap-3">
								<ExposureIcon type={exposure ?? "all"} size="lg" className="shrink-0 border" />
								<h1 className="min-w-0 max-w-prose text-balance font-medium text-lg leading-tight md:text-2xl lg:text-3xl">
									{title}
								</h1>
								<SelectionSubtitle className="shrink-0" />
							</div>

							{/* Negative inline margin stretches the divider across the section's padding to its borders */}
							<Separator className="-mx-6 mt-1 data-[orientation=horizontal]:w-auto dark:bg-border/40" />
						</div>

						<article className="flex min-w-0 flex-col gap-8">
							{/* TODO: Redo the loading logic here */}
							{isUserSelected ? (
								<UserDetails selectedUser={selectedUser} exposure={exposure} />
							) : (
								<>
									<AttentionCard
										subordinates={subordinates ?? []}
										isSubordinatesLoading={isSubordinatesLoading}
										thresholdSummary={thresholdSummary}
										isThresholdSummaryLoading={isThresholdSummaryLoading}
									/>

									{exposure ? (
										<UserStatusChart
											users={subordinates ?? []}
											exposure={exposure}
											isWeekly={isWeekly}
											userOnClick={(id) => setSelectedUserId(id)}
										/>
									) : (
										<>
											<ExposureSummaryGrid thresholdSummary={thresholdSummary} />

											<div className="flex flex-col gap-2">
												<h2 className="font-medium text-lg">
													{t(($) => $.foremanDashboard.team.title)}
												</h2>
												{isSubordinatesLoading ? (
													<div className="p-4">{t(($) => $.common.loading)}</div>
												) : subordinatesError ? (
													<div className="p-4 text-destructive">
														{t(($) => $.foremanDashboard.team.failedToLoadMembers)}
													</div>
												) : !subordinates || subordinates.length === 0 ? (
													<div className="p-4">
														{t(($) => $.foremanDashboard.team.noMembersFound)}
													</div>
												) : (
													<div className="rounded-md bg-card">
														<OperatorExposureStatusTable data={subordinates} />
													</div>
												)}
											</div>
										</>
									)}
								</>
							)}
						</article>
					</section>
				</div>

				<aside className="flex flex-col gap-4 md:w-1/5">
					<TeamSummary subordinateCount={subordinateCount} />
					<NotesCard />
					<LimitExplanation />
				</aside>
			</div>
		</div>
	);
}

function ExposureSummaryGrid({ thresholdSummary }: { thresholdSummary: ThresholdSummary | undefined }) {
	const { t } = useTranslation();
	const searchParams = useCurrentSearchParams();

	if (thresholdSummary === undefined) {
		return null;
	}

	return (
		<div className="flex flex-col gap-2">
			<h2 className="font-medium text-lg">{t(($) => $.foremanDashboard.overview.exposure)}</h2>
			<div className="grid w-full grid-cols-1 gap-4 lg:grid-cols-3">
				{exposures.map((exposureType) => {
					// Keep the current query params (date, view, ...) so the selected period is preserved
					const exposureSearchParams = new URLSearchParams(searchParams);
					exposureSearchParams.set("exposure", exposureType);

					return (
						<PieChartCard
							data={{
								safe: thresholdSummary[exposureType].safe,
								warning: thresholdSummary[exposureType].warning,
								danger: thresholdSummary[exposureType].danger,
							}}
							label={t(($) => $.exposures[exposureType])}
							to={`?${exposureSearchParams.toString()}`}
							key={exposureType}
							exposureType={exposureType}
						/>
					);
				})}
			</div>
		</div>
	);
}

function resolveForemanOverviewTitle(t: TranslateFn, exposure: Exposure | null, selectedUser: User | undefined) {
	const exposureTitle = exposure
		? t(($) => $.exposures[exposure]).toLowerCase()
		: t(($) => $.operatorHeader.subtitle.allExposureTypes).toLowerCase();

	if (selectedUser) {
		if (exposure === null) {
			return t(($) => $.foremanDashboard.overview.title.allForUser, {
				exposure: exposureTitle,
				name: selectedUser.name,
			});
		}

		return t(($) => $.foremanDashboard.overview.title.exposureForUser, {
			exposure: exposureTitle,
			name: selectedUser.name,
		});
	}

	if (exposure === null) {
		return t(($) => $.foremanDashboard.overview.title.all, {
			exposure: exposureTitle,
		});
	}

	return t(($) => $.foremanDashboard.overview.title.exposure, {
		exposure: exposureTitle,
	});
}
