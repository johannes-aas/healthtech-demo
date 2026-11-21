import { DangerLevelDots } from "@/components/danger-level-dots.tsx";
import { Card, CardHeader } from "@/components/ui/card.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { useDate } from "@/features/date-picker/use-date.ts";
import type { Exposure } from "@/features/exposure-picker/exposures.ts";
import { useUser } from "@/features/user/user-context.tsx";
import { useView } from "@/features/views/use-view.ts";
import { getLocale } from "@/i18n/locale.ts";
import { exposureOverviewQueryOptions, exposureQueryOptions } from "@/lib/api.ts";
import { type DangerLevel, dangerlevelStyles } from "@/lib/danger-levels.ts";
import { type Aggregation, Aggregations } from "@/lib/dto/exposure.ts";
import { buildExposureOverviewQuery, buildExposureQuery } from "@/lib/exposure-query-utils.ts";
import { defaultDustField, exposures, parseAsDustField } from "@/lib/exposures.ts";
import { calculateSummaryCounts } from "@/lib/time-bucket-utils.ts";
import { cn } from "@/lib/utils.ts";
import { useQueries } from "@tanstack/react-query";
import { formatDuration, hoursToMinutes, type Locale, minutesToHours } from "date-fns";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { useTranslation } from "react-i18next";

type ExposureType = Exposure | "all";

interface ExposureSummaryProps {
	exposureType: ExposureType;
}

export function ExposureSummary({ exposureType }: ExposureSummaryProps) {
	const { t, i18n } = useTranslation();
	const { view } = useView();
	const currentDate = useDate().date;
	const { user } = useUser();
	const locale = getLocale(i18n.language);

	const parseAsAggregation = parseAsStringLiteral(Aggregations);
	const [aggregation] = useQueryState<Aggregation>("aggregation", parseAsAggregation.withDefault("average"));
	const [dustField] = useQueryState("dustField", parseAsDustField.withDefault(defaultDustField));

	const peakAggregation = aggregation === "peak";

	const exposure = exposureType === "all" ? null : (exposureType as Exposure);

	// Because vibration data is cumulative and has few data points, we never fetch it with minute granularity
	// TODO: When we take vibration disconnectedOn into account we could fetch it with minute granularity for the day
	// view as well
	const granularity = exposure === "vibration" ? "hour" : "minute";

	const exposureQuery =
		exposure &&
		buildExposureQuery(exposure, view, currentDate, {
			usePeakAggregation: peakAggregation,
			granularity,
			field: exposure === "dust" ? dustField : undefined,
		});
	const exposureQueryEnabled = exposure !== null && exposureQuery !== null;

	const [exposureResponse, allExposuresResponse] = useQueries({
		queries: [
			exposureQueryOptions({
				exposure: exposure as NonNullable<typeof exposure>,
				query: exposureQuery as NonNullable<typeof exposureQuery>,
				enabled: exposureQueryEnabled,
				userId: user.id,
			}),
			exposureOverviewQueryOptions({
				query: buildExposureOverviewQuery([...exposures], view, currentDate, {
					usePeakAggregation: peakAggregation,
					granularity,
				}),
				userId: user.id,
				enabled: !exposureQueryEnabled,
			}),
		],
	});

	const response = exposure === null ? allExposuresResponse : exposureResponse;

	const data = response.data
		? calculateSummaryCounts(response.data.data, {
				exposure,
				peakAggregation,
				granularity,
			})
		: null;

	if (data === null) {
		return <SummaryCardSkeleton />;
	}

	return (
		<div className="grid @sm:grid-cols-3 grid-cols-1 gap-3">
			<SummaryStatCard
				label={t(($) => $.exposureSummary.aggregated.safe)}
				dangerLevel="safe"
				minutes={data.safeMinutes}
				locale={locale}
			/>
			<SummaryStatCard
				label={t(($) => $.exposureSummary.aggregated.warning)}
				dangerLevel="warning"
				minutes={data.warningMinutes}
				locale={locale}
			/>
			<SummaryStatCard
				label={t(($) => $.exposureSummary.aggregated.danger)}
				dangerLevel="danger"
				minutes={data.dangerMinutes}
				locale={locale}
			/>
		</div>
	);
}

interface SummaryStatCardProps {
	label: string;
	dangerLevel: DangerLevel;
	minutes: number;
	locale: Locale;
}

/** Time spent at a danger level, styled like the foreman's StatCard. */
function SummaryStatCard({ label, dangerLevel, minutes, locale }: SummaryStatCardProps) {
	const duration = formatMinutesAsDuration(minutes, locale);
	const { bgSubtle, border, text } = dangerlevelStyles[minutes === 0 ? "none" : dangerLevel];

	return (
		<Card title={`${label}: ${duration}`} className={cn("justify-between gap-1 px-3 py-2", bgSubtle, border, text)}>
			<CardHeader className="flex items-center justify-between gap-2 p-0">
				<h3 className={cn("font-medium text-xs", text)}>{label}</h3>
				<div className="flex items-center">
					<DangerLevelDots dangerLevel={dangerLevel} horizontal={true} size="sm" />
				</div>
			</CardHeader>
			<p className={cn("text-balance font-medium text-base tabular-nums leading-tight", text)}>{duration}</p>
		</Card>
	);
}

const HOURS_IN_DAY = 24;

function formatMinutesAsDuration(totalMinutes: number, locale: Locale) {
	if (totalMinutes === 0) {
		return formatDuration({ minutes: 0 }, { locale, format: ["minutes"], zero: true });
	}

	const totalHours = minutesToHours(totalMinutes);
	const days = Math.floor(totalHours / HOURS_IN_DAY);
	const hours = totalHours - days * HOURS_IN_DAY;
	const minutes = totalMinutes - hoursToMinutes(totalHours);

	const format: Array<"days" | "hours" | "minutes"> = [];

	if (days > 0) {
		format.push("days");
	}

	if (hours > 0) {
		format.push("hours");
	}

	if (minutes > 0) {
		format.push("minutes");
	}

	return formatDuration({ days, hours, minutes: minutes }, { locale, format }).replace("en", "1");
}

function SummaryCardSkeleton() {
	return (
		<div className="grid @sm:grid-cols-3 grid-cols-1 gap-3">
			<Skeleton className="h-15 w-full rounded-xl" />
			<Skeleton className="h-15 w-full rounded-xl" />
			<Skeleton className="h-15 w-full rounded-xl" />
		</div>
	);
}
