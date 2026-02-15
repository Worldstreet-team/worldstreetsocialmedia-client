import { atom } from "jotai";
import { PostProps } from "@/components/feed/PostCard";

interface FeedState {
	posts: PostProps[];
	page: number;
	hasMore: boolean;
	scrollPosition: number;
}

export const feedAtom = atom<FeedState>({
	posts: [],
	page: 1,
	hasMore: true,
	scrollPosition: 0,
});
