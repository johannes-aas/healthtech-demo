import { ExposureRiskCard } from "@/components/exposure-level-card.tsx";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { AtRiskPopup } from "@/features/attention-card/exposure-level-popup.tsx";
import { StatCard } from "@/features/attention-card/stat-card.tsx";
import type { DangerLevel } from "@/lib/danger-levels.ts";
import type { ThresholdSummary } from "@/lib/dto/threshold.ts";
import type { UserWithStatusDto } from "@/lib/dto/user.ts";
import { parseAsExposure } from "@/lib/exposures.ts";
import { cn } from "@/lib/utils.ts";
import { CircleAlertIcon, type LucideIcon, OctagonAlertIcon, ShieldCheckIcon } from "lucide-react";
import { parseAsString, useQueryState } from "nuqs";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

const statusHeaderStyles: Record<
	DangerLevel,
	{ StatusIcon: LucideIcon; card: string; iconChip: string; iconSize: string; title: string; description: string }
> = {
	danger: {
		StatusIcon: OctagonAlertIcon,
		card: "border-danger-border bg-danger-subtle",
		iconChip: "text-danger",
		iconSize: "size-7",
		title: "text-danger-text",
		description: "text-danger-text/80",
	},
	warning: {
		StatusIcon: CircleAlertIcon,
		card: "border-warning-border bg-warning-subtle",
		iconChip: "text-warning",
		iconSize: "size-7",
		title: "text-warning-text",
		description: "text-warning-text/80",
	},
	safe: {
		StatusIcon: ShieldCheckIcon,
		card: "",
		iconChip: "border border-safe-border bg-safe-subtle text-safe-text",
		iconSize: "size-5",
		title: "text-foreground",
		description: "text-muted-foreground",
	},
};

interface AttentionCardProps {
	subordinates: Array<UserWithStatusDto>;
	isSubordinatesLoading?: boolean;
	thresholdSummary?: ThresholdSummary;
	isThresholdSummaryLoading?: boolean;
}

export const AttentionCard = ({
	subordinates,
	isSubordinatesLoading,
	thresholdSummary,
	isThresholdSummaryLoading,
}: AttentionCardProps) => {
	const { t } = useTranslation();
	const [exposure] = useQueryState("exposure", parseAsExposure);
	const [, setSelectedUserId] = useQueryState("userId", parseAsString);

	const [selectedStatus, setSelectedStatus] = useState<DangerLevel | null>(null);
	const [popupStatus, setPopupStatus] = useState<DangerLevel | null>(null);

	const openForStatus = (status: DangerLevel) => {
		setPopupStatus(status);
		setSelectedStatus(status);
	};

	const closePopup = () => {
		setSelectedStatus(null);
	};

	const highestDangerLevel = useMemo(() => {
		const exposureType = exposure ?? "total";
		if (thresholdSummary === undefined) {
			return null;
		}

		if (subordinates === undefined || subordinates.length === 0) {
			return "safe";
		}

		if (thresholdSummary[exposureType].danger > 0) {
			return "danger";
		}

		if (thresholdSummary[exposureType].warning > 0) {
			return "warning";
		}

		return "safe";
	}, [thresholdSummary, subordinates, exposure]);

	const selectedExposureKey = exposure ?? "total";

	const attentionHeaderText =
		highestDangerLevel === null ? null : t(($) => $.foremanDashboard.actionCard[highestDangerLevel]);

	const warningDescription =
		highestDangerLevel === "danger" || highestDangerLevel === "warning"
			? t(($) => $.foremanDashboard.actionCard[`${highestDangerLevel}Description`])
			: null;

	if (isThresholdSummaryLoading || thresholdSummary === undefined || highestDangerLevel === null) {
		return (
			<Card className="gap-3 p-6">
				<Skeleton className="h-8 w-[50%] rounded-full bg-zinc-100 dark:bg-accent" />
				<Skeleton className="mt-4 h-32 w-full rounded-xl bg-zinc-100 dark:bg-accent" />
			</Card>
		);
	}

	const headerStyle = statusHeaderStyles[highestDangerLevel];
	const { StatusIcon } = headerStyle;

	const actionCardHeader = (
		<Card className={cn("flex-row items-center gap-3 p-3", !isSubordinatesLoading && headerStyle.card)}>
			{isSubordinatesLoading ? (
				<Skeleton className="h-8 w-[50%] rounded-full bg-zinc-100 dark:bg-accent" />
			) : (
				<>
					<div
						className={cn(
							"flex size-10 shrink-0 items-center justify-center self-start rounded-lg",
							headerStyle.iconChip,
						)}
					>
						<StatusIcon aria-hidden={true} className={headerStyle.iconSize} />
					</div>
					<div className="flex flex-col gap-0.5">
						<h2 className={cn("font-medium text-xl", headerStyle.title)}>
							<span className="font-normal">{t(($) => $.foremanDashboard.actionCard.teamStatus)}</span>{" "}
							{attentionHeaderText}
						</h2>
						{warningDescription && (
							<p className={cn("text-sm", headerStyle.description)}>{warningDescription}</p>
						)}
					</div>
				</>
			)}
		</Card>
	);

	return (
		<>
			<div className="flex flex-col gap-4 text-muted-foreground">
				{actionCardHeader}

				<CardContent className="gap-2">
					<div className="grid grid-cols-1 @lg:grid-cols-2 @3xl:grid-cols-3 items-stretch gap-4">
						{!exposure && (
							<>
								<StatCard
									label={t(($) => $.foremanDashboard.overview.statCards.danger.label)}
									dangerLevel="danger"
									onClick={() => openForStatus("danger")}
									value={thresholdSummary[selectedExposureKey].danger}
								/>

								<StatCard
									label={t(($) => $.foremanDashboard.overview.statCards.warning.label)}
									dangerLevel="warning"
									onClick={() => openForStatus("warning")}
									value={thresholdSummary[selectedExposureKey].warning}
								/>

								<StatCard
									label={t(($) => $.foremanDashboard.overview.statCards.safe.label)}
									dangerLevel="safe"
									onClick={() => openForStatus("safe")}
									value={thresholdSummary[selectedExposureKey].safe}
								/>
							</>
						)}

						{exposure && (
							<>
								<ExposureRiskCard
									users={subordinates ?? []}
									exposure={exposure}
									dangerLevel="danger"
									onUserClick={setSelectedUserId}
								/>
								<ExposureRiskCard
									users={subordinates ?? []}
									exposure={exposure}
									dangerLevel="warning"
									onUserClick={setSelectedUserId}
								/>
								<ExposureRiskCard
									users={subordinates ?? []}
									exposure={exposure}
									dangerLevel="safe"
									onUserClick={setSelectedUserId}
								/>
							</>
						)}
					</div>
				</CardContent>
			</div>

			{(popupStatus === "warning" || popupStatus === "danger" || popupStatus === "safe") && (
				<AtRiskPopup
					open={selectedStatus !== null}
					onClose={closePopup}
					title="Workers"
					status={popupStatus}
					subordinates={subordinates ?? []}
				/>
			)}
		</>
	);
};
