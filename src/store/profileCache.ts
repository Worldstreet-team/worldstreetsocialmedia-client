import { atom } from "jotai";
import { PostProps } from "@/components/feed/PostCard";

export interface ProfileData {
	_id: string;
	userId: string;
	firstName: string;
	lastName: string;
	username: string;
	bio?: string;
	location?: string;
	website?: string;
	avatar?: string;
	banner?: string;
	followersCount?: number;
	followingCount?: number;
	postsCount?: number;
	isVerified?: boolean;
	followers?: string[]; // IDs of followers
	following?: string[]; // IDs of following
	createdAt?: string;
}

// Map username -> ProfileData
export type ProfileCache = Record<string, ProfileData>;

// Map "userId-tab" -> PostProps[]
// e.g. "12345-posts" -> [Post1, Post2...]
export type UserPostsCache = Record<string, PostProps[]>;

export const profileCacheAtom = atom<ProfileCache>({});
export const userPostsCacheAtom = atom<UserPostsCache>({});
