"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

/**
 * Catmull-Rom → cubic-bézier smoothing. Analytics series read as motion, and
 * a hard polyline turns three data points into a mountain range; the gentle
 * curve is what every reference-grade dashboard draws. Tension 1/6 keeps the
 * curve inside the data's envelope, so it never invents a peak.
 */
function smoothPath(pts: { x: number; y: number }[]) {
	if (pts.length === 0) return "";
	if (pts.length === 1) return `M${pts[0].x},${pts[0].y}`;
	let d = `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
	for (let i = 0; i < pts.length - 1; i++) {
		const p0 = pts[Math.max(0, i - 1)];
		const p1 = pts[i];
		const p2 = pts[i + 1];
		const p3 = pts[Math.min(pts.length - 1, i + 2)];
		const c1x = p1.x + (p2.x - p0.x) / 6;
		const c1y = p1.y + (p2.y - p0.y) / 6;
		const c2x = p2.x - (p3.x - p1.x) / 6;
		const c2y = p2.y - (p3.y - p1.y) / 6;
		d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
	}
	return d;
}

const M = { top: 14, right: 26, bottom: 26, left: 46 };
const H = 250;

const INK_FAINT = "rgb(255 255 255 / 0.32)";
const GRID = "rgb(255 255 255 / 0.05)";
const SERIES_2 = "rgb(255 255 255 / 0.38)";

/**
 * The trend chart: smoothed impressions curve with a flat low-opacity fill
 * (no gradient — the fill states "area under the curve", nothing more), a
 * quieter engagements curve, faint grid, dated axis, hover crosshair with a
 * solid tooltip. Fixed inks: this only ever renders on the studio's dark.
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

	const path = (key: "impressions" | "engagements") =>
		smoothPath(points.map((d, i) => ({ x: x(i), y: y(d[key]) })));
	const areaPath = `${path("impressions")} L${x(points.length - 1).toFixed(1)},${
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
	const xTickCount = Math.min(
		points.length,
		Math.max(2, Math.floor(innerW / 90)),
	);
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
		hover !== null ? Math.min(Math.max(x(hover), M.left + 70), width - 90) : 0;

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
				{yTicks.map((v) => (
					<g key={v}>
						<line
							x1={M.left}
							x2={width - M.right}
							y1={y(v)}
							y2={y(v)}
							stroke={GRID}
							strokeWidth={1}
						/>
						<text
							x={M.left - 8}
							y={y(v) + 3.5}
							textAnchor="end"
							fill={INK_FAINT}
							className="font-sans tabular-nums"
							fontSize={10.5}
						>
							{fmt(v)}
						</text>
					</g>
				))}

				{xTicks.map((i) => (
					<text
						key={i}
						x={x(i)}
						y={H - 7}
						textAnchor="middle"
						fill={INK_FAINT}
						className="font-sans"
						fontSize={10.5}
					>
						{dateLabel(points[i].date)}
					</text>
				))}

				{/* impressions: flat fill + smooth brand curve */}
				<g style={{ color: "var(--ws-brand-primary, #EAB308)" }}>
					<path d={areaPath} fill="currentColor" fillOpacity={0.07} />
					<path
						d={path("impressions")}
						fill="none"
						stroke="currentColor"
						strokeWidth={2}
						strokeLinejoin="round"
						strokeLinecap="round"
					/>
				</g>

				{/* engagements: quieter sibling */}
				<path
					d={path("engagements")}
					fill="none"
					stroke={SERIES_2}
					strokeWidth={1.5}
					strokeLinejoin="round"
					strokeLinecap="round"
				/>

				{hover !== null && hovered && (
					<g>
						<line
							x1={x(hover)}
							x2={x(hover)}
							y1={M.top}
							y2={M.top + innerH}
							stroke="rgb(255 255 255 / 0.14)"
							strokeWidth={1}
						/>
						<circle
							cx={x(hover)}
							cy={y(hovered.impressions)}
							r={4}
							fill="var(--ws-brand-primary, #EAB308)"
							stroke="#131211"
							strokeWidth={2}
						/>
						<circle
							cx={x(hover)}
							cy={y(hovered.engagements)}
							r={3.5}
							fill="#fafaf9"
							stroke="#131211"
							strokeWidth={2}
						/>
					</g>
				)}
			</svg>

			{hover !== null && hovered && (
				<div
					className="pointer-events-none absolute top-1 -translate-x-1/2 rounded-lg bg-[#232120] px-3 py-2 font-sans whitespace-nowrap shadow-nav"
					style={{ left: tipLeft }}
				>
					<p className="text-[11px] glass-ink-faint mb-0.5">
						{dateLabel(hovered.date)}
					</p>
					<p className="text-[12px] glass-ink tabular-nums">
						<span className="mr-1.5 inline-block h-2 w-2 rounded-[2px] bg-[var(--ws-brand-primary)]" />
						{fmt(hovered.impressions)} {impressionsLabel.toLowerCase()}
					</p>
					<p className="text-[12px] glass-ink tabular-nums">
						<span className="mr-1.5 inline-block h-2 w-2 rounded-[2px] bg-[#fafaf9]/40" />
						{fmt(hovered.engagements)} {engagementsLabel.toLowerCase()}
					</p>
				</div>
			)}

			<div className="mt-2 flex items-center gap-4">
				<span className="flex items-center gap-1.5 font-sans text-[12px] glass-ink-dim">
					<span className="h-2 w-2 rounded-pill bg-[var(--ws-brand-primary)]" />
					{impressionsLabel}
				</span>
				<span className="flex items-center gap-1.5 font-sans text-[12px] glass-ink-dim">
					<span className="h-2 w-2 rounded-pill bg-[#fafaf9]/40" />
					{engagementsLabel}
				</span>
			</div>
		</div>
	);
}

/**
 * The stat-card pulse: the metric's daily shape as micro-bars, peak in brand.
 *
 * Bars, not a line — at 40px tall a line is noise. The peak is highlighted
 * rather than the latest day, because a young account's latest day is
 * usually zero and a brand-coloured 2px stub reads as a stray underline
 * rather than as "today".
 */
export function MiniBars({ values }: { values: number[] }) {
	// More than ~20 bars in 90px turns to moiré; bucket wider windows down.
	const bars = useMemo(() => {
		const MAX = 16;
		if (values.length <= MAX) return values;
		const size = Math.ceil(values.length / MAX);
		const out: number[] = [];
		for (let i = 0; i < values.length; i += size) {
			out.push(
				values.slice(i, i + size).reduce((a, b) => a + b, 0) / size,
			);
		}
		return out;
	}, [values]);

	const W = 96;
	const HH = 40;
	const max = Math.max(1, ...bars);
	const peak = bars.indexOf(Math.max(...bars));
	const gap = 2.5;
	const bw = (W - gap * (bars.length - 1)) / Math.max(1, bars.length);

	return (
		<svg
			viewBox={`0 0 ${W} ${HH}`}
			className="block h-10 w-24 shrink-0"
			aria-hidden
		>
			{bars.map((v, i) => {
				const h = Math.max(2, (v / max) * HH);
				return (
					<rect
						key={`${i}-${v}`}
						x={i * (bw + gap)}
						y={HH - h}
						width={bw}
						height={h}
						rx={1.5}
						fill={
							i === peak && v > 0
								? "var(--ws-brand-primary, #EAB308)"
								: "rgb(255 255 255 / 0.14)"
						}
					/>
				);
			})}
		</svg>
	);
}

/** Fixed accent set for categorical slices. Brand leads; the rest are set
 *  apart in hue so five countries never read as five blues. */
export const SLICE_COLORS = [
	"var(--ws-brand-primary, #EAB308)",
	"#34D399",
	"#FBBF24",
	"#F472B6",
	"#A78BFA",
	"#64748B",
];

/**
 * Share-of-whole donut with its legend. The ring carries proportion, the
 * legend carries names and exact counts, the centre carries the total —
 * three reads, one component.
 */
export function DonutChart({
	items,
	centerLabel,
	unknownLabel,
}: {
	items: { key: string; label: string; value: number; glyph?: string }[];
	centerLabel: string;
	unknownLabel?: string;
}) {
	const size = 168;
	const stroke = 18;
	const r = (size - stroke) / 2;
	const c = 2 * Math.PI * r;
	const total = Math.max(
		1,
		items.reduce((s, i) => s + i.value, 0),
	);

	// Beyond five slices the ring turns to confetti; fold the tail into one.
	const shown = items.slice(0, 5);
	const rest = items.slice(5).reduce((s, i) => s + i.value, 0);
	const slices = rest > 0
		? [...shown, { key: "__rest", label: "…", value: rest, glyph: "" }]
		: shown;

	let acc = 0;
	const GAP = 2.5; // px of ring left blank between slices

	return (
		<div className="flex items-center gap-6">
			<div className="relative shrink-0" style={{ width: size, height: size }}>
				<svg width={size} height={size} className="-rotate-90">
					{slices.map((s, i) => {
						const frac = s.value / total;
						const dash = Math.max(0, frac * c - GAP);
						const el = (
							<circle
								key={s.key}
								cx={size / 2}
								cy={size / 2}
								r={r}
								fill="none"
								stroke={SLICE_COLORS[i % SLICE_COLORS.length]}
								strokeWidth={stroke}
								strokeDasharray={`${dash} ${c - dash}`}
								strokeDashoffset={-acc * c}
							/>
						);
						acc += frac;
						return el;
					})}
				</svg>
				<div className="absolute inset-0 flex flex-col items-center justify-center">
					<span className="font-display text-[24px] font-semibold leading-none glass-ink tabular-nums">
						{fmt(total)}
					</span>
					<span className="mt-1 font-sans text-[10px] uppercase tracking-[0.1em] glass-ink-faint">
						{centerLabel}
					</span>
				</div>
			</div>

			<div className="flex min-w-0 flex-1 flex-col gap-2.5">
				{slices.map((s, i) => (
					<div
						key={s.key}
						className="flex items-center gap-2 font-sans text-[12.5px]"
					>
						<span
							className="h-2 w-2 shrink-0 rounded-pill"
							style={{ background: SLICE_COLORS[i % SLICE_COLORS.length] }}
						/>
						{s.glyph && (
							<span className="shrink-0 text-[13px] leading-none">
								{s.glyph}
							</span>
						)}
						<span className="min-w-0 flex-1 truncate glass-ink-dim">
							{s.label || unknownLabel || s.key}
						</span>
						<span className="shrink-0 font-semibold glass-ink tabular-nums">
							{fmt(s.value)}
						</span>
					</div>
				))}
			</div>
		</div>
	);
}

/** Ranked breakdown rows: label · value · share bar. Flat brand fill. */
export function BarList({
	items,
	unknownLabel,
}: {
	items: { key: string; label: string; value: number; glyph?: string }[];
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
						<div className="mb-1 flex items-center justify-between font-sans text-[13px]">
							<span className="flex min-w-0 items-center gap-1.5 font-medium glass-ink">
								{item.glyph && (
									<span className="shrink-0 leading-none">{item.glyph}</span>
								)}
								<span className="truncate">
									{item.label || unknownLabel || item.key}
								</span>
							</span>
							<span className="ml-3 shrink-0 glass-ink-dim tabular-nums">
								{fmt(item.value)}
								<span className="ml-1.5 glass-ink-faint">
									{pct >= 1 ? Math.round(pct) : "<1"}%
								</span>
							</span>
						</div>
						<div className="h-1.5 overflow-hidden rounded-pill bg-[#fafaf9]/[0.07]">
							<div
								className="h-full rounded-pill bg-[var(--ws-brand-primary)]"
								style={{ width: `${Math.max(2, pct)}%` }}
							/>
						</div>
					</div>
				);
			})}
		</div>
	);
}

/**
 * ISO-3166 alpha-2 → flag emoji, by offsetting each letter into the
 * regional-indicator block.
 *
 * The design system bans emoji *as icons*; a flag is data — the country
 * itself — and there is no flag set in the 74-icon library. Platforms
 * without flag glyphs (Windows Chrome) render the two letters instead,
 * which is a correct fallback rather than tofu.
 */
export function countryFlag(code: string): string {
	if (!code || code.length !== 2 || code === "??") return "";
	const up = code.toUpperCase();
	if (!/^[A-Z]{2}$/.test(up)) return "";
	return String.fromCodePoint(
		...[...up].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65),
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
