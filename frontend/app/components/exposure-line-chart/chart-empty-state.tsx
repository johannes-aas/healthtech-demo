import { usePlotArea } from "recharts";

/** Renders a message centered on the chart's plot area (excluding axes and legend). Must be a child of a Recharts chart. */
export function ChartEmptyState({ text }: { text: string }) {
	const plotArea = usePlotArea();

	if (!plotArea) {
		return null;
	}

	return (
		<text
			x={plotArea.x + plotArea.width / 2}
			y={plotArea.y + plotArea.height / 2}
			textAnchor="middle"
			dominantBaseline="middle"
			fill="var(--color-muted-foreground)"
		>
			{text}
		</text>
	);
}
