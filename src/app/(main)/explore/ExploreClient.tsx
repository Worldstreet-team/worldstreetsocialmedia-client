"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MagnifyingGlass, X } from "@phosphor-icons/react";
import { Compass } from "lucide-react";
import { searchUsersAction, followUserAction } from "@/lib/user.actions";
import { searchPostsAction } from "@/lib/post.actions";
import { joinSpaceAction } from "@/lib/space.actions";
import { toggleCommunityAction } from "@/lib/community.actions";
import { PostCard, type PostProps } from "@/components/feed/PostCard";
import { PostSkeleton } from "@/components/feed/PostSkeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Tabs } from "@/components/ui/Tabs";
import { useToast } from "@/components/ui/Toast/ToastContext";
import { useT } from "@/i18n/client";
import { mapApiPost } from "@/lib/post-mapper";
import { useAtom } from "jotai";
import { followingIdsAtom } from "@/store/ui.atom";
import type { SpaceRow } from "@/components/voice/SpaceCard";

import { useExploreData } from "@/components/explore/useExploreData";
import { LiveStrip } from "@/components/explore/LiveStrip";
import { VoiceStrip } from "@/components/explore/VoiceStrip";
import { StreetGrid } from "@/components/explore/StreetGrid";
import { TopicBrowser } from "@/components/explore/TopicBrowser";
import { TrendingList } from "@/components/explore/TrendingList";
import { CommunityStrip, type CommunityRow } from "@/components/explore/CommunityStrip";
import { PeopleStrip } from "@/components/explore/PeopleStrip";
import {
  SearchResults,
  type SearchTab,
  type UserResult,
} from "@/components/explore/SearchResults";

/**
 * Explore.
 *
 * Discovery is ordered by decay: what is happening right now first (live,
 * voice, street), then evergreen browsing (topics, trending), then
 * graph-building (communities, people), then reading (popular).
 *
 * Sections that have nothing to show render nothing at all — an empty
 * section is worse than no section.
 *
 * Typing replaces the entire stack with results rather than interleaving,
 * so search never competes with discovery for the same screen.
 */
export default function ExploreClient({
  initialResults,
  initialQuery,
}: {
  initialResults: UserResult[];
  initialQuery: string;
}) {
  const t = useT();
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState(initialQuery);
  const [tab, setTab] = useState<SearchTab>("top");
  /**
   * Adopt a NEW `initialQuery` when one actually arrives.
   *
   * `useState(initialQuery)` reads the prop once, on mount. Clicking a trend
   * navigates to /explore?q=… while this component is already mounted, so
   * React reuses the instance: the server re-renders with the new `q` and the
   * state ignores it. First trend worked (arriving from another page mounts
   * fresh), every trend after it changed the URL and nothing else.
   *
   * Compared against a ref of what we last adopted, NOT against `query` —
   * typing deliberately drives the URL through history.replaceState, so
   * `query` and `initialQuery` diverge constantly while someone types, and
   * comparing them would wipe the box mid-word.
   */
  const adoptedQueryRef = useRef(initialQuery);
  useEffect(() => {
    if (initialQuery === adoptedQueryRef.current) return;
    adoptedQueryRef.current = initialQuery;
    setQuery(initialQuery);
  }, [initialQuery]);
  const [userResults, setUserResults] = useState<UserResult[]>(initialResults);
  const [usersLoading, setUsersLoading] = useState(false);
  const [postResults, setPostResults] = useState<PostProps[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [followingIds, setFollowingIds] = useAtom(followingIdsAtom);

  const {
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
    retryTrends,
  } = useExploreData();

  const searchUsers = useCallback(async (q: string) => {
    setUsersLoading(true);
    try {
      const res = await searchUsersAction(q);
      setUserResults(res.success ? res.data : []);
    } catch {
      setUserResults([]);
    } finally {
      setUsersLoading(false);
    }
  }, []);

  const searchPosts = useCallback(async (q: string) => {
    setPostsLoading(true);
    try {
      const res = await searchPostsAction(q);
      setPostResults(
        res.success
          ? res.data.map(mapApiPost)
          : [],
      );
    } catch {
      setPostResults([]);
    } finally {
      setPostsLoading(false);
    }
  }, []);

  /**
   * Keep the search term in the URL without going through the router.
   *
   * Two things this must not do, both of which it used to:
   *
   * 1. Pass `null` as the state. The App Router keeps its own tree in
   *    `window.history.state`; nulling it leaves the entry with no router
   *    state, and a later back/forward then restores the wrong page —
   *    which is why leaving explore could bounce you back to it. Pass the
   *    existing state straight through instead.
   * 2. Hardcode "/explore". Locale-prefixed paths (/es/explore) are a
   *    rewrite in proxy.ts, so a literal path silently dropped the prefix.
   *    location.pathname already carries it.
   */
  const syncUrl = useCallback((url: string) => {
    window.history.replaceState(window.history.state, "", url);
  }, []);

  useEffect(() => {
    const trimmed = query.trim();

    if (!trimmed) {
      setUserResults([]);
      setPostResults([]);
      setUsersLoading(false);
      setPostsLoading(false);
      syncUrl(window.location.pathname);
      return;
    }

    setUsersLoading(true);
    setPostsLoading(true);

    const handler = setTimeout(() => {
      syncUrl(
        `${window.location.pathname}?q=${encodeURIComponent(trimmed)}`,
      );
      void searchUsers(trimmed);
      void searchPosts(trimmed);
    }, 400);

    return () => clearTimeout(handler);
  }, [query, searchUsers, searchPosts, syncUrl]);

  /** Every entry point into search goes through here. */
  const runSearch = useCallback((term: string) => {
    setQuery(term);
    setTab("posts");
    inputRef.current?.focus();
  }, []);

  const remindSpace = useCallback(
    async (row: SpaceRow) => {
      const res = await joinSpaceAction(row.id);
      if (res.success) toast(t("voice.reminded"));
    },
    [toast, t],
  );

  const joinCommunity = useCallback(
    async (row: CommunityRow) => {
      setCommunities((prev) =>
        prev.map((c) => (c.id === row.id ? { ...c, joined: true } : c)),
      );
      const res = await toggleCommunityAction(row.id, true);
      if (!res.success) {
        setCommunities((prev) =>
          prev.map((c) => (c.id === row.id ? { ...c, joined: false } : c)),
        );
        toast(res.message ?? "Could not join", { type: "error" });
      }
    },
    [setCommunities, toast],
  );

  const follow = useCallback(
    async (id: string) => {
      setFollowingIds((prev) => [...prev, id]);
      const res = await followUserAction(id);
      if (!res.success) {
        setFollowingIds((prev) => prev.filter((x) => x !== id));
        toast(t("rail.followFailed"), { type: "error" });
      }
    },
    [setFollowingIds, toast, t],
  );

  const isSearching = query.trim().length > 0;
  const unfollowed = people.filter((u) => !followingIds.includes(u._id));

  return (
    <div className="w-full min-w-0 pb-nav md:pb-10">
      <div className="animate-rise px-4 pt-6" style={{ animationDelay: "40ms" }}>
        <span className="block font-sans text-[11px] font-bold uppercase tracking-[0.16em] text-gold">
          {t("explore.eyebrow")}
        </span>
        <h1 className="mt-1 font-display text-[24px] font-semibold leading-none text-primary">
          {t("nav.explore")}
        </h1>
      </div>

      <div className="sticky top-0 z-sticky bg-page md:top-0">
        <div className="px-4 pb-3 pt-3">
          <div className="group relative">
            <MagnifyingGlass
              size={16}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-subtle transition-colors group-focus-within:text-primary"
            />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("explore.placeholder")}
              // text-base on mobile or iOS Safari zooms the page on focus.
              className="h-10 w-full rounded-pill bg-chip pl-10 pr-11 font-sans text-base text-primary outline-none transition-colors placeholder:text-subtle focus:bg-raised sm:text-[14px]"
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  inputRef.current?.focus();
                }}
                aria-label={t("explore.clear")}
                className="absolute right-0 top-1/2 flex h-10 w-10 -translate-y-1/2 cursor-pointer items-center justify-center rounded-pill text-subtle transition-colors hover:text-primary"
              >
                <X size={14} weight="bold" />
              </button>
            )}
          </div>
        </div>

        {isSearching && (
          <Tabs
            items={[
              { key: "top" as const, label: t("explore.tab.top") },
              { key: "users" as const, label: t("explore.tab.users") },
              { key: "posts" as const, label: t("explore.tab.posts") },
            ]}
            value={tab}
            onChange={setTab}
            ariaLabel={t("nav.explore")}
          />
        )}

        <div className="h-px bg-hairline" />
      </div>

      {isSearching ? (
        <SearchResults
          query={query}
          tab={tab}
          users={userResults}
          usersLoading={usersLoading}
          posts={postResults}
          postsLoading={postsLoading}
          onPickTopic={runSearch}
        />
      ) : (
        <>
          <LiveStrip delay={100} />

          <VoiceStrip
            live={spaces.live}
            upcoming={spaces.upcoming}
            loading={loading.spaces}
            onRemind={remindSpace}
            delay={160}
          />

          <StreetGrid posts={street} loading={loading.street} delay={220} />

          <TopicBrowser onPick={runSearch} delay={280} />

          {/* Trending lives in the right rail — but that rail is hidden below
              lg, which left trending unreachable on a phone entirely. Render
              it here for exactly those widths, so it still never appears
              twice on one screen. */}
          <div className="lg:hidden">
            <TrendingList
              trends={trends}
              loading={loading.trends}
              failed={trendsFailed}
              onRetry={retryTrends}
              onPick={runSearch}
              delay={340}
            />
          </div>

          <CommunityStrip
            communities={communities}
            loading={loading.communities}
            onJoin={joinCommunity}
            delay={400}
          />

          <PeopleStrip
            people={unfollowed}
            loading={loading.people}
            onFollow={follow}
            delay={460}
          />

          <section
            className="animate-rise mt-8 border-t border-hairline"
            style={{ animationDelay: "520ms" }}
          >
            <h2 className="px-4 py-3 font-sans text-[11px] font-semibold uppercase tracking-[0.14em] text-subtle">
              {t("explore.section.popular")}
            </h2>
            {loading.trends ? (
              [0, 1, 2].map((i) => <PostSkeleton key={i} />)
            ) : popularPosts.length === 0 ? (
              <EmptyState
                icon={Compass}
                title={t("explore.emptyTitle")}
                caption={t("explore.emptyCaption")}
              />
            ) : (
              popularPosts.map((post) => (
                <div key={post.id} className="border-b border-hairline">
                  <PostCard post={post} />
                </div>
              ))
            )}
          </section>
        </>
      )}
    </div>
  );
}
