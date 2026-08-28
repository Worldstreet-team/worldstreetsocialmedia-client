import { atom } from "jotai";
import type { PostProps } from "@/components/feed/PostCard";
import type { RailCommunity } from "@/components/community/MyCommunitiesRail";
import type { DiscoverCommunity } from "@/components/community/DiscoverRow";

/**
 * Communities, cached app-wide — same idiom as trends.atom.
 *
 * Two caches because the page has two data sources:
 *
 * - Home (`/api/communities/home`): the joined-communities rail plus the
 *   aggregated timeline, including the pagination cursor so "load more"
 *   pages survive a navigation away and back.
 * - Directory (`/api/communities`): the discover list, which Explore's
 *   CommunityStrip also reads (`DiscoverCommunity` is a superset of the
 *   strip's `CommunityRow`), so either surface warms the other.
 *
 * `null` home / `loaded: false` directory = never fetched this session —
 * the only time a skeleton is allowed. After that, revisits render the
 * cached copy immediately and revalidate underneath.
 */
export interface CommunityHomeCache {
  mine: RailCommunity[];
  posts: PostProps[];
  cursor: string | null;
  hasMore: boolean;
}

export const communityHomeAtom = atom<CommunityHomeCache | null>(null);
/** Epoch ms of the last successful home fetch (0 = never). */
export const communityHomeFetchedAtAtom = atom<number>(0);

export const communityDirAtom = atom<DiscoverCommunity[]>([]);
export const communityDirLoadedAtom = atom<boolean>(false);
/** Epoch ms of the last successful directory fetch (0 = never). */
export const communityDirFetchedAtAtom = atom<number>(0);
