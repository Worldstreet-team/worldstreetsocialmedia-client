"use client";

import { cacheKeys, fetchCached } from "@/lib/cache";

/** Same window the right rail uses — they are reading the same two endpoints. */
const SHARED_TTL = 5 * 60_000;

import { useAtom } from "jotai";
import { useCallback, useEffect, useRef, useState } from "react";
import { getExploreDataAction } from "@/lib/post.actions";
import { getSpacesAction } from "@/lib/space.actions";
import { getCommunitiesAction } from "@/lib/community.actions";
import { getVideoFeedAction } from "@/lib/feed.actions";
import { getWhoToFollowAction } from "@/lib/user.actions";
import {
  exploreFetchedAtAtom,
  popularPostsAtom,
  popularPostsLoadedAtom,
  trendsAtom,
  trendsLoadedAtom,
} from "@/store/trends.atom";
import { suggestionsAtom, suggestionsLoadedAtom } from "@/store/suggestions.atom";
import { mapApiPost } from "@/lib/post-mapper";
import type { SpaceRow } from "@/components/voice/SpaceCard";
import type { CommunityRow } from "./CommunityStrip";
import type { StreetPost } from "./StreetGrid";

/**
 * Every discovery section's data, fetched on mount.
 *
 * Trends and Popular are cached in atoms so a revisit paints instantly, but
 * the cache is time-boxed: past EXPLORE_TTL_MS the page refetches in the
 * background and swaps the results in. Without that the cached copy lived for
 * the whole tab session and Explore showed the same posts all day.
 *
 * allSettled and a per-section loading flag, not one page-level spinner: the
 * gateway is a cold-start instance and one slow call must not blank a page
 * with eight independent blocks on it.
 *
 * Live is deliberately absent. useLiveNow owns its own Ably subscription and
 * poll, so batching it here would only add a second source of truth.
 */
/** How long cached Explore data is considered current. */
const EXPLORE_TTL_MS = 3 * 60 * 1000;

export function useExploreData() {
  const [trends, setTrends] = useAtom(trendsAtom);
  const [trendsLoaded, setTrendsLoaded] = useAtom(trendsLoadedAtom);
  const [popularPosts, setPopularPosts] = useAtom(popularPostsAtom);
  const [popularLoaded, setPopularLoaded] = useAtom(popularPostsLoadedAtom);
  const [people, setPeople] = useAtom(suggestionsAtom);
  const [peopleLoaded, setPeopleLoaded] = useAtom(suggestionsLoadedAtom);
  const [fetchedAt, setFetchedAt] = useAtom(exploreFetchedAtAtom);

  const [spaces, setSpaces] = useState<{ live: SpaceRow[]; upcoming: SpaceRow[] }>({
    live: [],
    upcoming: [],
  });
  const [communities, setCommunities] = useState<CommunityRow[]>([]);
  const [street, setStreet] = useState<StreetPost[]>([]);

  const [loading, setLoading] = useState({
    trends: !trendsLoaded,
    spaces: true,
    communities: true,
    street: true,
    people: !peopleLoaded,
  });
  const [trendsFailed, setTrendsFailed] = useState(false);

  const fetchTrends = useCallback(async () => {
    setLoading((l) => ({ ...l, trends: true }));
    setTrendsFailed(false);
    const res = await fetchCached(
      cacheKeys.exploreData(),
      getExploreDataAction,
      SHARED_TTL,
    );
    if (res.success) {
      // The gateway shape is not guaranteed; guard both arrays.
      setTrends(res.data?.trendsForYou ?? []);
      setPopularPosts(
        (res.data?.popularTweets ?? []).map(mapApiPost),
      );
      setTrendsLoaded(true);
      setPopularLoaded(true);
      setFetchedAt(Date.now());
    } else {
      setTrendsFailed(true);
    }
    setLoading((l) => ({ ...l, trends: false }));
  }, [setTrends, setPopularPosts, setTrendsLoaded, setPopularLoaded, setFetchedAt]);

  const ran = useRef(false);
  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    // Cold: fetch and show the spinner. Warm but stale: keep the cached
    // paint on screen and refresh underneath it — a revisit should never
    // flash skeletons over data that is merely a few minutes old.
    const stale = Date.now() - fetchedAt > EXPLORE_TTL_MS;
    if (!trendsLoaded || !popularLoaded) {
      void fetchTrends();
    } else {
      setLoading((l) => ({ ...l, trends: false }));
      if (stale) void fetchTrends();
    }

    void getSpacesAction().then((res) => {
      if (res.success) setSpaces({ live: res.live ?? [], upcoming: res.upcoming ?? [] });
      setLoading((l) => ({ ...l, spaces: false }));
    });

    void getCommunitiesAction().then((res) => {
      if (res.success) setCommunities(res.communities ?? []);
      setLoading((l) => ({ ...l, communities: false }));
    });

    void getVideoFeedAction(null, 6).then((res) => {
      if (res.success) setStreet(res.data?.posts ?? []);
      setLoading((l) => ({ ...l, street: false }));
    });

    if (!peopleLoaded || stale) {
      void fetchCached(
        cacheKeys.whoToFollow(),
        getWhoToFollowAction,
        SHARED_TTL,
      ).then((res) => {
        if (res.success) {
          setPeople(res.data ?? []);
          setPeopleLoaded(true);
        }
        setLoading((l) => ({ ...l, people: false }));
      });
    } else {
      setLoading((l) => ({ ...l, people: false }));
    }
  }, [
    fetchTrends,
    trendsLoaded,
    popularLoaded,
    peopleLoaded,
    fetchedAt,
    setPeople,
    setPeopleLoaded,
  ]);

  return {
    trends,
    popularPosts,
    people,
    setPeople,
    spaces,
    communities,
    setCommunities,
    street,
    loading,
    trendsFailed,
    retryTrends: fetchTrends,
  };
}
