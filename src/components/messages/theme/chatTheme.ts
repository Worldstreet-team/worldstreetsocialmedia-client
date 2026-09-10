"use client";

import type { CSSProperties } from "react";

/**
 * The chat theme pack (owner 2026-09-10): everything a person can change
 * about how THEIR chats look. Wallpaper (curated, or their own photo, with
 * frost / cyan hue / dim), the bubble fills (mine solid or gradient, theirs
 * solid), and the bubble shape. Stored per mode (dark / light), globally on
 * the profile and optionally per conversation, where the per-chat one wins.
 *
 * Rendering is CSS variables on the thread pane (`themeVars`), so the
 * memoised bubbles never re-render for a theme change — the paint moves,
 * the tree does not.
 */

export type ThemeMode = "dark" | "light";

export interface ThemeWallpaper {
	type: "flat" | "solid" | "gradient" | "preset" | "image";
	/** solid ground. */
	color?: string;
	/** gradient ground. */
	stops?: [string, string];
	angle?: number;
	/** One of WALLPAPERS[].id. */
	preset?: string;
	/** Own photo: the private media key; the gateway presigns imageUrl. */
	imageKey?: string;
	imageUrl?: string;
	/** Gaussian blur on the image itself, 0..100. */
	frost: number;
	hue: "none" | "cyan";
	/** Legibility wash over the picture, 0..60. */
	dim: number;
}

export type MineFill =
	| { kind: "solid"; color: string }
	| { kind: "gradient"; stops: [string, string]; angle: number };

export type BubbleShape = "rounded" | "soft" | "square";

export interface ThemeBubbles {
	mine: MineFill;
	theirs: { color: string };
	shape: BubbleShape;
}

export interface ChatTheme {
	wallpaper: ThemeWallpaper;
	bubbles: ThemeBubbles;
}

export type ThemeByMode = Partial<Record<ThemeMode, ChatTheme>>;
export type ThemeScope = "chat" | "all";

/* ------------------------------------------------------------------ */
/* Curated wallpapers. Free-licence photographs (credits.json beside). */

export const WALLPAPERS: {
	id: string;
	label: string;
	src: string;
	tone: ThemeMode;
}[] = [
	{ id: "forest", label: "Forest", src: "/wallpapers/forest.jpg", tone: "dark" },
	{ id: "fogwood", label: "Fogwood", src: "/wallpapers/fogwood.jpg", tone: "dark" },
	{ id: "milkyway", label: "Milky Way", src: "/wallpapers/milkyway.jpg", tone: "dark" },
	{ id: "dusk", label: "Dusk", src: "/wallpapers/dusk.jpg", tone: "dark" },
	{ id: "mist", label: "Mist", src: "/wallpapers/mist.jpg", tone: "light" },
	{ id: "lonetree", label: "Lone tree", src: "/wallpapers/lonetree.jpg", tone: "light" },
	{ id: "pier", label: "Pier", src: "/wallpapers/pier.jpg", tone: "light" },
];

/** The painted (non-photographic) ground, or null when there is none. */
export function groundCss(w: ThemeWallpaper): string | null {
	if (w.type === "solid" && w.color) return w.color;
	if (w.type === "gradient" && w.stops)
		return `linear-gradient(${w.angle ?? 160}deg, ${w.stops[0]}, ${w.stops[1]})`;
	return null;
}

export function wallpaperSrc(w: ThemeWallpaper): string | null {
	if (w.type === "preset")
		return WALLPAPERS.find((p) => p.id === w.preset)?.src ?? null;
	if (w.type === "image") return w.imageUrl ?? null;
	return null;
}

/* ------------------------------------------------------------------ */
/* Bubble presets. */

const TIDE: MineFill = {
	kind: "gradient",
	stops: ["#22B8D6", "#6D5BFF"],
	angle: 135,
};

export const MINE_PRESETS: { id: string; label: string; fill: MineFill }[] = [
	{ id: "tide", label: "Tide", fill: TIDE },
	{ id: "cyan", label: "Cyan", fill: { kind: "solid", color: "#22B8D6" } },
	{ id: "ember", label: "Ember", fill: { kind: "gradient", stops: ["#F59E0B", "#EF4444"], angle: 135 } },
	{ id: "moss", label: "Moss", fill: { kind: "gradient", stops: ["#10B981", "#22B8D6"], angle: 135 } },
	{ id: "nebula", label: "Nebula", fill: { kind: "gradient", stops: ["#6D5BFF", "#EC4899"], angle: 135 } },
	{ id: "gold", label: "Gold", fill: { kind: "solid", color: "#EAB308" } },
	{ id: "slate", label: "Slate", fill: { kind: "solid", color: "#3F3F46" } },
	{ id: "rose", label: "Rose", fill: { kind: "solid", color: "#E11D48" } },
];

/** `house` is the raised token, so it follows dark / light on its own. */
export const HOUSE_THEIRS = "var(--ws-bg-raised)";
export const THEIRS_PRESETS: { id: string; label: string; color: string }[] = [
	{ id: "house", label: "House", color: HOUSE_THEIRS },
	{ id: "deep", label: "Deep", color: "#1B2A30" },
	{ id: "charcoal", label: "Charcoal", color: "#2B2B2B" },
	{ id: "paper", label: "Paper", color: "#E9E6E1" },
	{ id: "cloud", label: "Cloud", color: "#DCE4E7" },
];

/**
 * Outer radius and the inner run corner, per shape. Rounded is the owner's
 * 22/8, locked 2026-09-03, and it is what every gallery card ships: shape
 * is an Advanced control only, never part of a theme.
 */
export const SHAPES: Record<BubbleShape, { label: string; r: number; rin: number }> = {
	rounded: { label: "Rounded", r: 22, rin: 8 },
	soft: { label: "Soft", r: 16, rin: 6 },
	square: { label: "Square", r: 10, rin: 4 },
};

/* ------------------------------------------------------------------ */
/* Defaults and named pairings. */

const HOUSE_BUBBLES: ThemeBubbles = {
	mine: TIDE,
	theirs: { color: HOUSE_THEIRS },
	shape: "rounded",
};

/**
 * What a chat looks like before anyone opens the editor: the app's own
 * flat ground, the same colour as the sidebar (owner, repeatedly). A
 * picture is something a person CHOOSES, never something we impose.
 */
const FLAT: ThemeWallpaper = { type: "flat", frost: 0, hue: "none", dim: 0 };
export const HOUSE_DEFAULT: Record<ThemeMode, ChatTheme> = {
	dark: { wallpaper: { ...FLAT }, bubbles: HOUSE_BUBBLES },
	light: { wallpaper: { ...FLAT }, bubbles: HOUSE_BUBBLES },
};

/**
 * The gallery: twelve finished themes, each a matched dark and light pair,
 * chosen by hand from the thirty-one an agent panel generated (owner review
 * 2026-09-10: "the ui wasn't curated properly"). The rules that cut it down:
 *
 * - One idea per card. Four rust themes, five fogwood photographs and three
 *   black-and-white pairs were the same card wearing different names.
 * - A photograph appears on ONE card per mode, so two tiles in the grid
 *   never show the same picture side by side.
 * - No card changes the bubble geometry. The owner locked 22/8 on
 *   2026-09-03 and a theme is colour and ground, never shape; shape lives
 *   in Advanced for the person who goes looking for it. The stamp at the
 *   bottom of this block is what enforces that, so a card cannot even
 *   express a shape.
 * - Ordered as a set, not a list: the house look first, then the painted
 *   grounds from neutral through warm to cool to dramatic, then the four
 *   photographs last, where a picture reads as the deliberate choice it is.
 *
 * Every fill was contrast-checked against the ink it will be given, its
 * opposite bubble and the ground behind it, and the values are unchanged
 * from the validated set; only the shape and one light variant moved.
 */
type CardTheme = {
	wallpaper: ThemeWallpaper;
	bubbles: Omit<ThemeBubbles, "shape">;
};
const CARDS: {
	id: string;
	label: string;
	blurb: string;
	dark: CardTheme;
	light: CardTheme;
}[] = [
	{
		id: "worldspace",
		label: "Worldspace",
		blurb: "The house look. Cyan into indigo on the app's own ground.",
		dark: {
			wallpaper: { type: "flat", frost: 0, hue: "none", dim: 0 },
			bubbles: { mine: { kind: "gradient", stops: ["#22B8D6", "#6D5BFF"], angle: 135 }, theirs: { color: HOUSE_THEIRS } },
		},
		light: {
			wallpaper: { type: "flat", frost: 0, hue: "none", dim: 0 },
			bubbles: { mine: { kind: "gradient", stops: ["#22B8D6", "#6D5BFF"], angle: 135 }, theirs: { color: HOUSE_THEIRS } },
		},
	},
	{
		id: "obsidian",
		label: "Obsidian",
		blurb: "Pure black, pure white, nothing in between. The high-contrast one.",
		dark: {
			wallpaper: { type: "solid", color: "#000000", frost: 0, hue: "none", dim: 0 },
			bubbles: { mine: { kind: "solid", color: "#FAFAFA" }, theirs: { color: "#33333A" } },
		},
		light: {
			wallpaper: { type: "solid", color: "#FFFFFF", frost: 0, hue: "none", dim: 0 },
			bubbles: { mine: { kind: "solid", color: "#18181B" }, theirs: { color: "#CFCFD4" } },
		},
	},
	{
		id: "lamplight",
		label: "Lamplight",
		blurb: "Warm charcoal, one lamp of gold on your side.",
		dark: {
			wallpaper: { type: "gradient", stops: ["#1E1A16", "#0B0908"], angle: 180, frost: 0, hue: "none", dim: 0 },
			bubbles: { mine: { kind: "gradient", stops: ["#F7D65C", "#EFC02A"], angle: 150 }, theirs: { color: "#423B36" } },
		},
		light: {
			wallpaper: { type: "solid", color: "#FFFCF5", frost: 0, hue: "none", dim: 0 },
			bubbles: { mine: { kind: "gradient", stops: ["#F2C845", "#DDA512"], angle: 150 }, theirs: { color: "#2A2422" } },
		},
	},
	{
		id: "linen",
		label: "Linen",
		blurb: "Warm flax paper and sepia ink, soft as a handwritten letter.",
		dark: {
			wallpaper: { type: "gradient", stops: ["#1F1810", "#0E0A07"], angle: 165, frost: 0, hue: "none", dim: 0 },
			bubbles: { mine: { kind: "gradient", stops: ["#8B683C", "#6E522F"], angle: 160 }, theirs: { color: "#3C3229" } },
		},
		light: {
			wallpaper: { type: "gradient", stops: ["#FDFAF3", "#EFE5CF"], angle: 165, frost: 0, hue: "none", dim: 0 },
			bubbles: { mine: { kind: "gradient", stops: ["#54402B", "#3B2C1D"], angle: 160 }, theirs: { color: "#D3C3A0" } },
		},
	},
	{
		id: "ember",
		label: "Ember",
		blurb: "Low coals in a dark room. Warm, quiet, nearly burnt down.",
		dark: {
			wallpaper: { type: "gradient", stops: ["#231813", "#0C0A09"], angle: 160, frost: 0, hue: "none", dim: 0 },
			bubbles: { mine: { kind: "gradient", stops: ["#C2410C", "#8F300E"], angle: 135 }, theirs: { color: "#3F332B" } },
		},
		light: {
			wallpaper: { type: "gradient", stops: ["#FFF9F4", "#F7E5D3"], angle: 160, frost: 0, hue: "none", dim: 0 },
			bubbles: { mine: { kind: "gradient", stops: ["#B4400F", "#87290A"], angle: 135 }, theirs: { color: "#F6C29E" } },
		},
	},
	{
		id: "deep-current",
		label: "Deep Current",
		blurb: "Far below the surface. Ink, deep teal, nothing loud.",
		dark: {
			wallpaper: { type: "solid", color: "#05131B", frost: 0, hue: "none", dim: 0 },
			bubbles: { mine: { kind: "gradient", stops: ["#0C7796", "#0A5878"], angle: 160 }, theirs: { color: "#1A3E4F" } },
		},
		light: {
			wallpaper: { type: "solid", color: "#F1F7F9", frost: 0, hue: "none", dim: 0 },
			bubbles: { mine: { kind: "gradient", stops: ["#0C7796", "#0A5878"], angle: 160 }, theirs: { color: "#BFDAE6" } },
		},
	},
	{
		id: "nebula",
		label: "Nebula",
		blurb: "Plum dark with a violet-to-magenta flare. The dramatic one.",
		dark: {
			wallpaper: { type: "gradient", stops: ["#1B0B33", "#06040F"], angle: 155, frost: 0, hue: "none", dim: 0 },
			bubbles: { mine: { kind: "gradient", stops: ["#7A2BC4", "#C42A8E"], angle: 135 }, theirs: { color: "#3E2C5C" } },
		},
		light: {
			wallpaper: { type: "gradient", stops: ["#FDFAFF", "#EDE3FA"], angle: 155, frost: 0, hue: "none", dim: 0 },
			bubbles: { mine: { kind: "gradient", stops: ["#7A2BC4", "#C42A8E"], angle: 135 }, theirs: { color: "#D3C6EE" } },
		},
	},
	{
		id: "semaphore",
		label: "Semaphore",
		blurb: "Navy and honey, never red or green. Built for colour-blind readers.",
		dark: {
			wallpaper: { type: "solid", color: "#0D1117", frost: 0, hue: "none", dim: 0 },
			bubbles: { mine: { kind: "gradient", stops: ["#22439F", "#2563EB"], angle: 160 }, theirs: { color: "#F7E3A1" } },
		},
		light: {
			wallpaper: { type: "solid", color: "#EEF1F7", frost: 0, hue: "none", dim: 0 },
			bubbles: { mine: { kind: "gradient", stops: ["#17358F", "#3059D6"], angle: 160 }, theirs: { color: "#DCBA5C" } },
		},
	},
	{
		id: "old-growth",
		label: "Old Growth",
		blurb: "Deep pine and low light under standing timber.",
		dark: {
			wallpaper: { type: "preset", preset: "forest", frost: 20, hue: "none", dim: 34 },
			bubbles: { mine: { kind: "gradient", stops: ["#2F7D55", "#1B5539"], angle: 155 }, theirs: { color: "#DEE6D5" } },
		},
		light: {
			wallpaper: { type: "preset", preset: "mist", frost: 18, hue: "none", dim: 6 },
			bubbles: { mine: { kind: "gradient", stops: ["#2C6E4C", "#1E5238"], angle: 155 }, theirs: { color: "#B7CBAC" } },
		},
	},
	{
		id: "blue-hour",
		label: "Blue Hour",
		blurb: "Still water at the edge of the day, photographed.",
		dark: {
			wallpaper: { type: "preset", preset: "dusk", frost: 8, hue: "cyan", dim: 32 },
			bubbles: { mine: { kind: "gradient", stops: ["#1D7099", "#14547C"], angle: 165 }, theirs: { color: "#203748" } },
		},
		light: {
			wallpaper: { type: "preset", preset: "pier", frost: 10, hue: "cyan", dim: 10 },
			bubbles: { mine: { kind: "gradient", stops: ["#1D7099", "#14547C"], angle: 165 }, theirs: { color: "#F2F7FB" } },
		},
	},
	{
		id: "milky-way",
		label: "Milky Way",
		blurb: "The galaxy overhead at night. A pale, starless morning by day.",
		dark: {
			wallpaper: { type: "preset", preset: "milkyway", frost: 6, hue: "none", dim: 30 },
			bubbles: { mine: { kind: "gradient", stops: ["#4B3A9E", "#7454D6"], angle: 145 }, theirs: { color: "#57639E" } },
		},
		// Painted, not the pier: that picture is Blue Hour's by day, and a
		// galaxy has no daytime photograph anyway.
		light: {
			wallpaper: { type: "gradient", stops: ["#F3F4FA", "#E1E4F2"], angle: 165, frost: 0, hue: "none", dim: 0 },
			bubbles: { mine: { kind: "gradient", stops: ["#4B3A9E", "#7454D6"], angle: 145 }, theirs: { color: "#D3D6EA" } },
		},
	},
	{
		id: "silverpoint",
		label: "Silverpoint",
		blurb: "Bare trees in fog. Silver your side, ink theirs.",
		dark: {
			wallpaper: { type: "preset", preset: "fogwood", frost: 18, hue: "none", dim: 36 },
			bubbles: { mine: { kind: "solid", color: "#C3C8CC" }, theirs: { color: "#191C1E" } },
		},
		light: {
			wallpaper: { type: "preset", preset: "lonetree", frost: 16, hue: "none", dim: 10 },
			bubbles: { mine: { kind: "solid", color: "#F0F2F3" }, theirs: { color: "#191C1E" } },
		},
	},
];

/** The owner's 22/8, stamped on every card: a theme never re-cuts the bubbles. */
const stamp = (t: CardTheme): ChatTheme => ({
	wallpaper: t.wallpaper,
	bubbles: { ...t.bubbles, shape: "rounded" },
});
export const THEME_CARDS: {
	id: string;
	label: string;
	blurb: string;
	dark: ChatTheme;
	light: ChatTheme;
}[] = CARDS.map((c) => ({ ...c, dark: stamp(c.dark), light: stamp(c.light) }));

/* ------------------------------------------------------------------ */
/* Resolution and CSS. */

const clamp = (n: unknown, lo: number, hi: number, d: number) => {
	const v = Number(n);
	return Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d;
};
const HEX = /^#[0-9a-f]{6}$/i;
const okColor = (c: unknown, d: string) =>
	typeof c === "string" && (HEX.test(c) || c.startsWith("var(--ws-")) ? c : d;

/** Defensive: anything off the wire or out of storage becomes a whole theme. */
export function normalizeTheme(x: unknown, mode: ThemeMode): ChatTheme {
	const d = HOUSE_DEFAULT[mode];
	const t = (x ?? {}) as Partial<ChatTheme>;
	const w = (t.wallpaper ?? {}) as Partial<ThemeWallpaper>;
	const b = (t.bubbles ?? {}) as Partial<ThemeBubbles>;
	const mineIn = b.mine as MineFill | undefined;
	const mine: MineFill =
		mineIn?.kind === "solid"
			? { kind: "solid", color: okColor(mineIn.color, "#22B8D6") }
			: mineIn?.kind === "gradient"
				? {
						kind: "gradient",
						stops: [
							okColor(mineIn.stops?.[0], "#22B8D6"),
							okColor(mineIn.stops?.[1], "#6D5BFF"),
						],
						angle: clamp(mineIn.angle, 0, 360, 135),
					}
				: d.bubbles.mine;
	const type: ThemeWallpaper["type"] = (
		["flat", "solid", "gradient", "preset", "image"] as const
	).includes(w.type as never)
		? (w.type as ThemeWallpaper["type"])
		: d.wallpaper.type;
	return {
		wallpaper: {
			type,
			color: type === "solid" ? okColor(w.color, "#0C0A09") : undefined,
			stops:
				type === "gradient"
					? [
							okColor(w.stops?.[0], "#0C0A09"),
							okColor(w.stops?.[1], "#1C1917"),
						]
					: undefined,
			angle: type === "gradient" ? clamp(w.angle, 0, 360, 160) : undefined,
			preset:
				type === "preset"
					? WALLPAPERS.some((p) => p.id === w.preset)
						? w.preset
						: d.wallpaper.preset
					: undefined,
			imageKey: type === "image" ? w.imageKey : undefined,
			imageUrl: type === "image" ? w.imageUrl : undefined,
			frost: clamp(w.frost, 0, 100, d.wallpaper.frost),
			hue: w.hue === "cyan" ? "cyan" : "none",
			dim: clamp(w.dim, 0, 60, d.wallpaper.dim),
		},
		bubbles: {
			mine,
			theirs: { color: okColor(b.theirs?.color, HOUSE_THEIRS) },
			shape: b.shape && b.shape in SHAPES ? b.shape : "rounded",
		},
	};
}

/** Per-chat wins over global wins over the house default. */
export function resolveTheme(
	perChat: ThemeByMode | undefined,
	global: ThemeByMode | undefined,
	mode: ThemeMode,
): ChatTheme {
	return normalizeTheme(
		perChat?.[mode] ?? global?.[mode] ?? HOUSE_DEFAULT[mode],
		mode,
	);
}

export function mineCss(f: MineFill): string {
	return f.kind === "solid"
		? f.color
		: `linear-gradient(${f.angle}deg, ${f.stops[0]}, ${f.stops[1]})`;
}

export function accentOf(f: MineFill): string {
	return f.kind === "solid" ? f.color : f.stops[0];
}

function luminance(hex: string): number {
	const n = Number.parseInt(hex.slice(1), 16);
	const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => {
		const s = v / 255;
		return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
	});
	return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

/**
 * The ink for a fill is never a choice — white on a dark fill, ink on a
 * light one, so no custom colour can fail AA. A token fill (the house
 * raised) takes the token ink, which already follows the mode.
 */
export function inkFor(fillOrColor: MineFill | string): string {
	if (typeof fillOrColor === "string") {
		if (!HEX.test(fillOrColor)) return "var(--ws-text-primary)";
		return luminance(fillOrColor) > 0.42 ? "#1C1917" : "#FFFFFF";
	}
	const l =
		fillOrColor.kind === "solid"
			? luminance(fillOrColor.color)
			: (luminance(fillOrColor.stops[0]) + luminance(fillOrColor.stops[1])) / 2;
	return l > 0.42 ? "#1C1917" : "#FFFFFF";
}

/**
 * The variables the whole messages surface reads.
 *
 * Everything that used to be a hardcoded brand colour inside a thread —
 * the link, the mention chip, the unread rule, the reaction pill, the jump
 * badge, the inbox's unread dot — resolves through these, so picking a
 * theme retints the section instead of leaving cyan islands in it.
 */
export function themeVars(t: ChatTheme): CSSProperties {
	const s = SHAPES[t.bubbles.shape];
	const accent = accentOf(t.bubbles.mine);
	const mix = (pct: number) =>
		`color-mix(in srgb, ${accent} ${pct}%, transparent)`;
	return {
		"--chat-mine": mineCss(t.bubbles.mine),
		"--chat-mine-ink": inkFor(t.bubbles.mine),
		"--chat-accent": accent,
		"--chat-accent-ink": inkFor(accent),
		// Washes of the accent, for chips and rules that sit on the ground.
		"--chat-accent-12": mix(12),
		"--chat-accent-18": mix(18),
		"--chat-accent-40": mix(40),
		// A chip sitting ON my own bubble: a wash of that bubble's own ink,
		// so it reads on any fill instead of a fixed black at 20%.
		"--chat-on-mine": `color-mix(in srgb, ${inkFor(t.bubbles.mine)} 22%, transparent)`,
		"--chat-theirs": t.bubbles.theirs.color,
		"--chat-theirs-ink": inkFor(t.bubbles.theirs.color),
		// A quoted reply inside a bubble: a wash of the bubble it sits in.
		"--chat-quote-mine": `color-mix(in srgb, ${inkFor(t.bubbles.mine)} 16%, transparent)`,
		"--chat-quote-theirs": `color-mix(in srgb, ${inkFor(t.bubbles.theirs.color)} 12%, transparent)`,
		"--chat-r": `${s.r}px`,
		"--chat-r-in": `${s.rin}px`,
	} as CSSProperties;
}

export function sameTheme(a: ChatTheme, b: ChatTheme): boolean {
	return JSON.stringify(a) === JSON.stringify(b);
}
