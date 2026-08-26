import { atom } from "jotai";
import { type PostProps } from "@/components/feed/PostCard";

export interface TrendingTopic {
	title: string;
	startVolume: number;
	category: string;
	posts: string;
	/** Numeric twin of `posts`, so the card can size the figure itself. */
	postsCount?: number;
	/** Up to five distinct posters, for the stacked faces. */
	people?: { username: string; avatar?: string }[];
	/** Total distinct posters, which drives the +n. */
	peopleCount?: number;
}

export const trendsAtom = atom<TrendingTopic[]>([]);
export const trendsLoadedAtom = atom<boolean>(false);
/**
 * When Explore's data was last fetched (epoch ms, 0 = never).
 *
 * The loaded flags alone made the cache permanent for the life of the tab:
 * once true, Explore never refetched, so trends and Popular were frozen at
 * whatever they were the first time you opened the page. This timestamp lets
 * the cache serve an instant paint on revisit while still going back for
 * fresh data once it is stale.
 */
export const exploreFetchedAtAtom = atom<number>(0);

export const popularPostsAtom = atom<PostProps[]>([]);
export const popularPostsLoadedAtom = atom<boolean>(false);
