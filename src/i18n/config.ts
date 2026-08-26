// Custom i18n — no third-party translation service.
//
// URL contract: every route accepts an optional locale prefix — /es/explore,
// /fr/messages — which the middleware strips via rewrite, so the app router
// keeps its existing structure. Bare URLs resolve from the ws_locale cookie,
// then Accept-Language, then English. The chosen locale rides to server
// components on the x-ws-locale request header and to the client in the
// cookie.

export const LOCALES = ["en", "es", "fr", "pt", "de"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "ws_locale";
export const LOCALE_HEADER = "x-ws-locale";

export function isLocale(value: string | undefined | null): value is Locale {
	return !!value && (LOCALES as readonly string[]).includes(value);
}

/** Split "/es/foo" → { locale: "es", pathname: "/foo" }; no prefix → nulls. */
export function splitLocalePath(pathname: string): {
	locale: Locale | null;
	pathname: string;
} {
	const seg = pathname.split("/")[1];
	if (isLocale(seg)) {
		const rest = pathname.slice(seg.length + 1) || "/";
		return { locale: seg, pathname: rest };
	}
	return { locale: null, pathname };
}

/** Best match from an Accept-Language header. */
export function negotiateLocale(header: string | null): Locale {
	if (!header) return DEFAULT_LOCALE;
	for (const part of header.split(",")) {
		const tag = part.split(";")[0].trim().toLowerCase().slice(0, 2);
		if (isLocale(tag)) return tag;
	}
	return DEFAULT_LOCALE;
}
