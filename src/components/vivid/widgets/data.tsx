"use client";

import clsx from "clsx";
import {
	ArrowDownRight,
	ArrowUpRight,
	ChartBar,
	ChartLine,
	ChartPie,
	Check,
	Crown,
	Gauge,
	Palette,
	Scales,
	Table,
	ThumbsDown,
	ThumbsUp,
	Trophy,
	Wallet,
} from "@phosphor-icons/react";
import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { EASE_OUT_EXPO } from "@/lib/motion-presets";
import { arr, body, fmt, Frame, label, money, num, type Props, ramp, rec, SERIES, small, str, Txt } from "./parts";

/* Numbers and choices: table, compare, proscons, stats, chart, budget,
   progress, decision, market, palette. Charts are hand-rolled SVG, like the
   Studio's: no chart library, one hue stepped toward the surface. */

type R = Record<string, unknown>;

/** A bar or ring grows once, on a live answer; a reloaded thread is already drawn. */
const grow = (live: boolean | undefined, i = 0) =>
	live ? { duration: 0.6, ease: EASE_OUT_EXPO, delay: Math.min(i * 0.04, 0.24) } : { duration: 0 };

export function TableWidget({ data, title }: Props<R>) {
	const cols = arr(data.columns).map(str);
	const rows = arr<unknown[]>(data.rows);
	const numeric = cols.map((_, c) => rows.length > 0 && rows.every((r) => typeof arr(r)[c] === "number" || arr(r)[c] === ""));
	return (
		<Frame title={title || str(data.caption) || "Table"} icon={<Table />} flush>
			<div className="mt-1 overflow-x-auto border-t border-hairline">
				<table className="w-full min-w-max border-collapse font-sans text-[calc(13.5px*var(--ws-fs))]">
					<thead>
						<tr className="bg-primary/[0.03]">
							{cols.map((c, i) => (
								<th
									// biome-ignore lint/suspicious/noArrayIndexKey: columns in order
									key={i}
									className={clsx("px-4 py-2.5 font-semibold text-primary", numeric[i] ? "text-right" : "text-left")}
								>
									<Txt text={c} />
								</th>
							))}
						</tr>
					</thead>
					<tbody className="divide-y divide-hairline">
						{rows.map((r, i) => (
							// biome-ignore lint/suspicious/noArrayIndexKey: rows in order
							<tr key={i} className="transition-colors hover:bg-primary/[0.03]">
								{cols.map((_, c) => {
									const v = arr(r)[c];
									return (
										<td
											// biome-ignore lint/suspicious/noArrayIndexKey: cells in order
											key={c}
											className={clsx(
												"px-4 py-2.5 align-top",
												c === 0 ? "font-medium text-primary" : "text-muted",
												numeric[c] && "text-right tabular-nums",
											)}
										>
											{typeof v === "number" ? fmt(v, 4) : <Txt text={v} />}
										</td>
									);
								})}
							</tr>
						))}
					</tbody>
				</table>
			</div>
			{title && str(data.caption) && <p className="px-4 py-2.5 font-sans text-[13px] text-subtle">{str(data.caption)}</p>}
		</Frame>
	);
}

export function CompareWidget({ data, title }: Props<R>) {
	const items = arr<R>(data.items);
	const best = num(data.best);
	const keys = [...new Set(items.flatMap((it) => Object.keys(rec(it.attrs))))];
	return (
		<Frame title={title || "Side by side"} icon={<Scales />}>
			<div className="-mx-4 overflow-x-auto px-4 pt-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
				<div className="grid min-w-max gap-2" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(150px, 1fr))` }}>
					{items.map((it, i) => {
						const top = best === i;
						const attrs = rec(it.attrs);
						return (
							<div
								// biome-ignore lint/suspicious/noArrayIndexKey: items in order
								key={i}
								className={clsx("relative flex flex-col gap-3 rounded-[13px] p-3", top ? "bg-brand/10 ring-1 ring-brand/40" : "bg-primary/[0.04]")}
							>
								{top && (
									<span className="absolute -top-2 right-3 flex items-center gap-1 rounded-pill bg-brand px-2 py-0.5 font-sans text-[11px] font-semibold text-brand-on">
										<Crown weight="fill" className="size-3" /> Best pick
									</span>
								)}
								{str(it.image) && (
									// biome-ignore lint/performance/noImgElement: a remote picture the model chose; no Next loader for arbitrary hosts
									<img src={str(it.image)} alt="" className="aspect-[4/3] w-full rounded-[10px] bg-raised object-cover" />
								)}
								<div className="flex flex-col gap-0.5">
									<span className={label}>
										<Txt text={it.name} />
									</span>
									{str(it.subtitle) && <span className="font-sans text-[12.5px] text-muted">{str(it.subtitle)}</span>}
								</div>
								<dl className="flex flex-col gap-2 border-t border-hairline pt-2.5">
									{keys.map((k) => (
										<div key={k} className="flex flex-col">
											<dt className="font-sans text-[12px] text-subtle">{k}</dt>
											<dd className="font-sans text-[calc(13.5px*var(--ws-fs))] text-primary">
												<Txt text={attrs[k] ?? "–"} />
											</dd>
										</div>
									))}
								</dl>
							</div>
						);
					})}
				</div>
			</div>
			{str(data.verdict) && (
				<p className={clsx(body, "mt-3 flex gap-2")}>
					<Trophy weight="fill" className="mt-1 size-4 shrink-0 text-gold" />
					<span>
						<Txt text={data.verdict} />
					</span>
				</p>
			)}
		</Frame>
	);
}

export function ProsConsWidget({ data, title }: Props<R>) {
	const pros = arr(data.pros);
	const cons = arr(data.cons);
	const Col = ({ items, good }: { items: unknown[]; good: boolean }) => (
		<div className="flex min-w-0 flex-col gap-2 rounded-[13px] bg-primary/[0.03] p-3">
			<span className={clsx("flex items-center gap-1.5 font-sans text-[13px] font-semibold", good ? "text-credit" : "text-debit")}>
				{good ? <ThumbsUp weight="fill" className="size-4" /> : <ThumbsDown weight="fill" className="size-4" />}
				{good ? "Pros" : "Cons"}
			</span>
			<ul className="flex flex-col gap-1.5">
				{items.map((p, i) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: points in order
					<li key={i} className={clsx(small, "flex gap-2 text-primary")}>
						<span aria-hidden className={clsx("mt-[7px] size-1.5 shrink-0 rounded-full", good ? "bg-credit" : "bg-debit")} />
						<span className="min-w-0">
							<Txt text={p} />
						</span>
					</li>
				))}
				{items.length === 0 && <li className={small}>None worth noting.</li>}
			</ul>
		</div>
	);
	return (
		<Frame title={title || str(data.subject) || "Pros and cons"} icon={<Scales />}>
			<div className="grid gap-2 sm:grid-cols-2">
				<Col items={pros} good />
				<Col items={cons} good={false} />
			</div>
			{str(data.verdict) && (
				<p className={clsx(body, "mt-3")}>
					<Txt text={data.verdict} />
				</p>
			)}
		</Frame>
	);
}

export function StatsWidget({ data, title }: Props<R>) {
	const items = arr<R>(data.items);
	return (
		<Frame title={title} icon={title ? <ChartBar /> : undefined}>
			<div className={clsx("grid gap-2", items.length === 1 ? "grid-cols-1" : items.length === 3 ? "grid-cols-3" : "grid-cols-2 sm:grid-cols-4")}>
				{items.map((s, i) => {
					const d = num(s.delta);
					return (
						// biome-ignore lint/suspicious/noArrayIndexKey: items in order
						<div key={i} className="flex min-w-0 flex-col gap-1 rounded-[13px] bg-primary/[0.04] px-3 py-2.5">
							<span className="truncate font-sans text-[12.5px] text-muted">{str(s.label)}</span>
							<span className="flex min-w-0 items-baseline gap-1">
								<span className="truncate font-display text-[calc(21px*var(--ws-fs))] leading-tight font-semibold text-primary tabular-nums">
									{str(s.value)}
								</span>
								{str(s.unit) && <span className="shrink-0 font-sans text-[12.5px] text-muted">{str(s.unit)}</span>}
							</span>
							{d !== null && d !== 0 && (
								<span className={clsx("flex items-center gap-0.5 font-sans text-[12.5px] font-medium tabular-nums", d > 0 ? "text-credit" : "text-debit")}>
									{d > 0 ? <ArrowUpRight weight="bold" className="size-3" /> : <ArrowDownRight weight="bold" className="size-3" />}
									{fmt(Math.abs(d))}%
								</span>
							)}
							{str(s.note) && <span className="font-sans text-[12px] leading-snug text-subtle">{str(s.note)}</span>}
						</div>
					);
				})}
			</div>
		</Frame>
	);
}

/* ---- charts ---- */

const H = 176;

/** A round top for the axis, close above the peak so the bars use the height. */
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

export function ChartWidget({ data, title, live }: Props<R>) {
	const type = str(data.type) || "bar";
	const labels = arr(data.labels).map(str);
	const series = arr<R>(data.series).map((s) => ({ name: str(s.name), values: arr(s.values).map((v) => num(v) ?? 0) }));
	const unit = str(data.unit);
	const [hover, setHover] = useState<number | null>(null);
	const [measure, W] = useWidth();
	if (!labels.length || !series.length) return null;
	const icon = type === "line" ? <ChartLine /> : type === "pie" || type === "donut" ? <ChartPie /> : <ChartBar />;
	const show = (v: number) => `${fmt(v)}${unit ? ` ${unit}` : ""}`;

	if (type === "pie" || type === "donut") {
		const vals = series[0].values.map((v) => Math.max(0, v));
		return (
			<Frame title={title || series[0].name || "Breakdown"} icon={icon}>
				<Ring labels={labels} values={vals} donut={type === "donut"} live={live} format={show} />
			</Frame>
		);
	}

	const all = series.flatMap((s) => s.values);
	const lo = Math.min(0, ...all);
	const hi = niceMax(Math.max(...all, 0) - lo) + lo;
	const pad = { l: 34, r: 6, t: 8, b: 22 };
	const iw = W - pad.l - pad.r;
	const ih = H - pad.t - pad.b;
	const y = (v: number) => pad.t + ih - ((v - lo) / (hi - lo || 1)) * ih;
	const ticks = [0, 0.5, 1].map((f) => lo + (hi - lo) * f);
	const step = iw / labels.length;
	const every = Math.ceil(labels.length / Math.max(2, Math.floor(iw / 56)));

	return (
		<Frame title={title || "Chart"} icon={icon}>
			{series.length > 1 && <Legend names={series.map((s) => s.name)} />}
			<div ref={measure} className="relative">
				<svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="block max-w-full overflow-visible" role="img" aria-label={title || "Chart"} onMouseLeave={() => setHover(null)}>
					{ticks.map((t) => (
						<g key={t}>
							<line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="var(--ws-border-hairline)" strokeWidth={1} />
							<text x={pad.l - 6} y={y(t) + 3.5} textAnchor="end" fontSize={11} fill="var(--ws-text-subtle)" className="tabular-nums">
								{fmt(t, 1)}
							</text>
						</g>
					))}
					{labels.map((l, i) =>
						i % every === 0 ? (
							<text key={l + i} x={pad.l + step * (i + 0.5)} y={H - 6} textAnchor="middle" fontSize={11} fill="var(--ws-text-muted)">
								{l.length > 9 ? `${l.slice(0, 8)}…` : l}
							</text>
						) : null,
					)}
					{type === "line"
						? series.map((s, si) => {
								const pts = s.values.map((v, i) => [pad.l + step * (i + 0.5), y(v)] as [number, number]);
								const d = smooth(pts);
								return (
									<g key={s.name + si}>
										{si === 0 && series.length === 1 && (
											<path
												d={`${d} L${pts[pts.length - 1][0]},${y(lo)} L${pts[0][0]},${y(lo)} Z`}
												fill="color-mix(in srgb, var(--ws-brand-primary) 12%, transparent)"
											/>
										)}
										<motion.path
											d={d}
											fill="none"
											stroke={SERIES[si % SERIES.length]}
											strokeWidth={2.2}
											strokeLinecap="round"
											initial={live ? { pathLength: 0 } : false}
											animate={{ pathLength: 1 }}
											transition={live ? { duration: 0.9, ease: EASE_OUT_EXPO } : { duration: 0 }}
										/>
										{hover !== null && pts[hover] && (
											<circle cx={pts[hover][0]} cy={pts[hover][1]} r={3.5} fill={SERIES[si % SERIES.length]} stroke="var(--ws-bg-surface)" strokeWidth={1.5} />
										)}
									</g>
								);
							})
						: labels.map((l, i) => {
								const gw = step * 0.66;
								const bw = gw / series.length;
								return (
									<g key={l + i}>
										{series.map((s, si) => {
											const v = s.values[i] ?? 0;
											const top = y(Math.max(v, 0));
											const h = Math.abs(y(v) - y(0));
											return (
												<motion.rect
													key={s.name + si}
													x={pad.l + step * i + (step - gw) / 2 + bw * si + 0.5}
													y={top}
													width={Math.max(bw - 1, 1)}
													height={Math.max(h, 0.5)}
													rx={Math.min(3, bw / 3)}
													fill={series.length === 1 ? "var(--ws-brand-primary)" : SERIES[si % SERIES.length]}
													opacity={hover === null || hover === i ? 1 : 0.45}
													style={{ transformBox: "fill-box", transformOrigin: "bottom" }}
													initial={live ? { scaleY: 0 } : false}
													animate={{ scaleY: 1 }}
													transition={grow(live, i)}
												/>
											);
										})}
									</g>
								);
							})}
					{labels.map((l, i) => (
						<rect
							key={`hit${l}${i}`}
							x={pad.l + step * i}
							y={pad.t}
							width={step}
							height={ih}
							fill="transparent"
							onMouseEnter={() => setHover(i)}
							onClick={() => setHover(i)}
						/>
					))}
				</svg>
				{hover !== null && (
					<div
						className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-[10px] bg-raised px-2.5 py-1.5 font-sans text-[12px] whitespace-nowrap text-primary shadow-nav"
						style={{ left: `${((pad.l + step * (hover + 0.5)) / W) * 100}%` }}
					>
						<div className="font-semibold">{labels[hover]}</div>
						{series.map((s, si) => (
							<div key={s.name + si} className="flex items-center gap-1.5 text-muted tabular-nums">
								{series.length > 1 && <span className="size-2 rounded-full" style={{ background: SERIES[si % SERIES.length] }} />}
								{show(s.values[hover] ?? 0)}
							</div>
						))}
					</div>
				)}
			</div>
		</Frame>
	);
}

function Legend({ names }: { names: string[] }) {
	return (
		<div className="mb-2 flex flex-wrap gap-x-3 gap-y-1">
			{names.map((n, i) => (
				<span key={n + i} className="flex items-center gap-1.5 font-sans text-[12.5px] text-muted">
					<span className="size-2 rounded-full" style={{ background: SERIES[i % SERIES.length] }} />
					{n}
				</span>
			))}
		</div>
	);
}

/** A pie or donut with its legend; the centre carries the total, or the hovered slice. */
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
	const [hover, setHover] = useState<number | null>(null);
	const total = values.reduce((a, b) => a + b, 0) || 1;
	const r = 52;
	const sw = donut ? 16 : r;
	const rr = donut ? r : r / 2;
	const c = 2 * Math.PI * rr;
	let acc = 0;
	return (
		<div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
			<div className="relative size-[132px] shrink-0">
				<svg viewBox="0 0 132 132" className="size-full -rotate-90" aria-hidden>
					{donut && <circle cx={66} cy={66} r={rr} fill="none" stroke="var(--ws-bg-track, rgb(127 127 127 / .12))" strokeWidth={sw} />}
					{values.map((v, i) => {
						const len = (v / total) * c;
						const off = acc;
						acc += len;
						return (
							<motion.circle
								// biome-ignore lint/suspicious/noArrayIndexKey: slices in order
								key={i}
								cx={66}
								cy={66}
								r={rr}
								fill="none"
								stroke={ramp(i, values.length)}
								strokeWidth={hover === i ? sw + (donut ? 4 : 0) : sw}
								strokeDasharray={`${Math.max(len - (donut && values.length > 1 ? 1.5 : 0), 0)} ${c}`}
								strokeDashoffset={-off}
								initial={live ? { opacity: 0 } : false}
								animate={{ opacity: hover === null || hover === i ? 1 : 0.4 }}
								transition={grow(live, i)}
								onMouseEnter={() => setHover(i)}
								onMouseLeave={() => setHover(null)}
							/>
						);
					})}
				</svg>
				{donut && (
					<div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
						<span className="max-w-[80px] truncate font-sans text-[11px] text-muted">{hover !== null ? labels[hover] : "Total"}</span>
						<span className="max-w-[86px] truncate font-display text-[15px] font-semibold text-primary tabular-nums">
							{hover !== null ? format(values[hover]) : (center ?? format(total))}
						</span>
					</div>
				)}
			</div>
			<ul className="flex w-full min-w-0 flex-col gap-1.5">
				{labels.map((l, i) => (
					<li
						// biome-ignore lint/suspicious/noArrayIndexKey: legend in order
						key={i}
						onMouseEnter={() => setHover(i)}
						onMouseLeave={() => setHover(null)}
						className={clsx("flex items-center gap-2 rounded-[7px] px-1.5 py-0.5 font-sans text-[calc(13px*var(--ws-fs))]", hover === i && "bg-primary/5")}
					>
						<span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: ramp(i, values.length) }} />
						<span className="min-w-0 flex-1 truncate text-primary">{l}</span>
						<span className="shrink-0 text-muted tabular-nums">{format(values[i] ?? 0)}</span>
						<span className="w-10 shrink-0 text-right text-subtle tabular-nums">{Math.round(((values[i] ?? 0) / total) * 100)}%</span>
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
		<Frame title={title || "Budget"} icon={<Wallet />}>
			<Ring
				labels={items.map((it) => str(it.label))}
				values={values}
				donut
				live={live}
				format={(v) => money(v, cur)}
				center={money(total ?? sum, cur)}
			/>
			{left !== null && (
				<div className="mt-3 flex items-center justify-between border-t border-hairline pt-3 font-sans text-[calc(13.5px*var(--ws-fs))]">
					<span className="text-muted">{left >= 0 ? "Left over" : "Over budget"}</span>
					<span className={clsx("font-semibold tabular-nums", left >= 0 ? "text-credit" : "text-debit")}>{money(Math.abs(left), cur)}</span>
				</div>
			)}
		</Frame>
	);
}

export function ProgressWidget({ data, title, live }: Props<R>) {
	const value = num(data.value) ?? 0;
	const max = num(data.max) || 1;
	const f = Math.min(Math.max(value / max, 0), 1);
	const r = 44;
	const c = 2 * Math.PI * r;
	return (
		<Frame title={title} icon={title ? <Gauge /> : undefined}>
			<div className="flex items-center gap-4">
				<div className="relative size-[108px] shrink-0">
					<svg viewBox="0 0 108 108" className="size-full -rotate-90" aria-hidden>
						<circle cx={54} cy={54} r={r} fill="none" stroke="var(--ws-bg-track, rgb(127 127 127 / .12))" strokeWidth={9} />
						<motion.circle
							cx={54}
							cy={54}
							r={r}
							fill="none"
							stroke="var(--ws-brand-primary)"
							strokeWidth={9}
							strokeLinecap="round"
							strokeDasharray={c}
							initial={live ? { strokeDashoffset: c } : false}
							animate={{ strokeDashoffset: c * (1 - f) }}
							transition={live ? { duration: 0.9, ease: EASE_OUT_EXPO } : { duration: 0 }}
						/>
					</svg>
					<span className="absolute inset-0 flex items-center justify-center font-display text-[22px] font-semibold text-primary tabular-nums">
						{Math.round(f * 100)}%
					</span>
				</div>
				<div className="flex min-w-0 flex-col gap-1">
					<span className={label}>
						<Txt text={data.label} />
					</span>
					<span className="font-sans text-[calc(14px*var(--ws-fs))] text-muted tabular-nums">
						{fmt(value)} of {fmt(max)}
					</span>
					{str(data.note) && (
						<span className={small}>
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
	const top = Math.max(...opts.map((o) => o.score), 0);
	const scale = top <= 1 ? 1 : top <= 5 ? 5 : top <= 10 ? 10 : top <= 100 ? 100 : top;
	return (
		<Frame title={title || "Weighing it up"} icon={<Scales />}>
			<p className={clsx(body, "mb-3 font-medium")}>
				<Txt text={data.question} />
			</p>
			<ol className="flex flex-col gap-3">
				{opts.map((o, i) => (
					<li key={o.name + i} className="flex flex-col gap-1.5">
						<div className="flex items-baseline gap-2">
							<span className="w-4 shrink-0 font-sans text-[12.5px] text-subtle tabular-nums">{i + 1}</span>
							<span className={clsx(label, "min-w-0 flex-1")}>{o.name}</span>
							{i === 0 && <Check weight="bold" className="size-3.5 text-gold" />}
							<span className="font-sans text-[13px] text-muted tabular-nums">
								{fmt(o.score, 1)}
								<span className="text-subtle">/{fmt(scale)}</span>
							</span>
						</div>
						<div className="ml-6 h-1.5 overflow-hidden rounded-pill bg-primary/[0.07]">
							<motion.div
								className={clsx("h-full rounded-pill", i === 0 ? "bg-brand" : "bg-primary/35")}
								style={{ width: `${Math.min(Math.max((o.score / scale) * 100, 2), 100)}%`, transformOrigin: "left" }}
								initial={live ? { scaleX: 0 } : false}
								animate={{ scaleX: 1 }}
								transition={grow(live, i)}
							/>
						</div>
						{str(o.why) && (
							<p className={clsx(small, "ml-6")}>
								<Txt text={o.why} />
							</p>
						)}
					</li>
				))}
			</ol>
		</Frame>
	);
}

export function MarketWidget({ data, title }: Props<R>) {
	const price = num(data.price);
	if (price === null) return null;
	const change = num(data.change) ?? 0;
	const pct = num(data.changePct) ?? 0;
	const pts = arr(data.points)
		.map((v) => num(v))
		.filter((v): v is number => v !== null);
	const up = change >= 0;
	const lo = Math.min(...pts);
	const hi = Math.max(...pts);
	const line = pts.map((v, i) => [(i / Math.max(pts.length - 1, 1)) * 280, 52 - ((v - lo) / (hi - lo || 1)) * 48] as [number, number]);
	return (
		<Frame title={title}>
			<div className="flex items-end justify-between gap-3">
				<div className="flex min-w-0 flex-col gap-0.5">
					<span className="font-sans text-[12.5px] font-semibold text-muted">
						{str(data.symbol)} <span className="font-normal text-subtle">· {str(data.name)}</span>
					</span>
					<span className="font-display text-[calc(28px*var(--ws-fs))] leading-tight font-semibold text-primary tabular-nums">
						{money(price, str(data.currency))}
					</span>
					<span className={clsx("flex items-center gap-1 font-sans text-[13px] font-medium tabular-nums", up ? "text-credit" : "text-debit")}>
						{up ? <ArrowUpRight weight="bold" className="size-3.5" /> : <ArrowDownRight weight="bold" className="size-3.5" />}
						{up ? "+" : "−"}
						{fmt(Math.abs(change))} ({fmt(Math.abs(pct))}%)
					</span>
				</div>
				{line.length > 1 && (
					<svg viewBox="0 0 280 56" className="h-14 w-[45%] max-w-[180px] overflow-visible" aria-hidden>
						<path d={smooth(line)} fill="none" stroke={up ? "var(--ws-money-credit)" : "var(--ws-money-debit)"} strokeWidth={2} strokeLinecap="round" />
					</svg>
				)}
			</div>
		</Frame>
	);
}

export function PaletteWidget({ data, title }: Props<R>) {
	const colors = arr<R>(data.colors).filter((c) => /^#[0-9a-f]{3,8}$/i.test(str(c.hex)));
	const [copied, setCopied] = useState<number | null>(null);
	return (
		<Frame title={title || "Palette"} icon={<Palette />}>
			<div className="flex h-16 overflow-hidden rounded-[10px]">
				{colors.map((c, i) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: swatches in order
					<span key={i} className="flex-1" style={{ background: str(c.hex) }} />
				))}
			</div>
			<div className="mt-3 grid grid-cols-3 gap-1.5 sm:grid-cols-4">
				{colors.map((c, i) => (
					<button
						// biome-ignore lint/suspicious/noArrayIndexKey: swatches in order
						key={i}
						type="button"
						onClick={() => {
							void navigator.clipboard?.writeText(str(c.hex)).catch(() => {});
							setCopied(i);
							setTimeout(() => setCopied((x) => (x === i ? null : x)), 1200);
						}}
						className="flex min-h-[40px] cursor-pointer items-center gap-2 rounded-[10px] bg-primary/[0.04] px-2 py-1.5 text-left transition-colors hover:bg-primary/[0.08]"
					>
						<span className="size-6 shrink-0 rounded-[7px] ring-1 ring-primary/10" style={{ background: str(c.hex) }} />
						<span className="flex min-w-0 flex-col">
							{str(c.name) && <span className="truncate font-sans text-[12px] font-medium text-primary">{str(c.name)}</span>}
							<span className="truncate font-mono text-[11.5px] text-muted uppercase">{copied === i ? "Copied" : str(c.hex)}</span>
						</span>
					</button>
				))}
			</div>
		</Frame>
	);
}
