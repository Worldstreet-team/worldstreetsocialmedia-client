"use client";

import clsx from "clsx";

/**
 * The Studio's glass kit.
 *
 * The Studio joined the sanctioned glass surfaces (owner ruling 2026-08-26):
 * fixed-dark chrome in both themes, sheer panels with backdrop blur, white
 * CTAs, gold reserved for data and the active state. Everything here builds
 * on the `glass-*` utilities in globals.css — no theme tokens, because the
 * panels must not flip in light mode while sitting on a dark veil.
 */

export const fmt = (n: number) => {
	if (n >= 1_000_000)
		return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
	if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`;
	return String(n);
};

/**
 * A bento cell. `span` is the desktop column span on the 12-col grid;
 * below xl everything stacks and the span is ignored.
 */
export function GlassCell({
	span,
	tall,
	className,
	children,
}: {
	span: 3 | 4 | 5 | 6 | 7 | 8 | 12;
	tall?: boolean;
	className?: string;
	children: React.ReactNode;
}) {
	return (
		<div
			className={clsx(
				"glass-panel backdrop-blur-xl backdrop-saturate-150 border glass-divider rounded-2xl min-w-0",
				tall && "xl:row-span-2",
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

/** Panel header: eyebrow + optional right-side control. */
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
 * A headline number. The value is the hero — Poppins, big, tabular — and the
 * label is an eyebrow above it, so a wall of tiles reads as numbers first.
 */
export function StatTile({
	label,
	value,
	sub,
	children,
}: {
	label: string;
	value: string;
	sub?: string;
	children?: React.ReactNode;
}) {
	return (
		<div className="flex h-full flex-col px-5 py-4">
			<span className="glass-eyebrow font-sans">{label}</span>
			<span className="mt-2 font-display text-[28px] font-semibold leading-none tracking-tight glass-ink tabular-nums">
				{value}
			</span>
			{sub && (
				<span className="mt-1 font-sans text-[12px] glass-ink-faint">
					{sub}
				</span>
			)}
			{children && <div className="mt-auto pt-3">{children}</div>}
		</div>
	);
}

/** label · value line inside a panel. */
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
		<div className="flex items-baseline justify-between gap-3 py-2 border-b glass-divider last:border-0">
			<span className="min-w-0">
				<span className="block font-sans text-[13px] glass-ink-dim">
					{label}
				</span>
				{hint && (
					<span className="block font-sans text-[11px] glass-ink-faint mt-0.5">
						{hint}
					</span>
				)}
			</span>
			<span className="font-sans text-[15px] font-semibold glass-ink tabular-nums shrink-0">
				{value}
			</span>
		</div>
	);
}

/** The 7/28/90-day window switch, as glass chips. */
export function WindowSwitch({
	value,
	onChange,
}: {
	value: number;
	onChange: (days: number) => void;
}) {
	return (
		<div className="flex items-center gap-1">
			{[7, 28, 90].map((d) => (
				<button
					key={d}
					type="button"
					onClick={() => onChange(d)}
					aria-pressed={value === d}
					className={clsx(
						"h-7 rounded-pill px-2.5 font-sans text-[11.5px] font-semibold tabular-nums transition-colors cursor-pointer",
						value === d
							? "glass-chip-active"
							: "glass-ink-faint hover:glass-ink hover:bg-[#fafaf9]/[0.07]",
					)}
				>
					{d}d
				</button>
			))}
		</div>
	);
}

/** Empty note inside a panel — quiet, centred, never a full EmptyState. */
export function CellEmpty({ children }: { children: React.ReactNode }) {
	return (
		<p className="px-5 py-10 text-center font-sans text-[13px] glass-ink-faint">
			{children}
		</p>
	);
}

/**
 * Subpage header. The desktop shell deliberately has no top bar, so each
 * section names itself: display-face title, caption as the subline.
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
					<p className="mt-1 font-sans text-[13px] glass-ink-dim max-w-[68ch]">
						{caption}
					</p>
				)}
			</div>
			{action}
		</div>
	);
}
