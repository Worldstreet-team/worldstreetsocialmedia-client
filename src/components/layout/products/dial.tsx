"use client";

import {
	ChartLineUp,
	CurrencyBtc,
	Eye,
	GameController,
	GraduationCap,
	ShoppingBag,
	SquaresFour,
	Target,
	type Icon as PhosphorIcon,
} from "@phosphor-icons/react";
import { VividOrb } from "@/components/vivid/VividOrb";
import { easing } from "@/lib/morph/geometry";
import { DUR, EASE, EASE_BACK_SOFT, EASE_IN, EASE_OUT_EXPO } from "@/lib/motion-presets";

/**
 * What the two Products dials share: the desktop rail's (ProductsOrbit) and
 * the phone's wheel (ProductsWheel). The ring of apps, how an app rolls, and
 * the mark each app wears.
 */

/** Degrees between neighbouring apps on the ring. */
export const STEP = 30;
/** The app that lands in focus when the dial opens: Vivid. */
export const FOCUS0 = 2;
/**
 * An app turns one full turn for every seat it travels, so it rolls when the
 * dial turns or when it rolls in, and is upright again on every seat.
 */
export const ROLL = 360 / STEP;

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
export const rad = (d: number) => (d * Math.PI) / 180;
export const mod = (i: number, n: number) => ((i % n) + n) % n;
/** An angle folded into the ring's span, centred on 0. */
export const wrap = (deg: number, span: number) => {
	const half = span / 2;
	return ((((deg + half) % span) + span) % span) - half;
};

/** Rolling in: a quick start, a long glide, a soft settle in the seat. */
export const easeRoll = easing(EASE_BACK_SOFT);
export const easeGlide = easing(EASE_OUT_EXPO);
export const easeLeave = easing(EASE_IN);

/** The name under the hub, changing with a soft blur. */
export const labelSwap = {
	initial: { opacity: 0, y: 6, filter: "blur(5px)" },
	animate: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: DUR.slow, ease: EASE } },
	exit: { opacity: 0, y: -6, filter: "blur(5px)", transition: { duration: DUR.fast, ease: EASE_IN } },
} as const;

const ICONS: Record<string, PhosphorIcon> = {
	"Forex Markets": ChartLineUp,
	Cryptocurrencies: CurrencyBtc,
	Academy: GraduationCap,
	"e-Commerce": ShoppingBag,
	Prediction: Target,
	Arcade: GameController,
	Vision: Eye,
};

/**
 * The mark an app wears on the ring (owner 2026-10-16: "use the xtream logo
 * for xtream ... the vivid dots for vivid, it's not constrained to the icons
 * only"): Xstream's chilli, Vivid's living dots, a duotone glyph for the rest.
 */
export function ProductMark({ title, size, active }: { title: string; size: number; active?: boolean }) {
	if (title === "Xstream") {
		return (
			// biome-ignore lint/performance/noImgElement: a 10KB mark, never worth next/image's wrapper
			<img
				src="/images/products/xstream.webp"
				alt=""
				width={size}
				height={size}
				draggable={false}
				className="pointer-events-none object-contain"
				style={{ width: size, height: size }}
			/>
		);
	}
	if (title === "Vivid AI") return <VividOrb size={size} speed={active ? 0.9 : 0.45} />;
	const Icon = ICONS[title] ?? SquaresFour;
	return <Icon size={Math.round(size * 0.72)} weight={active ? "fill" : "duotone"} />;
}
