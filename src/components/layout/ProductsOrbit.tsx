"use client";

import {
	Broadcast,
	ChartLineUp,
	CurrencyBtc,
	Eye,
	GameController,
	GraduationCap,
	ShoppingBag,
	Sparkle,
	Target,
	type Icon as PhosphorIcon,
} from "@phosphor-icons/react";
import {
	AnimatePresence,
	animate,
	motion,
	type AnimationPlaybackControls,
	type MotionValue,
	useMotionValue,
	useMotionValueEvent,
	useReducedMotionConfig,
	useTransform,
} from "framer-motion";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ECOSYSTEM, type EcosystemApp } from "@/data/ecosystem";
import { type Cubic, easing, type Outline, Pen, pack, resample, rotate, alignK, toPath } from "@/lib/morph/geometry";
import { EASE_BACK_SOFT, EASE_IN, EASE_OUT_EXPO, swap } from "@/lib/motion-presets";
import { ProductGlyph } from "./products/ProductGlyph";
import { productScene } from "./products/product-scenes";
import s from "./products/products.module.css";

/** A glyph per product for the chips on the arc. */
const ICONS: Record<string, PhosphorIcon> = {
	"Forex Markets": ChartLineUp,
	Cryptocurrencies: CurrencyBtc,
	"Vivid AI": Sparkle,
	Academy: GraduationCap,
	"e-Commerce": ShoppingBag,
	Xstream: Broadcast,
	Prediction: Target,
	Arcade: GameController,
	Vision: Eye,
};

/** The half disc's radius at full size; a short window scales it down. */
const R0 = 252;
/** The arc the apps ride, inside the disc. */
const ARC0 = 188;
const CHIP = 46;
/** Degrees between neighbours: nine apps make a ring longer than the half
 *  you can see, so a drag or the wheel brings the rest round. */
const STEP = 30;
/** Vivid lands in focus, with Forex and Crypto above it. */
const FOCUS0 = 2;
/** Past these angles from the middle an app fades out of the visible half. */
const FADE_FROM = 66;
const FADE_TO = 92;
/** Segments in the glass outline: enough that a 250px arc stays round. */
const GLASS_N = 64;
/** The pour: each point of the outline waits for the sweep to reach where
 *  it is going, outward from the button (the nearest first, the far rim
 *  last), then travels, so the glass swells out of the button. */
const POUR = { sweep: 230, point: 520 };
const DRAIN_MS = 230;

/** Liquid: a quick start and a long glide. */
const easePour = easing(EASE_OUT_EXPO);
const easeIn = easing(EASE_IN);
const easeLand = easing(EASE_BACK_SOFT);
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const rad = (d: number) => (d * Math.PI) / 180;
const wrap = (deg: number, span: number) => {
	const half = span / 2;
	return ((((deg + half) % span) + span) % span) - half;
};
const mod = (i: number, n: number) => ((i % n) + n) % n;

/* ── the glass's two shapes ─────────────────────────────────────────────── */

const glassOutline = (c: Cubic[]) => pack(resample(c, GLASS_N));

/** The Products button: where the glass pours out of and drains back into. */
const pillShape = (x0: number, y0: number, x1: number, y1: number, r: number) =>
	glassOutline(
		new Pen(x0 + r, y0)
			.to(x1 - r, y0)
			.arc(x1 - r, y0 + r, r, r, -90, 0)
			.to(x1, y1 - r)
			.arc(x1 - r, y1 - r, r, r, 0, 90)
			.to(x0 + r, y1)
			.arc(x0 + r, y1 - r, r, r, 90, 180)
			.to(x0, y0 + r)
			.arc(x0 + r, y0 + r, r, r, 180, 270)
			.close(),
	);

/** The half disc, cut by the rail's edge. */
const discShape = (edge: number, cy: number, R: number) =>
	glassOutline(new Pen(edge, cy - R).arc(edge, cy, R, R, -90, 90).to(edge, cy - R).close());

interface Layout {
	/** The fixed box everything draws in, in viewport pixels. */
	box: { left: number; top: number; w: number; h: number };
	/** The rail's edge and the hub's height, in box pixels. */
	edge: number;
	cy: number;
	R: number;
	arc: number;
	pill: Outline;
	disc: Outline;
	/** The button's middle, where the pour starts. */
	from: [number, number];
}

function measure(anchor: HTMLElement): Layout {
	const b = anchor.getBoundingClientRect();
	const rail = anchor.closest("header") ?? anchor.closest("aside");
	const edgeX = rail ? rail.getBoundingClientRect().right : b.right + 12;
	const vh = window.innerHeight;
	const R = Math.min(R0, (vh - 24) / 2);
	// The hub sits level with the button, as far as the window allows.
	const cyV = Math.min(vh - R - 12, Math.max(R + 12, b.top + b.height / 2));
	const left = Math.min(b.left, edgeX) - 2;
	const top = Math.min(cyV - R, b.top) - 2;
	const right = edgeX + R + 2;
	const bottom = Math.max(cyV + R, b.bottom) + 2;
	const pill = pillShape(b.left - left, b.top - top, b.right - left, b.bottom - top, 13);
	const raw = discShape(edgeX - left, cyV - top, R);
	return {
		box: { left, top, w: right - left, h: bottom - top },
		edge: edgeX - left,
		cy: cyV - top,
		R,
		arc: ARC0 * (R / R0),
		pill,
		// Started where the pill is nearest, so the outline pours rather than twists.
		disc: rotate(raw, alignK(pill, raw)),
		from: [b.left + b.width / 2 - left, b.top + b.height / 2 - top],
	};
}

/** Paints one outline on the glass, its edge and its shadow, and morphs between outlines. */
function useGlass() {
	const glass = useRef<HTMLDivElement>(null);
	const edge = useRef<SVGPathElement>(null);
	const shade = useRef<SVGPathElement>(null);
	const current = useRef<Outline | null>(null);
	const frame = useRef(0);

	const paint = useCallback((o: Outline) => {
		current.current = Float64Array.from(o);
		const d = toPath(o);
		if (glass.current) glass.current.style.clipPath = `path("${d}")`;
		edge.current?.setAttribute("d", d);
		shade.current?.setAttribute("d", d);
	}, []);

	const morph = useCallback(
		(to: Outline, o: { ms: number; ease: (t: number) => number; delay?: (i: number) => number }) =>
			new Promise<void>((resolve) => {
				cancelAnimationFrame(frame.current);
				const from = current.current;
				if (!from || from.length !== to.length || o.ms <= 0) {
					paint(to);
					resolve();
					return;
				}
				const n = to.length / 6;
				const delays = Array.from({ length: n }, (_, i) => o.delay?.(i) ?? 0);
				const total = o.ms + Math.max(0, ...delays);
				const out = new Float64Array(to.length);
				const t0 = performance.now();
				const tick = (now: number) => {
					const el = now - t0;
					for (let i = 0; i < n; i++) {
						const p = o.ease(clamp01((el - delays[i]) / o.ms));
						for (let j = i * 6; j < i * 6 + 6; j++) out[j] = from[j] + (to[j] - from[j]) * p;
					}
					paint(out);
					if (el < total) frame.current = requestAnimationFrame(tick);
					else {
						paint(to);
						resolve();
					}
				};
				frame.current = requestAnimationFrame(tick);
			}),
		[paint],
	);

	useEffect(() => () => cancelAnimationFrame(frame.current), []);
	return { glass, edge, shade, paint, morph };
}

type Phase = "closed" | "opening" | "open" | "closing";

/**
 * Products, as a glass dial (owner 2026-10-16: first "halfcut and blurry
 * with the apps sliding in, with drag too, and tooltips", then "a more
 * sleek ui and nice transition and nice blur with svg morph").
 *
 * - The glass POURS out of the Products button: its outline morphs from the
 *   button's pill into a half disc cut by the rail's edge, the edge first and
 *   the far rim last, and drains back into the button on close.
 * - Real blur: the blur, the fill and the morphing clip-path are one element
 *   with nothing above it that would stop the browser blurring the page.
 * - The hub shows the product in focus as one duotone glyph that MORPHS from
 *   product to product (ProductGlyph), starting as the rail's own four
 *   squares, with its name and one line under it.
 * - The apps fly out along the arc from the hub, the one in focus first.
 *   Drag or scroll turns the dial and the app at three o'clock is in focus;
 *   hovering an app focuses it too. Arrows turn it, Enter opens, Esc closes.
 *
 * Portalled so the rail's scroll can't clip it. Reduced motion: no pour, no
 * flight; the glyph crossfades.
 */
export function ProductsOrbit({
	anchor,
	open,
	onClose,
}: {
	anchor: React.RefObject<HTMLElement | null>;
	open: boolean;
	onClose: () => void;
}) {
	const reduced = useReducedMotionConfig();
	const [layout, setLayout] = useState<Layout | null>(null);
	const [phase, setPhase] = useState<Phase>("closed");
	const [hubReady, setHubReady] = useState(false);
	const [spinFocus, setSpinFocus] = useState(FOCUS0);
	const [hover, setHover] = useState<number | null>(null);
	const spin = useMotionValue(0);
	const extend = useMotionValue(0);
	const closing = useRef(false);
	const dragging = useRef(false);
	const wheel = useRef({ acc: 0, target: 0 });
	const dial = useRef<HTMLDivElement>(null);
	const running = useRef<AnimationPlaybackControls[]>([]);
	const spinning = useRef<AnimationPlaybackControls | null>(null);
	const timers = useRef<number[]>([]);
	const { glass, edge, shade, paint, morph } = useGlass();
	const n = ECOSYSTEM.length;
	const span = n * STEP;

	const halt = useCallback(() => {
		for (const a of running.current) a.stop();
		running.current = [];
		spinning.current?.stop();
		spinning.current = null;
		for (const t of timers.current) window.clearTimeout(t);
		timers.current = [];
	}, []);

	// Open measures and pours; close drains. A re-open mid-drain pours again
	// from wherever the glass has got to.
	// biome-ignore lint/correctness/useExhaustiveDependencies: driven by `open` alone
	useLayoutEffect(() => {
		if (open) {
			if (!anchor.current) return;
			closing.current = false;
			setLayout(measure(anchor.current));
			setPhase("opening");
		} else if (phase === "opening" || phase === "open") {
			closing.current = true;
			setPhase("closing");
		}
	}, [open]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: one run per phase
	useLayoutEffect(() => {
		if (!layout) return;
		if (phase === "opening") {
			halt();
			spin.set(0);
			wheel.current = { acc: 0, target: 0 };
			setSpinFocus(FOCUS0);
			setHover(null);
			dial.current?.focus({ preventScroll: true });
			if (reduced) {
				paint(layout.disc);
				extend.set(1);
				setHubReady(true);
				setPhase("open");
				return;
			}
			paint(layout.pill);
			extend.set(0);
			running.current.push(animate(extend, 1, { duration: 0.7, ease: "linear", delay: 0.06 }));
			// The four squares hold a beat, then become the product in focus.
			timers.current.push(window.setTimeout(() => setHubReady(true), 240));
			const [fx, fy] = layout.from;
			const far = Math.hypot(layout.edge + layout.R - fx, Math.max(fy, layout.box.h - fy));
			void morph(layout.disc, {
				ms: POUR.point,
				ease: easePour,
				delay: (i) => POUR.sweep * clamp01(Math.hypot(layout.disc[i * 6 + 4] - fx, layout.disc[i * 6 + 5] - fy) / far),
			}).then(() => setPhase((p) => (p === "opening" ? "open" : p)));
		} else if (phase === "closing") {
			halt();
			setHubReady(false);
			// Exits are quicker than entrances and never stagger.
			running.current.push(animate(extend, 0, { duration: reduced ? 0 : 0.16, ease: EASE_IN }));
			void morph(layout.pill, { ms: reduced ? 0 : DRAIN_MS, ease: easeIn }).then(() =>
				setPhase((p) => (p === "closing" ? "closed" : p)),
			);
		}
	}, [phase, layout]);

	useEffect(() => halt, [halt]);

	// Focus follows the dial: whichever app sits at three o'clock.
	useMotionValueEvent(spin, "change", (v) => {
		const idx = mod(Math.round(FOCUS0 - v / STEP), n);
		setSpinFocus((p) => (p === idx ? p : idx));
	});
	const focus = hover ?? spinFocus;
	const app = ECOSYSTEM[focus];

	/** Turn the dial to `target` degrees; a new turn replaces the last. */
	const spinTo = useCallback(
		(target: number, stiffness: number, damping: number) => {
			wheel.current.target = target;
			spinning.current?.stop();
			spinning.current = animate(spin, target, reduced ? { duration: 0 } : { type: "spring", stiffness, damping });
		},
		[spin, reduced],
	);

	const turnTo = useCallback(
		(idx: number) => {
			const want = (FOCUS0 - mod(idx, n)) * STEP;
			spinTo(spin.get() + wrap(want - spin.get(), span), 210, 26);
		},
		[n, span, spin, spinTo],
	);

	// Out: a press anywhere else, Esc, the window resizing, the rail scrolling.
	useEffect(() => {
		if (phase !== "opening" && phase !== "open") return;
		const down = (e: PointerEvent) => {
			const t = e.target as Node;
			if (dial.current?.contains(t) || anchor.current?.contains(t)) return;
			onClose();
		};
		const key = (e: KeyboardEvent) => {
			if (e.key !== "Escape") return;
			onClose();
			anchor.current?.focus();
		};
		const rail = anchor.current?.closest("header") ?? anchor.current?.closest("aside");
		document.addEventListener("pointerdown", down, true);
		window.addEventListener("keydown", key);
		window.addEventListener("resize", onClose);
		rail?.addEventListener("scroll", onClose, { passive: true });
		return () => {
			document.removeEventListener("pointerdown", down, true);
			window.removeEventListener("keydown", key);
			window.removeEventListener("resize", onClose);
			rail?.removeEventListener("scroll", onClose);
		};
	}, [phase, onClose, anchor]);

	if (typeof document === "undefined" || phase === "closed" || !layout) return null;
	const { box, R, arc } = layout;
	const live = phase === "opening" || phase === "open";
	const glyph = Math.round(92 * (R / R0));

	const go = (a: EcosystemApp) => {
		window.open(a.href, "_blank", "noopener,noreferrer");
		onClose();
	};

	return createPortal(
		<div
			className="pointer-events-none fixed z-dropdown"
			style={{ left: box.left, top: box.top, width: box.w, height: box.h }}
		>
			{/* The shadow and the glass: the same outline, painted by useGlass. */}
			<svg aria-hidden className="absolute inset-0 overflow-visible" width={box.w} height={box.h}>
				<path ref={shade} className={s.shade} />
			</svg>
			<div ref={glass} aria-hidden className={`absolute inset-0 ${s.glass}`} />
			<svg aria-hidden className="absolute inset-0 overflow-visible" width={box.w} height={box.h}>
				<path ref={edge} className={s.edge} />
			</svg>

			{/* The dial: the half disc you can touch. */}
			<motion.div
				ref={dial}
				role="dialog"
				aria-label="WorldStreet products"
				tabIndex={-1}
				onKeyDown={(e) => {
					if (e.key === "ArrowDown" || e.key === "ArrowRight") turnTo(focus + 1);
					else if (e.key === "ArrowUp" || e.key === "ArrowLeft") turnTo(focus - 1);
					else if (e.key === "Home") turnTo(0);
					else if (e.key === "End") turnTo(n - 1);
					else if (e.key === "Enter" || e.key === " ") go(app);
					else return;
					e.preventDefault();
				}}
				onPanStart={() => {
					dragging.current = true;
					spinning.current?.stop();
					setHover(null);
				}}
				onPan={(_, info) => {
					spin.set(spin.get() + info.delta.y * 0.5);
				}}
				onPanEnd={(_, info) => {
					// A flick keeps turning a little, then lands an app at three o'clock.
					spinTo(Math.round((spin.get() + info.velocity.y * 0.08) / STEP) * STEP, 160, 22);
					window.setTimeout(() => {
						dragging.current = false;
					}, 0);
				}}
				onWheel={(e) => {
					// Trackpads send many small deltas: one app per 40px of scroll.
					const w = wheel.current;
					if (Math.abs(spin.get() - w.target) < 0.5) w.target = Math.round(spin.get() / STEP) * STEP;
					w.acc += e.deltaY;
					let moved = false;
					while (Math.abs(w.acc) >= 40) {
						w.target -= Math.sign(w.acc) * STEP;
						w.acc -= Math.sign(w.acc) * 40;
						moved = true;
					}
					if (moved) spinTo(w.target, 190, 24);
				}}
				className={`absolute cursor-grab select-none outline-none active:cursor-grabbing ${live ? "pointer-events-auto" : ""}`}
				style={{
					left: layout.edge,
					top: layout.cy - R,
					width: R,
					height: R * 2,
					borderRadius: `0 ${R}px ${R}px 0`,
					touchAction: "none",
				}}
			>
				{/* The arc the apps ride. */}
				<motion.svg aria-hidden className="absolute inset-0 overflow-visible" width={R} height={R * 2} style={{ opacity: extend }}>
					<path d={`M0 ${R - arc}A${arc} ${arc} 0 0 1 0 ${R + arc}`} className={s.track} />
				</motion.svg>

				{/* The hub: the glyph of the app in focus, its name and its line. */}
				<a
					href={app.href}
					target="_blank"
					rel="noopener noreferrer"
					draggable={false}
					onClick={(e) => {
						if (dragging.current) e.preventDefault();
						else onClose();
					}}
					aria-label={`Open ${app.title}`}
					className="absolute flex w-[150px] flex-col items-center rounded-[13px] text-center outline-none focus-visible:ring-2 focus-visible:ring-brand"
					style={{ left: 78 * (R / R0) - 75, top: R - 30 * (R / R0) - glyph / 2 }}
				>
					<ProductGlyph scene={hubReady ? productScene(app.title) : "products"} size={glyph} className="shrink-0" />
					<span className="relative mt-2 block h-[52px] w-full">
						<AnimatePresence initial={false} mode="popLayout">
							<motion.span key={app.title} {...(reduced ? {} : swap)} className="absolute inset-x-0 top-0 flex flex-col items-center">
								<span className="font-display text-[calc(15px*var(--ws-fs))] font-semibold tracking-[-0.01em] text-primary">{app.title}</span>
								<span className="mt-0.5 line-clamp-2 font-sans text-[calc(12px*var(--ws-fs))] leading-snug text-muted">
									{app.description}
								</span>
							</motion.span>
						</AnimatePresence>
					</span>
				</a>

				{ECOSYSTEM.map((a, i) => (
					<DialChip
						key={a.title}
						app={a}
						index={i}
						span={span}
						spin={spin}
						extend={extend}
						closing={closing}
						focused={i === focus}
						R={R}
						arc={arc}
						onHover={(on) => {
							if (dragging.current) return;
							setHover(on ? i : null);
						}}
						onPick={(e) => {
							if (dragging.current) {
								e.preventDefault();
								return;
							}
							onClose();
						}}
					/>
				))}
			</motion.div>
		</div>,
		document.body,
	);
}

function DialChip({
	app,
	index,
	span,
	spin,
	extend,
	closing,
	focused,
	R,
	arc,
	onHover,
	onPick,
}: {
	app: EcosystemApp;
	index: number;
	span: number;
	spin: MotionValue<number>;
	extend: MotionValue<number>;
	closing: React.RefObject<boolean>;
	focused: boolean;
	R: number;
	arc: number;
	onHover: (on: boolean) => void;
	onPick: (e: React.MouseEvent) => void;
}) {
	const angle = useTransform(spin, (v) => wrap(index * STEP - FOCUS0 * STEP + v, span));
	// How far out of the hub this app has flown: the one in focus leaves
	// first, the edges last, each landing with a soft settle. Closing pulls
	// them all in together.
	const out = useTransform(() => {
		const e = extend.get();
		if (closing.current) return e;
		const lead = 0.34 * Math.min(1, Math.abs(angle.get()) / 90);
		return easeLand(clamp01((e - lead) / 0.6));
	});
	const radius = useTransform(() => arc * (0.22 + 0.78 * out.get()));
	const x = useTransform(() => Math.cos(rad(angle.get())) * radius.get() - CHIP / 2);
	const y = useTransform(() => R + Math.sin(rad(angle.get())) * radius.get() - CHIP / 2);
	const opacity = useTransform(() => {
		const d = Math.abs(angle.get());
		const edge = d >= FADE_TO ? 0 : d > FADE_FROM ? (FADE_TO - d) / (FADE_TO - FADE_FROM) : 1;
		return edge * clamp01(out.get() * 1.6);
	});
	const scale = useTransform(() => (0.55 + 0.45 * clamp01(out.get())) * (1 - Math.min(0.2, (Math.abs(angle.get()) / 90) * 0.2)));
	const events = useTransform(opacity, (o) => (o < 0.4 ? "none" : "auto"));
	const Icon = ICONS[app.title] ?? Sparkle;

	return (
		<motion.a
			href={app.href}
			target="_blank"
			rel="noopener noreferrer"
			aria-label={app.title}
			draggable={false}
			// One tab stop for the dial (the hub link); arrows turn it, so the
			// apps turned out of sight are never reachable by Tab.
			tabIndex={-1}
			onClick={onPick}
			onPointerEnter={() => onHover(true)}
			onPointerLeave={() => onHover(false)}
			style={{ position: "absolute", left: 0, top: 0, x, y, opacity, scale, width: CHIP, height: CHIP, pointerEvents: events }}
			className="group/app outline-none"
		>
			<span
				className={`flex h-full w-full items-center justify-center rounded-pill transition-[background-color,color,box-shadow,transform] duration-200 ${
					focused
						? "scale-[1.12] bg-brand text-brand-on shadow-nav"
						: "bg-primary/[0.1] text-primary ring-1 ring-inset ring-primary/[0.08] group-hover/app:bg-primary/[0.16]"
				}`}
			>
				<Icon size={21} weight={focused ? "fill" : "duotone"} />
			</span>
		</motion.a>
	);
}
