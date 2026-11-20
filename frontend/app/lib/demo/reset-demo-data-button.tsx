import { Button } from "@/components/ui/button.tsx";
import { cn } from "@/lib/utils.ts";
import { RotateCcwIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { resetDemoData } from "./storage.ts";

/**
 * "Reset demo data" button for the DEMO box in the user menu. Only rendered in demo mode.
 * The labels live here (not in the locale files) so the demo stays self-contained in this folder.
 */

const LABELS = {
	en: "Reset demo data",
	no: "Tilbakestill demodata",
} as const;

export function ResetDemoDataButton() {
	const { i18n } = useTranslation();
	const label = i18n.language === "no" ? LABELS.no : LABELS.en;

	const handleClick = () => {
		resetDemoData();
		// Reloading clears the in-memory demo state and the query cache in one go
		window.location.reload();
	};

	return (
		// `w-0 min-w-full`: the button takes no width of its own when the menu sizes itself, then fills the menu's width,
		// so adding it doesn't make the dropdown wider
		<Button
			type="button"
			className={cn(
				"mt-2 flex w-0 min-w-full gap-2 text-sm text-zinc-600 dark:text-zinc-300",
				"bg-amber-200 hover:bg-amber-300 dark:bg-amber-900/75 dark:hover:bg-amber-800",
			)}
			onClick={handleClick}
		>
			<RotateCcwIcon className="size-4" />
			{label}
		</Button>
	);
}
