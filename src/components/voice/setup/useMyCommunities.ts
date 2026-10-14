"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getMyCommunitiesAction, type MyCommunity } from "@/lib/community.actions";

/** Rows per page: the panel draws this many and asks for more near the end. */
export const COMMUNITY_PAGE = 40;
/** Typing settles this long before the gateway is asked. */
const DEBOUNCE_MS = 200;

type Page = {
  items: MyCommunity[];
  total: number;
  nextCursor: string | null;
};

export type CommunityResults = {
  /** The query these rows answer (trimmed). */
  query: string;
  items: MyCommunity[];
  total: number;
  /** More rows exist past `items`. */
  hasMore: boolean;
  /** Nothing has been answered yet: show the rows' shape. */
  loading: boolean;
  /** These rows answer an older query; the newer one is on its way. */
  stale: boolean;
  loadingMore: boolean;
  error: string | null;
};

/**
 * The host's own communities for the audience step: searched on the
 * gateway (ranked there), 40 a page, the next page on demand.
 *
 * - Typing is debounced 200ms; an answer to an older query is cached but
 *   never shown over a newer one (server actions run one at a time, so
 *   order is not the risk; a slow first page landing after a fast retype
 *   is).
 * - Each query's pages are kept for the life of the sheet, so backspacing
 *   to a query already seen paints at once.
 * - `recent` (up to six they were active in lately) only comes with the
 *   plain list's first page; it is held separately so the suggestions
 *   under the field survive a search.
 */
export function useMyCommunities(enabled: boolean) {
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [pages, setPages] = useState<Map<string, Page>>(() => new Map());
  const [recent, setRecent] = useState<MyCommunity[] | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<{ query: string; message: string } | null>(
    null,
  );
  const inflight = useRef(new Set<string>());
  const current = useRef(query);
  current.current = query;

  // Debounce what was typed into what is asked for. Clearing the field is
  // immediate: the plain list is almost always cached.
  useEffect(() => {
    const next = input.trim();
    if (next === current.current) return;
    const t = setTimeout(() => setQuery(next), next ? DEBOUNCE_MS : 0);
    return () => clearTimeout(t);
  }, [input]);

  const fetchPage = useCallback(
    async (q: string, cursor: string | null) => {
      const key = `${q}\u0000${cursor ?? ""}`;
      if (inflight.current.has(key)) return;
      inflight.current.add(key);
      if (cursor) setLoadingMore(true);
      const res = await getMyCommunitiesAction({
        q,
        cursor,
        limit: COMMUNITY_PAGE,
      });
      inflight.current.delete(key);
      if (cursor) setLoadingMore(false);
      if (!res.success) {
        setError({ query: q, message: res.message });
        return;
      }
      setError((e) => (e?.query === q ? null : e));
      if (!q && !cursor && res.recent) setRecent(res.recent);
      setPages((prev) => {
        const map = new Map(prev);
        const had = cursor ? map.get(q) : undefined;
        // A page for a cursor we no longer hold (the list was refetched)
        // is dropped rather than appended to the wrong list.
        if (cursor && !had) return prev;
        const seen = new Set(had?.items.map((c) => c.id));
        map.set(q, {
          items: [
            ...(had?.items ?? []),
            ...res.communities.filter((c) => !seen.has(c.id)),
          ],
          total: res.total,
          nextCursor: res.nextCursor,
        });
        return map;
      });
    },
    [],
  );

  // First page for each new query, unless it is already held.
  useEffect(() => {
    if (!enabled) return;
    if (pages.has(query)) return;
    void fetchPage(query, null);
  }, [enabled, query, pages, fetchPage]);

  // While a new query's first page is on its way, the last answered one
  // stays up (dimmed by the caller) instead of flashing to skeletons.
  const lastShown = useRef<string | null>(null);
  if (pages.has(query)) lastShown.current = query;
  const shown = pages.has(query)
    ? query
    : lastShown.current !== null && pages.has(lastShown.current)
      ? lastShown.current
      : null;
  const page = shown === null ? undefined : pages.get(shown);
  const loadMore = useCallback(() => {
    const p = pages.get(current.current);
    if (!p?.nextCursor || loadingMore) return;
    void fetchPage(current.current, p.nextCursor);
  }, [pages, loadingMore, fetchPage]);

  const retry = useCallback(() => {
    setError(null);
    const p = pages.get(current.current);
    void fetchPage(current.current, p?.nextCursor ?? null);
  }, [pages, fetchPage]);

  const failed = error?.query === query ? error.message : null;
  const results: CommunityResults = {
    query: shown ?? query,
    items: page?.items ?? [],
    total: page?.total ?? 0,
    hasMore: shown === query && Boolean(page?.nextCursor),
    loading: !page && !failed,
    stale: shown !== null && shown !== query && !failed,
    loadingMore,
    error: failed,
  };

  return {
    input,
    setInput,
    /** The typed text has not been asked for yet (the debounce is running). */
    settling: input.trim() !== query,
    results,
    /** The plain list's total: every community the host is in. */
    allTotal: pages.get("")?.total ?? null,
    recent: recent ?? [],
    recentLoaded: recent !== null || pages.has(""),
    loadMore,
    retry,
  };
}

