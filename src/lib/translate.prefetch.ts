"use client";

import { translatePostAction } from "@/lib/translate.actions";
import type { TranslationEntry } from "@/store/translate.atom";

/**
 * Translate a page of posts in the background, as they load, before the
 * reader reaches them.
 *
 * Bounded concurrency rather than a flat Promise.all: the gateway's
 * translate provider is an external keyless service, and firing a whole
 * page at it at once is how you earn a rate limit. Four in flight keeps a
 * 20-post page well under a second of wall clock while staying polite.
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

export async function prefetchTranslations(
  posts: { id: string; content?: string | null }[],
  isKnown: (id: string) => boolean,
  put: (id: string, entry: TranslationEntry) => void,
  concurrency = 4,
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

  let cursor = 0;
  const worker = async () => {
    while (cursor < queue.length) {
      const post = queue[cursor++];
      try {
        const res = await translatePostAction(post.content as string);
        if (res.success) {
          put(post.id, {
            translated: res.translated,
            source: res.source,
            sameLanguage: Boolean(res.sameLanguage),
          });
        }
      } catch {
        // A failed translation is not a failed feed — the card just
        // keeps its "Translate post" affordance.
      } finally {
        inFlight.delete(post.id);
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(concurrency, queue.length) }, worker),
  );
}
