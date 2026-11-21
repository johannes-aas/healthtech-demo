import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs.tsx";
import { type ExposureUnit, parseAsExposureUnit } from "@/lib/exposures.ts";
import { useQueryState } from "nuqs";
import { useTranslation } from "react-i18next";

export function DustUnitTabs() {
	const { t } = useTranslation();
	const [dustUnit, setDustUnit] = useQueryState("unit", parseAsExposureUnit.withDefault("ug"));

	return (
		<Tabs value={dustUnit} onValueChange={(v) => setDustUnit(v as ExposureUnit)}>
			<TabsList>
				<TabsTrigger value="ug">{t(($) => $.exposures.units.ug)}</TabsTrigger>
				<TabsTrigger value="mg">{t(($) => $.exposures.units.mg)}</TabsTrigger>
			</TabsList>
		</Tabs>
	);
}
