"use client";

import clsx from "clsx";
import { ChartBar, ChartLine, ChartPie, Check, Gauge, Minus, Palette, Plus, Scales, Table, Wallet } from "@phosphor-icons/react";
import { motion } from "framer-motion";
import { type PointerEvent, useEffect, useRef, useState } from "react";
import { EASE_OUT_EXPO } from "@/lib/motion-presets";
import {
	arr,
	CopyBtn,
	Delta,
	Frame,
	fmt,
	money,
	num,
	type Props,
	ramp,
	rec,
	SERIES,
	short,
	str,
	T,
	Tag,
	Txt,
	useStill,
	useStripEnd,
	well,
} from "./parts";

/* Numbers and choices: table, compare, proscons, stats, chart, budget,
   progress, decision, market, palette. Charts are hand-rolled SVG drawn at
   their real width (no chart library), read by scrubbing, the way Stocks
   reads: the figure above the chart follows the finger. */

type R = Record<string, unknown>;

/** A bar or ring draws in once on a live answer; a reloaded thread or reduced motion lands drawn. */
const grow = (still: boolean, i = 0) => (still ? { duration: 0 } : { duration: 0.6, ease: EASE_OUT_EXPO, delay: Math.min(i * 0.035, 0.21) });

export function TableWidget({ data, title, live }: Props<R>) {
	const cols = arr(data.columns).map(str);
	const rows = arr<unknown[]>(data.rows);
	const [strip, end, edge] = useStripEnd<HTMLDivElement>();
	const numeric = cols.map((_, c) => rows.length > 0 && rows.every((r) => typeof arr(r)[c] === "number" || arr(r)[c] === ""));
	const caption = str(data.caption);
	return (
		<Frame title={title || caption || "Table"} icon={<Table />} live={live} flush>
			<div ref={strip} data-end={end} className={clsx(edge, "overflow-x-auto pb-2")}>
				<table className="w-full min-w-max border-collapse font-sans text-[calc(14px*var(--ws-fs))]">
					{caption && title && <caption className="sr-only">{caption}</caption>}
					<thead>
						<tr>
							{cols.map((c, i) => (
								<th
									// biome-ignore lint/suspicious/noArrayIndexKey: columns in order
									key={i}
									scope="col"
									className={clsx(
										"h-9 px-3 align-bottom font-sans text-[calc(13px*var(--ws-fs))] font-medium text-muted first:pl-4 last:pr-4 sm:first:pl-5 sm:last:pr-5",
										numeric[i] ? "text-right" : "text-left",
									)}
								>
									<Txt text={c} />
								</th>
							))}
						</tr>
					</thead>
					<tbody>
						{rows.map((r, i) => (
							// biome-ignore lint/suspicious/noArrayIndexKey: rows in order
							<tr key={i} className="border-hairline border-t transition-colors hover:bg-[var(--vivid-well)]">
								{cols.map((_, c) => {
									const v = arr(r)[c];
									const Cell = c === 0 ? "th" : "td";
									return (
										<Cell
											// biome-ignore lint/suspicious/noArrayIndexKey: cells in order
											key={c}
											scope={c === 0 ? "row" : undefined}
											className={clsx(
												"h-11 px-3 text-left align-middle first:pl-4 last:pr-4 sm:first:pl-5 sm:last:pr-5",
												c === 0 ? "font-medium text-primary" : "font-normal text-primary/85",
												numeric[c] && "text-right tabular-nums",
											)}
										>
											{typeof v === "number" ? fmt(v, 4) : <Txt text={v} />}
										</Cell>
									);
								})}
							</tr>
						))}
					</tbody>
				</table>
			</div>
			{caption && title && <p className={clsx(T.label, "px-4 pb-4 sm:px-5")}>{caption}</p>}
		</Frame>
	);
}

export function CompareWidget({ data, title, live }: Props<R>) {
	const items = arr<R>(data.items);
	const best = num(data.best);
	const keys = [...new Set(items.flatMap((it) => Object.keys(rec(it.attrs))))];
	const [strip, end, edge] = useStripEnd<HTMLDivElement>();
	const n = items.length;
	// Every attribute is one grid row across all items, so values line up side by side.
	const cell = (i: number, extra?: string) =>
		clsx("min-w-0 px-3 sm:px-4", best === i && "bg-[var(--vivid-brand-wash)]", extra);
	return (
		<Frame title={title || "Side by side"} icon={<Scales />} live={live} flush>
			<div ref={strip} data-end={end} className={clsx(edge, "overflow-x-auto px-2 pb-2 sm:px-3")}>
				<div className="grid min-w-max" style={{ gridTemplateColumns: `repeat(${n}, minmax(148px, 1fr))` }}>
					{items.map((it, i) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: items in order
						<div key={`h${i}`} className={cell(i, "flex flex-col gap-2 rounded-t-[13px] pt-3 pb-3")}>
							{str(it.image) && (
								// biome-ignore lint/performance/noImgElement: a remote picture the model chose; no Next loader for arbitrary hosts
								<img src={str(it.image)} alt="" className="aspect-[4/3] w-full rounded-[10px] bg-[var(--vivid-well)] object-cover" />
							)}
							<div className="flex min-h-[44px] flex-col gap-0.5">
								<span className="flex items-center gap-1.5">
									<span className={clsx(T.strong, "min-w-0")}>
										<Txt text={it.name} />
									</span>
								</span>
								{str(it.subtitle) && <span className={T.label}>{str(it.subtitle)}</span>}
								{best === i && (
									<span className="mt-1">
										<Tag tone="brand">Best pick</Tag>
									</span>
								)}
							</div>
						</div>
					))}
					{keys.map((k, r) =>
						items.map((it, i) => {
							const lastRow = r === keys.length - 1;
							return (
								<div
									// biome-ignore lint/suspicious/noArrayIndexKey: one cell per item per attribute
									key={`${k}${i}`}
									className={cell(i, clsx("flex flex-col gap-0.5 py-2.5", lastRow && "rounded-b-[13px] pb-3.5"))}
								>
									<span className={clsx(T.label, "border-hairline border-t pt-2.5")}>{k}</span>
									<span className={T.body}>
										<Txt text={rec(it.attrs)[k] ?? "–"} />
									</span>
								</div>
							);
						}),
					)}
				</div>
			</div>
			{str(data.verdict) && (
				<p className={clsx(T.body, "px-4 pt-2 pb-4 sm:px-5 sm:pb-5")}>
					<Txt text={data.verdict} />
				</p>
			)}
		</Frame>
	);
}

export function ProsConsWidget({ data, title, live }: Props<R>) {
	const pros = arr(data.pros);
	const cons = arr(data.cons);
	const Col = ({ items, good }: { items: unknown[]; good: boolean }) => (
		<div className="flex min-w-0 flex-col gap-3">
			<span className={clsx(T.head, "flex items-center gap-2")}>
				<span
					className={clsx(
						"flex size-5 items-center justify-center rounded-full",
						good ? "bg-[var(--vivid-credit-wash)] text-credit" : "bg-[var(--vivid-debit-wash)] text-debit",
					)}
				>
					{good ? <Plus weight="bold" className="size-3" /> : <Minus weight="bold" className="size-3" />}
				</span>
				{good ? "Pros" : "Cons"}
				<span className="font-normal text-muted tabular-nums">{items.length}</span>
			</span>
			<ul className="flex flex-col">
				{items.map((p, i) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: points in order
					<li key={i} className={clsx(T.body, "border-hairline border-t py-2.5 first:border-t-0 first:pt-0")}>
						<Txt text={p} />
					</li>
				))}
				{items.length === 0 && <li className={T.label}>None worth noting.</li>}
			</ul>
		</div>
	);
	return (
		<Frame title={title || str(data.subject) || "Pros and cons"} icon={<Scales />} live={live}>
			<div className="grid gap-5 sm:grid-cols-2 sm:gap-6">
				<Col items={pros} good />
				<Col items={cons} good={false} />
			</div>
			{str(data.verdict) && (
				<p className={clsx(well, T.body, "mt-5 px-4 py-3")}>
					<Txt text={data.verdict} />
				</p>
			)}
		</Frame>
	);
}

export function StatsWidget({ data, title, live }: Props<R>) {
	const items = arr<R>(data.items);
	const n = items.length;
	return (
		<Frame title={title || "Key numbers"} icon={<ChartBar />} live={live}>
			<div className={clsx("grid gap-2", n === 1 ? "grid-cols-1" : n === 3 ? "grid-cols-3" : "grid-cols-2", n >= 4 && "sm:grid-cols-4")}>
				{items.map((it, i) => {
					const d = num(it.delta);
					return (
						// biome-ignore lint/suspicious/noArrayIndexKey: items in order
						<div key={i} className={clsx(well, "flex min-w-0 flex-col gap-1.5 px-3.5 py-3")}>
							<span className={clsx(T.label, "truncate")}>{str(it.label)}</span>
							<span className="flex min-w-0 items-baseline gap-1">
								<span className={clsx(T.figure, "truncate")}>{str(it.value)}</span>
								{str(it.unit) && <span className={clsx(T.label, "shrink-0")}>{str(it.unit)}</span>}
							</span>
							{d !== null && (
								<span>
									<Delta value={d} />
								</span>
							)}
							{str(it.note) && <span className={T.label}>{str(it.note)}</span>}
						</div>
					);
				})}
			</div>
		</Frame>
	);
}

/* ---- charts ---- */

const H = 168;

/** A round top for the axis, close above the peak so the marks use the height. */
function niceMax(v: number) {
	if (v <= 0) return 1;
	const p = 10 ** Math.floor(Math.log10(v));
	for (const m of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * p >= v) return m * p;
	return 10 * p;
}

/** The chart draws at its real width, so axis text stays text-sized at any card width. */
function useWidth(fallback = 320) {
	const ref = useRef<HTMLDivElement>(null);
	const [w, setW] = useState(fallback);
	useEffect(() => {
		const el = ref.current;
		if (!el) return;
		const ro = new ResizeObserver(([e]) => setW(Math.max(160, Math.round(e.contentRect.width))));
		ro.observe(el);
		return () => ro.disconnect();
	}, []);
	return [ref, w] as const;
}

/** Catmull-Rom through the points, as cubic beziers (the Studio's trend curve). */
function smooth(pts: [number, number][]) {
	if (pts.length < 2) return "";
	let d = `M${pts[0][0]},${pts[0][1]}`;
	for (let i = 0; i < pts.length - 1; i++) {
		const p0 = pts[i - 1] ?? pts[i];
		const p1 = pts[i];
		const p2 = pts[i + 1];
		const p3 = pts[i + 2] ?? p2;
		const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
		const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
		d += ` C${c1[0]},${c1[1]} ${c2[0]},${c2[1]} ${p2[0]},${p2[1]}`;
	}
	return d;
}

/** One sentence a screen reader hears for the chart: its range and its peak. */
function summary(kind: string, labels: string[], series: { name: string; values: number[] }[], unit: string) {
	const s0 = series[0];
	const peak = s0.values.indexOf(Math.max(...s0.values));
	const u = unit ? ` ${unit}` : "";
	return `${kind} chart of ${series.map((x) => x.name).join(", ")}, ${labels[0]} to ${labels[labels.length - 1]}; highest ${labels[peak]} at ${fmt(s0.values[peak])}${u}.`;
}

/** The numbers behind a chart, for a screen reader (the design's table fallback). */
function SrTable({ labels, series }: { labels: string[]; series: { name: string; values: number[] }[] }) {
	return (
		<table className="sr-only">
			<thead>
				<tr>
					<th scope="col">Label</th>
					{series.map((x, i) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: series in order
						<th key={i} scope="col">
							{x.name}
						</th>
					))}
				</tr>
			</thead>
			<tbody>
				{labels.map((l, i) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: rows in order
					<tr key={i}>
						<th scope="row">{l}</th>
						{series.map((x, j) => (
							// biome-ignore lint/suspicious/noArrayIndexKey: cells in order
							<td key={j}>{x.values[i]}</td>
						))}
					</tr>
				))}
			</tbody>
		</table>
	);
}

export function ChartWidget({ data, title, live }: Props<R>) {
	const type = str(data.type) || "bar";
	const labels = arr(data.labels).map(str);
	const series = arr<R>(data.series).map((x) => ({ name: str(x.name), values: arr(x.values).map((v) => num(v) ?? 0) }));
	const unit = str(data.unit);
	const [sel, setSel] = useState<number | null>(null);
	const [measure, W] = useWidth();
	const still = useStill(live);
	if (!labels.length || !series.length) return null;
	const show = (v: number) => `${fmt(v)}${unit ? ` ${unit}` : ""}`;

	if (type === "pie" || type === "donut") {
		const vals = series[0].values.map((v) => Math.max(0, v));
		return (
			<Frame title={title || series[0].name || "Breakdown"} icon={<ChartPie />} live={live}>
				<Ring labels={labels} values={vals} donut={type === "donut"} live={live} format={show} />
				<SrTable labels={labels} series={series} />
			</Frame>
		);
	}

	const line = type === "line";
	const all = series.flatMap((x) => x.values);
	const lo = Math.min(0, ...all);
	const hi = niceMax(Math.max(...all, 0) - lo) + lo;
	const pad = { l: 4, r: 40, t: 10, b: 26 };
	const iw = W - pad.l - pad.r;
	const ih = H - pad.t - pad.b;
	const y = (v: number) => pad.t + ih - ((v - lo) / (hi - lo || 1)) * ih;
	const ticks = [0, 0.5, 1].map((f) => lo + (hi - lo) * f);
	const step = iw / labels.length;
	const x = (i: number) => pad.l + step * (i + 0.5);
	const every = Math.ceil(labels.length / Math.max(2, Math.floor(iw / 56)));
	const at = sel ?? labels.length - 1;
	const s0 = series[0].values;
	const change = line && series.length === 1 && s0[0] ? ((s0[s0.length - 1] - s0[0]) / Math.abs(s0[0])) * 100 : null;
	const pick = (e: PointerEvent<SVGSVGElement>) => {
		const r = e.currentTarget.getBoundingClientRect();
		const i = Math.floor((e.clientX - r.left - pad.l) / step);
		setSel(Math.min(Math.max(i, 0), labels.length - 1));
	};

	return (
		<Frame title={title || "Chart"} icon={line ? <ChartLine /> : <ChartBar />} live={live}>
			{/* The readout: the selected point, or the latest when nothing is selected. */}
			<div className="mb-3 flex min-h-[56px] flex-wrap items-end justify-between gap-x-4 gap-y-2" aria-live="polite">
				{series.length === 1 ? (
					<div className="flex flex-col gap-0.5">
						<span className={T.label}>{labels[at]}</span>
						<span className="flex items-baseline gap-2">
							<span className={clsx(T.figure, "text-[calc(28px*var(--ws-fs))]")}>{fmt(s0[at] ?? 0)}</span>
							{unit && <span className={T.label}>{unit}</span>}
							{sel === null && change !== null && <Delta value={change} digits={1} />}
						</span>
					</div>
				) : (
					<div className="flex flex-col gap-1.5">
						<span className={T.label}>{labels[at]}</span>
						<div className="flex flex-wrap gap-x-4 gap-y-1">
							{series.map((x2, i) => (
								<span key={x2.name + i} className="flex items-center gap-1.5">
									<span className="size-2 rounded-full" style={{ background: SERIES[i % SERIES.length] }} />
									<span className={T.label}>{x2.name}</span>
									<span className={clsx(T.strong, "tabular-nums")}>{fmt(x2.values[at] ?? 0)}</span>
								</span>
							))}
						</div>
					</div>
				)}
			</div>
			<div ref={measure} className="relative">
				<svg
					viewBox={`0 0 ${W} ${H}`}
					width={W}
					height={H}
					className="block max-w-full touch-pan-y overflow-visible select-none"
					role="img"
					aria-label={summary(line ? "Line" : "Bar", labels, series, unit)}
					onPointerMove={pick}
					onPointerDown={pick}
					onPointerLeave={() => setSel(null)}
				>
					{ticks.map((t) => (
						<g key={t}>
							<line
								x1={pad.l}
								x2={W - pad.r + 4}
								y1={y(t)}
								y2={y(t)}
								stroke="var(--ws-border-hairline)"
								strokeWidth={1}
								strokeDasharray={t === lo ? undefined : "2 4"}
							/>
							<text x={W} y={y(t) + 4} textAnchor="end" fontSize={12} fill="var(--ws-text-muted)" className="tabular-nums">
								{short(t)}
							</text>
						</g>
					))}
					{labels.map((l, i) =>
						i % every === 0 || i === at ? (
							<text
								key={`l${l}${i}`}
								x={x(i)}
								y={H - 6}
								textAnchor="middle"
								fontSize={12}
								fill={i === at && sel !== null ? "var(--ws-text-primary)" : "var(--ws-text-muted)"}
								fontWeight={i === at && sel !== null ? 600 : 400}
								opacity={i % every === 0 || sel !== null ? 1 : 0}
							>
								{l.length > 9 ? `${l.slice(0, 8)}…` : l}
							</text>
						) : null,
					)}
					{line && sel !== null && <line x1={x(at)} x2={x(at)} y1={pad.t} y2={pad.t + ih} stroke="var(--ws-text-muted)" strokeWidth={1} />}
					{line
						? series.map((s, si) => {
								const pts = s.values.map((v, i) => [x(i), y(v)] as [number, number]);
								const d = smooth(pts);
								const color = SERIES[si % SERIES.length];
								return (
									<g key={s.name + si}>
										{si === 0 && series.length === 1 && (
											<motion.path
												d={`${d} L${pts[pts.length - 1][0]},${y(lo)} L${pts[0][0]},${y(lo)} Z`}
												fill="var(--vivid-brand-wash)"
												initial={still ? false : { opacity: 0 }}
												animate={{ opacity: 1 }}
												transition={still ? { duration: 0 } : { duration: 0.5, delay: 0.3 }}
											/>
										)}
										<motion.path
											d={d}
											fill="none"
											stroke={color}
											strokeWidth={2.5}
											strokeLinecap="round"
											strokeDasharray={si >= 2 ? "6 5" : undefined}
											initial={still || si >= 2 ? false : { pathLength: 0 }}
											animate={{ pathLength: 1 }}
											transition={still ? { duration: 0 } : { duration: 0.9, ease: EASE_OUT_EXPO }}
										/>
										{pts[at] && (sel !== null || si === 0) && (
											<circle cx={pts[at][0]} cy={pts[at][1]} r={4.5} fill={color} stroke="var(--ws-bg-page)" strokeWidth={2} />
										)}
									</g>
								);
							})
						: labels.map((l, i) => {
								const gw = Math.min(step * 0.62, 44);
								const bw = gw / series.length;
								return (
									<g key={`b${l}${i}`}>
										{series.map((s, si) => {
											const v = s.values[i] ?? 0;
											const top = y(Math.max(v, 0));
											const h = Math.abs(y(v) - y(0));
											const lit = sel === null || sel === i;
											return (
												<motion.rect
													key={s.name + si}
													x={x(i) - gw / 2 + bw * si + 1}
													y={top}
													width={Math.max(bw - 2, 1)}
													height={Math.max(h, 1)}
													rx={Math.min(5, bw / 3)}
													fill={series.length === 1 ? "var(--ws-brand-primary)" : SERIES[si % SERIES.length]}
													opacity={lit ? 1 : 0.32}
													style={{ transformBox: "fill-box", transformOrigin: "50% 100%" }}
													initial={still ? false : { scaleY: 0 }}
													animate={{ scaleY: 1 }}
													transition={grow(still, i)}
												/>
											);
										})}
									</g>
								);
							})}
				</svg>
			</div>
			<SrTable labels={labels} series={series} />
		</Frame>
	);
}

/** A pie or donut with its legend; the centre carries the total, or the selected slice. */
function Ring({
	labels,
	values,
	donut,
	live,
	format,
	center,
}: {
	labels: string[];
	values: number[];
	donut: boolean;
	live?: boolean;
	format: (v: number) => string;
	center?: string;
}) {
	const [sel, setSel] = useState<number | null>(null);
	const still = useStill(live);
	const total = values.reduce((a, b) => a + b, 0) || 1;
	const size = 148;
	const c0 = size / 2;
	const rr = donut ? 58 : 37;
	const sw = donut ? 18 : 74;
	const c = 2 * Math.PI * rr;
	const gap = donut && values.length > 1 ? 2 : 0;
	let acc = 0;
	return (
		<div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:gap-6">
			<div className="relative shrink-0" style={{ width: size, height: size }}>
				<svg viewBox={`0 0 ${size} ${size}`} className="size-full -rotate-90" aria-hidden>
					{donut && <circle cx={c0} cy={c0} r={rr} fill="none" stroke="var(--vivid-track)" strokeWidth={sw} />}
					{values.map((v, i) => {
						const len = (v / total) * c;
						const off = acc;
						acc += len;
						return (
							<motion.circle
								// biome-ignore lint/suspicious/noArrayIndexKey: slices in order
								key={i}
								cx={c0}
								cy={c0}
								r={rr}
								fill="none"
								stroke={ramp(i, values.length)}
								strokeWidth={sel === i && donut ? sw + 6 : sw}
								strokeDasharray={`${Math.max(len - gap, 0)} ${c}`}
								strokeDashoffset={-off}
								initial={still ? false : { opacity: 0 }}
								animate={{ opacity: sel === null || sel === i ? 1 : 0.35 }}
								transition={grow(still, i)}
								onPointerEnter={() => setSel(i)}
								onPointerLeave={() => setSel(null)}
							/>
						);
					})}
				</svg>
				{donut && (
					<div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
						<span className={clsx(T.label, "max-w-full truncate")}>{sel !== null ? labels[sel] : "Total"}</span>
						<span className="max-w-full truncate font-display text-[calc(18px*var(--ws-fs))] font-semibold text-primary tabular-nums">
							{sel !== null ? format(values[sel]) : (center ?? format(total))}
						</span>
					</div>
				)}
			</div>
			<ul className="flex w-full min-w-0 flex-col">
				{labels.map((l, i) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: legend in order
					<li key={i} className="border-hairline border-t first:border-t-0">
						<button
							type="button"
							onClick={() => setSel((x) => (x === i ? null : i))}
							onPointerEnter={() => setSel(i)}
							onPointerLeave={() => setSel(null)}
							aria-pressed={sel === i}
							className={clsx(
								"-mx-2 flex min-h-[40px] w-[calc(100%+16px)] cursor-pointer items-center gap-2.5 rounded-[10px] px-2 text-left transition-colors",
								sel === i && "bg-[var(--vivid-well)]",
							)}
						>
							<span className="size-2.5 shrink-0 rounded-[4px]" style={{ background: ramp(i, values.length) }} />
							<span className={clsx(T.body, "min-w-0 flex-1 truncate")}>{l}</span>
							<span className={clsx(T.body, "shrink-0 tabular-nums")}>{format(values[i] ?? 0)}</span>
							<span className={clsx(T.label, "w-10 shrink-0 text-right tabular-nums")}>{Math.round(((values[i] ?? 0) / total) * 100)}%</span>
						</button>
					</li>
				))}
			</ul>
		</div>
	);
}

export function BudgetWidget({ data, title, live }: Props<R>) {
	const items = arr<R>(data.items);
	const cur = str(data.currency);
	const values = items.map((it) => Math.max(0, num(it.amount) ?? 0));
	const sum = values.reduce((a, b) => a + b, 0);
	const total = num(data.total);
	const left = total !== null ? total - sum : null;
	return (
		<Frame title={title || "Budget"} icon={<Wallet />} live={live}>
			<Ring
				labels={items.map((it) => str(it.label))}
				values={values}
				donut
				live={live}
				format={(v) => money(v, cur)}
				center={money(total ?? sum, cur)}
			/>
			{left !== null && (
				<div className={clsx(well, "mt-5 flex items-center justify-between px-4 py-3")}>
					<span className={T.body}>{left >= 0 ? "Left over" : "Over budget"}</span>
					<span className={clsx(T.strong, "tabular-nums", left >= 0 ? "text-credit" : "text-debit")}>{money(Math.abs(left), cur)}</span>
				</div>
			)}
		</Frame>
	);
}

export function ProgressWidget({ data, title, live }: Props<R>) {
	const value = num(data.value) ?? 0;
	const max = num(data.max) || 1;
	const f = Math.min(Math.max(value / max, 0), 1);
	const still = useStill(live);
	const r = 50;
	const c = 2 * Math.PI * r;
	return (
		<Frame title={title || "Progress"} icon={<Gauge />} live={live}>
			<div className="flex items-center gap-5">
				<div className="relative size-[120px] shrink-0">
					<svg viewBox="0 0 120 120" className="size-full -rotate-90" aria-hidden>
						<circle cx={60} cy={60} r={r} fill="none" stroke="var(--vivid-track)" strokeWidth={10} />
						<motion.circle
							cx={60}
							cy={60}
							r={r}
							fill="none"
							stroke="var(--ws-brand-primary)"
							strokeWidth={10}
							strokeLinecap="round"
							strokeDasharray={c}
							initial={still ? false : { strokeDashoffset: c }}
							animate={{ strokeDashoffset: c * (1 - f) }}
							transition={still ? { duration: 0 } : { duration: 0.9, ease: EASE_OUT_EXPO }}
						/>
					</svg>
					<span className="absolute inset-0 flex items-center justify-center font-display text-[calc(26px*var(--ws-fs))] font-semibold text-primary tabular-nums">
						{Math.round(f * 100)}%
					</span>
				</div>
				<div className="flex min-w-0 flex-col gap-1">
					<span className={T.strong}>
						<Txt text={data.label} />
					</span>
					<span className={clsx(T.body, "text-muted tabular-nums")}>
						{fmt(value)} of {fmt(max)}
					</span>
					{str(data.note) && (
						<span className={clsx(T.label, "mt-1")}>
							<Txt text={data.note} />
						</span>
					)}
				</div>
			</div>
		</Frame>
	);
}

export function DecisionWidget({ data, title, live }: Props<R>) {
	const opts = arr<R>(data.options)
		.map((o) => ({ name: str(o.name), score: num(o.score) ?? 0, why: o.why }))
		.sort((a, b) => b.score - a.score);
	const still = useStill(live);
	const top = Math.max(...opts.map((o) => o.score), 0);
	const scale = top <= 1 ? 1 : top <= 5 ? 5 : top <= 10 ? 10 : top <= 100 ? 100 : top;
	return (
		<Frame title={title || "Weighing it up"} icon={<Scales />} live={live}>
			<p className={clsx(T.strong, "mb-4 text-[calc(16.5px*var(--ws-fs))]")}>
				<Txt text={data.question} />
			</p>
			<ol className="flex flex-col">
				{opts.map((o, i) => (
					<li key={o.name + i} className="flex flex-col gap-2 border-hairline border-t py-3 first:border-t-0 first:pt-0 last:pb-0">
						<div className="flex items-center gap-2.5">
							<span
								className={clsx(
									"flex size-6 shrink-0 items-center justify-center rounded-full font-sans text-[12px] font-semibold tabular-nums",
									i === 0 ? "bg-brand text-brand-on" : "bg-[var(--vivid-well)] text-muted",
								)}
							>
								{i === 0 ? <Check weight="bold" className="size-3.5" /> : i + 1}
							</span>
							<span className={clsx(T.strong, "min-w-0 flex-1")}>{o.name}</span>
							<span className={clsx(T.strong, "tabular-nums")}>
								{fmt(o.score, 1)}
								<span className="font-normal text-muted">/{fmt(scale)}</span>
							</span>
						</div>
						<div className="ml-[34px] h-1.5 overflow-hidden rounded-pill bg-[var(--vivid-track)]">
							<motion.div
								className={clsx("h-full rounded-pill", i === 0 ? "bg-brand" : "bg-primary/35")}
								style={{ width: `${Math.min(Math.max((o.score / scale) * 100, 2), 100)}%`, transformOrigin: "left" }}
								initial={still ? false : { scaleX: 0 }}
								animate={{ scaleX: 1 }}
								transition={grow(still, i)}
							/>
						</div>
						{str(o.why) && (
							<p className={clsx(T.label, "ml-[34px]")}>
								<Txt text={o.why} />
							</p>
						)}
					</li>
				))}
			</ol>
		</Frame>
	);
}

export function MarketWidget({ data, title, live }: Props<R>) {
	const price = num(data.price);
	const [measure, W] = useWidth(300);
	const still = useStill(live);
	if (price === null) return null;
	const change = num(data.change) ?? 0;
	const pct = num(data.changePct) ?? 0;
	const pts = arr(data.points)
		.map((v) => num(v))
		.filter((v): v is number => v !== null);
	const up = change >= 0;
	const lo = Math.min(...pts);
	const hi = Math.max(...pts);
	const h = 72;
	const line = pts.map((v, i) => [(i / Math.max(pts.length - 1, 1)) * W, h - 4 - ((v - lo) / (hi - lo || 1)) * (h - 8)] as [number, number]);
	const ink = up ? "var(--ws-money-credit)" : "var(--ws-money-debit)";
	return (
		<Frame title={title || str(data.name)} icon={<ChartLine />} live={live} label={`${str(data.symbol)} quote`}>
			<div className="flex flex-col gap-1">
				<span className={T.label}>
					<span className="font-semibold text-primary">{str(data.symbol)}</span>
					{str(data.name) && title ? ` · ${str(data.name)}` : ""}
				</span>
				<span className={T.hero}>{money(price, str(data.currency))}</span>
				<span className="flex items-center gap-2">
					<span className={clsx("font-sans text-[calc(14px*var(--ws-fs))] font-semibold tabular-nums", up ? "text-credit" : "text-debit")}>
						{up ? "+" : "−"}
						{fmt(Math.abs(change))}
					</span>
					<Delta value={pct} />
				</span>
			</div>
			{line.length > 1 && (
				<div ref={measure} className="mt-4">
					<svg viewBox={`0 0 ${W} ${h}`} width={W} height={h} className="block max-w-full overflow-visible" aria-hidden>
						<line x1={0} x2={W} y1={line[0][1]} y2={line[0][1]} stroke="var(--ws-border-hairline)" strokeDasharray="2 4" />
						<motion.path
							d={smooth(line)}
							fill="none"
							stroke={ink}
							strokeWidth={2.25}
							strokeLinecap="round"
							initial={still ? false : { pathLength: 0 }}
							animate={{ pathLength: 1 }}
							transition={still ? { duration: 0 } : { duration: 0.9, ease: EASE_OUT_EXPO }}
						/>
					</svg>
				</div>
			)}
		</Frame>
	);
}

export function PaletteWidget({ data, title, live }: Props<R>) {
	const colors = arr<R>(data.colors).filter((c) => /^#[0-9a-f]{3,8}$/i.test(str(c.hex)));
	const [copied, setCopied] = useState<number | null>(null);
	const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
	useEffect(() => () => clearTimeout(timer.current), []);
	const copy = (i: number) => {
		void navigator.clipboard?.writeText(str(colors[i].hex)).catch(() => {});
		setCopied(i);
		clearTimeout(timer.current);
		timer.current = setTimeout(() => setCopied(null), 1200);
	};
	return (
		<Frame
			title={title || "Palette"}
			icon={<Palette />}
			action={<CopyBtn text={colors.map((c) => str(c.hex)).join(", ")} label="Copy all colours" icon />}
			live={live}
		>
			<div className="flex h-20 overflow-hidden rounded-[13px]">
				{colors.map((c, i) => (
					<button
						// biome-ignore lint/suspicious/noArrayIndexKey: swatches in order
						key={i}
						type="button"
						onClick={() => copy(i)}
						aria-label={`Copy ${str(c.name) || str(c.hex)}`}
						className="relative flex flex-1 cursor-pointer items-end justify-center pb-2"
						style={{ background: str(c.hex) }}
					>
						{copied === i && (
							<span className="rounded-pill bg-page/80 px-2 py-0.5 font-sans text-[12px] font-medium text-primary">Copied</span>
						)}
					</button>
				))}
			</div>
			<ul className="mt-3 grid grid-cols-2 gap-x-4 sm:grid-cols-3">
				{colors.map((c, i) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: swatches in order
					<li key={i}>
						<button
							type="button"
							onClick={() => copy(i)}
							className="-mx-2 flex min-h-[44px] w-[calc(100%+16px)] cursor-pointer items-center gap-2.5 rounded-[10px] px-2 text-left transition-colors hover:bg-[var(--vivid-well)]"
						>
							<span className="size-7 shrink-0 rounded-[7px] ring-1 ring-primary/10 ring-inset" style={{ background: str(c.hex) }} />
							<span className="flex min-w-0 flex-col">
								<span className={clsx(T.head, "truncate")}>{str(c.name) || str(c.hex).toUpperCase()}</span>
								{str(c.name) && <span className="font-mono text-[calc(12.5px*var(--ws-fs))] text-muted uppercase">{str(c.hex)}</span>}
							</span>
						</button>
					</li>
				))}
			</ul>
		</Frame>
	);
}
