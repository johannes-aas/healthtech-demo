import { cn } from "@/lib/utils.ts";

/*
 * Shared layout for the operator and foreman dashboards: a header row of controls, a calendar card, the main panel and
 * a column of side cards.
 *
 * - Phone: everything stacks in one column (controls, calendar, main panel, side cards).
 * - md to xl: two columns. The side cards move under the calendar and the main panel takes the rest of the width.
 * - xl and up: three columns with the side cards to the right of the main panel. Each page passes its own column
 *   template for this.
 */

/**
 * Grid wrapper. `xlColumnsClassName` sets the three-column template from `xl` up, e.g.
 * `xl:grid-cols-[calc(var(--spacing)*71)_minmax(0,1fr)_20%]`.
 */
export function dashboardGridClassName(xlColumnsClassName: string) {
	return cn(
		"grid w-full flex-1 grid-cols-1 gap-6",
		// 71 comes from w-65 on DatePicker's Calendar + px-3 on its outer div in DatePickerCard (so 6 spacings for both sides)
		"md:grid-cols-[calc(var(--spacing)*71)_minmax(0,1fr)] md:grid-rows-[auto_auto_1fr]",
		"xl:grid-rows-[auto_1fr]",
		xlColumnsClassName,
		// Cancels the layout's bottom margin so the main panel reaches the bottom edge
		"md:-mb-5",
	);
}

export const dashboardHeaderClassName = "col-span-full flex min-w-0 flex-wrap items-center gap-3 xl:gap-x-6";

export const dashboardCalendarAsideClassName = "flex flex-col gap-4 md:col-start-1 md:row-start-2";

/** Side cards: under the calendar below `xl`, in their own right-hand column from `xl` up. */
export const dashboardSideAsideClassName = cn(
	"flex flex-col gap-4 md:col-start-1 md:row-start-3 xl:col-start-3 xl:row-start-2",
	// Pulls the cards up so the gap to the calendar above matches the gap between the cards (gap-4 instead of gap-6)
	"md:-mt-2 xl:mt-0",
);

/**
 * The recessed panel holding a dashboard's main content. From `md` up it runs into the bottom edge (open bottom). On
 * phones the side cards stack below it, so it is closed off with a full border instead.
 *
 * It is a size container, so its content can adapt to the panel's width (`@sm:`, `@xl:`, ...) rather than the
 * viewport's, which no longer track each other once the side columns come and go.
 */
export const mainPanelClassName = cn(
	"@container flex min-w-0 flex-col gap-4 rounded-2xl border border-border bg-surface p-4 sm:p-6 dark:border-border/40",
	"md:col-start-2 md:row-span-2 md:row-start-2 md:rounded-b-none md:border-b-0 xl:row-span-1",
);

/** Divider under the panel's title, stretched across the panel's padding to its borders. */
export const mainPanelSeparatorClassName = "-mx-4 mt-1 data-[orientation=horizontal]:w-auto sm:-mx-6 dark:bg-border/40";
