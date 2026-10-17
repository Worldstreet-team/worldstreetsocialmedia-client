"use client";

import clsx from "clsx";
import {
	ArrowsCounterClockwise,
	FlowArrow,
	Function as FunctionIcon,
	MagnifyingGlassMinus,
	MagnifyingGlassPlus,
} from "@phosphor-icons/react";
import { type PointerEvent as RPointerEvent, useEffect, useMemo, useRef, useState } from "react";
import { arr, Btn, Frame, fmt, num, type Props, SERIES, str, T, useAsk, useStripEnd } from "./parts";

/* Wave 2, drawn by the client: graph-plot (a function plotter over the
   contract's strict expression grammar) and diagram (a small layered
   flowchart). Both are hand-rolled SVG at their real width. */

type R = Record<string, unknown>;

/* ---- the expression grammar (docs/vivid-widgets.md 7.4) ---- */

type Fn = (x: number) => number;
const FUNCS: Record<string, (v: number) => number> = {
	sin: Math.sin,
	cos: Math.cos,
	tan: Math.tan,
	sqrt: Math.sqrt,
	abs: Math.abs,
	log: Math.log10,
	ln: Math.log,
	exp: Math.exp,
};

/**
 * Parse one canonical expression into a function of x, or null. The
 * gateway has already written it out (explicit `*`, no spaces, `^` for
 * powers), so anything outside the grammar is refused rather than guessed.
 */
export function compile(src: string): Fn | null {
	const toks = src.match(/\d+\.\d*|\.\d+|\d+|[a-z]+|[-+*/^()]/g);
	if (!toks || toks.join("") !== src.replace(/\s+/g, "")) return null;
	let i = 0;
	const peek = () => toks[i];
	const take = (t?: string) => {
		const v = toks[i];
		if (t !== undefined && v !== t) throw new Error("expected");
		i++;
		return v;
	};
	const expr = (): Fn => {
		let left = term();
		while (peek() === "+" || peek() === "-") {
			const op = take();
			const a = left;
			const b = term();
			left = op === "+" ? (x) => a(x) + b(x) : (x) => a(x) - b(x);
		}
		return left;
	};
	const term = (): Fn => {
		let left = unary();
		while (peek() === "*" || peek() === "/") {
			const op = take();
			const a = left;
			const b = unary();
			left = op === "*" ? (x) => a(x) * b(x) : (x) => a(x) / b(x);
		}
		return left;
	};
	const unary = (): Fn => {
		if (peek() === "-") {
			take();
			const a = unary();
			return (x) => -a(x);
		}
		if (peek() === "+") {
			take();
			return unary();
		}
		return power();
	};
	const power = (): Fn => {
		const base = atom();
		if (peek() === "^") {
			take();
			const e = unary();
			return (x) => base(x) ** e(x);
		}
		return base;
	};
	const atom = (): Fn => {
		const t = take();
		if (t === undefined) throw new Error("end");
		if (/^(\d|\.)/.test(t)) {
			const v = Number(t);
			return () => v;
		}
		if (t === "x") return (x) => x;
		if (t === "pi") return () => Math.PI;
		if (t === "e") return () => Math.E;
		if (t === "(") {
			const inner = expr();
			take(")");
			return inner;
		}
		const f = FUNCS[t];
		if (f) {
			take("(");
			const inner = expr();
			take(")");
			return (x) => f(inner(x));
		}
		throw new Error("name");
	};
	try {
		const f = expr();
		if (i !== toks.length) return null;
		return f;
	} catch {
		return null;
	}
}

/** A round step for grid lines: 1, 2 or 5 times a power of ten, about `n` per span. */
function niceStep(span: number, n = 5) {
	const raw = span / n;
	const p = 10 ** Math.floor(Math.log10(raw));
	const m = raw / p;
	return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p;
}

/** The view that fits the functions: the middle 96% of their values, padded, so an asymptote does not flatten the rest. */
function fitY(fns: Fn[], x0: number, x1: number): [number, number] {
	const ys: number[] = [];
	for (const f of fns)
		for (let k = 0; k <= 200; k++) {
			const y = f(x0 + ((x1 - x0) * k) / 200);
			if (Number.isFinite(y)) ys.push(y);
		}
	if (!ys.length) return [-1, 1];
	ys.sort((a, b) => a - b);
	let lo = ys[Math.floor(ys.length * 0.02)];
	let hi = ys[Math.ceil(ys.length * 0.98) - 1];
	if (hi - lo < 1e-9) {
		lo -= 1;
		hi += 1;
	}
	const pad = (hi - lo) * 0.12;
	return [lo - pad, hi + pad];
}

const PH = 240;

export function GraphPlotWidget({ data, title, live }: Props<R>) {
	const fns = useMemo(
		() =>
			arr<R>(data.functions)
				.map((f) => ({ expr: str(f.expr), label: str(f.label), fn: compile(str(f.expr)) }))
				.filter((f): f is { expr: string; label: string; fn: Fn } => f.fn !== null),
		[data.functions],
	);
	const xr = arr(data.xRange).map((v) => num(v));
	const yrIn = arr(data.yRange).map((v) => num(v));
	const x0 = xr[0] ?? -10;
	const x1 = xr[1] ?? 10;
	const home = useMemo(() => {
		const y: [number, number] =
			yrIn.length === 2 && yrIn[0] !== null && yrIn[1] !== null && (yrIn[0] as number) < (yrIn[1] as number)
				? [yrIn[0] as number, yrIn[1] as number]
				: fitY(
						fns.map((f) => f.fn),
						x0,
						x1,
					);
		return { x: [x0, x1] as [number, number], y };
		// biome-ignore lint/correctness/useExhaustiveDependencies: the ranges are values from the card
	}, [fns, x0, x1, yrIn[0], yrIn[1]]);
	const [view, setView] = useState(home);
	const [hover, setHover] = useState<number | null>(null);
	const box = useRef<HTMLDivElement>(null);
	const [W, setW] = useState(320);
	useEffect(() => {
		const el = box.current;
		if (!el) return;
		const ro = new ResizeObserver(([e]) => setW(Math.max(200, Math.round(e.contentRect.width))));
		ro.observe(el);
		return () => ro.disconnect();
	}, []);

	const points = arr<R>(data.points)
		.map((p) => ({ x: num(p.x), y: num(p.y), label: str(p.label) }))
		.filter((p): p is { x: number; y: number; label: string } => p.x !== null && p.y !== null);

	const [vx0, vx1] = view.x;
	const [vy0, vy1] = view.y;
	const sx = (x: number) => ((x - vx0) / (vx1 - vx0)) * W;
	const sy = (y: number) => PH - ((y - vy0) / (vy1 - vy0)) * PH;
	const ix = (px: number) => vx0 + (px / W) * (vx1 - vx0);

	// Pan, pinch and wheel-with-ctrl (a trackpad pinch) move the view; a plain wheel scrolls the page.
	const ptrs = useRef(new Map<number, { x: number; y: number }>());
	const startRef = useRef<{ view: typeof view; d?: number; mid?: { x: number; y: number }; at: { x: number; y: number } } | null>(null);
	const local = (e: { clientX: number; clientY: number }) => {
		const r = box.current?.getBoundingClientRect();
		return { x: e.clientX - (r?.left ?? 0), y: e.clientY - (r?.top ?? 0) };
	};
	const zoomAt = (v: typeof view, px: number, py: number, k: number) => {
		const cx = v.x[0] + (px / W) * (v.x[1] - v.x[0]);
		const cy = v.y[0] + ((PH - py) / PH) * (v.y[1] - v.y[0]);
		return {
			x: [cx - (cx - v.x[0]) * k, cx + (v.x[1] - cx) * k] as [number, number],
			y: [cy - (cy - v.y[0]) * k, cy + (v.y[1] - cy) * k] as [number, number],
		};
	};
	const down = (e: RPointerEvent<SVGSVGElement>) => {
		e.currentTarget.setPointerCapture(e.pointerId);
		const p = local(e);
		ptrs.current.set(e.pointerId, p);
		const all = [...ptrs.current.values()];
		if (all.length === 2) {
			const d = Math.hypot(all[0].x - all[1].x, all[0].y - all[1].y);
			startRef.current = { view, d, mid: { x: (all[0].x + all[1].x) / 2, y: (all[0].y + all[1].y) / 2 }, at: p };
		} else startRef.current = { view, at: p };
		if (e.pointerType !== "mouse") setHover(p.x);
	};
	const move = (e: RPointerEvent<SVGSVGElement>) => {
		const p = local(e);
		if (!ptrs.current.has(e.pointerId)) {
			if (e.pointerType === "mouse") setHover(p.x);
			return;
		}
		ptrs.current.set(e.pointerId, p);
		const s = startRef.current;
		if (!s) return;
		const all = [...ptrs.current.values()];
		if (all.length === 2 && s.d && s.mid) {
			const d = Math.hypot(all[0].x - all[1].x, all[0].y - all[1].y);
			setView(zoomAt(s.view, s.mid.x, s.mid.y, s.d / Math.max(d, 1)));
			setHover(null);
			return;
		}
		const dx = ((p.x - s.at.x) / W) * (s.view.x[1] - s.view.x[0]);
		const dy = ((p.y - s.at.y) / PH) * (s.view.y[1] - s.view.y[0]);
		if (Math.abs(p.x - s.at.x) + Math.abs(p.y - s.at.y) > 3) {
			setView({ x: [s.view.x[0] - dx, s.view.x[1] - dx], y: [s.view.y[0] + dy, s.view.y[1] + dy] });
			if (e.pointerType === "mouse") setHover(p.x);
			else setHover(null);
		}
	};
	const up = (e: RPointerEvent<SVGSVGElement>) => {
		ptrs.current.delete(e.pointerId);
		startRef.current = ptrs.current.size ? { view, at: [...ptrs.current.values()][0] } : null;
	};
	useEffect(() => {
		const el = box.current;
		if (!el) return;
		const wheel = (e: WheelEvent) => {
			if (!e.ctrlKey && !e.metaKey) return;
			e.preventDefault();
			const r = el.getBoundingClientRect();
			setView((v) => zoomAt(v, e.clientX - r.left, e.clientY - r.top, Math.exp(e.deltaY * 0.01)));
		};
		el.addEventListener("wheel", wheel, { passive: false });
		return () => el.removeEventListener("wheel", wheel);
	});

	const zoom = (k: number) => setView((v) => zoomAt(v, W / 2, PH / 2, k));
	const moved = view.x[0] !== home.x[0] || view.x[1] !== home.x[1] || view.y[0] !== home.y[0] || view.y[1] !== home.y[1];

	// Sampled at two pixels, broken where a function is undefined or leaps (an asymptote).
	const paths = fns.map((f) => {
		let d = "";
		let pen = false;
		let prev: number | null = null;
		for (let px = 0; px <= W; px += 2) {
			const y = f.fn(ix(px));
			if (!Number.isFinite(y) || (prev !== null && Math.abs(y - prev) > (vy1 - vy0) * 2)) {
				pen = false;
				prev = Number.isFinite(y) ? y : null;
				continue;
			}
			const py = Math.min(Math.max(sy(y), -PH), PH * 2);
			d += `${pen ? "L" : "M"}${px},${py.toFixed(1)}`;
			pen = true;
			prev = y;
		}
		return d;
	});

	const gx = niceStep(vx1 - vx0, Math.max(3, Math.round(W / 80)));
	const gy = niceStep(vy1 - vy0, 4);
	const xs: number[] = [];
	for (let v = Math.ceil(vx0 / gx) * gx; v <= vx1; v += gx) xs.push(Number(v.toPrecision(12)));
	const ys: number[] = [];
	for (let v = Math.ceil(vy0 / gy) * gy; v <= vy1; v += gy) ys.push(Number(v.toPrecision(12)));
	const hx = hover !== null ? ix(hover) : null;
	const name = (f: { expr: string; label: string }) => f.label || `y = ${f.expr.replace(/\*/g, "·")}`;

	if (!fns.length) return null;
	return (
		<Frame
			title={title || "Graph"}
			icon={<FunctionIcon />}
			live={live}
			action={
				<>
					<Btn label="Zoom in" tone="ghost" icon onClick={() => zoom(0.7)}>
						<MagnifyingGlassPlus />
					</Btn>
					<Btn label="Zoom out" tone="ghost" icon onClick={() => zoom(1 / 0.7)}>
						<MagnifyingGlassMinus />
					</Btn>
					{moved && (
						<Btn label="Reset view" tone="ghost" icon onClick={() => setView(home)}>
							<ArrowsCounterClockwise />
						</Btn>
					)}
				</>
			}
		>
			{/* The readout: x and each function's value where the pointer is. */}
			<div className="mb-3 flex min-h-[44px] flex-wrap items-end gap-x-4 gap-y-1.5" aria-live="polite">
				{fns.map((f, i) => {
					const y = hx !== null ? f.fn(hx) : null;
					return (
						<span key={f.expr + i} className="flex min-w-0 items-center gap-2">
							<span className="h-[3px] w-4 shrink-0 rounded-pill" style={{ background: SERIES[i % SERIES.length] }} />
							<span className={clsx(T.label, "truncate font-mono text-[calc(12.5px*var(--ws-fs))]")}>{name(f)}</span>
							{y !== null && (
								<span className={clsx(T.strong, "tabular-nums")}>{Number.isFinite(y) ? fmt(y, 3) : "undefined"}</span>
							)}
						</span>
					);
				})}
				{hx !== null && <span className={clsx(T.label, "tabular-nums")}>at x = {fmt(hx, 3)}</span>}
			</div>
			<div ref={box} className="relative overflow-hidden rounded-[13px] bg-[var(--vivid-well)]">
				<svg
					viewBox={`0 0 ${W} ${PH}`}
					width={W}
					height={PH}
					className="block max-w-full cursor-grab touch-pan-y select-none active:cursor-grabbing"
					role="img"
					aria-label={`Graph of ${fns.map(name).join(", ")} for x from ${fmt(home.x[0])} to ${fmt(home.x[1])}`}
					onPointerDown={down}
					onPointerMove={move}
					onPointerUp={up}
					onPointerCancel={up}
					onPointerLeave={(e) => {
						if (e.pointerType === "mouse") setHover(null);
					}}
				>
					{xs.map((v) => (
						<line key={`gx${v}`} x1={sx(v)} x2={sx(v)} y1={0} y2={PH} stroke="var(--ws-border-hairline)" strokeDasharray={v === 0 ? undefined : "2 4"} />
					))}
					{ys.map((v) => (
						<line key={`gy${v}`} x1={0} x2={W} y1={sy(v)} y2={sy(v)} stroke="var(--ws-border-hairline)" strokeDasharray={v === 0 ? undefined : "2 4"} />
					))}
					{vx0 < 0 && vx1 > 0 && <line x1={sx(0)} x2={sx(0)} y1={0} y2={PH} stroke="var(--ws-text-muted)" strokeWidth={1} opacity={0.6} />}
					{vy0 < 0 && vy1 > 0 && <line x1={0} x2={W} y1={sy(0)} y2={sy(0)} stroke="var(--ws-text-muted)" strokeWidth={1} opacity={0.6} />}
					{xs.map((v) =>
						v === 0 || sx(v) < 14 || sx(v) > W - 14 ? null : (
							<text
								key={`tx${v}`}
								x={sx(v)}
								y={Math.min(Math.max(sy(0) + 15, 14), PH - 5)}
								textAnchor="middle"
								fontSize={11}
								fill="var(--ws-text-muted)"
								className="tabular-nums"
							>
								{fmt(v, 4)}
							</text>
						),
					)}
					{ys.map((v) =>
						v === 0 || sy(v) < 14 || sy(v) > PH - 6 ? null : (
							<text
								key={`ty${v}`}
								x={Math.min(Math.max(sx(0) + 5, 4), W - 30)}
								y={sy(v) - 4}
								fontSize={11}
								fill="var(--ws-text-muted)"
								className="tabular-nums"
							>
								{fmt(v, 4)}
							</text>
						),
					)}
					{paths.map((d, i) => (
						<path
							// biome-ignore lint/suspicious/noArrayIndexKey: functions in order
							key={i}
							d={d}
							fill="none"
							stroke={SERIES[i % SERIES.length]}
							strokeWidth={2.5}
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeDasharray={i >= 2 ? "6 5" : undefined}
						/>
					))}
					{points.map((p, i) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: points in order
						<g key={i}>
							<circle cx={sx(p.x)} cy={sy(p.y)} r={4.5} fill="var(--ws-text-primary)" stroke="var(--ws-bg-page)" strokeWidth={2} />
							{p.label && (
								<text x={sx(p.x) + 8} y={sy(p.y) - 8} fontSize={12} fontWeight={600} fill="var(--ws-text-primary)">
									{p.label}
								</text>
							)}
						</g>
					))}
					{hover !== null && (
						<g>
							<line x1={hover} x2={hover} y1={0} y2={PH} stroke="var(--ws-text-muted)" strokeWidth={1} />
							{fns.map((f, i) => {
								const y = f.fn(ix(hover));
								if (!Number.isFinite(y) || y < vy0 || y > vy1) return null;
								return (
									<circle
										key={f.expr + i}
										cx={hover}
										cy={sy(y)}
										r={4.5}
										fill={SERIES[i % SERIES.length]}
										stroke="var(--ws-bg-page)"
										strokeWidth={2}
									/>
								);
							})}
						</g>
					)}
				</svg>
			</div>
			<p className={clsx(T.label, "mt-2")}>Drag to move. Pinch, or the buttons, to zoom.</p>
		</Frame>
	);
}

/* ---- diagram ---- */

type DNode = { id: string; label: string; kind: string };
type DEdge = { from: string; to: string; label: string };

/** Layers by longest path from the sources, then one sweep that orders each layer by its parents. */
function layout(nodes: DNode[], edges: DEdge[]) {
	const ids = new Set(nodes.map((n) => n.id));
	const es = edges.filter((e) => ids.has(e.from) && ids.has(e.to) && e.from !== e.to);
	const layer = new Map<string, number>(nodes.map((n) => [n.id, 0]));
	// Acyclic by contract: relax at most n times.
	for (let k = 0; k < nodes.length; k++) {
		let changed = false;
		for (const e of es) {
			const want = (layer.get(e.from) ?? 0) + 1;
			if (want > (layer.get(e.to) ?? 0)) {
				layer.set(e.to, want);
				changed = true;
			}
		}
		if (!changed) break;
	}
	const rows: string[][] = [];
	for (const n of nodes) {
		const l = layer.get(n.id) ?? 0;
		rows[l] = rows[l] ?? [];
		rows[l].push(n.id);
	}
	const pos = new Map<string, number>();
	rows.forEach((row, l) => {
		if (l > 0) {
			const bary = (id: string) => {
				const ps = es.filter((e) => e.to === id).map((e) => pos.get(e.from) ?? 0);
				return ps.length ? ps.reduce((a, b) => a + b, 0) / ps.length : 0;
			};
			row.sort((a, b) => bary(a) - bary(b));
		}
		row.forEach((id, i) => {
			pos.set(id, i - (row.length - 1) / 2);
		});
	});
	return { rows: rows.filter(Boolean), layer, pos, edges: es };
}

const NODE_W = 152;
const NODE_H = 52;
const DIA_H = 72;

export function DiagramWidget({ data, title, live }: Props<R>) {
	const ask = useAsk();
	const nodes: DNode[] = arr<R>(data.nodes)
		.map((n) => ({ id: str(n.id), label: str(n.label), kind: str(n.kind) || "step" }))
		.filter((n) => n.id);
	const edges: DEdge[] = arr<R>(data.edges).map((e) => ({ from: str(e.from), to: str(e.to), label: str(e.label) }));
	const right = str(data.direction) === "right";
	const key = JSON.stringify([nodes, edges]);
	// biome-ignore lint/correctness/useExhaustiveDependencies: the shape is keyed by its own JSON
	const L = useMemo(() => layout(nodes, edges), [key]);
	const [strip, end, edge] = useStripEnd<HTMLDivElement>();
	if (!nodes.length) return null;

	const widest = Math.max(...L.rows.map((r) => r.length));
	// Pitch: along the flow, then across it.
	const along = right ? NODE_W + 64 : DIA_H + 44;
	const across = right ? DIA_H + 28 : NODE_W + 24;
	const W = right ? L.rows.length * along - 64 + 16 : widest * across - 24 + 16;
	const H = right ? widest * across - 28 + 16 : L.rows.length * along - 44 + 16;
	const center = (id: string) => {
		const l = L.layer.get(id) ?? 0;
		const p = L.pos.get(id) ?? 0;
		return right
			? { x: 8 + l * along + NODE_W / 2, y: H / 2 + p * across }
			: { x: W / 2 + p * across, y: 8 + l * along + DIA_H / 2 };
	};
	const half = (n: DNode) => (n.kind === "decision" ? DIA_H / 2 : NODE_H / 2);
	const byId = new Map(nodes.map((n) => [n.id, n]));

	return (
		<Frame title={title || "Diagram"} icon={<FlowArrow />} live={live} flush>
			<div ref={strip} data-end={end} className={clsx(edge, "overflow-x-auto px-4 pb-4 sm:px-5 sm:pb-5")}>
				<div className="relative mx-auto" style={{ width: W, height: H }}>
					<svg width={W} height={H} className="absolute inset-0 overflow-visible" aria-hidden>
						<defs>
							<marker id="vivid-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
								<path d="M0,1 L9,5 L0,9 z" fill="var(--ws-text-muted)" />
							</marker>
						</defs>
						{L.edges.map((e, i) => {
							const a = center(e.from);
							const b = center(e.to);
							const na = byId.get(e.from) as DNode;
							const nb = byId.get(e.to) as DNode;
							const s = right ? { x: a.x + NODE_W / 2, y: a.y } : { x: a.x, y: a.y + half(na) };
							const t = right ? { x: b.x - NODE_W / 2 - 2, y: b.y } : { x: b.x, y: b.y - half(nb) - 2 };
							const d = right
								? `M${s.x},${s.y} C${(s.x + t.x) / 2},${s.y} ${(s.x + t.x) / 2},${t.y} ${t.x},${t.y}`
								: `M${s.x},${s.y} C${s.x},${(s.y + t.y) / 2} ${t.x},${(s.y + t.y) / 2} ${t.x},${t.y}`;
							return (
								// biome-ignore lint/suspicious/noArrayIndexKey: edges in order
								<g key={i}>
									<path d={d} fill="none" stroke="var(--ws-text-muted)" strokeWidth={1.5} markerEnd="url(#vivid-arrow)" opacity={0.7} />
								</g>
							);
						})}
					</svg>
					{L.edges.map((e, i) => {
						if (!e.label) return null;
						const a = center(e.from);
						const b = center(e.to);
						return (
							<span
								// biome-ignore lint/suspicious/noArrayIndexKey: edges in order
								key={`l${i}`}
								className="absolute -translate-x-1/2 -translate-y-1/2 rounded-pill bg-raised px-2 py-0.5 font-sans text-[calc(12px*var(--ws-fs))] font-medium whitespace-nowrap text-muted"
								style={{ left: (a.x + b.x) / 2, top: (a.y + b.y) / 2 }}
							>
								{e.label}
							</span>
						);
					})}
					{nodes.map((n) => {
						const c = center(n.id);
						const dia = n.kind === "decision";
						const h = dia ? DIA_H : NODE_H;
						const shape = clsx(
							"absolute flex items-center justify-center px-3 text-center font-sans text-[calc(13px*var(--ws-fs))] leading-snug",
							n.kind === "start" && "rounded-pill bg-brand font-semibold text-brand-on",
							n.kind === "end" && "rounded-pill bg-raised font-semibold text-primary ring-[1.5px] ring-primary/25 ring-inset",
							n.kind === "step" && "rounded-[13px] bg-raised text-primary",
							dia && "text-primary",
							ask && "cursor-pointer transition-[filter] hover:brightness-110",
						);
						const body = (
							<>
								{dia && (
									<svg className="absolute inset-0 -z-0" width={NODE_W} height={h} aria-hidden>
										<polygon
											points={`${NODE_W / 2},1 ${NODE_W - 1},${h / 2} ${NODE_W / 2},${h - 1} 1,${h / 2}`}
											fill="var(--vivid-brand-wash)"
											stroke="var(--ws-brand-primary)"
											strokeWidth={1.5}
											strokeLinejoin="round"
										/>
									</svg>
								)}
								<span className={clsx("relative line-clamp-2", dia && "max-w-[96px] text-[calc(12.5px*var(--ws-fs))] font-semibold")}>{n.label}</span>
							</>
						);
						const style = { left: c.x - NODE_W / 2, top: c.y - h / 2, width: NODE_W, height: h };
						return ask ? (
							<button key={n.id} type="button" className={shape} style={style} onClick={() => ask(`Tell me more about "${n.label}"`)}>
								{body}
							</button>
						) : (
							<div key={n.id} className={shape} style={style}>
								{body}
							</div>
						);
					})}
				</div>
			</div>
		</Frame>
	);
}

