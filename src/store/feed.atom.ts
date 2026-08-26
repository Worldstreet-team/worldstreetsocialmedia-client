import { atom } from "jotai";
import { PostProps } from "@/components/feed/PostCard";

interface FeedState {
	posts: PostProps[];
	cursor: string | null;
	hasMore: boolean;
	scrollPosition: number;
}

export const feedAtom = atom<FeedState>({
	posts: [],
	cursor: null,
	hasMore: true,
	scrollPosition: 0,
});
