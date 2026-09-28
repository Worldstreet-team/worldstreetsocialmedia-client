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
	/** An own photo's measured colour and the pole it sits nearest, sampled
	 *  from the FILE at upload (the served copy is cross-origin and would
	 *  taint a canvas). With these a picture derives its ground family the
	 *  way a preset does; without them it takes the token branch. */
	tint?: string;
	tone?: ThemeMode;
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

/** How much of the theme the bars wear. */
export type ChromeLevel = "quiet" | "colour";

export interface ChatTheme {
	wallpaper: ThemeWallpaper;
	bubbles: ThemeBubbles;
	/** The top bar and the composer (owner 2026-09-25: "the theme should
	 *  affect the chrome header where the input is, the colour"). `colour`,
	 *  which is what unset means, paints them in the theme's own colour;
	 *  `quiet` is the earlier look, the ground with a tenth of the accent.
	 *  The flat house theme has no colour to wear and ignores it. */
	chrome?: ChromeLevel;
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
	// The comic-book set (2026-09-25): eight moods with no character in
	// them, drawn to the same rule as the set above, tints measured.
	{ id: "rooftop-dark", label: "Rooftop", src: "/wallpapers/gen/rooftop-dark.webp", tone: "dark", tint: "#1E0C1A" },
	{ id: "rooftop-light", label: "Rooftop", src: "/wallpapers/gen/rooftop-light.webp", tone: "light", tint: "#F6F1F6" },
	{ id: "gamma-dark", label: "Gamma", src: "/wallpapers/gen/gamma-dark.webp", tone: "dark", tint: "#051308" },
	{ id: "gamma-light", label: "Gamma", src: "/wallpapers/gen/gamma-light.webp", tone: "light", tint: "#EDF7EE" },
	{ id: "vigilante-dark", label: "Vigilante", src: "/wallpapers/gen/vigilante-dark.webp", tone: "dark", tint: "#0A0904" },
	{ id: "vigilante-light", label: "Vigilante", src: "/wallpapers/gen/vigilante-light.webp", tone: "light", tint: "#F6F4EC" },
	{ id: "cosmic-dark", label: "Cosmic", src: "/wallpapers/gen/cosmic-dark.webp", tone: "dark", tint: "#1A0B22" },
	{ id: "cosmic-light", label: "Cosmic", src: "/wallpapers/gen/cosmic-light.webp", tone: "light", tint: "#F7F0FB" },
	{ id: "storm-dark", label: "Storm Front", src: "/wallpapers/gen/storm-dark.webp", tone: "dark", tint: "#0E1522" },
	{ id: "storm-light", label: "Storm Front", src: "/wallpapers/gen/storm-light.webp", tone: "light", tint: "#EFF2F9" },
	{ id: "symbiote-dark", label: "Symbiote", src: "/wallpapers/gen/symbiote-dark.webp", tone: "dark", tint: "#0F0F12" },
	{ id: "symbiote-light", label: "Symbiote", src: "/wallpapers/gen/symbiote-light.webp", tone: "light", tint: "#F2F1F6" },
	{ id: "multiverse-dark", label: "Multiverse", src: "/wallpapers/gen/multiverse-dark.webp", tone: "dark", tint: "#100F19" },
	{ id: "multiverse-light", label: "Multiverse", src: "/wallpapers/gen/multiverse-light.webp", tone: "light", tint: "#F4F4FB" },
	{ id: "arclight-dark", label: "Arc Light", src: "/wallpapers/gen/arclight-dark.webp", tone: "dark", tint: "#1B0C0E" },
	{ id: "arclight-light", label: "Arc Light", src: "/wallpapers/gen/arclight-light.webp", tone: "light", tint: "#F5F2F0" },
	// Photographs found online (2026-09-25 PM, owner: "search online and
	// curate themes from them"): twelve free-licence pictures (public
	// domain, CC0 or CC BY, never ShareAlike, so a crop is clean) in the
	// hero moods, 1440 by 900, credits in /wallpapers/credits.json. The
	// dark card carries the picture; the light card is a painted pale
	// ground from the same accent (a galaxy has no daytime photograph).
	{ id: "thunder", label: "Thunder", src: "/wallpapers/thunder.webp", tone: "dark", tint: "#74616e" },
	{ id: "low-orbit", label: "Low Orbit", src: "/wallpapers/low-orbit.webp", tone: "dark", tint: "#3d342a" },
	{ id: "celestial", label: "Celestial", src: "/wallpapers/celestial.webp", tone: "dark", tint: "#644e57" },
	{ id: "helix", label: "Helix", src: "/wallpapers/helix.webp", tone: "dark", tint: "#214749" },
	{ id: "ice-cave", label: "Ice Cave", src: "/wallpapers/ice-cave.webp", tone: "dark", tint: "#076d89" },
	{ id: "night-grid", label: "Night Grid", src: "/wallpapers/night-grid.webp", tone: "dark", tint: "#070809" },
	{ id: "dew-web", label: "Dew Web", src: "/wallpapers/dew-web.webp", tone: "dark", tint: "#6b5b46" },
	{ id: "kabukicho", label: "Kabukicho", src: "/wallpapers/kabukicho.webp", tone: "dark", tint: "#524844" },
	{ id: "ferro", label: "Ferro", src: "/wallpapers/ferro.webp", tone: "dark", tint: "#474745" },
	{ id: "gateway", label: "Gateway", src: "/wallpapers/gateway.webp", tone: "dark", tint: "#915722" },
	{ id: "bay-lights", label: "Bay Lights", src: "/wallpapers/bay-lights.webp", tone: "dark", tint: "#393632" },
	{ id: "carousel", label: "Carousel", src: "/wallpapers/carousel.webp", tone: "dark", tint: "#57443e" },
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
export type CardGroup = "colour" | "places" | "photo" | "art";
type CardTheme = {
	wallpaper: ThemeWallpaper;
	bubbles: Omit<ThemeBubbles, "shape">;
};
const CARDS: {
	id: string;
	label: string;
	blurb: string;
	/** A shelf chosen by hand; otherwise decided by the dark ground. */
	group?: CardGroup;
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

	/* ── Places (curated 2026-09-25, an agent pass on atmosphere): whole
	   systems, not one colour each. Dark grounds are black or a wash of it
	   (no stone); every body pair was computed at 4.5:1 or better, both
	   modes; no pure blue or pink accent. Painted grounds, so a drawn
	   wallpaper can follow later without the card changing. ── */
	{
		id: "night-market",
		label: "Night Market",
		blurb: "Lagos after dark. Hot orange neon strung over black.",
		group: "places",
		dark: {
			wallpaper: { type: "gradient", stops: ["#000000", "#140600"], angle: 170, frost: 0, hue: "none", dim: 0 },
			bubbles: { mine: { kind: "gradient", stops: ["#D2400C", "#A5140F"], angle: 135 }, theirs: { color: "#3E2219" } },
		},
		light: {
			wallpaper: { type: "gradient", stops: ["#FFF7EE", "#FFE3CC"], angle: 170, frost: 0, hue: "none", dim: 0 },
			bubbles: { mine: { kind: "gradient", stops: ["#D2400C", "#A5140F"], angle: 135 }, theirs: { color: "#F3CDB2" } },
		},
	},
	{
		id: "sahara-dusk",
		label: "Sahara Dusk",
		blurb: "Sienna sky into plum, sand underfoot.",
		group: "places",
		dark: {
			wallpaper: { type: "gradient", stops: ["#150710", "#000000"], angle: 180, frost: 0, hue: "none", dim: 0 },
			bubbles: { mine: { kind: "gradient", stops: ["#B0501A", "#7E2A45"], angle: 150 }, theirs: { color: "#3F2719" } },
		},
		light: {
			wallpaper: { type: "gradient", stops: ["#FBEFE6", "#F1D8C2"], angle: 180, frost: 0, hue: "none", dim: 0 },
			bubbles: { mine: { kind: "gradient", stops: ["#B0501A", "#7E2A45"], angle: 150 }, theirs: { color: "#E6C6A3" } },
		},
	},
	{
		id: "atlantic-morning",
		label: "Atlantic Morning",
		blurb: "Sea-glass light on deep water. Your side is the morning.",
		group: "places",
		dark: {
			wallpaper: { type: "gradient", stops: ["#000000", "#04161B"], angle: 180, frost: 0, hue: "none", dim: 0 },
			bubbles: { mine: { kind: "solid", color: "#D6EDE8" }, theirs: { color: "#113642" } },
		},
		light: {
			wallpaper: { type: "gradient", stops: ["#F4FAF9", "#D9ECEB"], angle: 180, frost: 0, hue: "none", dim: 0 },
			bubbles: { mine: { kind: "solid", color: "#0F6F80" }, theirs: { color: "#BFDEDB" } },
		},
	},
	{
		id: "nairobi-green",
		label: "Nairobi Green",
		blurb: "Highland emerald, sisal and black soil.",
		group: "places",
		dark: {
			wallpaper: { type: "gradient", stops: ["#000000", "#04120A"], angle: 180, frost: 0, hue: "none", dim: 0 },
			bubbles: { mine: { kind: "gradient", stops: ["#0E8438", "#0B5E3B"], angle: 150 }, theirs: { color: "#17351F" } },
		},
		light: {
			wallpaper: { type: "gradient", stops: ["#F3F9F1", "#E1EFDB"], angle: 180, frost: 0, hue: "none", dim: 0 },
			bubbles: { mine: { kind: "gradient", stops: ["#0E8438", "#0B5E3B"], angle: 150 }, theirs: { color: "#E3DDC0" } },
		},
	},
	{
		id: "accra-gold",
		label: "Accra Gold",
		blurb: "Market gold on black cloth, oxblood beside it.",
		group: "places",
		dark: {
			wallpaper: { type: "gradient", stops: ["#000000", "#120A00"], angle: 175, frost: 0, hue: "none", dim: 0 },
			bubbles: { mine: { kind: "gradient", stops: ["#F2B72A", "#E39D12"], angle: 150 }, theirs: { color: "#4E1C17" } },
		},
		light: {
			wallpaper: { type: "gradient", stops: ["#FFF9E8", "#F8E6BC"], angle: 175, frost: 0, hue: "none", dim: 0 },
			bubbles: { mine: { kind: "gradient", stops: ["#9A6B06", "#7A5400"], angle: 150 }, theirs: { color: "#EAD3A2" } },
		},
	},
	{
		id: "rio-carnival",
		label: "Rio Carnival",
		blurb: "Purple into flame over green. Loud on purpose.",
		group: "places",
		dark: {
			wallpaper: { type: "gradient", stops: ["#0B0414", "#000000"], angle: 160, frost: 0, hue: "none", dim: 0 },
			bubbles: { mine: { kind: "gradient", stops: ["#A82DC4", "#C2410C"], angle: 135 }, theirs: { color: "#173821" } },
		},
		light: {
			wallpaper: { type: "gradient", stops: ["#FFFBEE", "#FFE7A8"], angle: 160, frost: 0, hue: "none", dim: 0 },
			bubbles: { mine: { kind: "gradient", stops: ["#A82DC4", "#C2410C"], angle: 135 }, theirs: { color: "#C2E4B3" } },
		},
	},
	{
		id: "tokyo-rain",
		label: "Tokyo Rain",
		blurb: "Teal into magenta neon on wet asphalt.",
		group: "places",
		dark: {
			wallpaper: { type: "gradient", stops: ["#000000", "#040E14"], angle: 180, frost: 0, hue: "none", dim: 0 },
			bubbles: { mine: { kind: "gradient", stops: ["#0C7C8C", "#A5177A"], angle: 135 }, theirs: { color: "#1E3040" } },
		},
		light: {
			wallpaper: { type: "gradient", stops: ["#EEF3F6", "#D6E1E8"], angle: 180, frost: 0, hue: "none", dim: 0 },
			bubbles: { mine: { kind: "gradient", stops: ["#0C7C8C", "#A5177A"], angle: 135 }, theirs: { color: "#C4D2DB" } },
		},
	},
	/* ── Studies: one material each. ── */
	{
		id: "alpine-snow",
		label: "Alpine Snow",
		blurb: "Cold white, spruce-blue shadow. Crisp.",
		dark: {
			wallpaper: { type: "gradient", stops: ["#000000", "#030A10"], angle: 180, frost: 0, hue: "none", dim: 0 },
			bubbles: { mine: { kind: "solid", color: "#EDF3F7" }, theirs: { color: "#1A2E3E" } },
		},
		light: {
			wallpaper: { type: "gradient", stops: ["#FFFFFF", "#E4EEF5"], angle: 180, frost: 0, hue: "none", dim: 0 },
			bubbles: { mine: { kind: "solid", color: "#295A73" }, theirs: { color: "#D7E4EC" } },
		},
	},
	{
		id: "ledger-paper",
		label: "Ledger Paper",
		blurb: "Buff paper and pen ink. Money keeps its own colours.",
		dark: {
			wallpaper: { type: "solid", color: "#000000", frost: 0, hue: "none", dim: 0 },
			bubbles: { mine: { kind: "solid", color: "#E6D7A8" }, theirs: { color: "#262626" } },
		},
		light: {
			wallpaper: { type: "gradient", stops: ["#FCFAF3", "#F3EEDD"], angle: 180, frost: 0, hue: "none", dim: 0 },
			bubbles: { mine: { kind: "solid", color: "#1F2B36" }, theirs: { color: "#E9E2CB" } },
		},
	},
	{
		id: "phosphor-terminal",
		label: "Phosphor Terminal",
		blurb: "Green phosphor on black. The font stays.",
		dark: {
			wallpaper: { type: "solid", color: "#000000", frost: 0, hue: "none", dim: 0 },
			bubbles: { mine: { kind: "solid", color: "#2BD96A" }, theirs: { color: "#123020" } },
		},
		light: {
			wallpaper: { type: "gradient", stops: ["#F5F7F1", "#E4EBDD"], angle: 180, frost: 0, hue: "none", dim: 0 },
			bubbles: { mine: { kind: "solid", color: "#0F5F35" }, theirs: { color: "#D3DECB" } },
		},
	},
	{
		id: "velvet-rope",
		label: "Velvet Rope",
		blurb: "Deep burgundy, low light, no queue.",
		dark: {
			wallpaper: { type: "gradient", stops: ["#14040A", "#000000"], angle: 165, frost: 0, hue: "none", dim: 0 },
			bubbles: { mine: { kind: "gradient", stops: ["#9B1B3F", "#6B1230"], angle: 150 }, theirs: { color: "#4A1B2E" } },
		},
		light: {
			wallpaper: { type: "gradient", stops: ["#FCF4F5", "#F3DEE3"], angle: 165, frost: 0, hue: "none", dim: 0 },
			bubbles: { mine: { kind: "gradient", stops: ["#9B1B3F", "#6B1230"], angle: 150 }, theirs: { color: "#EBCBD3" } },
		},
	},
	{
		id: "chalk-slate",
		label: "Chalk Slate",
		blurb: "Green slate, chalk in your hand.",
		dark: {
			wallpaper: { type: "gradient", stops: ["#101A16", "#050807"], angle: 180, frost: 0, hue: "none", dim: 0 },
			bubbles: { mine: { kind: "solid", color: "#EDEBE3" }, theirs: { color: "#223530" } },
		},
		light: {
			wallpaper: { type: "gradient", stops: ["#EEF2EE", "#DCE4DE"], angle: 180, frost: 0, hue: "none", dim: 0 },
			bubbles: { mine: { kind: "solid", color: "#2B4640" }, theirs: { color: "#C9D6CF" } },
		},
	},
	/* ── Colour, third set (curated 2026-09-25, the quiet-to-bold pass).
	   Eight of fourteen kept: the other six were the same card as a Place
	   (a second terminal, a second dusk, a third cold white, a second gold
	   on black, a second bottle green, a second paper). Mine ink 4.76:1 or
	   better at the worst stop, their ink 11.5:1 or better, both modes. ── */
	{
		id: "bond-desk",
		label: "Bond Desk",
		blurb: "Navy on black, the trading desk after the close.",
		dark: {
			wallpaper: { type: "solid", color: "#000000", frost: 0, hue: "none", dim: 0 },
			bubbles: { mine: { kind: "solid", color: "#24358A" }, theirs: { color: "#2A2F40" } },
		},
		light: {
			wallpaper: { type: "solid", color: "#F3F5F9", frost: 0, hue: "none", dim: 0 },
			bubbles: { mine: { kind: "solid", color: "#24358A" }, theirs: { color: "#D9DEEA" } },
		},
	},
	{
		id: "wild-honey",
		label: "Wild Honey",
		blurb: "Dark honey, amber-orange, on a jar-black ground.",
		dark: {
			wallpaper: { type: "gradient", stops: ["#160E02", "#000000"], angle: 180, frost: 0, hue: "none", dim: 0 },
			bubbles: { mine: { kind: "solid", color: "#F99E52" }, theirs: { color: "#40301A" } },
		},
		light: {
			wallpaper: { type: "solid", color: "#FFF8EC", frost: 0, hue: "none", dim: 0 },
			bubbles: { mine: { kind: "solid", color: "#F99E52" }, theirs: { color: "#F5DCB0" } },
		},
	},
	{
		id: "coral-reef",
		label: "Coral Reef",
		blurb: "Living coral over black water.",
		dark: {
			wallpaper: { type: "gradient", stops: ["#001417", "#000000"], angle: 180, frost: 0, hue: "none", dim: 0 },
			bubbles: { mine: { kind: "solid", color: "#FF968D" }, theirs: { color: "#14373E" } },
		},
		light: {
			wallpaper: { type: "solid", color: "#FFF6F3", frost: 0, hue: "none", dim: 0 },
			bubbles: { mine: { kind: "solid", color: "#FF968D" }, theirs: { color: "#FFD9CF" } },
		},
	},
	{
		id: "rose-gold",
		label: "Rose Gold",
		blurb: "Burnished copper-rose, the metal not the pink.",
		dark: {
			wallpaper: { type: "gradient", stops: ["#170B0C", "#000000"], angle: 180, frost: 0, hue: "none", dim: 0 },
			bubbles: { mine: { kind: "gradient", stops: ["#9C6257", "#7A4B45"], angle: 150 }, theirs: { color: "#472E2E" } },
		},
		light: {
			wallpaper: { type: "solid", color: "#FBF3F1", frost: 0, hue: "none", dim: 0 },
			bubbles: { mine: { kind: "gradient", stops: ["#9C6257", "#7A4B45"], angle: 150 }, theirs: { color: "#F0D9D3" } },
		},
	},
	{
		id: "abyss",
		label: "Abyss",
		blurb: "Black water, a bioluminescent reply.",
		dark: {
			wallpaper: { type: "gradient", stops: ["#00111C", "#000000"], angle: 180, frost: 0, hue: "none", dim: 0 },
			bubbles: { mine: { kind: "solid", color: "#0F4A4E" }, theirs: { color: "#7FE3D8" } },
		},
		light: {
			wallpaper: { type: "solid", color: "#EEF6F7", frost: 0, hue: "none", dim: 0 },
			bubbles: { mine: { kind: "solid", color: "#0F4A4E" }, theirs: { color: "#B4E7E1" } },
		},
	},
	{
		id: "slate-rain",
		label: "Slate Rain",
		blurb: "Rain-grey blue streaking down. Overcast and calm.",
		dark: {
			wallpaper: { type: "gradient", stops: ["#070C12", "#000000"], angle: 180, frost: 0, hue: "none", dim: 0 },
			bubbles: { mine: { kind: "gradient", stops: ["#587690", "#3E5468"], angle: 170 }, theirs: { color: "#2A3340" } },
		},
		light: {
			wallpaper: { type: "solid", color: "#EEF1F4", frost: 0, hue: "none", dim: 0 },
			bubbles: { mine: { kind: "gradient", stops: ["#587690", "#3E5468"], angle: 170 }, theirs: { color: "#D3DAE1" } },
		},
	},
	{
		id: "acid-night",
		label: "Acid Night",
		blurb: "Neon lime on pure black. Loud on purpose.",
		dark: {
			wallpaper: { type: "solid", color: "#000000", frost: 0, hue: "none", dim: 0 },
			bubbles: { mine: { kind: "solid", color: "#B6FF2E" }, theirs: { color: "#2E2E2E" } },
		},
		light: {
			wallpaper: { type: "solid", color: "#FFFFFF", frost: 0, hue: "none", dim: 0 },
			bubbles: { mine: { kind: "solid", color: "#7BCB00" }, theirs: { color: "#E6E6E6" } },
		},
	},
	{
		id: "stark-relief",
		label: "Stark Relief",
		blurb: "Both poles at once: white and black bubbles on a grey wash.",
		dark: {
			wallpaper: { type: "solid", color: "#2E2E2E", frost: 0, hue: "none", dim: 0 },
			bubbles: { mine: { kind: "solid", color: "#FFFFFF" }, theirs: { color: "#000000" } },
		},
		light: {
			wallpaper: { type: "solid", color: "#DEDEDE", frost: 0, hue: "none", dim: 0 },
			bubbles: { mine: { kind: "solid", color: "#000000" }, theirs: { color: "#FFFFFF" } },
		},
	},
	/* Artwork, the comic-book set (2026-09-25; owner: themes "even dark
	   things like spider man, marvel things"). Eight moods with no
	   character, emblem or name in them, each on its own drawn picture,
	   all on the Artwork shelf: rooftop night, gamma glow, a searchlight
	   over a skyline, a nebula, a storm, gloss black, a glitch, an arc.
	   Saturated fills only where the hue was still free (the red, the
	   toxic green); the glow cards (Storm Front, Cosmic, Multiverse, Arc
	   Light) wear pale light-source fills in the dark and a deep cut of
	   the same hue on paper, which keeps them clear of the saturated
	   blues and violets above. Rooftop's red and Vigilante's yellow sit
	   inside 20 degrees of Kiln / Night Market and Lamplight: those bands
	   were full, and the colour is the point of each card. Checked with
	   the file's own formula against the measured tints: white ink on
	   every dark mine stop 4.67:1 or better, dark ink on every pale one
	   8.1:1 or better, their ink 10:1 or better, their fill 1.66:1 (dark)
	   and 1.25:1 (light) or more off the ground. */
	{
		id: "rooftop",
		label: "Rooftop",
		blurb: "A night sky strung with thread, red glow below, blue above.",
		group: "art",
		dark: {
			wallpaper: { type: "preset", preset: "rooftop-dark", frost: 0, hue: "none", dim: 0 },
			bubbles: { mine: { kind: "gradient", stops: ["#D8202B", "#A5121B"], angle: 140 }, theirs: { color: "#26376F" } },
		},
		light: {
			wallpaper: { type: "preset", preset: "rooftop-light", frost: 0, hue: "none", dim: 0 },
			bubbles: { mine: { kind: "gradient", stops: ["#D8202B", "#A5121B"], angle: 140 }, theirs: { color: "#C5D2F0" } },
		},
	},
	{
		id: "gamma",
		label: "Gamma",
		blurb: "A green glow through a halftone screen. Pulp-page dark.",
		group: "art",
		dark: {
			wallpaper: { type: "preset", preset: "gamma-dark", frost: 0, hue: "none", dim: 0 },
			bubbles: { mine: { kind: "gradient", stops: ["#3A8420", "#2B6617"], angle: 140 }, theirs: { color: "#22412E" } },
		},
		light: {
			wallpaper: { type: "preset", preset: "gamma-light", frost: 0, hue: "none", dim: 0 },
			bubbles: { mine: { kind: "gradient", stops: ["#3A8420", "#2B6617"], angle: 140 }, theirs: { color: "#C3E3C8" } },
		},
	},
	{
		id: "vigilante",
		label: "Vigilante",
		blurb: "A searchlight over a black skyline. Signal yellow, your side.",
		group: "art",
		dark: {
			wallpaper: { type: "preset", preset: "vigilante-dark", frost: 0, hue: "none", dim: 0 },
			bubbles: { mine: { kind: "gradient", stops: ["#ECE22A", "#CBC014"], angle: 150 }, theirs: { color: "#3A3A3A" } },
		},
		light: {
			wallpaper: { type: "preset", preset: "vigilante-light", frost: 0, hue: "none", dim: 0 },
			bubbles: { mine: { kind: "gradient", stops: ["#E3D91C", "#BFB40E"], angle: 150 }, theirs: { color: "#DCD9CF" } },
		},
	},
	{
		id: "cosmic",
		label: "Cosmic",
		blurb: "Nebula washes and a scatter of stars. Your side is starlight.",
		group: "art",
		dark: {
			wallpaper: { type: "preset", preset: "cosmic-dark", frost: 0, hue: "none", dim: 0 },
			bubbles: { mine: { kind: "gradient", stops: ["#C9BAFF", "#E4BFFF"], angle: 140 }, theirs: { color: "#4E2F66" } },
		},
		light: {
			wallpaper: { type: "preset", preset: "cosmic-light", frost: 0, hue: "none", dim: 0 },
			bubbles: { mine: { kind: "gradient", stops: ["#6A48C9", "#8A5BD6"], angle: 140 }, theirs: { color: "#DCCBF2" } },
		},
	},
	{
		id: "storm",
		label: "Storm Front",
		blurb: "Lightning over slate. Your side carries the charge.",
		group: "art",
		dark: {
			wallpaper: { type: "preset", preset: "storm-dark", frost: 0, hue: "none", dim: 0 },
			bubbles: { mine: { kind: "gradient", stops: ["#A9D2FF", "#7FB5F7"], angle: 160 }, theirs: { color: "#37414F" } },
		},
		light: {
			wallpaper: { type: "preset", preset: "storm-light", frost: 0, hue: "none", dim: 0 },
			bubbles: { mine: { kind: "gradient", stops: ["#2A5DB8", "#1E4A99"], angle: 160 }, theirs: { color: "#CFDBEC" } },
		},
	},
	{
		id: "symbiote",
		label: "Symbiote",
		blurb: "Gloss black on black and one white streak. Yours is the streak.",
		group: "art",
		dark: {
			wallpaper: { type: "preset", preset: "symbiote-dark", frost: 0, hue: "none", dim: 0 },
			bubbles: { mine: { kind: "solid", color: "#F4F4F5" }, theirs: { color: "#353B50" } },
		},
		light: {
			wallpaper: { type: "preset", preset: "symbiote-light", frost: 0, hue: "none", dim: 0 },
			bubbles: { mine: { kind: "solid", color: "#121216" }, theirs: { color: "#D4D4DC" } },
		},
	},
	{
		id: "multiverse",
		label: "Multiverse",
		blurb: "Cyan and magenta split a few pixels apart. The glitch one.",
		group: "art",
		dark: {
			wallpaper: { type: "preset", preset: "multiverse-dark", frost: 0, hue: "none", dim: 0 },
			bubbles: { mine: { kind: "gradient", stops: ["#FF8AD4", "#FF9DB8"], angle: 140 }, theirs: { color: "#154850" } },
		},
		light: {
			wallpaper: { type: "preset", preset: "multiverse-light", frost: 0, hue: "none", dim: 0 },
			bubbles: { mine: { kind: "gradient", stops: ["#C41E8E", "#8E2FB5"], angle: 140 }, theirs: { color: "#BFE3E6" } },
		},
	},
	{
		id: "arclight",
		label: "Arc Light",
		blurb: "A cyan ring in a red-black dark, gold at the rim.",
		group: "art",
		dark: {
			wallpaper: { type: "preset", preset: "arclight-dark", frost: 0, hue: "none", dim: 0 },
			bubbles: { mine: { kind: "gradient", stops: ["#2BDCF2", "#14C4E0"], angle: 150 }, theirs: { color: "#4A3A12" } },
		},
		light: {
			wallpaper: { type: "preset", preset: "arclight-light", frost: 0, hue: "none", dim: 0 },
			bubbles: { mine: { kind: "gradient", stops: ["#0A7F92", "#07697A"], angle: 150 }, theirs: { color: "#EBD9A8" } },
		},
	},
	/* Photographs found online (2026-09-25 PM). Each card's hero colour
	   was set by hand from the picture, on the sampler's two routes: a
	   light colour stays light with dark ink (the golds, the aurora
	   green, the lightning's lilac), a deep one is walked under 0.18
	   luminance for white ink. Checked with the file's own formula: white
	   or dark ink on every mine stop 4.6:1 or better by the gradient's
	   average, their ink 6.8:1 or better, their fill 1.6:1 or more off
	   the measured ground in the dark and 1.4:1 or more on paper. */
	{
		id: "thunder",
		label: "Thunder",
		blurb: "Lightning over a dark hill, photographed at La Silla. Your side carries the charge.",
		dark: {
			wallpaper: { type: "preset", preset: "thunder", frost: 4, hue: "none", dim: 22 },
			bubbles: { mine: { kind: "gradient", stops: ["#c7baf9", "#b7abe5"], angle: 140 }, theirs: { color: "#585560" } },
		},
		light: {
			wallpaper: { type: "gradient", stops: ["#faf8fe", "#ede8fd"], angle: 165, frost: 0, hue: "none", dim: 0 },
			bubbles: { mine: { kind: "gradient", stops: ["#c7baf9", "#b7abe5"], angle: 140 }, theirs: { color: "#c4c0cc" } },
		},
	},
	{
		id: "low-orbit",
		label: "Low Orbit",
		blurb: "The aurora from the station, city lights below. Green on black.",
		dark: {
			wallpaper: { type: "preset", preset: "low-orbit", frost: 4, hue: "none", dim: 22 },
			bubbles: { mine: { kind: "gradient", stops: ["#9FE07A", "#92ce70"], angle: 140 }, theirs: { color: "#62492b" } },
		},
		light: {
			wallpaper: { type: "gradient", stops: ["#fbfefa", "#f2fbec"], angle: 165, frost: 0, hue: "none", dim: 0 },
			bubbles: { mine: { kind: "gradient", stops: ["#9FE07A", "#92ce70"], angle: 140 }, theirs: { color: "#dbc3a6" } },
		},
	},
	{
		id: "celestial",
		label: "Celestial",
		blurb: "Hubble's star cluster in full colour. The loud one.",
		dark: {
			wallpaper: { type: "preset", preset: "celestial", frost: 10, hue: "none", dim: 32 },
			bubbles: { mine: { kind: "gradient", stops: ["#f1abd5", "#de9dc4"], angle: 140 }, theirs: { color: "#475974" } },
		},
		light: {
			wallpaper: { type: "gradient", stops: ["#fef8fb", "#fbe6f3"], angle: 165, frost: 0, hue: "none", dim: 0 },
			bubbles: { mine: { kind: "gradient", stops: ["#f1abd5", "#de9dc4"], angle: 140 }, theirs: { color: "#b6c9e4" } },
		},
	},
	{
		id: "helix",
		label: "Helix",
		blurb: "The Helix Nebula, a teal ring with a red heart.",
		dark: {
			wallpaper: { type: "preset", preset: "helix", frost: 8, hue: "none", dim: 28 },
			bubbles: { mine: { kind: "gradient", stops: ["#1c7783", "#155962"], angle: 140 }, theirs: { color: "#7e3c45" } },
		},
		light: {
			wallpaper: { type: "gradient", stops: ["#f6fbfc", "#e1f2f4"], angle: 165, frost: 0, hue: "none", dim: 0 },
			bubbles: { mine: { kind: "gradient", stops: ["#1c7783", "#155962"], angle: 140 }, theirs: { color: "#e6b0b6" } },
		},
	},
	{
		id: "ice-cave",
		label: "Ice Cave",
		blurb: "Inside a glacier in Iceland. Cold blue all around.",
		dark: {
			wallpaper: { type: "preset", preset: "ice-cave", frost: 6, hue: "none", dim: 24 },
			bubbles: { mine: { kind: "gradient", stops: ["#018095", "#016070"], angle: 140 }, theirs: { color: "#2e5964" } },
		},
		light: {
			wallpaper: { type: "gradient", stops: ["#f5fdfe", "#dbf7fb"], angle: 165, frost: 0, hue: "none", dim: 0 },
			bubbles: { mine: { kind: "gradient", stops: ["#018095", "#016070"], angle: 140 }, theirs: { color: "#9ac4cf" } },
		},
	},
	{
		id: "night-grid",
		label: "Night Grid",
		blurb: "Hong Kong and Shenzhen from orbit: gold threads on black.",
		dark: {
			wallpaper: { type: "preset", preset: "night-grid", frost: 0, hue: "none", dim: 16 },
			bubbles: { mine: { kind: "gradient", stops: ["#E8C25A", "#d5b253"], angle: 140 }, theirs: { color: "#353538" } },
		},
		light: {
			wallpaper: { type: "gradient", stops: ["#fefdf8", "#fcf6e8"], angle: 165, frost: 0, hue: "none", dim: 0 },
			bubbles: { mine: { kind: "gradient", stops: ["#E8C25A", "#d5b253"], angle: 140 }, theirs: { color: "#bcbcbf" } },
		},
	},
	{
		id: "dew-web",
		label: "Dew Web",
		blurb: "A spider's web strung with dew at sunrise.",
		dark: {
			wallpaper: { type: "preset", preset: "dew-web", frost: 8, hue: "none", dim: 30 },
			bubbles: { mine: { kind: "gradient", stops: ["#E6C070", "#d4b167"], angle: 140 }, theirs: { color: "#5e574c" } },
		},
		light: {
			wallpaper: { type: "gradient", stops: ["#fefcf9", "#fcf6eb"], angle: 165, frost: 0, hue: "none", dim: 0 },
			bubbles: { mine: { kind: "gradient", stops: ["#E6C070", "#d4b167"], angle: 140 }, theirs: { color: "#c3bcb0" } },
		},
	},
	{
		id: "kabukicho",
		label: "Kabukicho",
		blurb: "Shinjuku's neon at night. Every sign lit.",
		dark: {
			wallpaper: { type: "preset", preset: "kabukicho", frost: 12, hue: "none", dim: 34 },
			bubbles: { mine: { kind: "gradient", stops: ["#d13a1b", "#9d2c14"], angle: 140 }, theirs: { color: "#2c5e2c" } },
		},
		light: {
			wallpaper: { type: "gradient", stops: ["#fef7f6", "#fce4df"], angle: 165, frost: 0, hue: "none", dim: 0 },
			bubbles: { mine: { kind: "gradient", stops: ["#d13a1b", "#9d2c14"], angle: 140 }, theirs: { color: "#a7d8a7" } },
		},
	},
	{
		id: "ferro",
		label: "Ferro",
		blurb: "Ferrofluid under a magnet: black gloss, spiked.",
		dark: {
			wallpaper: { type: "preset", preset: "ferro", frost: 6, hue: "none", dim: 24 },
			bubbles: { mine: { kind: "gradient", stops: ["#9e6516", "#774c11"], angle: 140 }, theirs: { color: "#5b5b5d" } },
		},
		light: {
			wallpaper: { type: "gradient", stops: ["#fdfaf6", "#faefdf"], angle: 165, frost: 0, hue: "none", dim: 0 },
			bubbles: { mine: { kind: "gradient", stops: ["#9e6516", "#774c11"], angle: 140 }, theirs: { color: "#bcbcbe" } },
		},
	},
	{
		id: "gateway",
		label: "Gateway",
		blurb: "A ring of fire in a brick tunnel, drawn with steel wool.",
		dark: {
			wallpaper: { type: "preset", preset: "gateway", frost: 8, hue: "none", dim: 28 },
			bubbles: { mine: { kind: "gradient", stops: ["#af5912", "#83430e"], angle: 140 }, theirs: { color: "#64574a" } },
		},
		light: {
			wallpaper: { type: "gradient", stops: ["#fefaf6", "#fdecdf"], angle: 165, frost: 0, hue: "none", dim: 0 },
			bubbles: { mine: { kind: "gradient", stops: ["#af5912", "#83430e"], angle: 140 }, theirs: { color: "#cabcae" } },
		},
	},
	{
		id: "bay-lights",
		label: "Bay Lights",
		blurb: "Light trails over the bridge, the city gold behind.",
		dark: {
			wallpaper: { type: "preset", preset: "bay-lights", frost: 10, hue: "none", dim: 30 },
			bubbles: { mine: { kind: "gradient", stops: ["#EBBE5E", "#d8af56"], angle: 140 }, theirs: { color: "#47484f" } },
		},
		light: {
			wallpaper: { type: "gradient", stops: ["#fefcf9", "#fcf6e8"], angle: 165, frost: 0, hue: "none", dim: 0 },
			bubbles: { mine: { kind: "gradient", stops: ["#EBBE5E", "#d8af56"], angle: 140 }, theirs: { color: "#bdbec5" } },
		},
	},
	{
		id: "carousel",
		label: "Carousel",
		blurb: "A fairground ride spun into rings of light.",
		dark: {
			wallpaper: { type: "preset", preset: "carousel", frost: 8, hue: "none", dim: 26 },
			bubbles: { mine: { kind: "gradient", stops: ["#BFD8FF", "#b0c7eb"], angle: 140 }, theirs: { color: "#5e514a" } },
		},
		light: {
			wallpaper: { type: "gradient", stops: ["#fcfdff", "#f6faff"], angle: 165, frost: 0, hue: "none", dim: 0 },
			bubbles: { mine: { kind: "gradient", stops: ["#BFD8FF", "#b0c7eb"], angle: 140 }, theirs: { color: "#c9bcb6" } },
		},
	},
];

/** The owner's 22/8, stamped on every card: a theme never re-cuts the bubbles. */
const stamp = (t: CardTheme): ChatTheme => ({
	wallpaper: t.wallpaper,
	bubbles: { ...t.bubbles, shape: "rounded" },
});
/** Which shelf of the gallery a card sits on: by hand, else by its dark ground. */
const groupOf = (c: (typeof CARDS)[number]): CardGroup => {
	if (c.group) return c.group;
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
	{ id: "places", label: "Places" },
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
			tint: type === "image" && typeof w.tint === "string" && HEX.test(w.tint) ? w.tint : undefined,
			tone: type === "image" && (w.tone === "dark" || w.tone === "light") ? w.tone : undefined,
			frost: clamp(w.frost, 0, 100, d.wallpaper.frost),
			hue: w.hue === "cyan" ? "cyan" : "none",
			dim: clamp(w.dim, 0, 60, d.wallpaper.dim),
		},
		bubbles: {
			mine,
			theirs: { color: okColor(b.theirs?.color, HOUSE_THEIRS) },
			shape: b.shape && b.shape in SHAPES ? b.shape : "rounded",
		},
		// Only the non-default survives, so a card and a saved copy of it
		// still compare equal (canon drops undefined keys).
		chrome: t.chrome === "quiet" ? "quiet" : undefined,
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

export function luminance(hex: string): number {
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

/* ── the six sender hues (groups): pushed per theme toward their ink ── */

/** Six brand-family hues for sender names in groups. No blue, no pink. A
 *  theme walks each toward their bubble's ink until it clears 4.5:1 on
 *  that fill, and the bubble reads `--chat-sender-N`. */
export const SENDER_HUES = [
	"#EAB308", // gold
	"#F59E0B", // amber
	"#10B981", // emerald
	"#14B8A6", // teal
	"#A3A375", // olive
	"#D97706", // ochre
] as const;

/* ── chrome: the top bar and the composer wear the theme ─────────────── */

const toRgb = (hex: string): [number, number, number] => {
	const n = Number.parseInt(hex.slice(1), 16);
	return [n >> 16, (n >> 8) & 255, n & 255];
};
const toHex = (c: number[]) =>
	`#${c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("")}`;
/** `t` of the way from a to b, in sRGB: these are small UI tints, not blends of light. */
export function mixHex(a: string, b: string, t: number): string {
	const A = toRgb(a);
	const B = toRgb(b);
	return toHex(A.map((v, i) => v * (1 - t) + B[i] * t));
}
export function contrast(a: string, b: string): number {
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
/**
 * The one colour a theme's ground can be read as (audit 2026-09-25): the
 * solid, the middle of the gradient, or a picture's measured tint walked
 * toward its pole. null for the flat house ground, an own photo, or a
 * token fill, where everything derives from the app tokens instead.
 */
/**
 * The ground a picture can be read as: its measured tint, dimmed as the
 * theme dims it, walked to the pole of its tone until it holds that pole's
 * ink at 12:1 (not the 7.5 floor the chrome uses: a photograph's average
 * says little about the band a bar sits on, so the ground goes well in).
 */
export function pictureGround(tint: string, tone: ThemeMode, dim: number): { base: string; ink: string } {
	const ink = tone === "dark" ? INK_LIGHT : INK_DARK;
	const pole = tone === "dark" ? "#000000" : "#FFFFFF";
	let base = mixHex(tint, "#000000", dim / 100);
	for (let i = 0; i < 10 && contrast(base, ink) < 12; i++) base = mixHex(base, pole, 0.15);
	return { base, ink };
}

function groundOf(t: ChatTheme): { base: string | null; ink: string | null } {
	const w = t.wallpaper;
	if (w.type === "solid" && w.color && HEX.test(w.color)) return { base: w.color, ink: null };
	if (w.type === "gradient" && w.stops && w.stops.every((c) => HEX.test(c)))
		return { base: mixHex(w.stops[0], w.stops[1], 0.5), ink: null };
	if (w.type === "preset") {
		const row = WALLPAPERS.find((p) => p.id === w.preset);
		if (row) return pictureGround(row.tint, row.tone, w.dim);
	}
	// An own photo sampled at upload carries its own tint and tone (2026-09-25).
	if (w.type === "image" && w.tint && HEX.test(w.tint) && w.tone)
		return pictureGround(w.tint, w.tone, w.dim);
	return { base: null, ink: null };
}

/** Push `color` toward `toward` until it clears `ratio` against `against`. */
export function walkTo(color: string, toward: string, against: string, ratio: number): string {
	let c = color;
	for (let i = 0; i < 10 && contrast(c, against) < ratio; i++) c = mixHex(c, toward, 0.12);
	return c;
}

/** The ink (white or near-black) that wins on a fill. */
export const inkOn = (fill: string) =>
	contrast(fill, INK_LIGHT) >= contrast(fill, INK_DARK) ? INK_LIGHT : INK_DARK;

/** The app ladder as hexes, for contrast tests on the token branch only;
 *  the emitted values stay `var(--ws-*)` so the house look follows the
 *  app palette and mode by itself. */
const LADDER: Record<ThemeMode, { page: string; raised: string; ink: string }> = {
	dark: { page: "#000000", raised: "#1A1A1A", ink: "#FFFFFF" },
	light: { page: "#FFFFFF", raised: "#EFEFEF", ink: "#1C1917" },
};

function chromeOf(t: ChatTheme): Record<string, string> {
	const w = t.wallpaper;
	const accent = accentOf(t.bubbles.mine);
	let { base, ink } = groundOf(t);
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
			"--chat-chrome-chip": "var(--ws-bg-chip)",
			"--chat-chrome-accent": "var(--ws-brand-primary)",
		};
	}
	if (!ink)
		ink = contrast(base, INK_LIGHT) >= contrast(base, INK_DARK) ? INK_LIGHT : INK_DARK;
	const away = ink === INK_LIGHT ? "#000000" : "#FFFFFF";
	// Coloured bars (owner 2026-09-25, the default): on a dark ground the
	// bar is the ground and the accent in equal parts, then walked into the
	// dark until white holds at 7.5:1, so it keeps the accent's HUE and
	// reads as a deep version of it. On paper it is a pastel: the ground
	// lifted toward white with a third of the accent, walked lighter until
	// the dark ink holds.
	// Quiet bars (the 2026-09-20 rule): on a dark ground a layer is one step
	// LIGHTER (toward its ink). On a pale ground it is lighter too, which
	// there means AWAY from the ink: paper stacks white on cream, and a bar
	// that went greyer than its ground read as dirty. Accent: a tenth in the
	// dark, 6% on paper.
	const bold = t.chrome !== "quiet";
	let solid = bold
		? ink === INK_LIGHT
			? mixHex(mixHex(base, accent, 0.5), ink, 0.04)
			: mixHex(mixHex(base, "#FFFFFF", 0.35), accent, 0.3)
		: ink === INK_LIGHT
			? mixHex(mixHex(base, accent, 0.1), ink, 0.07)
			: mixHex(mixHex(base, "#FFFFFF", 0.55), accent, 0.06);
	for (let i = 0; i < 10 && contrast(solid, ink) < 7.5; i++)
		solid = mixHex(solid, away, 0.12);
	const inkAt = (pct: number) => `color-mix(in srgb, ${ink} ${pct}%, transparent)`;
	return {
		"--chat-chrome-solid": solid,
		"--chat-chrome-bg": `color-mix(in srgb, ${solid} 88%, transparent)`,
		"--chat-chrome-ink": ink,
		"--chat-chrome-ink-muted": inkAt(66),
		"--chat-chrome-ink-subtle": inkAt(46),
		"--chat-chrome-hairline": inkAt(12),
		// A well inside a bar (an avatar, a thumb): one step from the bar.
		"--chat-chrome-chip": mixHex(solid, ink, 0.1),
		// The accent at glyph size on the bar (a pin, the review bars): pushed
		// toward the ink until it reads at 3:1.
		"--chat-chrome-accent": walkTo(accent, ink, solid, 3),
	};
}

/**
 * Everything BETWEEN the chrome and the bubbles (audit 2026-09-25): the
 * stamps, system rows, reactions, ticks, the reply affordances and the
 * jump disc sat on app tokens, so a theme reached the bars and the bubbles
 * and nothing in the middle. These derive from the theme's ground; on the
 * token branch (flat house ground, own photo) they are the app's own, so
 * the house look keeps following mode and palette.
 */
function groundVars(t: ChatTheme, mode?: ThemeMode): Record<string, string> {
	const accent = accentOf(t.bubbles.mine);
	const theirs = t.bubbles.theirs.color;
	const theirsInk = inkFor(theirs);
	const { base } = groundOf(t);
	const ladder = LADDER[mode ?? "dark"];
	// Contrast tests need a hex for their bubble; a token fill takes the
	// ladder's raised step for the test and keeps emitting the token.
	const theirsHex = HEX.test(theirs) ? theirs : ladder.raised;
	const theirsInkHex = HEX.test(theirs) ? theirsInk : ladder.ink;
	const linkTheirs = HEX.test(accent) ? walkTo(accent, theirsInkHex, theirsHex, 4.5) : "var(--ws-brand-primary)";
	const senders = Object.fromEntries(
		SENDER_HUES.map((h, i) => [`--chat-sender-${i + 1}`, walkTo(h, theirsInkHex, theirsHex, 4.5)]),
	);
	const shared = {
		"--chat-link-theirs": linkTheirs,
		"--chat-mention-theirs-bg": `color-mix(in srgb, ${linkTheirs} 18%, transparent)`,
		"--chat-link-mine": inkFor(t.bubbles.mine),
		"--chat-on-theirs": `color-mix(in srgb, ${theirsInk} 22%, transparent)`,
		"--chat-send-bg": mineCss(t.bubbles.mine),
		"--chat-send-ink": inkFor(t.bubbles.mine),
		...senders,
	};
	if (!base || !HEX.test(accent)) {
		const flat = t.wallpaper.type === "flat";
		const accentOnGround = mode ? walkTo(accent, ladder.ink, ladder.page, 4.5) : accent;
		return {
			...shared,
			"--chat-ground": "var(--ws-bg-page)",
			"--chat-ground-ink": "var(--ws-text-primary)",
			"--chat-ground-ink-muted": "var(--ws-text-muted)",
			"--chat-ground-ink-subtle": "var(--ws-text-subtle)",
			"--chat-ground-hairline": "var(--ws-border-hairline)",
			"--chat-ground-wash": "color-mix(in srgb, var(--ws-text-primary) 6%, transparent)",
			"--chat-ground-wash-strong": "color-mix(in srgb, var(--ws-text-primary) 12%, transparent)",
			// The centred day stamp. On a flat ground it is bare subtle ink; on
			// a picture it sits in a chip of the page colour so it reads over
			// whatever is behind it (owner 2026-09-15).
			"--chat-pill-bg": flat ? "transparent" : "color-mix(in srgb, var(--ws-bg-page) 72%, transparent)",
			"--chat-pill-ink": flat ? "var(--ws-text-subtle)" : "var(--ws-text-muted)",
			"--chat-accent-on-ground": HEX.test(accent) ? accentOnGround : "var(--ws-brand-primary)",
			// The house line art on a painted ground (owner 2026-09-25), in
			// the accent as it reads here, at the house opacities per mode.
			"--chat-doodle-ink": HEX.test(accent) ? accentOnGround : "var(--ws-brand-primary)",
			"--chat-doodle-alpha": mode === "light" ? "0.14" : "0.2",
			"--chat-reaction-bg": "var(--ws-bg-raised)",
			"--chat-reaction-ink": "var(--ws-text-muted)",
			"--chat-reaction-mine-bg": `color-mix(in srgb, ${accent} 40%, var(--ws-bg-page))`,
			"--chat-reaction-mine-ink": "var(--ws-text-primary)",
			"--chat-reaction-ring": "var(--ws-bg-page)",
			"--chat-tick": "var(--ws-text-muted)",
			"--chat-tick-read": "var(--ws-brand-gold-text)",
			"--chat-quote-mine": `color-mix(in srgb, ${accent} 24%, var(--ws-bg-surface))`,
			"--chat-quote-mine-ink": "var(--ws-text-primary)",
			"--chat-card-bg": "var(--chat-frost)",
		};
	}
	const ink = inkOn(base);
	const inkAt = (pct: number) => `color-mix(in srgb, ${ink} ${pct}%, transparent)`;
	const pill = mixHex(base, ink, 0.07);
	const reactionMine = mixHex(base, accent, 0.4);
	const quoteMine = mixHex(base, accent, 0.24);
	return {
		...shared,
		"--chat-ground": base,
		"--chat-ground-ink": ink,
		"--chat-ground-ink-muted": inkAt(66),
		"--chat-ground-ink-subtle": inkAt(46),
		"--chat-ground-hairline": inkAt(12),
		"--chat-ground-wash": inkAt(6),
		"--chat-ground-wash-strong": inkAt(12),
		"--chat-pill-bg": `color-mix(in srgb, ${pill} 82%, transparent)`,
		"--chat-pill-ink": inkAt(70),
		"--chat-accent-on-ground": walkTo(accent, ink, base, 4.5),
		"--chat-doodle-ink": walkTo(accent, ink, base, 4.5),
		"--chat-doodle-alpha": ink === INK_LIGHT ? "0.2" : "0.14",
		"--chat-reaction-bg": mixHex(base, ink, 0.1),
		"--chat-reaction-ink": inkAt(70),
		"--chat-reaction-mine-bg": reactionMine,
		"--chat-reaction-mine-ink": inkOn(reactionMine),
		"--chat-reaction-ring": base,
		"--chat-tick": inkAt(66),
		"--chat-tick-read": walkTo(accent, ink, base, 4.5),
		"--chat-quote-mine": quoteMine,
		"--chat-quote-mine-ink": inkOn(quoteMine),
		// The thread card wears the theme's own chrome, not the app frost.
		"--chat-card-bg": "var(--chat-chrome-bg)",
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
export function themeVars(t: ChatTheme, mode?: ThemeMode): CSSProperties {
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
		// the accent folded into the ground (groundVars), theirs is their own
		// fill. A translucent wash of the bubble's ink (the old rule) was
		// white text on 16% white over a pale wallpaper.
		"--chat-quote-theirs": t.bubbles.theirs.color,
		"--chat-quote-theirs-ink": inkFor(t.bubbles.theirs.color),
		...groundVars(t, mode),
		// The day stamp is the pill (kept under its old name for callers).
		"--chat-stamp-bg": "var(--chat-pill-bg)",
		"--chat-stamp-ink": "var(--chat-pill-ink)",
		"--chat-r": `${s.r}px`,
		"--chat-r-in": `${s.rin}px`,
		// Always the whole set, so the `.chat-chrome` scope never meets an
		// undefined variable. Never put `.chat-chrome` on the element that
		// carries these: it re-points --ws-text-* at them, and a property that
		// reaches itself is a cycle CSS throws away (see the --ws-fs note).
		...chromeOf(t),
	} as CSSProperties;
}

/** Key order and undefined keys never decide sameness. */
function canon(x: unknown): unknown {
	if (Array.isArray(x)) return x.map(canon);
	if (x && typeof x === "object")
		return Object.fromEntries(
			Object.keys(x as Record<string, unknown>)
				.sort()
				.filter((k) => (x as Record<string, unknown>)[k] !== undefined)
				.map((k) => [k, canon((x as Record<string, unknown>)[k])]),
		);
	return x;
}
export function sameTheme(a: ChatTheme, b: ChatTheme): boolean {
	return JSON.stringify(canon(a)) === JSON.stringify(canon(b));
}
