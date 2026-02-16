import { atom } from "jotai";
import { PostProps } from "@/components/feed/PostCard";

export interface PostCache {
	[postId: string]: PostProps;
}

// Atom for caching individual posts by ID
// e.g. "msg_123" -> PostProps object
export const singlePostCacheAtom = atom<PostCache>({});

// Helper to update specific post in cache
export const updateSinglePostCacheAtom = atom(
	null,
	(get, set, { postId, post }: { postId: string; post: PostProps }) => {
		const currentCache = get(singlePostCacheAtom);
		set(singlePostCacheAtom, {
			...currentCache,
			[postId]: post,
		});
	},
);
