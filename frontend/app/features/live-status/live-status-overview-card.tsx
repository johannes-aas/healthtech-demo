import { Card } from "@/components/ui/card.tsx";
import type { DangerLevel } from "@/lib/danger-levels.ts";
import { dangerlevelStyles } from "@/lib/danger-levels.ts";
import { exposures } from "@/lib/exposures.ts";
import { cn, getEmoji } from "@/lib/utils.ts";
import { t } from "i18next";

interface LiveStatusOverviewCardProps {
	exposureDangerLevels: {
		dust: DangerLevel;
		noise: DangerLevel;
		vibration: DangerLevel;
	};
}

function mapDangerLevelToLabel(dangerLevel: DangerLevel) {
	return t(($) => $.live.overviewCard[dangerLevel]);
}

export const LiveStatusOverviewCard = ({ exposureDangerLevels }: LiveStatusOverviewCardProps) => (
	<Card>
		<div className="grid grid-cols-3 gap-2">
			{exposures.map((exposure) => {
				const dangerLevel = exposureDangerLevels[exposure];
				const Icon = getEmoji(dangerLevel);

				return (
					<div
						key={exposure}
						className="flex flex-row justify-between rounded-md border border-b-card-highlight p-2"
					>
						<div>{t(($) => $.exposures[exposure])}</div>

						<div
							className={cn(
								"flex flex-row items-center gap-1 text-xs",
								dangerlevelStyles[dangerLevel].signalText,
							)}
						>
							<p>{mapDangerLevelToLabel(dangerLevel)}</p>
							<Icon className="h-5 w-5" />
						</div>
					</div>
				);
			})}
		</div>
	</Card>
);
