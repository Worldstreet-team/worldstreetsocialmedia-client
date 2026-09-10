"use client";

/**
 * User preferences: the schema, the defaults, and how they reach the page.
 *
 * The settings audit (2026-09-10) put "sync my settings to my account" above
 * every individual setting, because until preferences live on the profile
 * every control in the app is a lie on a second device. So: one tree,
 * namespaced, stored on the gateway, cached in localStorage for a
 * flash-free first paint, and reconciled on load.
 *
 * The accessibility ones are stamped onto <html> as data attributes and CSS
 * variables BEFORE first paint (the inline script in app/layout.tsx reads
 * the same cache), because text size and contrast changing after paint is
 * a layout jump in the face of exactly the person who can least afford it.
 */

// The cache key and the pre-paint script live in a NON-client module, so
// the server component that renders the inline <script> can import them.
export { PREFS_CACHE_KEY, PREPAINT_PREFS } from "./preferences-prepaint";
import { PREFS_CACHE_KEY } from "./preferences-prepaint";

/* ------------------------------------------------------------------ */
/* Schema */

export type TextScale = "auto" | 90 | 100 | 110 | 125 | 150 | 175;
export type ColorVision = "off" | "deuteran" | "protan" | "tritan" | "achroma";
export type TriState = "auto" | "on" | "off";
export type Appearance = "dark" | "light" | "system";
export type Autoplay = "always" | "saver" | "never";

export interface Preferences {
	a11y: {
		/** Multiplier for every text size. "auto" follows the device. */
		textScale: TextScale;
		/** Retints the theme off the hue axis the viewer cannot separate. */
		colorVision: ColorVision;
		/** Symbols and labels alongside colour, never colour alone. */
		nonColorCues: boolean;
		contrast: TriState;
		reduceMotion: TriState;
		reduceTransparency: boolean;
		boldText: boolean;
		underlineLinks: boolean;
		/** A second multiplier scoped to chat, on top of textScale. */
		chatTextScale: "match" | 100 | 115 | 130 | 150 | 175;
	};
	appearance: {
		mode: Appearance;
	};
	data: {
		saver: boolean;
		autoplay: Autoplay;
	};
}

export const DEFAULTS: Preferences = {
	a11y: {
		// "auto" is the honest default: the person already told their phone
		// how big they need type. Reading that beats making them ask twice.
		textScale: "auto",
		colorVision: "off",
		nonColorCues: false,
		contrast: "auto",
		reduceMotion: "auto",
		reduceTransparency: false,
		boldText: false,
		underlineLinks: false,
		chatTextScale: "match",
	},
	appearance: { mode: "dark" },
	data: { saver: false, autoplay: "always" },
};

/* ------------------------------------------------------------------ */
/* Normalising */

const SCALES: TextScale[] = ["auto", 90, 100, 110, 125, 150, 175];
const CHAT_SCALES = ["match", 100, 115, 130, 150, 175] as const;
const oneOf = <T,>(list: readonly T[], v: unknown, d: T): T =>
	(list as readonly unknown[]).includes(v) ? (v as T) : d;
const bool = (v: unknown, d: boolean) => (typeof v === "boolean" ? v : d);

/** Anything off the wire or out of the cache becomes a whole tree. */
export function normalizePrefs(raw: unknown): Preferences {
	const p = (raw ?? {}) as Partial<Preferences>;
	const a = (p.a11y ?? {}) as Partial<Preferences["a11y"]>;
	const ap = (p.appearance ?? {}) as Partial<Preferences["appearance"]>;
	const d = (p.data ?? {}) as Partial<Preferences["data"]>;
	return {
		a11y: {
			textScale: oneOf(SCALES, a.textScale, DEFAULTS.a11y.textScale),
			colorVision: oneOf(
				["off", "deuteran", "protan", "tritan", "achroma"] as const,
				a.colorVision,
				DEFAULTS.a11y.colorVision,
			),
			nonColorCues: bool(a.nonColorCues, DEFAULTS.a11y.nonColorCues),
			contrast: oneOf(["auto", "on", "off"] as const, a.contrast, DEFAULTS.a11y.contrast),
			reduceMotion: oneOf(["auto", "on", "off"] as const, a.reduceMotion, DEFAULTS.a11y.reduceMotion),
			reduceTransparency: bool(a.reduceTransparency, DEFAULTS.a11y.reduceTransparency),
			boldText: bool(a.boldText, DEFAULTS.a11y.boldText),
			underlineLinks: bool(a.underlineLinks, DEFAULTS.a11y.underlineLinks),
			chatTextScale: oneOf(CHAT_SCALES, a.chatTextScale, DEFAULTS.a11y.chatTextScale),
		},
		appearance: {
			mode: oneOf(["dark", "light", "system"] as const, ap.mode, DEFAULTS.appearance.mode),
		},
		data: {
			saver: bool(d.saver, DEFAULTS.data.saver),
			autoplay: oneOf(["always", "saver", "never"] as const, d.autoplay, DEFAULTS.data.autoplay),
		},
	};
}

/* ------------------------------------------------------------------ */
/* Painting */

/**
 * Resolve `auto` against the device, then stamp the tree onto <html>.
 *
 * Shared verbatim with the pre-paint script in app/layout.tsx — if this
 * changes, change PREPAINT below with it, or a reload will flash.
 */
export function applyPrefsToDocument(p: Preferences) {
	if (typeof document === "undefined") return;
	const h = document.documentElement;
	const mq = (q: string) => window.matchMedia?.(q).matches ?? false;

	// Text size. "auto" reads the browser's own default font size, which is
	// what a phone's display-size setting moves; 16px means "unchanged".
	let scale =
		p.a11y.textScale === "auto"
			? Math.round(
					(Number.parseFloat(
						getComputedStyle(h).getPropertyValue("--ws-root-fs") || "16",
					) || 16) / 0.16,
				) / 100
			: p.a11y.textScale / 100;
	scale = Math.max(0.9, Math.min(1.75, scale));
	h.style.setProperty("--ws-fs", String(scale));

	const chat =
		p.a11y.chatTextScale === "match" ? 1 : p.a11y.chatTextScale / 100;
	h.style.setProperty("--ws-fs-chat", String(chat));

	const on = (v: TriState, query: string) =>
		v === "on" || (v === "auto" && mq(query));
	h.dataset.wsContrast = on(p.a11y.contrast, "(prefers-contrast: more)")
		? "more"
		: "";
	h.dataset.wsMotion = on(p.a11y.reduceMotion, "(prefers-reduced-motion: reduce)")
		? "reduce"
		: "";
	h.dataset.wsCv = p.a11y.colorVision === "off" ? "" : p.a11y.colorVision;
	// A retint alone cannot fix a hue-only signal, so any colour-vision mode
	// forces the redundant encoding on (the audit's finding, and iOS's rule).
	h.dataset.wsCues =
		p.a11y.nonColorCues || p.a11y.colorVision !== "off" ? "1" : "";
	h.dataset.wsBold = p.a11y.boldText ? "1" : "";
	h.dataset.wsFlat = p.a11y.reduceTransparency ? "1" : "";
	h.dataset.wsUnderline =
		p.a11y.underlineLinks || p.a11y.colorVision !== "off" ? "1" : "";
	h.dataset.wsSaver = p.data.saver ? "1" : "";

	for (const k of Object.keys(h.dataset)) {
		if (k.startsWith("ws") && h.dataset[k] === "") delete h.dataset[k];
	}
}
