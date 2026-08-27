import { atom } from "jotai";
import { PostProps } from "@/components/feed/PostCard";

interface FeedState {
	posts: PostProps[];
	cursor: string | null;
	hasMore: boolean;
	scrollPosition: number;
	/**
	 * Which tab these posts were fetched for. The two tabs are different
	 * QUERIES on the gateway, not two views of one list, so remembering this is
	 * what stops a remount serving For-You posts under the Following tab.
	 */
	mode: "foryou" | "following";
}

export const feedAtom = atom<FeedState>({
	posts: [],
	cursor: null,
	hasMore: true,
	scrollPosition: 0,
	mode: "foryou",
});
