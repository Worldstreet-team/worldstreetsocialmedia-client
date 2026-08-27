import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";

// X-style auto-translate: when on, the feed translates posts in the
// background as they load, so a card is already in the reader's language
// the first time they see it.
/**
 * Auto-translate defaults ON.
 *
 * Cheap by construction, which is why it can be the default: the gateway
 * detects language locally first, so a post already in the reader's language
 * costs nothing and never reaches a provider. Everything else is cached by
 * (text-hash, target) — a viral French post is translated ONCE and that one
 * result serves every English reader after it. The marginal cost is per
 * unique post-and-language pair, not per view.
 *
 * Readers still get the original: a translated post shows "Show original",
 * and the whole behaviour is one toggle away in the post menu.
 */
export const autoTranslateAtom = atomWithStorage<boolean>(
  "ws-auto-translate",
  true,
);

export interface TranslationEntry {
  translated?: string;
  source?: string;
  sameLanguage: boolean;
}

/**
 * Post id → translation, filled by the feed's background prefetch and read
 * by PostCard. Cards render straight from this: no per-card round trip, no
 * "Translating…" in front of the reader.
 *
 * Session-scoped on purpose. The gateway already caches translations in
 * Mongo by (text, target), so a reload is cheap; persisting them here would
 * mean invalidating on every locale switch for no real gain.
 */
export const translationsAtom = atom<Record<string, TranslationEntry>>({});
