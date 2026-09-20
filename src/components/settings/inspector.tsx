"use client";

import clsx from "clsx";
import { ChevronDown } from "lucide-react";
import { Switch } from "@/components/ui/Switch";

/**
 * The Inspector: the grammar every settings page is set in (owner
 * 2026-09-20, picked from four directions after calling the pill-and-card
 * layout "child's play").
 *
 * A professional tool, not a form: no cards, no icon chips, no option
 * pills. A group is a quiet label over hairline rows. A row is three
 * columns on a desktop (name, what it does, the control at the right edge)
 * and two on a phone (name with the explanation under it, the control).
 * A choice is a dropdown showing the current value, so ten settings fit
 * above the fold and the value is the loudest thing on the row.
 *
 * The dropdown is a native <select> on purpose: the phone gets its own
 * picker, the keyboard and screen readers work with no code, and there is
 * no overlay to position, trap focus in or animate.
 */

export function SettingGroup({
	id,
	title,
	caption,
	tone,
	children,
}: {
	/** Matches a GROUPS entry; the sub-nav scrolls to `group-<id>`. */
	id: string;
	title: string;
	caption?: string;
	tone?: "danger";
	children: React.ReactNode;
}) {
	return (
		// scroll-mt clears the sticky header (and the chip strip on a phone).
		<section
			id={`group-${id}`}
			data-group={id}
			className="scroll-mt-[112px] lg:scroll-mt-[72px]"
		>
			<div className="flex flex-col gap-0.5 border-b border-hairline pb-2.5 lg:flex-row lg:items-baseline lg:justify-between lg:gap-6">
				<h3
					className={clsx(
						"shrink-0 font-sans text-[calc(13px*var(--ws-fs))] font-semibold",
						tone === "danger" ? "text-danger" : "text-primary",
					)}
				>
					{title}
				</h3>
				{caption && (
					<p className="max-w-[64ch] font-sans text-[calc(12.5px*var(--ws-fs))] leading-snug text-muted lg:text-right">
						{caption}
					</p>
				)}
			</div>
			<div className="flex flex-col">{children}</div>
		</section>
	);
}

/** One setting. `children` is the control; it sits at the right edge. */
export function SettingRow({
	label,
	hint,
	disabled,
	children,
}: {
	label: React.ReactNode;
	hint?: React.ReactNode;
	disabled?: boolean;
	children?: React.ReactNode;
}) {
	return (
		<div
			className={clsx(
				"grid min-h-[52px] grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 border-b border-hairline py-1.5",
				"lg:grid-cols-[minmax(0,220px)_minmax(0,1fr)_auto] lg:gap-x-6",
				disabled && "opacity-60",
			)}
		>
			<span className="font-sans text-[calc(13.5px*var(--ws-fs))] font-medium text-primary">
				{label}
			</span>
			{/* Under the name on a phone, its own column on a desktop. Always
			    rendered on a desktop so the control column stays put. */}
			<span
				className={clsx(
					"col-start-1 row-start-2 font-sans text-[calc(12.5px*var(--ws-fs))] leading-snug text-muted lg:col-start-2 lg:row-start-1",
					!hint && "hidden lg:block",
				)}
			>
				{hint}
			</span>
			<span className="col-start-2 row-span-2 row-start-1 flex items-center justify-end lg:col-start-3 lg:row-span-1">
				{children}
			</span>
		</div>
	);
}

/** A choice, as a dropdown that shows the current value. */
export function SelectRow<V extends string | number>({
	label,
	hint,
	value,
	options,
	onPick,
	disabled,
}: {
	label: string;
	hint?: string;
	value: V;
	options: readonly (readonly [V, string])[];
	onPick: (v: V) => void;
	disabled?: boolean;
}) {
	// Values are strings AND numbers (text size is 90, "auto"), and a DOM
	// select only speaks strings, so the option's index is what it carries.
	const index = Math.max(
		0,
		options.findIndex(([v]) => v === value),
	);
	return (
		<SettingRow label={label} hint={hint} disabled={disabled}>
			<span className="relative inline-flex">
				<select
					aria-label={label}
					disabled={disabled}
					value={index}
					onChange={(e) => onPick(options[Number(e.target.value)][0])}
					className="h-10 min-w-[132px] max-w-[46vw] cursor-pointer appearance-none truncate rounded-[7px] border border-hairline bg-transparent pl-3 pr-8 font-sans text-[calc(13px*var(--ws-fs))] font-medium text-primary transition-colors hover:bg-primary/5 disabled:cursor-default lg:max-w-[240px] [&>option]:bg-surface [&>option]:text-primary"
				>
					{options.map(([v, l], i) => (
						<option key={String(v)} value={i}>
							{l}
						</option>
					))}
				</select>
				<ChevronDown
					aria-hidden
					className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted"
					strokeWidth={2.25}
				/>
			</span>
		</SettingRow>
	);
}

export function ToggleRow({
	label,
	hint,
	checked,
	disabled,
	onChange,
}: {
	label: string;
	hint?: string;
	checked: boolean;
	disabled?: boolean;
	onChange: (v: boolean) => void;
}) {
	return (
		<SettingRow label={label} hint={hint} disabled={disabled}>
			<Switch
				checked={checked}
				disabled={disabled}
				onChange={onChange}
				label={label}
				className="-mr-[3px]"
			/>
		</SettingRow>
	);
}

/** A fact, not a control: email, renewal date. */
export function ValueRow({
	label,
	hint,
	value,
}: {
	label: string;
	hint?: string;
	value: React.ReactNode;
}) {
	return (
		<SettingRow label={label} hint={hint}>
			<span className="max-w-[52vw] truncate font-sans text-[calc(13px*var(--ws-fs))] tabular-nums text-muted lg:max-w-[320px]">
				{value}
			</span>
		</SettingRow>
	);
}

/** The small bordered button a row ends in: Change, Download, Manage. */
export const rowButton =
	"h-10 shrink-0 cursor-pointer rounded-[7px] border border-hairline px-3.5 font-sans text-[calc(13px*var(--ws-fs))] font-medium text-primary transition-colors hover:bg-primary/5 disabled:cursor-default disabled:opacity-50";
