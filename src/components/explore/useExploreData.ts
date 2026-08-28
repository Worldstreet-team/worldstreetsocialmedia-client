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
  streetFetchedAtAtom,
  streetLoadedAtom,
  streetPostsAtom,
  trendsAtom,
  trendsLoadedAtom,
} from "@/store/trends.atom";
import {
  spacesFetchedAtAtom,
  spacesLiveAtom,
  spacesLoadedAtom,
  spacesUpcomingAtom,
} from "@/store/spaces.atom";
import {
  communityDirAtom,
  communityDirFetchedAtAtom,
  communityDirLoadedAtom,
} from "@/store/communities.atom";
import { suggestionsAtom, suggestionsLoadedAtom } from "@/store/suggestions.atom";
import { mapApiPost } from "@/lib/post-mapper";

/**
 * Every discovery section's data, stale-while-revalidate.
 *
 * All six sections are cached in atoms so a revisit paints instantly — a
 * skeleton is only allowed the genuinely first time a section loads this
 * session. Past EXPLORE_TTL_MS the page refetches *in the background* and
 * swaps the results in; the reader never waits and never sees a skeleton
 * over data that is merely a few minutes old. (Spaces are the exception to
 * the TTL: rooms go live and die in minutes, so a warm mount always
 * revalidates — just quietly.)
 *
 * allSettled-style per-section loading flags, not one page-level spinner:
 * the gateway is a cold-start instance and one slow call must not blank a
 * page with eight independent blocks on it.
 *
 * Live is deliberately absent. useLiveNow owns its own Ably subscription and
 * poll, so batching it here would only add a second source of truth.
 */
/** How long cached Explore data is considered current. */
const EXPLORE_TTL_MS = 5 * 60 * 1000;

export function useExploreData() {
  const [trends, setTrends] = useAtom(trendsAtom);
  const [trendsLoaded, setTrendsLoaded] = useAtom(trendsLoadedAtom);
  const [popularPosts, setPopularPosts] = useAtom(popularPostsAtom);
  const [popularLoaded, setPopularLoaded] = useAtom(popularPostsLoadedAtom);
  const [people, setPeople] = useAtom(suggestionsAtom);
  const [peopleLoaded, setPeopleLoaded] = useAtom(suggestionsLoadedAtom);
  const [fetchedAt, setFetchedAt] = useAtom(exploreFetchedAtAtom);

  const [liveSpaces, setLiveSpaces] = useAtom(spacesLiveAtom);
  const [upcomingSpaces, setUpcomingSpaces] = useAtom(spacesUpcomingAtom);
  const [spacesLoaded, setSpacesLoaded] = useAtom(spacesLoadedAtom);
  const [, setSpacesFetchedAt] = useAtom(spacesFetchedAtAtom);

  const [communities, setCommunities] = useAtom(communityDirAtom);
  const [communitiesLoaded, setCommunitiesLoaded] = useAtom(communityDirLoadedAtom);
  const [communitiesFetchedAt, setCommunitiesFetchedAt] = useAtom(
    communityDirFetchedAtAtom,
  );

  const [street, setStreet] = useAtom(streetPostsAtom);
  const [streetLoaded, setStreetLoaded] = useAtom(streetLoadedAtom);
  const [streetFetchedAt, setStreetFetchedAt] = useAtom(streetFetchedAtAtom);

  const [loading, setLoading] = useState({
    trends: !trendsLoaded,
    spaces: !spacesLoaded,
    communities: !communitiesLoaded,
    street: !streetLoaded,
    people: !peopleLoaded,
  });
  const [trendsFailed, setTrendsFailed] = useState(false);

  /**
   * `background` = a revalidation of data already on screen. It must NOT
   * flip the loading flag — doing so was exactly the bug that flashed
   * skeletons over warm data on every revisit past the TTL.
   */
  const fetchTrends = useCallback(
    async (background = false) => {
      if (!background) setLoading((l) => ({ ...l, trends: true }));
      setTrendsFailed(false);
      const res = await fetchCached(
        cacheKeys.exploreData(),
        getExploreDataAction,
        SHARED_TTL,
      );
      if (res.success) {
        // The gateway shape is not guaranteed; guard both arrays.
        setTrends(res.data?.trendsForYou ?? []);
        setPopularPosts((res.data?.popularTweets ?? []).map(mapApiPost));
        setTrendsLoaded(true);
        setPopularLoaded(true);
        setFetchedAt(Date.now());
      } else if (!background) {
        setTrendsFailed(true);
      }
      setLoading((l) => ({ ...l, trends: false }));
    },
    [setTrends, setPopularPosts, setTrendsLoaded, setPopularLoaded, setFetchedAt],
  );

  const ran = useRef(false);
  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const now = Date.now();
    const stale = now - fetchedAt > EXPLORE_TTL_MS;

    // Cold: fetch and show the skeleton. Warm but stale: keep the cached
    // paint on screen and refresh underneath it.
    if (!trendsLoaded || !popularLoaded) {
      void fetchTrends();
    } else if (stale) {
      void fetchTrends(true);
    }

    // Rooms decay in minutes, so a warm mount still revalidates — quietly.
    void getSpacesAction().then((res) => {
      if (res.success) {
        setLiveSpaces(res.live ?? []);
        setUpcomingSpaces(res.upcoming ?? []);
        setSpacesLoaded(true);
        setSpacesFetchedAt(Date.now());
      }
      setLoading((l) => ({ ...l, spaces: false }));
    });

    if (!communitiesLoaded || now - communitiesFetchedAt > EXPLORE_TTL_MS) {
      void getCommunitiesAction().then((res) => {
        if (res.success) {
          setCommunities(res.communities ?? []);
          setCommunitiesLoaded(true);
          setCommunitiesFetchedAt(Date.now());
        }
        setLoading((l) => ({ ...l, communities: false }));
      });
    }

    if (!streetLoaded || now - streetFetchedAt > EXPLORE_TTL_MS) {
      void getVideoFeedAction(null, 6).then((res) => {
        if (res.success) {
          setStreet(res.data?.posts ?? []);
          setStreetLoaded(true);
          setStreetFetchedAt(Date.now());
        }
        setLoading((l) => ({ ...l, street: false }));
      });
    }

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
    }
  }, [
    fetchTrends,
    trendsLoaded,
    popularLoaded,
    peopleLoaded,
    fetchedAt,
    communitiesLoaded,
    communitiesFetchedAt,
    streetLoaded,
    streetFetchedAt,
    setPeople,
    setPeopleLoaded,
    setLiveSpaces,
    setUpcomingSpaces,
    setSpacesLoaded,
    setSpacesFetchedAt,
    setCommunities,
    setCommunitiesLoaded,
    setCommunitiesFetchedAt,
    setStreet,
    setStreetLoaded,
    setStreetFetchedAt,
  ]);

  // The retry button hands its click event straight through; a wrapper keeps
  // that event from being read as `background = true`.
  const retryTrends = useCallback(() => void fetchTrends(false), [fetchTrends]);

  return {
    trends,
    popularPosts,
    people,
    setPeople,
    spaces: { live: liveSpaces, upcoming: upcomingSpaces },
    communities,
    setCommunities,
    street,
    loading,
    trendsFailed,
    retryTrends,
  };
}
