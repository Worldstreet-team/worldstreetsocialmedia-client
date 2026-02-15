import { atom } from "jotai";
import { type PostProps } from "@/components/feed/PostCard";

export interface TrendingTopic {
	title: string;
	startVolume: number;
	category: string;
	posts: string;
}

export const trendsAtom = atom<TrendingTopic[]>([]);
export const trendsLoadedAtom = atom<boolean>(false);

export const popularPostsAtom = atom<PostProps[]>([]);
export const popularPostsLoadedAtom = atom<boolean>(false);
