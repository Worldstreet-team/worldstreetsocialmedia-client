"use client";

import { translatePostsAction } from "@/lib/translate.actions";
import type { TranslationEntry } from "@/store/translate.atom";

/**
 * Translate a page of posts in the background, as it loads, before the
 * reader reaches it.
 *
 * One request per page, not one per post: the gateway's batch endpoint
 * resolves the whole page — local language detection first, then its cache,
 * then the provider — so a page of same-language posts now costs a single
 * round trip and zero provider calls.
 *
 * `inFlight` is module-level so two surfaces mounting at once (feed and a
 * post page) can't translate the same post twice.
 *
 * `attempted` is the retry-storm guard, and it is not optional. A failure
 * stores nothing, so without it every re-run of the caller's effect re-queues
 * the same posts forever — which is exactly what happened the first time this
 * ran against an exhausted provider quota: ten requests every nine seconds,
 * indefinitely. One attempt per post per session; a reload is the retry.
 */
const inFlight = new Set<string>();
const attempted = new Set<string>();

/** Matches the gateway's MAX_BATCH. Longer pages go out as several calls. */
const BATCH_SIZE = 30;

export async function prefetchTranslations(
  posts: { id: string; content?: string | null }[],
  isKnown: (id: string) => boolean,
  put: (id: string, entry: TranslationEntry) => void,
) {
  const queue = posts.filter(
    (p) =>
      p.content?.trim() &&
      !isKnown(p.id) &&
      !inFlight.has(p.id) &&
      !attempted.has(p.id),
  );
  if (queue.length === 0) return;
  for (const p of queue) {
    inFlight.add(p.id);
    attempted.add(p.id);
  }

  try {
    for (let i = 0; i < queue.length; i += BATCH_SIZE) {
      const chunk = queue.slice(i, i + BATCH_SIZE);
      // Guarded: a rejected action (transport error, timeout) must not take
      // out the prefetch or surface as an unhandled rejection. A page that
      // can't be translated is a page that stays in its original language.
      let res: Awaited<ReturnType<typeof translatePostsAction>>;
      try {
        res = await translatePostsAction(
          chunk.map((p) => ({ id: p.id, text: p.content as string })),
        );
      } catch {
        continue;
      }
      if (!res.success) continue;
      for (const post of chunk) {
        const entry = res.results[post.id];
        // Absent = the gateway couldn't resolve it. Leave the card alone;
        // its manual "Translate" affordance still works.
        if (!entry) continue;
        put(post.id, {
          translated: entry.translated,
          source: entry.source,
          sameLanguage: Boolean(entry.sameLanguage),
        });
      }
    }
  } finally {
    for (const p of queue) inFlight.delete(p.id);
  }
}
