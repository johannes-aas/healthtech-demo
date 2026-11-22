import { Button } from "@/components/ui/button.tsx";
import { cn } from "@/lib/utils.ts";
import { useTranslation } from "react-i18next";

/**
 * Callout below the user menu trigger telling first-time visitors they're signed in as a demo user and can switch
 * user from the menu. Must be rendered inside a `relative` wrapper around the trigger.
 */
export function DemoUserHint({ onDismiss }: { onDismiss: () => void }) {
	const { t } = useTranslation();

	return (
		<div
			role="status"
			className={cn(
				"absolute top-full right-0 z-50 mt-3 w-64 rounded-lg border-[1.5px] p-3 shadow-md",
				"border-amber-500 bg-amber-100 text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-50",
				"fade-in-0 slide-in-from-top-2 animate-in duration-300",
			)}
		>
			{/* Arrow pointing up at the avatar */}
			<span
				aria-hidden={true}
				className="absolute -top-[7px] right-4 size-3 rotate-45 border-amber-500 border-t-[1.5px] border-l-[1.5px] bg-amber-100 dark:border-amber-800 dark:bg-amber-950"
			/>

			<p className="font-semibold text-sm">{t(($) => $.demo.hintTitle)}</p>
			<p className="mt-1 text-xs">{t(($) => $.demo.hintBody)}</p>

			<div className="mt-2.5 flex justify-end">
				<Button
					type="button"
					size="sm"
					onClick={onDismiss}
					className="h-7 bg-amber-200 text-amber-900 hover:bg-amber-300 dark:bg-amber-900/60 dark:text-amber-100 dark:hover:bg-amber-900"
				>
					{t(($) => $.demo.hintDismiss)}
				</Button>
			</div>
		</div>
	);
}
