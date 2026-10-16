"use client";

import { X } from "@phosphor-icons/react";
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
import { EASE_IN, EASE_OUT_EXPO } from "@/lib/motion-presets";
import { FOCUS0, ProductMark, ROLL, STEP, clamp01, easeLeave, easeRoll, labelSwap, mod, rad, wrap } from "./dial";
import { ProductGlyph } from "./ProductGlyph";
import { productScene } from "./product-scenes";
import s from "./products.module.css";

const CHIP = 48;
const GLYPH = 72;
/** Where the apps roll in from: off the wheel's left end, below the axle. */
const ENTER = -112;
const FADE_FROM = 62;
const FADE_TO = 90;
const ROLL_IN = { delay: 70, gap: 45, base: 300, perDeg: 2 };
const WIPE_IN = 0.56;
const WIPE_OUT = 0.24;
const HUB_TURN_MS = 380;

interface Layout {
	/** The axle: the wheel's centre, near the bottom of the screen. */
	cx: number;
	cy: number;
	R: number;
	/** The Products row's middle, where the blur comes from. */
	origin: [number, number];
	reach: number;
}

function measure(from: HTMLElement | null): Layout {
	const vw = window.innerWidth;
	const vh = window.innerHeight;
	const safe = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--ws-safe-bottom")) || 0;
	const cx = vw / 2;
	const cy = vh - safe - 64;
	const o = from?.getBoundingClientRect();
	const ox = o ? o.left + o.width / 2 : cx;
	const oy = o ? o.top + o.height / 2 : cy;
	return {
		cx,
		cy,
		R: Math.min(162, vw / 2 - 38),
		origin: [ox, oy],
		reach: Math.hypot(Math.max(ox, vw - ox), Math.max(oy, vh - oy)) + 24,
	};
}

/** Seats on the wheel: 0 is the top, the right is positive. The right-most seat leaves first. */
function rollOrder(n: number, span: number) {
	const seats = Array.from({ length: n }, (_, i) => ({ i, seat: wrap(i * STEP - FOCUS0 * STEP, span) }));
	const shown = seats.filter((x) => Math.abs(x.seat) < FADE_TO).sort((a, b) => b.seat - a.seat);
	const plan = new Map<number, { delay: number; dur: number }>();
	shown.forEach((x, k) =>
		plan.set(x.i, { delay: ROLL_IN.delay + k * ROLL_IN.gap, dur: ROLL_IN.base + Math.abs(x.seat - ENTER) * ROLL_IN.perDeg }),
	);
	const end = Math.max(0, ...[...plan.values()].map((p) => p.delay + p.dur)) + 20;
	return { plan, end };
}

type Phase = "closed" | "opening" | "open" | "closing";

/**
 * Products on a phone (owner 2026-10-16: "let mobile have its own animation
 * too"). The desktop dial (ProductsOrbit) hangs off the rail; a phone has no
 * rail, so the apps ride a wheel that rises from the bottom of the screen,
 * where the thumb is.
 *
 * - The page goes soft, the blur spreading out of the Products row.
 * - The apps roll in along the rim from the left, the right-most seat first,
 *   one turn per seat, and settle with a soft overshoot.
 * - A swipe turns the wheel (the apps roll as it turns); the one at the top
 *   is in focus. Tap another app and the wheel brings it to the top, so you
 *   see its name first; tap it again, or the hub, to open it.
 * - The hub opens on WorldStreet's W and morphs into the app at the top,
 *   its name and line under it. The axle is the close button.
 *
 * Reduced motion: no wipe, no rolling; the glyph crossfades.
 */
export function ProductsWheel({
	origin,
	open,
	onClose,
}: {
	origin: React.RefObject<HTMLElement | null>;
	open: boolean;
	onClose: () => void;
}) {
	const reduced = useReducedMotionConfig();
	const [layout, setLayout] = useState<Layout | null>(null);
	const [phase, setPhase] = useState<Phase>("closed");
	const [hubReady, setHubReady] = useState(false);
	const [focus, setFocus] = useState(FOCUS0);
	const n = ECOSYSTEM.length;
	const span = n * STEP;
	const [order] = useState(() => rollOrder(n, span));
	const spin = useMotionValue(0);
	const clock = useMotionValue(0);
	const leave = useMotionValue(0);
	const wipe = useMotionValue(0);
	const hubOpacity = useTransform(leave, (l) => 1 - l);
	const closing = useRef(false);
	const dragging = useRef(false);
	const running = useRef<AnimationPlaybackControls[]>([]);
	const spinning = useRef<AnimationPlaybackControls | null>(null);
	const timers = useRef<number[]>([]);

	const halt = useCallback(() => {
		for (const a of running.current) a.stop();
		running.current = [];
		spinning.current?.stop();
		spinning.current = null;
		for (const t of timers.current) window.clearTimeout(t);
		timers.current = [];
	}, []);

	// biome-ignore lint/correctness/useExhaustiveDependencies: driven by `open` alone
	useLayoutEffect(() => {
		if (open) {
			closing.current = false;
			setLayout(measure(origin.current));
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
			leave.set(0);
			setFocus(FOCUS0);
			setHubReady(false);
			if (reduced) {
				wipe.set(layout.reach);
				clock.set(order.end);
				setHubReady(true);
				setPhase("open");
				return;
			}
			wipe.set(0);
			clock.set(0);
			running.current.push(animate(wipe, layout.reach, { duration: WIPE_IN, ease: EASE_OUT_EXPO }));
			running.current.push(animate(clock, order.end, { duration: order.end / 1000, ease: "linear" }));
			timers.current.push(window.setTimeout(() => setHubReady(true), HUB_TURN_MS));
			timers.current.push(window.setTimeout(() => setPhase((p) => (p === "opening" ? "open" : p)), order.end));
		} else if (phase === "closing") {
			halt();
			setHubReady(false);
			running.current.push(animate(leave, 1, { duration: reduced ? 0 : 0.2, ease: EASE_IN }));
			running.current.push(animate(wipe, 0, { duration: reduced ? 0 : WIPE_OUT, ease: EASE_IN }));
			timers.current.push(
				window.setTimeout(() => setPhase((p) => (p === "closing" ? "closed" : p)), reduced ? 0 : WIPE_OUT * 1000 + 30),
			);
		}
	}, [phase, layout]);

	useEffect(() => halt, [halt]);

	// Esc on a tablet keyboard; the page behind never scrolls under the wheel.
	useEffect(() => {
		if (phase !== "opening" && phase !== "open") return;
		const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
		const prev = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		window.addEventListener("keydown", key);
		window.addEventListener("resize", onClose);
		return () => {
			document.body.style.overflow = prev;
			window.removeEventListener("keydown", key);
			window.removeEventListener("resize", onClose);
		};
	}, [phase, onClose]);

	useMotionValueEvent(spin, "change", (v) => {
		const idx = mod(Math.round(FOCUS0 - v / STEP), n);
		setFocus((p) => (p === idx ? p : idx));
	});
	const app = ECOSYSTEM[focus];

	const spinTo = useCallback(
		(target: number, stiffness: number, damping: number) => {
			spinning.current?.stop();
			spinning.current = animate(spin, target, reduced ? { duration: 0 } : { type: "spring", stiffness, damping });
		},
		[spin, reduced],
	);
	const turnTo = useCallback(
		(idx: number) => {
			const want = (FOCUS0 - mod(idx, n)) * STEP;
			spinTo(spin.get() + wrap(want - spin.get(), span), 200, 24);
		},
		[n, span, spin, spinTo],
	);

	const clip = useTransform(wipe, (r) => (layout ? `circle(${r}px at ${layout.origin[0]}px ${layout.origin[1]}px)` : "none"));

	if (typeof document === "undefined" || phase === "closed" || !layout) return null;
	const live = phase === "opening" || phase === "open";
	const { cx, cy, R } = layout;

	const go = (a: EcosystemApp) => {
		window.open(a.href, "_blank", "noopener,noreferrer");
		onClose();
	};

	return createPortal(
		<>
			<motion.div
				aria-hidden
				onPointerDown={onClose}
				className={`fixed inset-0 z-modal touch-none ${s.backdrop} ${live ? "" : "pointer-events-none"}`}
				style={{ clipPath: clip }}
			/>
			<motion.div
				role="dialog"
				aria-label="WorldStreet products"
				onPanStart={() => {
					dragging.current = true;
					spinning.current?.stop();
				}}
				onPan={(_, info) => {
					spin.set(spin.get() + info.delta.x * 0.42);
				}}
				onPanEnd={(_, info) => {
					spinTo(Math.round((spin.get() + info.velocity.x * 0.06) / STEP) * STEP, 170, 22);
					window.setTimeout(() => {
						dragging.current = false;
					}, 0);
				}}
				className={`fixed z-modal touch-none select-none ${live ? "" : "pointer-events-none"}`}
				style={{ left: cx - R - CHIP, top: cy - R - CHIP, width: (R + CHIP) * 2, height: R + CHIP + 56 }}
			>
				{/* The hub: WorldStreet's W, then the app at the top. */}
				<motion.button
					type="button"
					onClick={() => {
						if (!dragging.current) go(app);
					}}
					aria-label={`Open ${app.title}`}
					className="absolute flex w-[210px] cursor-pointer flex-col items-center text-center outline-none"
					style={{ left: R + CHIP - 105, top: R + CHIP - 100 - GLYPH / 2, opacity: hubOpacity }}
				>
					<ProductGlyph scene={hubReady ? productScene(app.title) : "worldstreet"} size={GLYPH} className="shrink-0" />
					<span className="relative mt-2 block h-[50px] w-full">
						<AnimatePresence initial={false} mode="popLayout">
							<motion.span
								key={hubReady ? app.title : "worldstreet"}
								{...(reduced ? {} : labelSwap)}
								className="absolute inset-x-0 top-0 flex flex-col items-center"
							>
								<span className="font-display text-[calc(15px*var(--ws-fs))] font-semibold tracking-[-0.01em] text-primary">
									{hubReady ? app.title : "WorldStreet"}
								</span>
								{hubReady && (
									<span className="mt-0.5 line-clamp-2 font-sans text-[calc(12.5px*var(--ws-fs))] leading-snug text-muted">
										{app.description}
									</span>
								)}
							</motion.span>
						</AnimatePresence>
					</span>
				</motion.button>

				{ECOSYSTEM.map((a, i) => (
					<WheelApp
						key={a.title}
						app={a}
						index={i}
						span={span}
						spin={spin}
						clock={clock}
						leave={leave}
						closing={closing}
						plan={order.plan.get(i)}
						focused={i === focus}
						R={R}
						center={R + CHIP}
						onTap={() => {
							if (dragging.current) return;
							// The first tap brings it to the top, so its name shows; the second opens.
							if (i === focus) go(a);
							else turnTo(i);
						}}
					/>
				))}

				{/* The axle closes. */}
				<motion.button
					type="button"
					onClick={onClose}
					aria-label="Close"
					className="absolute flex h-11 w-11 cursor-pointer items-center justify-center rounded-pill bg-primary/10 text-primary outline-none"
					style={{ left: R + CHIP - 22, top: R + CHIP - 4, opacity: hubOpacity }}
				>
					<X size={18} weight="bold" />
				</motion.button>
			</motion.div>
		</>,
		document.body,
	);
}

function WheelApp({
	app,
	index,
	span,
	spin,
	clock,
	leave,
	closing,
	plan,
	focused,
	R,
	center,
	onTap,
}: {
	app: EcosystemApp;
	index: number;
	span: number;
	spin: MotionValue<number>;
	clock: MotionValue<number>;
	leave: MotionValue<number>;
	closing: React.RefObject<boolean>;
	plan?: { delay: number; dur: number };
	focused: boolean;
	R: number;
	/** The axle, in the wheel box. */
	center: number;
	onTap: () => void;
}) {
	const seat = useTransform(spin, (v) => wrap(index * STEP - FOCUS0 * STEP + v, span));
	const angle = useTransform(() => {
		const st = seat.get();
		if (closing.current) return st + (ENTER - st) * easeLeave(leave.get());
		if (!plan) return st;
		const p = easeRoll(clamp01((clock.get() - plan.delay) / plan.dur));
		return ENTER + (st - ENTER) * p;
	});
	// 0 is the top of the wheel.
	const x = useTransform(() => center + Math.sin(rad(angle.get())) * R - CHIP / 2);
	const y = useTransform(() => center - Math.cos(rad(angle.get())) * R - CHIP / 2);
	const rotate = useTransform(angle, (a) => a * ROLL);
	const opacity = useTransform(angle, (a) => {
		const d = Math.abs(a);
		return d >= FADE_TO ? 0 : d > FADE_FROM ? (FADE_TO - d) / (FADE_TO - FADE_FROM) : 1;
	});
	const scale = useTransform(angle, (a) => 1 - Math.min(0.18, (Math.abs(a) / 90) * 0.18));
	const events = useTransform(opacity, (o) => (o < 0.4 ? "none" : "auto"));
	const logo = app.title === "Xstream" || app.title === "Vivid AI";

	return (
		<motion.button
			type="button"
			onClick={onTap}
			aria-label={app.title}
			style={{ position: "absolute", left: 0, top: 0, x, y, rotate, opacity, scale, width: CHIP, height: CHIP, pointerEvents: events }}
			className="cursor-pointer outline-none"
		>
			<span
				className={`flex h-full w-full items-center justify-center rounded-pill transition-[background-color,color,transform] duration-200 ${
					focused ? "scale-[1.14] bg-primary/[0.16] text-brand" : "bg-primary/[0.08] text-primary"
				}`}
			>
				<ProductMark title={app.title} size={logo ? 34 : CHIP - 14} active={focused} />
			</span>
		</motion.button>
	);
}
