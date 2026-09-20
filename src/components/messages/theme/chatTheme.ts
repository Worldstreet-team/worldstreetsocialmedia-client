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
/* Curated wallpapers. Free-licence photographs (credits.json beside), and
 * a generated set (owner 2026-09-20: ten more themes "with good images").
 *
 * `tint` is the picture's measured average colour. Nothing is sampled at
 * runtime (an own photo taints the canvas anyway); the thread's top bar and
 * composer derive their fill from this, so a theme reaches the chrome too.
 *
 * The generated set lives in /wallpapers/gen: drawn for this app, one dark
 * and one light per theme, low-frequency on purpose because a wallpaper
 * sits BEHIND text. Dark ones hold 90% of their pixels under 3.5% relative
 * luminance and light ones above 80%, so they need no frost and no dim. */

export const WALLPAPERS: {
	id: string;
	label: string;
	src: string;
	tone: ThemeMode;
	tint: string;
}[] = [
	{ id: "forest", label: "Forest", src: "/wallpapers/forest.jpg", tone: "dark", tint: "#B7B5B0" },
	{ id: "fogwood", label: "Fogwood", src: "/wallpapers/fogwood.jpg", tone: "dark", tint: "#969696" },
	{ id: "milkyway", label: "Milky Way", src: "/wallpapers/milkyway.jpg", tone: "dark", tint: "#161516" },
	{ id: "dusk", label: "Dusk", src: "/wallpapers/dusk.jpg", tone: "dark", tint: "#5480C4" },
	{ id: "mist", label: "Mist", src: "/wallpapers/mist.jpg", tone: "light", tint: "#C0C0C1" },
	{ id: "lonetree", label: "Lone tree", src: "/wallpapers/lonetree.jpg", tone: "light", tint: "#C6C6C6" },
	{ id: "pier", label: "Pier", src: "/wallpapers/pier.jpg", tone: "light", tint: "#728BAF" },
	{ id: "peony-dark", label: "Peony", src: "/wallpapers/gen/peony-dark.webp", tone: "dark", tint: "#451127" },
	{ id: "peony-light", label: "Peony", src: "/wallpapers/gen/peony-light.webp", tone: "light", tint: "#F5D8E1" },
	{ id: "kiln-dark", label: "Kiln", src: "/wallpapers/gen/kiln-dark.webp", tone: "dark", tint: "#331409" },
	{ id: "kiln-light", label: "Kiln", src: "/wallpapers/gen/kiln-light.webp", tone: "light", tint: "#E7CFC0" },
	{ id: "dune-sea-dark", label: "Dune Sea", src: "/wallpapers/gen/dune-sea-dark.webp", tone: "dark", tint: "#19140C" },
	{ id: "dune-sea-light", label: "Dune Sea", src: "/wallpapers/gen/dune-sea-light.webp", tone: "light", tint: "#F4ECDC" },
	{ id: "cellar-dark", label: "Cellar", src: "/wallpapers/gen/cellar-dark.webp", tone: "dark", tint: "#471122" },
	{ id: "cellar-light", label: "Cellar", src: "/wallpapers/gen/cellar-light.webp", tone: "light", tint: "#F3E2E8" },
	{ id: "glasshouse-dark", label: "Glasshouse", src: "/wallpapers/gen/glasshouse-dark.webp", tone: "dark", tint: "#082A21" },
	{ id: "glasshouse-light", label: "Glasshouse", src: "/wallpapers/gen/glasshouse-light.webp", tone: "light", tint: "#E0F3EB" },
	{ id: "wisteria-dark", label: "Wisteria", src: "/wallpapers/gen/wisteria-dark.webp", tone: "dark", tint: "#1C1A42" },
	{ id: "wisteria-light", label: "Wisteria", src: "/wallpapers/gen/wisteria-light.webp", tone: "light", tint: "#E4E4F8" },
	{ id: "cirrus-dark", label: "Cirrus", src: "/wallpapers/gen/cirrus-dark.webp", tone: "dark", tint: "#0B253E" },
	{ id: "cirrus-light", label: "Cirrus", src: "/wallpapers/gen/cirrus-light.webp", tone: "light", tint: "#D7E7F6" },
	{ id: "arcade-dark", label: "Arcade", src: "/wallpapers/gen/arcade-dark.webp", tone: "dark", tint: "#1D0B3B" },
	{ id: "arcade-light", label: "Arcade", src: "/wallpapers/gen/arcade-light.webp", tone: "light", tint: "#EAE0F8" },
	{ id: "lichen-dark", label: "Lichen", src: "/wallpapers/gen/lichen-dark.webp", tone: "dark", tint: "#1F2A14" },
	{ id: "lichen-light", label: "Lichen", src: "/wallpapers/gen/lichen-light.webp", tone: "light", tint: "#E7ECD8" },
	{ id: "foundry-dark", label: "Foundry", src: "/wallpapers/gen/foundry-dark.webp", tone: "dark", tint: "#171A1F" },
	{ id: "foundry-light", label: "Foundry", src: "/wallpapers/gen/foundry-light.webp", tone: "light", tint: "#D5D8DD" },
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
	},	/*
	 * The second set (owner 2026-09-20): ten more, each on its own drawn
	 * picture. Chosen to fill the hue families the first twelve left empty
	 * (rose, clay, sand, wine, mint, periwinkle, sky, neon, sage, steel),
	 * warm through cool to neutral. Same rules: one idea per card, a picture
	 * on one card per mode, no shape. Checked: white ink on every mine stop
	 * is 4.7:1 or better, their ink on their fill 9:1 or better, and their
	 * fill stands 1.2:1 (light) to 1.6:1 (dark) off the measured ground.
	 */
	{
		id: "peony",
		label: "Peony",
		blurb: "Blush and deep rose. Soft, never loud.",
		dark: {
			wallpaper: { type: "preset", preset: "peony-dark", frost: 0, hue: "none", dim: 0 },
			bubbles: { mine: { kind: "gradient", stops: ["#C2255C", "#9C1F6B"], angle: 140 }, theirs: { color: "#63374A" } },
		},
		light: {
			wallpaper: { type: "preset", preset: "peony-light", frost: 0, hue: "none", dim: 0 },
			bubbles: { mine: { kind: "gradient", stops: ["#C2255C", "#9C1F6B"], angle: 140 }, theirs: { color: "#EDBBCC" } },
		},
	},
	{
		id: "kiln",
		label: "Kiln",
		blurb: "Fired clay ridges, terracotta heat.",
		dark: {
			wallpaper: { type: "preset", preset: "kiln-dark", frost: 0, hue: "none", dim: 0 },
			bubbles: { mine: { kind: "gradient", stops: ["#B8431F", "#9A2F2A"], angle: 140 }, theirs: { color: "#543A30" } },
		},
		light: {
			wallpaper: { type: "preset", preset: "kiln-light", frost: 0, hue: "none", dim: 0 },
			bubbles: { mine: { kind: "gradient", stops: ["#B8431F", "#9A2F2A"], angle: 140 }, theirs: { color: "#DDB4A1" } },
		},
	},
	{
		id: "dune-sea",
		label: "Dune Sea",
		blurb: "Desert contour lines at dusk. Quiet sand.",
		dark: {
			wallpaper: { type: "preset", preset: "dune-sea-dark", frost: 0, hue: "none", dim: 0 },
			bubbles: { mine: { kind: "solid", color: "#8A6A3B" }, theirs: { color: "#3E3A33" } },
		},
		light: {
			wallpaper: { type: "preset", preset: "dune-sea-light", frost: 0, hue: "none", dim: 0 },
			bubbles: { mine: { kind: "solid", color: "#8A6A3B" }, theirs: { color: "#DFD3BD" } },
		},
	},
	{
		id: "cellar",
		label: "Cellar",
		blurb: "Deep wine and low lights out of focus.",
		dark: {
			wallpaper: { type: "preset", preset: "cellar-dark", frost: 0, hue: "none", dim: 0 },
			bubbles: { mine: { kind: "gradient", stops: ["#7A1F3D", "#5A1A4A"], angle: 140 }, theirs: { color: "#643745" } },
		},
		light: {
			wallpaper: { type: "preset", preset: "cellar-light", frost: 0, hue: "none", dim: 0 },
			bubbles: { mine: { kind: "gradient", stops: ["#7A1F3D", "#5A1A4A"], angle: 140 }, theirs: { color: "#E0C3CD" } },
		},
	},
	{
		id: "glasshouse",
		label: "Glasshouse",
		blurb: "Mint and humid green light through glass.",
		dark: {
			wallpaper: { type: "preset", preset: "glasshouse-dark", frost: 0, hue: "none", dim: 0 },
			bubbles: { mine: { kind: "gradient", stops: ["#0F7B62", "#0B6A74"], angle: 140 }, theirs: { color: "#304C45" } },
		},
		light: {
			wallpaper: { type: "preset", preset: "glasshouse-light", frost: 0, hue: "none", dim: 0 },
			bubbles: { mine: { kind: "gradient", stops: ["#0F7B62", "#0B6A74"], angle: 140 }, theirs: { color: "#BFE0D5" } },
		},
	},
	{
		id: "wisteria",
		label: "Wisteria",
		blurb: "A periwinkle haze. The calm evening one.",
		dark: {
			wallpaper: { type: "preset", preset: "wisteria-dark", frost: 0, hue: "none", dim: 0 },
			bubbles: { mine: { kind: "gradient", stops: ["#5B5FC7", "#7A4FBF"], angle: 140 }, theirs: { color: "#403F60" } },
		},
		light: {
			wallpaper: { type: "preset", preset: "wisteria-light", frost: 0, hue: "none", dim: 0 },
			bubbles: { mine: { kind: "gradient", stops: ["#5B5FC7", "#7A4FBF"], angle: 140 }, theirs: { color: "#C9CBEE" } },
		},
	},
	{
		id: "cirrus",
		label: "Cirrus",
		blurb: "Open sky, high thin cloud, daylight blue.",
		dark: {
			wallpaper: { type: "preset", preset: "cirrus-dark", frost: 0, hue: "none", dim: 0 },
			bubbles: { mine: { kind: "solid", color: "#1F6FB5" }, theirs: { color: "#32485D" } },
		},
		light: {
			wallpaper: { type: "preset", preset: "cirrus-light", frost: 0, hue: "none", dim: 0 },
			bubbles: { mine: { kind: "solid", color: "#1F6FB5" }, theirs: { color: "#B4D0EA" } },
		},
	},
	{
		id: "arcade",
		label: "Arcade",
		blurb: "Neon violet into blue under a few stars.",
		dark: {
			wallpaper: { type: "preset", preset: "arcade-dark", frost: 0, hue: "none", dim: 0 },
			bubbles: { mine: { kind: "gradient", stops: ["#C026D3", "#2563EB"], angle: 140 }, theirs: { color: "#41325A" } },
		},
		light: {
			wallpaper: { type: "preset", preset: "arcade-light", frost: 0, hue: "none", dim: 0 },
			bubbles: { mine: { kind: "gradient", stops: ["#C026D3", "#2563EB"], angle: 140 }, theirs: { color: "#E3C2F2" } },
		},
	},
	{
		id: "lichen",
		label: "Lichen",
		blurb: "Sage and stone. Grounded, unhurried.",
		dark: {
			wallpaper: { type: "preset", preset: "lichen-dark", frost: 0, hue: "none", dim: 0 },
			bubbles: { mine: { kind: "solid", color: "#5F6F3A" }, theirs: { color: "#434C3A" } },
		},
		light: {
			wallpaper: { type: "preset", preset: "lichen-light", frost: 0, hue: "none", dim: 0 },
			bubbles: { mine: { kind: "solid", color: "#5F6F3A" }, theirs: { color: "#CCD4BA" } },
		},
	},
	{
		id: "foundry",
		label: "Foundry",
		blurb: "Graphite and brushed steel. Precise.",
		dark: {
			wallpaper: { type: "preset", preset: "foundry-dark", frost: 0, hue: "none", dim: 0 },
			bubbles: { mine: { kind: "solid", color: "#475569" }, theirs: { color: "#3C3F43" } },
		},
		light: {
			wallpaper: { type: "preset", preset: "foundry-light", frost: 0, hue: "none", dim: 0 },
			bubbles: { mine: { kind: "solid", color: "#475569" }, theirs: { color: "#BEC3CA" } },
		},
	},
];

/** The owner's 22/8, stamped on every card: a theme never re-cuts the bubbles. */
const stamp = (t: CardTheme): ChatTheme => ({
	wallpaper: t.wallpaper,
	bubbles: { ...t.bubbles, shape: "rounded" },
});
export type CardGroup = "colour" | "photo" | "art";
/** Which shelf of the gallery a card sits on: decided by its dark ground. */
const groupOf = (c: (typeof CARDS)[number]): CardGroup => {
	const w = c.dark.wallpaper;
	if (w.type !== "preset") return "colour";
	return WALLPAPERS.find((p) => p.id === w.preset)?.src.startsWith("/wallpapers/gen/")
		? "art"
		: "photo";
};
export const THEME_CARDS: {
	id: string;
	label: string;
	blurb: string;
	group: CardGroup;
	dark: ChatTheme;
	light: ChatTheme;
}[] = CARDS.map((c) => ({ ...c, group: groupOf(c), dark: stamp(c.dark), light: stamp(c.light) }));
export const CARD_GROUPS: { id: CardGroup; label: string }[] = [
	{ id: "colour", label: "Colour" },
	{ id: "art", label: "Artwork" },
	{ id: "photo", label: "Photographs" },
];

/**
 * The painted grounds Advanced offers, per mode: every solid and gradient
 * the gallery ships, under the card's own name, so a custom theme can stand
 * on a ground someone already chose rather than only on a photograph.
 */
export const GROUND_PRESETS: {
	id: string;
	label: string;
	dark: ThemeWallpaper;
	light: ThemeWallpaper;
}[] = CARDS.filter(
	(c) =>
		(c.dark.wallpaper.type === "solid" || c.dark.wallpaper.type === "gradient") &&
		(c.light.wallpaper.type === "solid" || c.light.wallpaper.type === "gradient"),
).map((c) => ({ id: c.id, label: c.label, dark: c.dark.wallpaper, light: c.light.wallpaper }));

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
			color: type === "solid" ? okColor(w.color, "#000000") : undefined,
			stops:
				type === "gradient"
					? [
							okColor(w.stops?.[0], "#000000"),
							okColor(w.stops?.[1], "#0D0D0D"),
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

/* ── chrome: the top bar and the composer wear the theme ─────────────── */

const toRgb = (hex: string): [number, number, number] => {
	const n = Number.parseInt(hex.slice(1), 16);
	return [n >> 16, (n >> 8) & 255, n & 255];
};
const toHex = (c: number[]) =>
	`#${c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("")}`;
/** `t` of the way from a to b, in sRGB: these are small UI tints, not blends of light. */
function mixHex(a: string, b: string, t: number): string {
	const A = toRgb(a);
	const B = toRgb(b);
	return toHex(A.map((v, i) => v * (1 - t) + B[i] * t));
}
function contrast(a: string, b: string): number {
	const la = luminance(a);
	const lb = luminance(b);
	return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

const INK_LIGHT = "#FFFFFF";
const INK_DARK = "#1C1917";

/**
 * The fill and inks of the thread's chrome (the top bar pill, the composer
 * and the bars that open above it) for one theme (owner 2026-09-20: "the
 * selected theme should affect the message input box and the top bar").
 *
 * The rule, from the research pass: the accent stays at full strength on
 * glyph-sized things only (send, links, my bubbles). A bar-sized surface
 * gets the GROUND's colour with a tenth of the accent in it, lifted one
 * step toward its ink so it reads as a layer, at 88% so the wallpaper
 * still breathes behind it. No blur: the thread card already carries the
 * one blur this stack is allowed.
 *
 * Ink is chosen by the chrome's OWN fill, never by the app mode or the
 * picture: the Studio lets a pale ground live under dark mode, and the
 * forest photograph is near white across the band the top bar sits on.
 * The 0.42 threshold `inkFor` uses is a bubble taste call (it leaves white
 * on mid-tones at about 2.2:1); here the ink is whichever of the two wins
 * on contrast, and the fill is pushed away from it until it clears 7.5:1.
 *
 * A theme with no colour of its own to read (the flat house ground, an own
 * photo, a token fill) takes the token branch: the app surface with a
 * trace of the accent, inks from the app tokens, so it follows light and
 * dark and the app palette by itself.
 */
function chromeOf(t: ChatTheme): Record<string, string> {
	const w = t.wallpaper;
	const accent = accentOf(t.bubbles.mine);
	let base: string | null = null;
	let ink: string | null = null;
	if (w.type === "solid" && w.color && HEX.test(w.color)) base = w.color;
	else if (w.type === "gradient" && w.stops && w.stops.every((c) => HEX.test(c)))
		base = mixHex(w.stops[0], w.stops[1], 0.5);
	else if (w.type === "preset") {
		const row = WALLPAPERS.find((p) => p.id === w.preset);
		if (row) {
			// A picture has a tone it was chosen for; take the ink from that and
			// walk the tint to that pole until it holds the ink comfortably.
			ink = row.tone === "dark" ? INK_LIGHT : INK_DARK;
			const pole = row.tone === "dark" ? "#000000" : "#FFFFFF";
			base = mixHex(row.tint, "#000000", w.dim / 100);
			// 12:1, not the 7.5 floor below: a photograph's average says little
			// about the band the bar sits on, so the bar goes well into its pole.
			for (let i = 0; i < 10 && contrast(base, ink) < 12; i++)
				base = mixHex(base, pole, 0.15);
		}
	}
	if (!base || !HEX.test(accent)) {
		// The flat house ground is the app itself, so its chrome is exactly the
		// app's frost (the owner turned down a cyan tint on these surfaces on
		// 2026-09-20). An own photo gets the surface with a trace of the accent.
		const flat = w.type === "flat";
		const solid = flat
			? "var(--ws-bg-surface)"
			: `color-mix(in srgb, ${accent} 8%, var(--ws-bg-surface))`;
		return {
			"--chat-chrome-solid": solid,
			"--chat-chrome-bg": flat
				? "var(--chat-frost)"
				: `color-mix(in srgb, ${solid} 86%, transparent)`,
			"--chat-chrome-ink": "var(--ws-text-primary)",
			"--chat-chrome-ink-muted": "var(--ws-text-muted)",
			"--chat-chrome-ink-subtle": "var(--ws-text-subtle)",
			"--chat-chrome-hairline": "var(--ws-border-hairline)",
		};
	}
	if (!ink)
		ink = contrast(base, INK_LIGHT) >= contrast(base, INK_DARK) ? INK_LIGHT : INK_DARK;
	const away = ink === INK_LIGHT ? "#000000" : "#FFFFFF";
	// On a dark ground a layer is one step LIGHTER (toward its ink). On a
	// pale ground it is lighter too, which there means AWAY from the ink:
	// paper stacks white on cream, and a bar that went greyer than its
	// ground read as dirty. Accent: a tenth in the dark, 6% on paper.
	let solid =
		ink === INK_LIGHT
			? mixHex(mixHex(base, accent, 0.1), ink, 0.07)
			: mixHex(mixHex(base, "#FFFFFF", 0.55), accent, 0.06);
	for (let i = 0; i < 6 && contrast(solid, ink) < 7.5; i++)
		solid = mixHex(solid, away, 0.12);
	const inkAt = (pct: number) => `color-mix(in srgb, ${ink} ${pct}%, transparent)`;
	return {
		"--chat-chrome-solid": solid,
		"--chat-chrome-bg": `color-mix(in srgb, ${solid} 88%, transparent)`,
		"--chat-chrome-ink": ink,
		"--chat-chrome-ink-muted": inkAt(66),
		"--chat-chrome-ink-subtle": inkAt(46),
		"--chat-chrome-hairline": inkAt(12),
	};
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
		// The quoted reply peeks out from behind a bubble, so it sits on the
		// GROUND, which may be a photograph. It gets an opaque chip: mine is
		// the accent folded into the surface token, theirs is their own fill.
		// A translucent wash of the bubble's ink (the old rule) was white text
		// on 16% white over a pale wallpaper.
		"--chat-quote-mine": `color-mix(in srgb, ${accent} 24%, var(--ws-bg-surface))`,
		"--chat-quote-mine-ink": "var(--ws-text-primary)",
		"--chat-quote-theirs": t.bubbles.theirs.color,
		"--chat-quote-theirs-ink": inkFor(t.bubbles.theirs.color),
		// The centred day stamp. On a flat ground it is bare subtle ink; on
		// any picture or painted ground it sits in a chip of the page colour
		// so it reads over whatever is behind it (owner 2026-09-15: the dates
		// vanished on a pale wallpaper).
		"--chat-stamp-bg":
			t.wallpaper.type === "flat"
				? "transparent"
				: "color-mix(in srgb, var(--ws-bg-page) 72%, transparent)",
		"--chat-stamp-ink":
			t.wallpaper.type === "flat" ? "var(--ws-text-subtle)" : "var(--ws-text-muted)",
		"--chat-r": `${s.r}px`,
		"--chat-r-in": `${s.rin}px`,
		// Always the whole set, so the `.chat-chrome` scope never meets an
		// undefined variable. Never put `.chat-chrome` on the element that
		// carries these: it re-points --ws-text-* at them, and a property that
		// reaches itself is a cycle CSS throws away (see the --ws-fs note).
		...chromeOf(t),
	} as CSSProperties;
}

export function sameTheme(a: ChatTheme, b: ChatTheme): boolean {
	return JSON.stringify(a) === JSON.stringify(b);
}
