"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import { fmt } from "@/components/studio/studio-ui";

export interface TrendPoint {
	date: string;
	impressions: number;
	engagements: number;
}

/** Round a max up to a clean axis ceiling (1/2/5 × 10^n). */
function niceCeil(v: number) {
	if (v <= 0) return 4;
	const mag = 10 ** Math.floor(Math.log10(v));
	for (const m of [1, 2, 2.5, 5, 10]) {
		if (v <= m * mag) return m * mag;
	}
	return 10 * mag;
}

const M = { top: 14, right: 14, bottom: 26, left: 46 };
const H = 240;

/**
 * The studio's trend chart, hand-built SVG: gridlines + y-axis ticks, dated
 * x-axis, a gradient area for impressions, a line for engagements, and a
 * hover crosshair with a real tooltip. currentColor + tokens keep it
 * theme-correct in both modes.
 */
export function TrendChart({
	daily,
	impressionsLabel,
	engagementsLabel,
}: {
	daily: TrendPoint[];
	impressionsLabel: string;
	engagementsLabel: string;
}) {
	const wrapRef = useRef<HTMLDivElement>(null);
	const [width, setWidth] = useState(640);
	const [hover, setHover] = useState<number | null>(null);

	useEffect(() => {
		const el = wrapRef.current;
		if (!el) return;
		const sync = () => setWidth(Math.max(280, el.clientWidth));
		sync();
		const ro = new ResizeObserver(sync);
		ro.observe(el);
		return () => ro.disconnect();
	}, []);

	// A single day still deserves a chart — pad it into a flat two-point run.
	const points = useMemo(
		() => (daily.length === 1 ? [daily[0], { ...daily[0] }] : daily),
		[daily],
	);

	// 15% headroom above the peak: without it a flat series sits welded to
	// the top gridline and reads as a filled block rather than a trend.
	const yMax = useMemo(
		() =>
			niceCeil(
				Math.max(
					1,
					...points.map((d) => Math.max(d.impressions, d.engagements)),
				) * 1.15,
			),
		[points],
	);

	const innerW = width - M.left - M.right;
	const innerH = H - M.top - M.bottom;
	const x = (i: number) =>
		M.left + (points.length > 1 ? (i / (points.length - 1)) * innerW : 0);
	const y = (v: number) => M.top + innerH - (v / yMax) * innerH;

	const linePath = (key: "impressions" | "engagements") =>
		points
			.map((d, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(d[key]).toFixed(1)}`)
			.join(" ");
	const areaPath = `${linePath("impressions")} L${x(points.length - 1).toFixed(1)},${
		M.top + innerH
	} L${x(0).toFixed(1)},${M.top + innerH} Z`;

	// Counts are whole numbers: on small ranges step by 1 rather than showing
	// quarter-fractions like 0.625 on an impressions axis.
	const yTicks = useMemo(() => {
		if (yMax <= 6) {
			return Array.from({ length: Math.round(yMax) + 1 }, (_, i) => i);
		}
		return [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(f * yMax));
	}, [yMax]);
	const xTickCount = Math.min(points.length, Math.max(2, Math.floor(innerW / 90)));
	const xTicks = Array.from({ length: xTickCount }, (_, i) =>
		Math.round((i / (xTickCount - 1)) * (points.length - 1)),
	);
	const dateLabel = (iso: string) => {
		const d = new Date(`${iso}T00:00:00`);
		return Number.isNaN(d.getTime())
			? iso
			: d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
	};

	const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
		const rect = e.currentTarget.getBoundingClientRect();
		const px = e.clientX - rect.left;
		const idx = Math.round(
			((px - M.left) / Math.max(1, innerW)) * (points.length - 1),
		);
		setHover(Math.min(points.length - 1, Math.max(0, idx)));
	};

	const hovered = hover !== null ? points[hover] : null;
	// Keep the tooltip inside the plot on both edges.
	const tipLeft =
		hover !== null
			? Math.min(Math.max(x(hover), M.left + 70), width - 90)
			: 0;

	return (
		<div ref={wrapRef} className="relative">
			<svg
				width={width}
				height={H}
				role="img"
				aria-label={impressionsLabel}
				onMouseMove={onMove}
				onMouseLeave={() => setHover(null)}
				className="block"
			>
				{/* grid + y labels */}
				{yTicks.map((v) => (
					<g key={v}>
						<line
							x1={M.left}
							x2={width - M.right}
							y1={y(v)}
							y2={y(v)}
							className="stroke-hairline"
							strokeWidth={1}
							strokeDasharray={v === 0 ? undefined : "3 5"}
						/>
						<text
							x={M.left - 8}
							y={y(v) + 3.5}
							textAnchor="end"
							className="fill-[var(--ws-text-subtle,#79716b)] font-sans tabular-nums"
							fontSize={10.5}
						>
							{fmt(v)}
						</text>
					</g>
				))}

				{/* x labels */}
				{xTicks.map((i) => (
					<text
						key={i}
						x={x(i)}
						y={H - 7}
						textAnchor="middle"
						className="fill-[var(--ws-text-subtle,#79716b)] font-sans"
						fontSize={10.5}
					>
						{dateLabel(points[i].date)}
					</text>
				))}

				{/* impressions area + line (gold) */}
				<g className="text-gold">
					<defs>
						<linearGradient id="ws-trend-fill" x1="0" y1="0" x2="0" y2="1">
							<stop offset="0%" stopColor="currentColor" stopOpacity="0.28" />
							<stop offset="100%" stopColor="currentColor" stopOpacity="0.02" />
						</linearGradient>
					</defs>
					<path d={areaPath} fill="url(#ws-trend-fill)" />
					<path
						d={linePath("impressions")}
						fill="none"
						stroke="currentColor"
						strokeWidth={2}
						strokeLinejoin="round"
						strokeLinecap="round"
					/>
				</g>

				{/* engagements line (neutral) */}
				<path
					d={linePath("engagements")}
					fill="none"
					stroke="currentColor"
					strokeWidth={1.75}
					strokeLinejoin="round"
					strokeLinecap="round"
					className="text-primary/50"
				/>

				{/* hover crosshair + markers */}
				{hover !== null && hovered && (
					<g>
						<line
							x1={x(hover)}
							x2={x(hover)}
							y1={M.top}
							y2={M.top + innerH}
							className="stroke-hairline"
							strokeWidth={1}
						/>
						<circle
							cx={x(hover)}
							cy={y(hovered.impressions)}
							r={4}
							className="fill-gold stroke-page"
							strokeWidth={2}
						/>
						<circle
							cx={x(hover)}
							cy={y(hovered.engagements)}
							r={3.5}
							className="fill-primary stroke-page"
							strokeWidth={2}
						/>
					</g>
				)}
			</svg>

			{/* tooltip */}
			{hover !== null && hovered && (
				<div
					className="pointer-events-none absolute top-1 -translate-x-1/2 rounded-lg bg-surface border border-hairline shadow-nav px-3 py-2 font-sans whitespace-nowrap"
					style={{ left: tipLeft }}
				>
					<p className="text-[11px] text-subtle mb-0.5">
						{dateLabel(hovered.date)}
					</p>
					<p className="text-[12px] text-primary tabular-nums">
						<span className="inline-block w-2 h-2 rounded-[2px] bg-brand mr-1.5" />
						{fmt(hovered.impressions)} {impressionsLabel.toLowerCase()}
					</p>
					<p className="text-[12px] text-primary tabular-nums">
						<span className="inline-block w-2 h-2 rounded-[2px] bg-primary/50 mr-1.5" />
						{fmt(hovered.engagements)} {engagementsLabel.toLowerCase()}
					</p>
				</div>
			)}

			<div className="flex items-center gap-4 mt-2">
				<span className="flex items-center gap-1.5 font-sans text-[12px] text-muted">
					<span className="w-2.5 h-2.5 rounded-[3px] bg-brand" />
					{impressionsLabel}
				</span>
				<span className="flex items-center gap-1.5 font-sans text-[12px] text-muted">
					<span className="w-2.5 h-2.5 rounded-[3px] bg-primary/50" />
					{engagementsLabel}
				</span>
			</div>
		</div>
	);
}

/** Ranked breakdown rows: label · value · share bar. Countries, surfaces —
 *  anything with a name and a count. */
export function BarList({
	items,
	unknownLabel,
}: {
	items: { key: string; label: string; value: number }[];
	unknownLabel?: string;
}) {
	const total = Math.max(
		1,
		items.reduce((sum, i) => sum + i.value, 0),
	);
	return (
		<div className="flex flex-col gap-3">
			{items.map((item) => {
				const pct = (item.value / total) * 100;
				return (
					<div key={item.key}>
						<div className="flex items-center justify-between font-sans text-[13px] mb-1">
							<span className="text-primary font-medium truncate min-w-0">
								{item.label || unknownLabel || item.key}
							</span>
							<span className="text-muted tabular-nums shrink-0 ml-3">
								{fmt(item.value)}
								<span className="text-subtle ml-1.5">
									{pct >= 1 ? Math.round(pct) : "<1"}%
								</span>
							</span>
						</div>
						<div className="h-2 rounded-pill bg-raised overflow-hidden">
							<div
								className="h-full bg-brand/75 rounded-pill"
								style={{ width: `${Math.max(2, pct)}%` }}
							/>
						</div>
					</div>
				);
			})}
		</div>
	);
}

/** ISO code → localized country name; "??" stays the unknown bucket. */
export function countryLabel(code: string, locale: string): string {
	if (!code || code === "??") return "";
	try {
		return (
			new Intl.DisplayNames([locale], { type: "region" }).of(code) ?? code
		);
	} catch {
		return code;
	}
}
