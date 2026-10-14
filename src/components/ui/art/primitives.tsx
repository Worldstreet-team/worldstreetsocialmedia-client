"use client";

import { type CSSProperties, type ReactNode, useEffect, useId, useRef } from "react";
import { cn } from "@/lib/utils";
import s from "./art.module.css";

/**
 * The house illustration kit, ported from Xtream's (owner 2026-10-14:
 * "the svg morphs aren't looking nice for the empty states ... check how
 * the xtream did theirs"). Xtream's empty states are composed drawings,
 * not morphs, and that is the whole difference: an object you recognise at
 * a glance, standing on something, beats a line bending into a symbol.
 *
 * The language: a faint disc to stand on, a few specks around it, objects
 * in 2px lines over solid cards (10 to 16 corners, like the product),
 * placeholder text as soft bars, and at most one accent per drawing. Every
 * colour is a token (./art.module.css), so dark and light need no second
 * version. No bitmaps, gradients, glows or the logo.
 *
 * Coordinates are SVG user units inside an `ArtCanvas` (viewBox
 * "24 12 192 152", the disc centred on 120, 90); parts are drawn at scale 1
 * so the line weight matches from drawing to drawing. Wrap a part in
 * `Enter` / `Idle` to move it: their CSS transforms would replace a
 * `transform` attribute on the same element.
 */

/* ---- paint ----------------------------------------------------------------- */

/** Class names for raw shapes: `<path className={paint.card} d="…" />`. */
export const paint = {
	/** 2px ink line, no fill. */
	line: s.line,
	/** A fainter 2px line: inner edges, dividers, empty buttons. */
	soft: s.soft,
	/** Add to a line for a dashed "empty slot" edge. */
	dash: s.dash,
	/** Solid card with the ink line. */
	card: s.card,
	/** A card a step back, for things behind. */
	card2: s.card2,
	/** Placeholder text and quiet fills. */
	bar: s.bar,
	/** Stronger ink fill: glyphs, dots. */
	ink: s.ink,
	inkLine: s.inkLine,
	/** The neutral accent: white on black, near-black on paper. */
	hi: s.hi,
	onHi: s.onHi,
	onHiBar: s.onHiBar,
	speck: s.speck,
	disc: s.disc,
	/** The danger red, only where the drawing is about being live. */
	live: s.live,
	liveLine: s.liveLine,
	/** The brand colour: a booked room, a pick. */
	accent: s.accent,
	accentLine: s.accentLine,
	/** Gold is money's colour, so it is for money only. */
	coin: s.coin,
	coinLine: s.coinLine,
} as const;
export type Paint = keyof typeof paint;

/* ---- motion ---------------------------------------------------------------- */

export type EnterKind = "rise" | "pop" | "fade" | "fromRight";
export type IdleKind =
	| "float"
	| "breathe"
	| "twinkle"
	| "blink"
	| "level"
	| "seek"
	| "spin"
	| "tick"
	| "search";

const ENTER: Record<EnterKind, string> = {
	rise: s.rise,
	pop: s.pop,
	fade: s.fade,
	fromRight: s.fromRight,
};

/** Motion classes, for a motion straight on a shape instead of a wrapping `<g>`. */
export const motion: Record<EnterKind | IdleKind, string> = {
	...ENTER,
	float: s.float,
	breathe: s.breathe,
	twinkle: s.twinkle,
	blink: s.blink,
	level: s.level,
	seek: s.seek,
	spin: s.spin,
	tick: s.tick,
	search: s.search,
};

/** Entrance delay, in ms, as the style the motion classes read. */
export const delay = (ms: number) => ({ "--d": `${ms}ms` }) as CSSProperties;
/** Idle offset, in seconds, so parts that share a loop fall out of step. */
export const offset = (sec: number) => ({ "--i": `${sec}s` }) as CSSProperties;

/** Plays once when the drawing appears. `delay` in ms staggers parts. */
export function Enter({
	kind = "rise",
	delay: ms,
	className,
	children,
}: {
	kind?: EnterKind;
	delay?: number;
	className?: string;
	children: ReactNode;
}) {
	return (
		<g className={cn(ENTER[kind], className)} style={ms === undefined ? undefined : delay(ms)}>
			{children}
		</g>
	);
}

/** A slow loop after the entrance. `offset` in seconds shifts it. */
export function Idle({
	kind,
	offset: sec,
	className,
	children,
}: {
	kind: IdleKind;
	offset?: number;
	className?: string;
	children: ReactNode;
}) {
	return (
		<g className={cn(motion[kind], className)} style={sec === undefined ? undefined : offset(sec)}>
			{children}
		</g>
	);
}

/* ---- canvas ---------------------------------------------------------------- */

/**
 * The `<svg>` every drawing sits in: carries the art tokens, holds its
 * loops still while off screen, and is hidden from assistive tech unless
 * given a `label` (decorative by default: the words around it say what it
 * means). Size it with a width class; height follows the viewBox.
 */
export function ArtCanvas({
	viewBox = "24 12 192 152",
	label,
	className,
	children,
}: {
	viewBox?: string;
	label?: string;
	className?: string;
	children: ReactNode;
}) {
	const ref = useRef<SVGSVGElement>(null);

	useEffect(() => {
		const el = ref.current;
		if (!el || typeof IntersectionObserver === "undefined") return;
		const io = new IntersectionObserver(([entry]) => {
			if (entry) el.dataset.paused = String(!entry.isIntersecting);
		});
		io.observe(el);
		return () => io.disconnect();
	}, []);

	return (
		<svg
			ref={ref}
			viewBox={viewBox}
			role={label ? "img" : undefined}
			aria-label={label}
			aria-hidden={label ? undefined : true}
			focusable="false"
			className={cn(s.canvas, className)}
		>
			{children}
		</svg>
	);
}

/* ---- ground ---------------------------------------------------------------- */

type Speck = [cx: number, cy: number, r: number, offset: number];
const SPECKS: Speck[] = [
	[38, 50, 2, 0],
	[206, 56, 1.6, 1.4],
	[198, 144, 2.2, 2.6],
	[44, 134, 1.5, 3.3],
];

/** What a drawing stands on: a faint disc that settles in, and specks that twinkle. */
export function Ground({
	cx = 120,
	cy = 90,
	r = 72,
	specks = SPECKS,
}: {
	cx?: number;
	cy?: number;
	r?: number;
	specks?: Speck[] | false;
}) {
	return (
		<>
			<circle className={cn(s.disc, s.discIn)} cx={cx} cy={cy} r={r} />
			{specks && (
				<g className={s.fade} style={delay(300)}>
					{specks.map(([x, y, sr, t]) => (
						<circle
							key={`${x}-${y}`}
							className={cn(s.speck, s.twinkle)}
							style={offset(t)}
							cx={x}
							cy={y}
							r={sr}
						/>
					))}
				</g>
			)}
		</>
	);
}

/* ---- shapes ---------------------------------------------------------------- */

/** A rounded card. `paint` card | card2 | line | soft; `dashed` for an empty slot. */
export function Card({
	x,
	y,
	w,
	h,
	r = 12,
	paint: p = "card",
	dashed = false,
	className,
}: {
	x: number;
	y: number;
	w: number;
	h: number;
	r?: number;
	paint?: Paint;
	dashed?: boolean;
	className?: string;
}) {
	return (
		<rect
			className={cn(paint[p], dashed && s.dash, className)}
			x={x}
			y={y}
			width={w}
			height={h}
			rx={r}
		/>
	);
}

/** A line of placeholder text, or any pill-ended bar. */
export function Bar({
	x,
	y,
	w,
	h = 4.5,
	paint: p = "bar",
	className,
}: {
	x: number;
	y: number;
	w: number;
	h?: number;
	paint?: Paint;
	className?: string;
}) {
	return <rect className={cn(paint[p], className)} x={x} y={y} width={w} height={h} rx={h / 2} />;
}

/** A filled dot. */
export function Dot({
	cx,
	cy,
	r,
	paint: p = "ink",
	className,
}: {
	cx: number;
	cy: number;
	r: number;
	paint?: Paint;
	className?: string;
}) {
	return <circle className={cn(paint[p], className)} cx={cx} cy={cy} r={r} />;
}

/* ---- figures --------------------------------------------------------------- */

/**
 * A person: head and shoulders in a round frame. No face, no colour: a
 * seat for someone. `ring` dashed makes it the empty seat.
 */
export function Figure({
	cx,
	cy,
	r,
	ring = "line",
}: {
	cx: number;
	cy: number;
	r: number;
	ring?: "line" | "dashed" | "none";
}) {
	const id = `art${useId().replace(/[^\w-]/g, "")}`;
	return (
		<g>
			<clipPath id={id}>
				<circle cx={cx} cy={cy} r={r} />
			</clipPath>
			<circle className={s.card} style={{ stroke: "none" }} cx={cx} cy={cy} r={r} />
			<g clipPath={`url(#${id})`}>
				<circle className={s.bar} cx={cx} cy={cy - r * 0.22} r={r * 0.33} />
				<path
					className={s.bar}
					d={`M${cx - r * 0.62} ${cy + r}a${r * 0.62} ${r * 0.56} 0 0 1 ${r * 1.24} 0z`}
				/>
			</g>
			{ring !== "none" && (
				<circle className={cn(s.line, ring === "dashed" && s.dash)} cx={cx} cy={cy} r={r} />
			)}
		</g>
	);
}

/* ---- props ----------------------------------------------------------------- */

/** A round badge in the neutral accent, with a glyph. */
export function Badge({
	cx,
	cy,
	r,
	glyph = "check",
}: {
	cx: number;
	cy: number;
	r: number;
	glyph?: "check" | "alert" | "plus" | "none";
}) {
	const k = r / 16;
	return (
		<g>
			<circle className={s.hi} cx={cx} cy={cy} r={r} />
			{glyph === "check" && (
				<path
					className={s.onHi}
					d={`M${cx - 7.5 * k} ${cy + 0.5 * k}l${5 * k} ${5 * k} ${10 * k} ${-10.5 * k}`}
				/>
			)}
			{glyph === "alert" && (
				<path
					className={s.onHi}
					style={{ strokeWidth: 3 }}
					d={`M${cx} ${cy - 8.5 * k}v${10 * k}M${cx} ${cy + 7.5 * k}h0`}
				/>
			)}
			{glyph === "plus" && (
				<path className={s.onHi} d={`M${cx} ${cy - 7 * k}v${14 * k}M${cx - 7 * k} ${cy}h${14 * k}`} />
			)}
		</g>
	);
}

/** A signal ring leaving a point. At rest it sits still and faint; `far` is the fainter outer one. */
export function Pulse({
	cx,
	cy,
	r,
	paint: p = "liveLine",
	offset: sec,
	far = false,
}: {
	cx: number;
	cy: number;
	r: number;
	paint?: Paint;
	offset?: number;
	far?: boolean;
}) {
	return (
		<circle
			className={cn(paint[p], s.pulse, far && s.pulseFar)}
			style={sec === undefined ? undefined : offset(sec)}
			cx={cx}
			cy={cy}
			r={r}
		/>
	);
}

/** A magnifying lens with its handle, centred on (cx, cy). */
export function Lens({ cx, cy, r = 22 }: { cx: number; cy: number; r?: number }) {
	const k = r / 22;
	return (
		<g>
			<path
				className={s.line}
				style={{ strokeWidth: 6 }}
				d={`M${cx + 16 * k} ${cy + 16 * k}l${14 * k} ${14 * k}`}
			/>
			<circle className={s.card} style={{ strokeWidth: 2.5 }} cx={cx} cy={cy} r={r} />
			<path
				className={s.soft}
				d={`M${cx - 12 * k} ${cy - 5 * k}a${13 * k} ${13 * k} 0 0 1 ${8 * k} ${-8 * k}`}
			/>
		</g>
	);
}

/** A clock whose minute hand keeps going. */
export function Clock({ cx, cy, r = 19 }: { cx: number; cy: number; r?: number }) {
	return (
		<g>
			<circle className={s.card} cx={cx} cy={cy} r={r} />
			<path className={s.inkLine} d={`M${cx} ${cy}l${r * 0.37} ${-r * 0.21}`} />
			<path className={cn(s.inkLine, s.tick)} d={`M${cx} ${cy}v${-r * 0.68}`} />
			<circle className={s.ink} cx={cx} cy={cy} r={2.2} />
		</g>
	);
}

/**
 * A studio microphone on a stand, Space Voice's object. (cx, top) is the
 * top of the capsule; the base sits about 82 units below it.
 */
export function Mic({ cx, top, children }: { cx: number; top: number; children?: ReactNode }) {
	const w = 30;
	const h = 48;
	const x = cx - w / 2;
	return (
		<g>
			{/* Holder, stem and foot, drawn behind the capsule. */}
			<path className={s.line} d={`M${cx - 23} ${top + 26}v6a23 23 0 0 0 46 0v-6`} />
			<path className={s.line} d={`M${cx} ${top + 55}v19`} />
			<rect className={s.card2} x={cx - 21} y={top + 74} width={42} height={9} rx={4.5} />
			<rect className={s.card} x={x} y={top} width={w} height={h} rx={w / 2} />
			{[0, 1, 2].map((k) => (
				<rect
					key={k}
					className={s.bar}
					x={cx - 8}
					y={top + 12 + k * 8}
					width={16}
					height={3.5}
					rx={1.75}
				/>
			))}
			{children}
		</g>
	);
}
