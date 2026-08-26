"use client";

import clsx from "clsx";

/** Count formatting shared by every studio number. */
export const fmt = (n: number) => {
	if (!Number.isFinite(n)) return "0";
	if (n < 10_000) return n.toLocaleString();
	if (n < 1_000_000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}K`;
	return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
};

export function StatTile({
	label,
	value,
	hint,
}: {
	label: string;
	value: string;
	hint?: string;
}) {
	return (
		<div className="rounded-xl border border-hairline bg-surface/60 px-3.5 py-3 min-w-0">
			<p className="font-sans text-[10.5px] font-semibold uppercase tracking-[0.12em] text-subtle truncate">
				{label}
			</p>
			<p className="font-display text-[22px] leading-tight font-semibold text-primary tabular-nums mt-0.5">
				{value}
			</p>
			{hint && (
				<p className="font-sans text-[11.5px] text-subtle truncate mt-0.5">
					{hint}
				</p>
			)}
		</div>
	);
}

/** Compact label/value row for the rail cards. */
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
		<div className="flex items-baseline justify-between gap-3 py-2 border-b border-hairline/60 last:border-0">
			<span className="font-sans text-[12.5px] text-muted truncate">
				{label}
			</span>
			<span className="font-sans text-[13.5px] font-semibold text-primary tabular-nums shrink-0">
				{value}
				{hint && (
					<span className="text-subtle font-normal text-[11.5px] ml-1.5">
						{hint}
					</span>
				)}
			</span>
		</div>
	);
}

/** Section card — the studio's one container shape. */
export function Panel({
	title,
	action,
	children,
	className,
}: {
	title?: string;
	action?: React.ReactNode;
	children: React.ReactNode;
	className?: string;
}) {
	return (
		<section
			className={clsx(
				"rounded-xl border border-hairline bg-surface/60 p-3.5 min-w-0",
				className,
			)}
		>
			{(title || action) && (
				<div className="flex items-center justify-between gap-2 mb-3">
					{title && (
						<h2 className="font-sans text-[12.5px] font-semibold text-primary">
							{title}
						</h2>
					)}
					{action}
				</div>
			)}
			{children}
		</section>
	);
}

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
					className={clsx(
						"h-7 px-2.5 rounded-pill font-sans text-[11.5px] font-medium transition-colors cursor-pointer tabular-nums",
						value === d
							? "bg-primary text-page font-semibold"
							: "bg-raised/60 text-muted hover:text-primary",
					)}
				>
					{d}d
				</button>
			))}
		</div>
	);
}
