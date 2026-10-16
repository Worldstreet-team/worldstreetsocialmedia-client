"use client";

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
import { ProductGlyph } from "./products/ProductGlyph";
import { FOCUS0, ProductMark, ROLL, STEP, clamp01, easeLeave, easeRoll, labelSwap, mod, rad, wrap } from "./products/dial";
import { productScene } from "./products/product-scenes";
import s from "./products/products.module.css";

/** The ring the apps ride, centred on the rail's edge. */
const ARC = 150;
const CHIP = 42;
const GLYPH = 64;
/** Where the apps roll in from: just under the ring's lower end, by the button. */
const ENTER = 108;
/** Past these angles from three o'clock an app fades out of the half you can see. */
const FADE_FROM = 66;
const FADE_TO = 90;
/** Rolling in, in ms: the farthest seat leaves first, each a beat after the last. */
const ROLL_IN = { delay: 60, gap: 45, base: 300, perDeg: 2.1 };
/** The blur spreading out of the button, and drawing back into it (s). */
const WIPE_IN = 0.56;
const WIPE_OUT = 0.24;
const HUB_TURN_MS = 380;

interface Layout {
	/** The rail's edge and the hub's height, in viewport pixels. */
	edge: number;
	cy: number;
	/** The Products button's middle, where the blur comes from. */
	origin: [number, number];
	/** The blur's full radius: past the farthest corner. */
	reach: number;
}

function measure(anchor: HTMLElement): Layout {
	const b = anchor.getBoundingClientRect();
	const rail = anchor.closest("header") ?? anchor.closest("aside");
	const edge = rail ? rail.getBoundingClientRect().right : b.right + 12;
	const vw = window.innerWidth;
	const vh = window.innerHeight;
	const by = b.top + b.height / 2;
	const room = ARC + CHIP;
	// The hub sits level with the button, as far as the window allows.
	const cy = Math.min(vh - room - 8, Math.max(room + 8, by));
	const ox = b.left + b.width / 2;
	return {
		edge,
		cy,
		origin: [ox, by],
		reach: Math.hypot(Math.max(vw - ox, ox), Math.max(by, vh - by)) + 24,
	};
}

/** Each app's turn to roll in: the highest seat first, so they never cross. */
function rollOrder(n: number, span: number) {
	const seats = Array.from({ length: n }, (_, i) => ({ i, seat: wrap(i * STEP - FOCUS0 * STEP, span) }));
	const shown = seats.filter((x) => Math.abs(x.seat) < FADE_TO).sort((a, b) => a.seat - b.seat);
	const plan = new Map<number, { delay: number; dur: number }>();
	shown.forEach((x, k) =>
		plan.set(x.i, { delay: ROLL_IN.delay + k * ROLL_IN.gap, dur: ROLL_IN.base + Math.abs(ENTER - x.seat) * ROLL_IN.perDeg }),
	);
	const end = Math.max(0, ...[...plan.values()].map((p) => p.delay + p.dur)) + 20;
	return { plan, end };
}

type Phase = "closed" | "opening" | "open" | "closing";

/**
 * Products, a dial of the WorldStreet apps beside the rail. Owner
 * 2026-10-16, in three passes: "halfcut and blurry with the apps sliding in,
 * with drag too, and tooltips"; then "a more sleek ui and nice transition and
 * nice blur with svg morph"; then "on open the items roll, use the xtream
 * logo for xtream and the worldstreet logo for worldstreet, the vivid dots
 * for vivid ... a nice motion flow not just morph, blur background, remove
 * the rounded border, make it smaller". Phones have their own: ProductsWheel.
 *
 * - The page goes soft: a blur spreads out of the Products button across
 *   everything right of the rail, and draws back into it on close. Pressing
 *   the blur closes the dial.
 * - The apps ROLL in: each leaves from under the ring by the button and
 *   rolls up into its seat, one full turn per seat it travels, the highest
 *   seat first, settling with a soft overshoot. Turning the dial (drag,
 *   wheel, arrows) rolls them too, and every seat stands them upright.
 * - Real marks, not only icons: Xstream's chilli, Vivid's living dots.
 * - The hub opens on WorldStreet's W and morphs into the app in focus (the
 *   one at three o'clock, or the one under the pointer), with its name and
 *   line changing under it through a soft blur. No disc, no border.
 *
 * Portalled so the rail's scroll can't clip it. Reduced motion: no wipe, no
 * rolling; the glyph crossfades.
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
	const n = ECOSYSTEM.length;
	const span = n * STEP;
	const [order] = useState(() => rollOrder(n, span));
	const spin = useMotionValue(0);
	/** Milliseconds into the roll-in. */
	const clock = useMotionValue(0);
	/** 0 to 1 while closing: everything rolls back down together. */
	const leave = useMotionValue(0);
	/** The blur's radius. */
	const wipe = useMotionValue(0);
	const hubOpacity = useTransform(leave, (l) => 1 - l);
	const closing = useRef(false);
	const dragging = useRef(false);
	const wheel = useRef({ acc: 0, target: 0 });
	const dial = useRef<HTMLDivElement>(null);
	const running = useRef<AnimationPlaybackControls[]>([]);
	const spinning = useRef<AnimationPlaybackControls | null>(null);
	/** While the dial turns, apps slide under a still pointer: that is not a hover. */
	const turning = useRef(false);
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
			leave.set(0);
			wheel.current = { acc: 0, target: 0 };
			setSpinFocus(FOCUS0);
			setHover(null);
			setHubReady(false);
			dial.current?.focus({ preventScroll: true });
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
			// WorldStreet's W holds a beat, then becomes the app in focus.
			timers.current.push(window.setTimeout(() => setHubReady(true), HUB_TURN_MS));
			timers.current.push(window.setTimeout(() => setPhase((p) => (p === "opening" ? "open" : p)), order.end));
		} else if (phase === "closing") {
			halt();
			setHubReady(false);
			// Exits are quicker than entrances and never stagger.
			running.current.push(animate(leave, 1, { duration: reduced ? 0 : 0.2, ease: EASE_IN }));
			running.current.push(animate(wipe, 0, { duration: reduced ? 0 : WIPE_OUT, ease: EASE_IN }));
			timers.current.push(
				window.setTimeout(() => setPhase((p) => (p === "closing" ? "closed" : p)), reduced ? 0 : WIPE_OUT * 1000 + 30),
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
			// Turning hands focus to three o'clock.
			setHover(null);
			turning.current = true;
			const run = animate(spin, target, reduced ? { duration: 0 } : { type: "spring", stiffness, damping });
			spinning.current = run;
			void run.then(() => {
				if (spinning.current === run) turning.current = false;
			});
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

	const clip = useTransform(wipe, (r) =>
		layout ? `circle(${r}px at ${layout.origin[0] - layout.edge}px ${layout.origin[1]}px)` : "none",
	);

	if (typeof document === "undefined" || phase === "closed" || !layout) return null;
	const live = phase === "opening" || phase === "open";
	const room = ARC + CHIP;

	const go = (a: EcosystemApp) => {
		window.open(a.href, "_blank", "noopener,noreferrer");
		onClose();
	};

	return createPortal(
		<>
			{/* The page goes soft, spreading out of the button. */}
			<motion.div
				aria-hidden
				className={`fixed inset-y-0 right-0 z-dropdown ${s.backdrop} ${live ? "" : "pointer-events-none"}`}
				style={{ left: layout.edge, clipPath: clip }}
			/>

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
				onTap={(e) => {
					// The dial's empty space is the page: a tap there closes.
					if (e.target === dial.current) onClose();
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
				className={`fixed z-dropdown cursor-grab select-none outline-none active:cursor-grabbing ${live ? "" : "pointer-events-none"}`}
				style={{ left: layout.edge, top: layout.cy - room, width: room + 16, height: room * 2, touchAction: "none" }}
			>
				{/* The hub: WorldStreet's W, then the app in focus, its name under it. */}
				<motion.a
					href={app.href}
					target="_blank"
					rel="noopener noreferrer"
					draggable={false}
					onClick={(e) => {
						if (dragging.current) e.preventDefault();
						else onClose();
					}}
					aria-label={`Open ${app.title}`}
					className="absolute flex w-[118px] flex-col items-center rounded-[13px] text-center outline-none focus-visible:ring-2 focus-visible:ring-brand"
					style={{ left: 58 - 59, top: room - 26 - GLYPH / 2, opacity: hubOpacity }}
				>
					<ProductGlyph scene={hubReady ? productScene(app.title) : "worldstreet"} size={GLYPH} className="shrink-0" />
					<span className="relative mt-1.5 block h-[46px] w-full">
						<AnimatePresence initial={false} mode="popLayout">
							<motion.span
								key={hubReady ? app.title : "worldstreet"}
								{...(reduced ? {} : labelSwap)}
								className="absolute inset-x-0 top-0 flex flex-col items-center"
							>
								<span className="font-display text-[calc(13.5px*var(--ws-fs))] font-semibold tracking-[-0.01em] text-primary">
									{hubReady ? app.title : "WorldStreet"}
								</span>
								{hubReady && (
									<span className="mt-0.5 line-clamp-2 font-sans text-[calc(11.5px*var(--ws-fs))] leading-snug text-muted">
										{app.description}
									</span>
								)}
							</motion.span>
						</AnimatePresence>
					</span>
				</motion.a>

				{ECOSYSTEM.map((a, i) => (
					<RollingApp
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
						cy={room}
						onHover={(on) => {
							if (dragging.current || turning.current) return;
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
		</>,
		document.body,
	);
}

function RollingApp({
	app,
	index,
	span,
	spin,
	clock,
	leave,
	closing,
	plan,
	focused,
	cy,
	onHover,
	onPick,
}: {
	app: EcosystemApp;
	index: number;
	span: number;
	spin: MotionValue<number>;
	clock: MotionValue<number>;
	leave: MotionValue<number>;
	closing: React.RefObject<boolean>;
	/** When this app rolls in; none when its seat is out of sight. */
	plan?: { delay: number; dur: number };
	focused: boolean;
	cy: number;
	onHover: (on: boolean) => void;
	onPick: (e: React.MouseEvent) => void;
}) {
	const seat = useTransform(spin, (v) => wrap(index * STEP - FOCUS0 * STEP + v, span));
	// Where on the ring it is: rolling up into its seat, then riding the dial;
	// closing rolls everything back down together.
	const angle = useTransform(() => {
		const st = seat.get();
		if (closing.current) return st + (ENTER - st) * easeLeave(leave.get());
		if (!plan) return st;
		const p = easeRoll(clamp01((clock.get() - plan.delay) / plan.dur));
		return ENTER + (st - ENTER) * p;
	});
	const x = useTransform(() => Math.cos(rad(angle.get())) * ARC - CHIP / 2);
	const y = useTransform(() => cy + Math.sin(rad(angle.get())) * ARC - CHIP / 2);
	// One turn per seat travelled: it rolls, and stands upright on every seat.
	const rotate = useTransform(angle, (a) => a * ROLL);
	const opacity = useTransform(angle, (a) => {
		const d = Math.abs(a);
		return d >= FADE_TO ? 0 : d > FADE_FROM ? (FADE_TO - d) / (FADE_TO - FADE_FROM) : 1;
	});
	const scale = useTransform(angle, (a) => 1 - Math.min(0.16, (Math.abs(a) / 90) * 0.16));
	const events = useTransform(opacity, (o) => (o < 0.4 ? "none" : "auto"));
	const logo = app.title === "Xstream" || app.title === "Vivid AI";

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
			style={{ position: "absolute", left: 0, top: 0, x, y, rotate, opacity, scale, width: CHIP, height: CHIP, pointerEvents: events }}
			className="outline-none"
		>
			<span
				className={`flex h-full w-full items-center justify-center rounded-pill transition-[background-color,color,transform] duration-200 ${
					focused ? "scale-[1.16] bg-primary/[0.16] text-brand" : "bg-primary/[0.08] text-primary"
				}`}
			>
				<ProductMark title={app.title} size={logo ? 30 : CHIP - 12} active={focused} />
			</span>
		</motion.a>
	);
}
