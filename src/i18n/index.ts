import en from "./dictionaries/en.json";
import es from "./dictionaries/es.json";
import fr from "./dictionaries/fr.json";
import pt from "./dictionaries/pt.json";
import de from "./dictionaries/de.json";
import { DEFAULT_LOCALE, type Locale } from "./config";

export type Dict = Record<string, string>;

const DICTIONARIES: Record<Locale, Dict> = { en, es, fr, pt, de };

export function getDict(locale: Locale | string | undefined): Dict {
	return DICTIONARIES[(locale as Locale) ?? DEFAULT_LOCALE] ?? DICTIONARIES.en;
}

/**
 * Translate with English fallback — a missing key never renders blank, it
 * renders English, so an incomplete catalog degrades gracefully instead of
 * breaking a locale.
 */
export function translate(dict: Dict, key: string): string {
	return dict[key] ?? DICTIONARIES.en[key] ?? key;
}

export { LOCALES, DEFAULT_LOCALE, isLocale } from "./config";
export type { Locale } from "./config";
