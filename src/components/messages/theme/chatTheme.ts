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
	type: "flat" | "preset" | "image";
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

/** Outer radius and the inner run corner, per shape (owner's 22/8 is Rounded). */
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

/** What a chat looks like before anyone opens the editor. */
export const HOUSE_DEFAULT: Record<ThemeMode, ChatTheme> = {
	dark: {
		wallpaper: { type: "preset", preset: "forest", frost: 60, hue: "cyan", dim: 25 },
		bubbles: HOUSE_BUBBLES,
	},
	light: {
		wallpaper: { type: "preset", preset: "mist", frost: 50, hue: "none", dim: 0 },
		bubbles: HOUSE_BUBBLES,
	},
};

const fill = (id: string): MineFill =>
	MINE_PRESETS.find((p) => p.id === id)?.fill ?? TIDE;

/** The gallery: finished wallpaper + bubble pairings, one tap each. */
export const THEME_CARDS: {
	id: string;
	label: string;
	dark: ChatTheme;
	light: ChatTheme;
}[] = [
	{ id: "tide", label: "Tide", dark: HOUSE_DEFAULT.dark, light: HOUSE_DEFAULT.light },
	{
		id: "forest",
		label: "Forest",
		dark: {
			wallpaper: { type: "preset", preset: "fogwood", frost: 40, hue: "cyan", dim: 30 },
			bubbles: { mine: fill("moss"), theirs: { color: "#1B2A30" }, shape: "rounded" },
		},
		light: {
			wallpaper: { type: "preset", preset: "lonetree", frost: 40, hue: "none", dim: 0 },
			bubbles: { mine: fill("moss"), theirs: { color: "#DCE4E7" }, shape: "rounded" },
		},
	},
	{
		id: "night",
		label: "Night",
		dark: {
			wallpaper: { type: "preset", preset: "milkyway", frost: 30, hue: "none", dim: 20 },
			bubbles: { mine: fill("nebula"), theirs: { color: "#2B2B2B" }, shape: "soft" },
		},
		light: {
			wallpaper: { type: "preset", preset: "pier", frost: 40, hue: "none", dim: 0 },
			bubbles: { mine: fill("nebula"), theirs: { color: "#E9E6E1" }, shape: "soft" },
		},
	},
	{
		id: "ember",
		label: "Ember",
		dark: {
			wallpaper: { type: "preset", preset: "dusk", frost: 50, hue: "none", dim: 30 },
			bubbles: { mine: fill("ember"), theirs: { color: HOUSE_THEIRS }, shape: "rounded" },
		},
		light: {
			wallpaper: { type: "preset", preset: "mist", frost: 60, hue: "none", dim: 0 },
			bubbles: { mine: fill("ember"), theirs: { color: HOUSE_THEIRS }, shape: "rounded" },
		},
	},
	{
		id: "paper",
		label: "Paper",
		dark: {
			wallpaper: { type: "flat", frost: 0, hue: "none", dim: 0 },
			bubbles: { mine: fill("cyan"), theirs: { color: HOUSE_THEIRS }, shape: "square" },
		},
		light: {
			wallpaper: { type: "flat", frost: 0, hue: "none", dim: 0 },
			bubbles: { mine: fill("cyan"), theirs: { color: HOUSE_THEIRS }, shape: "square" },
		},
	},
	{
		id: "flat",
		label: "Flat",
		dark: { wallpaper: { type: "flat", frost: 0, hue: "none", dim: 0 }, bubbles: HOUSE_BUBBLES },
		light: { wallpaper: { type: "flat", frost: 0, hue: "none", dim: 0 }, bubbles: HOUSE_BUBBLES },
	},
];

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
	const type: ThemeWallpaper["type"] =
		w.type === "flat" || w.type === "preset" || w.type === "image"
			? w.type
			: d.wallpaper.type;
	return {
		wallpaper: {
			type,
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

/** The variables the thread and every bubble read. */
export function themeVars(t: ChatTheme): CSSProperties {
	const s = SHAPES[t.bubbles.shape];
	return {
		"--chat-mine": mineCss(t.bubbles.mine),
		"--chat-mine-ink": inkFor(t.bubbles.mine),
		"--chat-accent": accentOf(t.bubbles.mine),
		"--chat-theirs": t.bubbles.theirs.color,
		"--chat-theirs-ink": inkFor(t.bubbles.theirs.color),
		"--chat-r": `${s.r}px`,
		"--chat-r-in": `${s.rin}px`,
	} as CSSProperties;
}

export function sameTheme(a: ChatTheme, b: ChatTheme): boolean {
	return JSON.stringify(a) === JSON.stringify(b);
}
