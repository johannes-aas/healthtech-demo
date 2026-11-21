import { Button } from "@/components/ui/button.tsx";
import {
	Combobox,
	ComboboxContent,
	ComboboxInput,
	ComboboxItem,
	ComboboxList,
	useComboboxAnchor,
} from "@/components/ui/combobox.tsx";
import { InputGroupAddon } from "@/components/ui/input-group.tsx";
import { cn } from "@/lib/utils.ts";
import { UserIcon, XIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

export type UserSelectUser = { id: string; name: string };

interface UserSelectProps {
	users: Array<UserSelectUser>;
	value: string | null;
	onValueChange: (value: string | null) => void;
	placeholder: string;
	inputClassName?: string;
	contentClassName?: string;
	itemClassName?: string;
}

export function UserSelect({
	users,
	value,
	onValueChange,
	placeholder,
	inputClassName,
	contentClassName,
	itemClassName,
}: UserSelectProps) {
	const { t } = useTranslation();
	const anchorRef = useComboboxAnchor();

	const [searchValue, setSearchValue] = useState<string>(value ? userSelectItemToStringLabel(value, users) : "");

	useEffect(() => {
		const currentLabel = value ? userSelectItemToStringLabel(value, users) : "";
		setSearchValue(currentLabel);
	}, [value, users]);

	const disabled = !users || users.length === 0;

	const items = users.map((user) => ({
		value: user.id,
		label: user.name,
	}));

	const resolveItemLabel = (item: string | UserSelectListItem) => userSelectItemToStringLabel(item, users);

	function handleComboboxValueChange(nextValue: string | UserSelectListItem | null) {
		if (nextValue === null) {
			onValueChange(null);
			return;
		}

		if (typeof nextValue === "string") {
			onValueChange(nextValue);
			return;
		}

		onValueChange(nextValue.value);
	}

	return (
		<div className="flex gap-1">
			<Combobox
				items={items}
				disabled={disabled}
				value={value ?? undefined}
				onValueChange={handleComboboxValueChange}
				itemToStringLabel={resolveItemLabel}
			>
				<div ref={anchorRef} className="w-full">
					<ComboboxInput
						placeholder={placeholder}
						disabled={disabled}
						value={searchValue}
						onChange={(e) => {
							setSearchValue(e.target.value);
						}}
						className={cn(
							"w-full rounded-l-xl bg-background font-medium dark:bg-input/30",
							// Square off the seam with the "show all" button only when it is visible.
							value === null ? "rounded-r-xl" : "rounded-r-md",
							inputClassName,
						)}
					>
						<InputGroupAddon align="inline-start">
							<UserIcon aria-hidden="true" />
						</InputGroupAddon>
					</ComboboxInput>
				</div>
				<ComboboxContent anchor={anchorRef} className={cn("rounded-xl", contentClassName)}>
					<ComboboxList>
						{(item) => (
							<ComboboxItem
								key={item.value}
								value={item.value}
								className={cn("rounded-lg", itemClassName)}
							>
								{item.label}
							</ComboboxItem>
						)}
					</ComboboxList>
				</ComboboxContent>
			</Combobox>

			{value !== null && (
				<Button
					type="button"
					title={t(($) => $.foremanDashboard.overview.clearUserSelection)}
					variant="outline"
					onClick={() => {
						onValueChange(null);
						setSearchValue("");
					}}
					disabled={disabled}
					className="shrink-0 rounded-r-xl px-2 lg:px-3"
				>
					<XIcon className="size-4" aria-hidden="true" />
					<span className="text-xs lg:text-sm">{t(($) => $.foremanDashboard.overview.showAllUsers)}</span>
				</Button>
			)}
		</div>
	);
}

type UserSelectListItem = { value: string; label: string };

function userSelectItemToStringLabel(item: string | UserSelectListItem, users: Array<UserSelectUser>): string {
	if (typeof item === "string") {
		return users.find((user) => user.id === item)?.name ?? "";
	}

	if (item.label == null) {
		return "";
	}

	return String(item.label);
}
