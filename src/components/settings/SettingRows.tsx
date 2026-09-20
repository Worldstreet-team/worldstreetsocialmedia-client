"use client";

import { SelectRow, ToggleRow } from "./inspector";

/**
 * The two row shapes every settings group is built from. Shared so a new
 * group is a list of rows, not a new design.
 *
 * Since the Inspector layout (owner 2026-09-20) these are thin names over
 * `inspector.tsx`: a Choice is a dropdown row, a Toggle is a switch row.
 * The pill-chip Choice is gone on purpose; do not bring it back for a
 * "short" list of options, a settings page reads as one system or not at all.
 */

export function Choice({
	label,
	hint,
	value,
	options,
	onPick,
}: {
	label: string;
	hint?: string;
	value: string | number;
	options: [string | number, string][];
	onPick: (v: string | number) => void;
}) {
	return (
		<SelectRow label={label} hint={hint} value={value} options={options} onPick={onPick} />
	);
}

export const Toggle = ToggleRow;
