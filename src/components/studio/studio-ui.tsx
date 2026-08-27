"use client";

import { ArrowDownRight, ArrowUpRight } from "@phosphor-icons/react";
import clsx from "clsx";

/**
 * The Studio's kit — flat professional dark, benchmarked against
 * reference-grade analytics dashboards (owner review 2026-08-26):
 *
 *  - **No borders.** Depth comes from fill contrast alone: page `#0F0E0D`,
 *    card one step lighter. A hairline on every card is where dashboards go
 *    to look like wireframes.
 *  - **No gradients, no ambient decoration.** The data is the visual.
 *  - Every count that can carry an honest comparison carries a DeltaChip;
 *    a number without context is trivia.
 *  - Fixed inks (`glass-ink*`) because this surface is dark in both themes.
 */

export const fmt = (n: number) => {
	if (n >= 1_000_000)
		return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
	if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`;
	return String(n);
};

/** The card fill. One string so every surface stays on the same step. */
export const CARD = "rounded-2xl bg-[#171614]";

/** A bento cell on the overview's 12-col grid; spans apply at xl only. */
export function Cell({
	span,
	className,
	children,
}: {
	span: 3 | 4 | 5 | 6 | 7 | 8 | 12;
	className?: string;
	children: React.ReactNode;
}) {
	return (
		<div
			className={clsx(
				CARD,
				"min-w-0",
				span === 3 && "xl:col-span-3",
				span === 4 && "xl:col-span-4",
				span === 5 && "xl:col-span-5",
				span === 6 && "xl:col-span-6",
				span === 7 && "xl:col-span-7",
				span === 8 && "xl:col-span-8",
				span === 12 && "xl:col-span-12",
				className,
			)}
		>
			{children}
		</div>
	);
}

/** Card header: eyebrow + optional right-side control. */
export function CellHead({
	label,
	action,
}: {
	label: string;
	action?: React.ReactNode;
}) {
	return (
		<div className="flex items-center justify-between gap-3 px-5 pt-4 pb-1">
			<span className="glass-eyebrow font-sans">{label}</span>
			{action}
		</div>
	);
}

/**
 * Change vs the previous window, in the compact chip grammar every analytics
 * product speaks: arrow + percentage, green up / red down, on a soft wash.
 * `delta` is a fraction (0.09 = +9%); null renders nothing — an absent
 * comparison beats an invented one.
 */
export function DeltaChip({
	delta,
	suffix = "%",
	caption,
}: {
	delta: number | null;
	suffix?: string;
	caption?: string;
}) {
	if (delta === null || !Number.isFinite(delta)) return null;
	const up = delta >= 0;
	const magnitude = Math.abs(suffix === "%" ? delta * 100 : delta);
	const value = magnitude >= 100 ? Math.round(magnitude) : magnitude.toFixed(1);
	return (
		<span className="flex items-center gap-1.5">
			<span
				className={clsx(
					"inline-flex items-center gap-0.5 rounded-pill px-1.5 py-0.5 font-sans text-[11px] font-semibold tabular-nums",
					up ? "bg-success/10 text-success" : "bg-danger/10 text-danger",
				)}
			>
				{up ? (
					<ArrowUpRight size={11} weight="bold" />
				) : (
					<ArrowDownRight size={11} weight="bold" />
				)}
				{value}
				{suffix}
			</span>
			{caption && (
				<span className="font-sans text-[11px] glass-ink-faint">{caption}</span>
			)}
		</span>
	);
}

/**
 * A headline metric: icon chip + label up top, the number as the hero, the
 * honest comparison under it, and the metric's own pulse on the right.
 */
export function StatCard({
	icon: Icon,
	label,
	value,
	delta = null,
	deltaSuffix,
	deltaCaption,
	chart,
	sub,
}: {
	icon: React.ComponentType<{ size?: number; weight?: any }>;
	label: string;
	value: string;
	delta?: number | null;
	deltaSuffix?: string;
	deltaCaption?: string;
	chart?: React.ReactNode;
	sub?: string;
}) {
	return (
		<div className="flex h-full flex-col px-5 py-4">
			<div className="flex items-center gap-2.5">
				<span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-[#fafaf9]/[0.06] text-[var(--ws-brand-primary)]">
					<Icon size={15} weight="bold" />
				</span>
				<span className="glass-eyebrow font-sans">{label}</span>
			</div>
			<div className="mt-3 flex items-end justify-between gap-3">
				<span className="font-display text-[30px] font-semibold leading-none tracking-tight glass-ink tabular-nums">
					{value}
				</span>
				{chart}
			</div>
			<div className="mt-2.5 min-h-[18px]">
				{delta !== null ? (
					<DeltaChip
						delta={delta}
						suffix={deltaSuffix}
						caption={deltaCaption}
					/>
				) : sub ? (
					<span className="font-sans text-[11px] glass-ink-faint">{sub}</span>
				) : null}
			</div>
		</div>
	);
}

/** label · value line inside a panel. Divider only between rows — the one
 *  place a hairline earns its keep. */
export function MetricRow({
	label,
	value,
	hint,
}: {
	label: string;
	value: string;
	hint?: string;
}) {
	return (
		<div className="flex items-baseline justify-between gap-3 border-b border-[#fafaf9]/[0.05] py-2.5 last:border-0">
			<span className="min-w-0">
				<span className="block font-sans text-[13px] glass-ink-dim">
					{label}
				</span>
				{hint && (
					<span className="mt-0.5 block font-sans text-[11px] glass-ink-faint">
						{hint}
					</span>
				)}
			</span>
			<span className="shrink-0 font-sans text-[15px] font-semibold glass-ink tabular-nums">
				{value}
			</span>
		</div>
	);
}

/** The 7/28/90-day window switch, segmented-control style. */
export function WindowSwitch({
	value,
	onChange,
}: {
	value: number;
	onChange: (days: number) => void;
}) {
	return (
		<div className="flex items-center gap-0.5 rounded-pill bg-[#fafaf9]/[0.05] p-0.5">
			{[7, 28, 90].map((d) => (
				<button
					key={d}
					type="button"
					onClick={() => onChange(d)}
					aria-pressed={value === d}
					className={clsx(
						"h-7 rounded-pill px-3 font-sans text-[11.5px] font-semibold tabular-nums transition-colors cursor-pointer",
						value === d
							? "bg-[#fafaf9] text-[#0c0a09]"
							: "glass-ink-faint hover:glass-ink",
					)}
				>
					{d}d
				</button>
			))}
		</div>
	);
}

/** Empty note inside a card — quiet, centred. */
export function CellEmpty({ children }: { children: React.ReactNode }) {
	return (
		<p className="px-5 py-10 text-center font-sans text-[13px] glass-ink-faint">
			{children}
		</p>
	);
}

/**
 * Subpage header. The desktop shell has no top bar, so each section names
 * itself: display-face title, caption as the subline.
 */
export function PageHead({
	title,
	caption,
	action,
}: {
	title: string;
	caption?: string;
	action?: React.ReactNode;
}) {
	return (
		<div className="mb-4 flex flex-wrap items-end justify-between gap-3">
			<div className="min-w-0">
				<h1 className="font-display text-[22px] font-semibold tracking-tight glass-ink">
					{title}
				</h1>
				{caption && (
					<p className="mt-1 max-w-[68ch] font-sans text-[13px] glass-ink-dim">
						{caption}
					</p>
				)}
			</div>
			{action}
		</div>
	);
}
