"use client";

/**
 * The thread wallpaper vocabulary — register items 47-50.
 *
 * A wallpaper is layers, Telegram-style: a fill (solid or gradient), the
 * brand doodle at whisper opacity, an optional user image (blurred via a
 * filter ON the image — never backdrop-blur), then a dim wash that solves
 * legibility over ANY picture with one div.
 */
export interface WallpaperSetting {
	type: "default" | "gradient" | "image" | "solid";
	value?: string;
	/** Presigned URL for image wallpapers, minted by the gateway. */
	valueUrl?: string;
	dim?: number;
	blur?: boolean;
}

export interface GradientPreset {
	id: string;
	label: string;
	/** Two stops keeps the rotate-on-send interpolation cheap. */
	stops: [string, string];
}

/** Gold-family and stone-family gradients only — the palette has no blue. */
export const GRADIENTS: GradientPreset[] = [
	{ id: "ember", label: "Ember", stops: ["#2a1d06", "#0C0A09"] },
	{ id: "dusk", label: "Dusk", stops: ["#231d15", "#141210"] },
	{ id: "moss", label: "Moss", stops: ["#101a14", "#0C0A09"] },
	{ id: "clay", label: "Clay", stops: ["#221410", "#0C0A09"] },
];

export const SOLIDS: { id: string; label: string; color: string }[] = [
	{ id: "stone", label: "Stone", color: "#0C0A09" },
	{ id: "ink", label: "Ink", color: "#121212" },
];

export function gradientById(id?: string): GradientPreset {
	return GRADIENTS.find((g) => g.id === id) ?? GRADIENTS[0];
}

export const DEFAULT_WALLPAPER: WallpaperSetting = { type: "default", dim: 0 };
