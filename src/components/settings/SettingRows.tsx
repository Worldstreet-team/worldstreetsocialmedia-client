"use client";

import { type RowTag, SelectRow, ToggleRow } from "./inspector";

/**
 * The two row shapes every settings group is built from. Shared so a new
 * group is a list of rows, not a new design.
 *
 * Thin names over `inspector.tsx`: a Choice is a choice row, a Toggle is a
 * switch row. A Choice with three or fewer short options shows them side by
 * side on a desktop (owner 2026-10-07); anything longer, and every choice
 * on a phone, is the dropdown.
 */

export function Choice({
	label,
	hint,
	tag,
	value,
	options,
	onPick,
}: {
	label: string;
	hint?: string;
	tag?: RowTag;
	value: string | number;
	options: [string | number, string][];
	onPick: (v: string | number) => void;
}) {
	return (
		<SelectRow
			label={label}
			hint={hint}
			tag={tag}
			value={value}
			options={options}
			onPick={onPick}
			segmented="auto"
		/>
	);
}

export const Toggle = ToggleRow;
