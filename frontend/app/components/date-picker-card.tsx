import { DatePicker } from "@/components/date-picker.tsx";
import { Card, CardLabelHeader } from "@/components/ui/card.tsx";
import { DateNavigation } from "@/features/date-picker/date-navigation.tsx";
import type { TZDate } from "@date-fns/tz";
import type { ComponentProps } from "react";

type DatePickerCardProps = ComponentProps<typeof DatePicker> & {
	minDate?: TZDate;
	maxDate?: TZDate;
};

/**
 * Date navigation with a calendar below it.
 */
export function DatePickerCard({ minDate, maxDate, ...datePickerProps }: DatePickerCardProps) {
	return (
		<Card muted={true} variant="labeled">
			<CardLabelHeader className="px-2 py-1.5">
				<DateNavigation className="w-full" minDate={minDate} maxDate={maxDate} />
			</CardLabelHeader>

			{/* Centered for when the card is wider than the calendar (single-column layout on phones) */}
			<div className="flex justify-center p-4">
				<DatePicker {...datePickerProps} />
			</div>
		</Card>
	);
}
