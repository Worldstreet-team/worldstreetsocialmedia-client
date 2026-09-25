/**
 * A custom app palette, derived from one seed colour (owner 2026-09-25:
 * the WorldSpace theme, outside chat too, should be able to follow a
 * picture). The seed is the picture's accent from sampleImage(); this
 * file turns it into the six brand tokens per mode that every curated
 * palette in src/styles/ws-palettes.css keeps, on the same architecture:
 *
 * - The fill is a LIGHT fill with the dark ink #0C0A09 in both modes, and
 *   the ink reads on it at 7.2:1 or better. The seed keeps its hue and its
 *   saturation; only lightness walks (in HSL) until the ink passes, so a
 *   deep navy becomes a cornflower, not a pastel.
 * - Dark: active is one step lighter, dim one step darker, and the brand
 *   as text or glyph on black reads at 11:1 or better (the active step,
 *   walked lighter if it has to be).
 * - Light: the fill is the same colour, walked one step deeper only when
 *   it would dissolve into paper (under 1.5:1 against white, the reason
 *   Citrus drops a step); active is a step darker, dim a step darker
 *   again, and the brand as text is a deep version of the hue at 5.8:1 or
 *   better against #FFFFFF.
 * - A seed with no colour in it (a black-and-white photograph) becomes an
 *   ink palette, exactly Mono: white fill with dark ink at night, #18181B
 *   with white ink by day.
 *
 * The shape is FLAT with scalar string leaves: the gateway keeps one object
 * level under a preferences namespace, nothing deeper. Plain TypeScript, no
 * React, so preferences.ts (client) and any script can import it.
 */

export interface CustomPalette {
	/** The colour it was derived from, as sampled. */
	seed: string;
	dPrimary: string;
	dOn: string;
	dActive: string;
	dDim: string;
	dText: string;
	/** `rgba(r, g, b, 0.10)`. */
	dGlow: string;
	lPrimary: string;
	lOn: string;
	lActive: string;
	lDim: string;
	lText: string;
	/** `rgba(r, g, b, 0.06)`. */
	lGlow: string;
}

export const CUSTOM_PALETTE_KEYS = [
	"seed",
	"dPrimary",
	"dOn",
	"dActive",
	"dDim",
	"dText",
	"dGlow",
	"lPrimary",
	"lOn",
	"lActive",
	"lDim",
	"lText",
	"lGlow",
] as const satisfies readonly (keyof CustomPalette)[];

/* ------------------------------------------------------------------ */
/* Colour helpers */

const HEX_RE = /^#[0-9a-fA-F]{6}$/;
const RGBA_RE = /^rgba\(\d{1,3}, \d{1,3}, \d{1,3}, (0|1|0?\.\d{1,3})\)$/;

/** The dark ink every light fill carries, and the two pages. */
const INK = "#0C0A09";
const BLACK = "#000000";
const PAPER = "#FFFFFF";

/** Ink on fill, both modes. */
const FILL_INK_RATIO = 7.2;
/** Brand as text on black. */
const DARK_TEXT_RATIO = 11;
/** Brand as text on paper. */
const LIGHT_TEXT_RATIO = 5.8;
/** A light fill still has to stand off the paper (Citrus dropped a step). */
const FILL_ON_PAPER_RATIO = 1.5;
/** Below this chroma (max minus min channel, 0..1) a seed is grey. */
const GREY_CHROMA = 0.08;
/** One ladder step in HSL lightness. */
const STEP = 0.1;
const DIM_STEP = 0.16;

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

export function hexToRgb(hex: string): [number, number, number] {
	const n = Number.parseInt(hex.slice(1, 7), 16);
	return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex(r: number, g: number, b: number): string {
	return `#${[r, g, b]
		.map((v) =>
			Math.round(clamp01(v / 255) * 255)
				.toString(16)
				.padStart(2, "0"),
		)
		.join("")
		.toUpperCase()}`;
}

/** Hex to HSL, each of h (degrees), s and l in 0..1. */
export function hexToHsl(hex: string): [number, number, number] {
	const [r, g, b] = hexToRgb(hex).map((v) => v / 255);
	const max = Math.max(r, g, b);
	const min = Math.min(r, g, b);
	const l = (max + min) / 2;
	const d = max - min;
	if (d === 0) return [0, 0, l];
	const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
	let h: number;
	if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
	else if (max === g) h = ((b - r) / d + 2) * 60;
	else h = ((r - g) / d + 4) * 60;
	return [h, s, l];
}

export function hslToHex(h: number, s: number, l: number): string {
	const S = clamp01(s);
	const L = clamp01(l);
	const c = (1 - Math.abs(2 * L - 1)) * S;
	const hh = (((h % 360) + 360) % 360) / 60;
	const x = c * (1 - Math.abs((hh % 2) - 1));
	const m = L - c / 2;
	let r = 0;
	let g = 0;
	let b = 0;
	if (hh < 1) [r, g, b] = [c, x, 0];
	else if (hh < 2) [r, g, b] = [x, c, 0];
	else if (hh < 3) [r, g, b] = [0, c, x];
	else if (hh < 4) [r, g, b] = [0, x, c];
	else if (hh < 5) [r, g, b] = [x, 0, c];
	else [r, g, b] = [c, 0, x];
	return rgbToHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
}

/** WCAG relative luminance of a hex colour. */
export function luminance(hex: string): number {
	const c = hexToRgb(hex).map((v) => {
		const s = v / 255;
		return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
	});
	return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

/** WCAG contrast ratio between two hex colours, 1..21. */
export function contrast(a: string, b: string): number {
	const la = luminance(a);
	const lb = luminance(b);
	return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** `rgba(r, g, b, a)` in the form the palette file writes. */
function glow(hex: string, alpha: number): string {
	const [r, g, b] = hexToRgb(hex);
	return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(2)})`;
}

/**
 * Walk lightness from `l` in `dir` (+1 lighter, -1 darker), a hundredth
 * at a time, until `ok` passes or the end of the ladder. Hue and
 * saturation never move, so the colour stays the seed's colour: this is
 * the whole difference between "as much saturation as the contrast allows"
 * and mixing toward white until it is pastel.
 */
function walk(h: number, s: number, l: number, dir: 1 | -1, ok: (hex: string) => boolean): string {
	let L = clamp01(l);
	let hex = hslToHex(h, s, L);
	for (let i = 0; i < 100 && !ok(hex); i++) {
		const next = clamp01(L + dir * 0.01);
		if (next === L) break;
		L = next;
		hex = hslToHex(h, s, L);
	}
	return hex;
}

/* ------------------------------------------------------------------ */
/* Derivation */

/** Mono's six per mode, for a seed with no hue to keep. */
const INK_PALETTE = {
	dPrimary: "#FAFAFA",
	dOn: INK,
	dActive: "#FFFFFF",
	dDim: "#A1A1AA",
	dText: "#FFFFFF",
	lPrimary: "#18181B",
	lOn: "#FFFFFF",
	lActive: "#27272A",
	lDim: "#52525B",
	lText: "#18181B",
} as const;

/** Derive the twelve values from one seed colour (`#rrggbb`). */
export function paletteFromSeed(seedIn: string): CustomPalette {
	const seed = HEX_RE.test(seedIn) ? seedIn.toUpperCase() : "#808080";
	const [r, g, b] = hexToRgb(seed).map((v) => v / 255);
	const chroma = Math.max(r, g, b) - Math.min(r, g, b);
	if (chroma < GREY_CHROMA) {
		return {
			seed,
			...INK_PALETTE,
			dGlow: glow(INK_PALETTE.dPrimary, 0.1),
			lGlow: glow(INK_PALETTE.lDim, 0.06),
		};
	}

	const [h, s, l] = hexToHsl(seed);

	// Dark: the fill is the seed walked lighter until the dark ink reads.
	const dPrimary = walk(h, s, l, 1, (c) => contrast(c, INK) >= FILL_INK_RATIO);
	const dL = hexToHsl(dPrimary)[2];
	const dActive = hslToHex(h, s, Math.min(dL + STEP, 0.97));
	const dDim = hslToHex(h, s, dL - DIM_STEP);
	// The lighter step is the brand as text, walked lighter still if black
	// needs it. A fill can pass the ink test at 7.2:1 and still sit a
	// little short of 11:1 as text.
	const dText = walk(h, s, hexToHsl(dActive)[2], 1, (c) => contrast(c, BLACK) >= DARK_TEXT_RATIO);

	// Light: the same fill, one step deeper only when it dissolves into
	// paper. The ink test is the floor, so the walk can never overshoot it.
	const lPrimary = walk(
		h,
		s,
		dL,
		-1,
		(c) => contrast(c, PAPER) >= FILL_ON_PAPER_RATIO || contrast(c, INK) <= FILL_INK_RATIO,
	);
	const lL = hexToHsl(lPrimary)[2];
	const lActive = hslToHex(h, s, lL - STEP);
	const lDim = hslToHex(h, s, lL - 2 * STEP);
	const lText = walk(h, s, lL, -1, (c) => contrast(c, PAPER) >= LIGHT_TEXT_RATIO);

	return {
		seed,
		dPrimary,
		dOn: INK,
		dActive,
		dDim,
		dText,
		dGlow: glow(dPrimary, 0.1),
		lPrimary,
		lOn: INK,
		lActive,
		lDim,
		lText,
		lGlow: glow(lDim, 0.06),
	};
}

/* ------------------------------------------------------------------ */
/* Stamping and validation */

const VAR_OF: Record<Exclude<keyof CustomPalette, "seed">, string> = {
	dPrimary: "--ws-custom-d-primary",
	dOn: "--ws-custom-d-on",
	dActive: "--ws-custom-d-active",
	dDim: "--ws-custom-d-dim",
	dText: "--ws-custom-d-text",
	dGlow: "--ws-custom-d-glow",
	lPrimary: "--ws-custom-l-primary",
	lOn: "--ws-custom-l-on",
	lActive: "--ws-custom-l-active",
	lDim: "--ws-custom-l-dim",
	lText: "--ws-custom-l-text",
	lGlow: "--ws-custom-l-glow",
};

/** The twelve custom property names, for clearing them. */
export const CUSTOM_PALETTE_VARS: readonly string[] = Object.values(VAR_OF);

/**
 * The twelve `--ws-custom-*` properties a palette stamps on <html>.
 * ws-palettes.css maps them onto the six brand tokens per mode.
 */
export function customPaletteVars(c: CustomPalette): Record<string, string> {
	const out: Record<string, string> = {};
	for (const k of Object.keys(VAR_OF) as (keyof typeof VAR_OF)[]) out[VAR_OF[k]] = c[k];
	return out;
}

/** Every field present and well formed: hex for the colours, rgba for the glows. */
export function isCustomPalette(x: unknown): x is CustomPalette {
	if (!x || typeof x !== "object") return false;
	const o = x as Record<string, unknown>;
	for (const k of CUSTOM_PALETTE_KEYS) {
		const v = o[k];
		if (typeof v !== "string") return false;
		if (!(k === "dGlow" || k === "lGlow" ? RGBA_RE : HEX_RE).test(v)) return false;
	}
	return true;
}
