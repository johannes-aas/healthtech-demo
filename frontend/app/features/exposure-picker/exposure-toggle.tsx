import { ExposureIcon } from "@/components/exposure-icon.tsx";
import { Button } from "@/components/ui/button.tsx";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group.tsx";
import type { Exposure } from "@/lib/exposures.ts";
import { cn } from "@/lib/utils.ts";
import { XIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

interface ExposureToggleProps {
	value: Exposure | null;
	onValueChange: (value: Exposure | null) => void;
}

export function ExposureToggle({ value, onValueChange }: ExposureToggleProps) {
	const { t } = useTranslation();

	return (
		<div className="flex gap-1">
			<ToggleGroup
				type="single"
				value={value ?? ""}
				variant="outline"
				className="rounded-xl"
				onValueChange={(newValue: Exposure | "") => {
					// Value is an empty string when clicking the already selected item, which clears the filter.
					onValueChange(newValue || null);
				}}
			>
				<ToggleGroupItem
					value="dust"
					aria-label={t(($) => $.exposures.dust)}
					className="rounded-l-xl! px-4 lg:px-6"
				>
					<ExposureIcon type="dust" iconOnly={true} iconClassName="size-4" />
					<p className="min-w-0 text-xs lg:text-sm">{t(($) => $.exposures.dust)}</p>
				</ToggleGroupItem>
				<ToggleGroupItem value="noise" aria-label={t(($) => $.exposures.noise)} className="px-4 lg:px-6">
					<ExposureIcon type="noise" iconOnly={true} iconClassName="size-4" />
					<p className="min-w-0 text-xs lg:text-sm">{t(($) => $.exposures.noise)}</p>
				</ToggleGroupItem>
				<ToggleGroupItem
					value="vibration"
					aria-label={t(($) => $.exposures.vibration)}
					// Square off the seam with the "show all" button only when it is visible.
					className={cn("px-4 lg:px-6", value === null ? "rounded-r-xl!" : "rounded-r-md!")}
				>
					<ExposureIcon type="vibration" iconOnly={true} iconClassName="size-4" />
					<p className="min-w-0 text-xs lg:text-sm">{t(($) => $.exposures.vibration)}</p>
				</ToggleGroupItem>
			</ToggleGroup>

			{value !== null && (
				<Button
					type="button"
					title={t(($) => $.foremanDashboard.overview.clearExposureFilter)}
					variant="outline"
					onClick={() => onValueChange(null)}
					className="shrink-0 rounded-r-xl px-2 lg:px-3"
				>
					<XIcon className="size-4" aria-hidden="true" />
					<span className="text-xs lg:text-sm">{t(($) => $.foremanDashboard.overview.showAllExposures)}</span>
				</Button>
			)}
		</div>
	);
}
