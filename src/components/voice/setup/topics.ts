import { VERTICALS, type VerticalId } from "@/data/categories";
import { CATEGORY_BY_ID, classifyText } from "@/lib/categories";

/** Shown when the title gives nothing away: the app's busiest rooms. */
const FALLBACK: VerticalId[] = ["markets", "business", "news", "tech"];

/**
 * A room's topic is a VERTICAL (the directory's chips filter on the 14),
 * so the title's categories are mapped up to theirs.
 *
 * `matched` are real reads of the text, best first, and the first of them
 * becomes the topic until the host picks one. `shown` is always three:
 * the matches, then the fallbacks, so the row never looks empty.
 *
 * A title is short, so one solid word is enough to suggest (score 2, where
 * the composer's floor is 3); a wrong guess here costs one tap to change.
 */
export function suggestVerticals(text: string): {
  matched: VerticalId[];
  shown: VerticalId[];
} {
  const matched: VerticalId[] = [];
  for (const m of classifyText(text, { limit: 8, minScore: 2 })) {
    const v = CATEGORY_BY_ID.get(m.id)?.vertical;
    if (v && !matched.includes(v)) matched.push(v);
  }
  const shown = matched.slice(0, 3);
  for (const v of FALLBACK) {
    if (shown.length >= 3) break;
    if (!shown.includes(v)) shown.push(v);
  }
  return { matched: matched.slice(0, 3), shown };
}

/** A topic in words. Rooms made before topics were verticals may carry a category id. */
export const verticalLabel = (id: string) =>
  VERTICALS.find((v) => v.id === id)?.label ?? CATEGORY_BY_ID.get(id)?.label ?? "";
