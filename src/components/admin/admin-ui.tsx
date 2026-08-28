"use client";

import clsx from "clsx";

/** USD minor units → a readable amount. Money is never a bare number. */
export const money = (minor: number) =>
	`$${(minor / 100).toLocaleString(undefined, {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	})}`;

export const compact = (n: number) =>
	n >= 1_000_000
		? `${(n / 1_000_000).toFixed(1)}M`
		: n >= 1_000
			? `${(n / 1_000).toFixed(1)}k`
			: String(n);

/**
 * Change against the previous window of equal length.
 *
 * No baseline means no chip — a first-ever window has nothing to compare to,
 * and inventing "+100%" is how a dashboard starts lying. Same rule the Studio
 * follows.
 */
export function Delta({ now, prev }: { now: number; prev: number }) {
	if (!prev) return null;
	const pct = Math.round(((now - prev) / prev) * 100);
	if (pct === 0) return null;
	const up = pct > 0;
	return (
		<span
			className={clsx(
				"ml-2 shrink-0 font-sans text-[12px] font-semibold tabular-nums",
				up ? "text-success" : "text-danger",
			)}
		>
			{up ? "+" : ""}
			{pct}%
		</span>
	);
}

/** A headline number. `glass-tile` — a tint inside the pane's blur, not a
 *  second blur of its own. */
export function Stat({
	label,
	value,
	sub,
	tone,
}: {
	label: string;
	value: string;
	sub?: string;
	tone?: "gold" | "danger";
}) {
	return (
		<div className="glass-tile rounded-lg p-3.5">
			<div className="font-sans text-[11px] font-semibold uppercase tracking-[0.1em] text-subtle">
				{label}
			</div>
			<div
				className={clsx(
					"mt-1.5 font-display text-[24px] font-semibold leading-none tabular-nums",
					tone === "gold"
						? "text-gold"
						: tone === "danger"
							? "text-danger"
							: "text-primary",
				)}
			>
				{value}
			</div>
			{sub && (
				<div className="mt-1 font-sans text-[12px] text-muted">{sub}</div>
			)}
		</div>
	);
}

/**
 * A day series as bars.
 *
 * Hand-rolled rather than a chart library, matching the Studio: the whole app
 * ships zero charting dependencies and this is not the place to add one.
 * Bars only — a line implies continuity between days that daily counts do not
 * have.
 */
export function DayBars({
	series,
	label,
}: {
	series: { date: string; value: number }[];
	label: string;
}) {
	if (series.length === 0) {
		return (
			<p className="font-sans text-[13px] text-subtle">
				Nothing in this window yet.
			</p>
		);
	}
	const max = Math.max(...series.map((d) => d.value), 1);
	const peak = series.reduce((a, b) => (b.value > a.value ? b : a));
	return (
		<div>
			<div className="flex h-24 items-end gap-[3px]" role="img"
				aria-label={`${label}: ${series.length} days, peak ${peak.value} on ${peak.date}`}>
				{series.map((d) => (
					<span
						key={d.date}
						title={`${d.date} · ${d.value}`}
						className="flex-1 rounded-t-sm bg-brand/70 transition-colors hover:bg-brand"
						style={{ height: `${Math.max(2, (d.value / max) * 100)}%` }}
					/>
				))}
			</div>
			<div className="mt-2 flex justify-between font-sans text-[11px] text-subtle">
				<span>{series[0]?.date.slice(5)}</span>
				<span className="tabular-nums">peak {peak.value}</span>
				<span>{series[series.length - 1]?.date.slice(5)}</span>
			</div>
		</div>
	);
}

/** A labelled row with a number on the right. */
export function Row({
	label,
	value,
	caption,
	tone,
}: {
	label: React.ReactNode;
	value: string;
	caption?: string;
	tone?: "muted";
}) {
	return (
		<div className="flex items-baseline gap-3 border-t border-hairline py-2.5 first:border-t-0">
			<div className="min-w-0">
				<div className="font-sans text-[13.5px] text-primary">{label}</div>
				{caption && (
					<div className="font-sans text-[12px] text-subtle">{caption}</div>
				)}
			</div>
			<div
				className={clsx(
					"ml-auto shrink-0 font-sans text-[13.5px] font-semibold tabular-nums",
					tone === "muted" ? "text-muted" : "text-primary",
				)}
			>
				{value}
			</div>
		</div>
	);
}

/** Something the data cannot answer, said plainly rather than rendered as a
 *  zero. A zero and "we do not measure this" look identical on a chart. */
export function Caveat({ children }: { children: React.ReactNode }) {
	return (
		<p className="glass-tile mt-3 rounded-lg p-3 font-sans text-[12.5px] leading-relaxed text-muted">
			{children}
		</p>
	);
}

export function AdminSkeleton() {
	return (
		<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
			{[0, 1, 2, 3].map((i) => (
				<div key={i} className="glass-tile rounded-lg p-3.5">
					<div className="skeleton h-3 w-20 rounded-sm" />
					<div className="skeleton mt-2 h-6 w-16 rounded-sm" />
				</div>
			))}
		</div>
	);
}
