"use client";

import { createContext, useContext, useMemo } from "react";
import { getDict, translate, type Locale } from "@/i18n";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale } from "@/i18n/config";

const LocaleContext = createContext<Locale>(DEFAULT_LOCALE);

function readCookieLocale(): Locale {
	if (typeof document === "undefined") return DEFAULT_LOCALE;
	const m = document.cookie.match(new RegExp(`${LOCALE_COOKIE}=([a-z]{2})`));
	return m && isLocale(m[1]) ? m[1] : DEFAULT_LOCALE;
}

export function LocaleProvider({
	locale,
	children,
}: {
	locale?: Locale;
	children: React.ReactNode;
}) {
	// Server-provided locale wins (set by the middleware from the URL prefix);
	// the cookie covers client-only trees.
	const value = locale ?? readCookieLocale();
	return (
		<LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
	);
}

/** t("feed.tab.foryou") → localized string, English fallback. */
export function useT() {
	const locale = useContext(LocaleContext);
	return useMemo(() => {
		const dict = getDict(locale);
		const t = (key: string) => translate(dict, key);
		return Object.assign(t, { locale });
	}, [locale]);
}
