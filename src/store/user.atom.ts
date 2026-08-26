import { atom } from "jotai";

export interface User {
	_id: string;
	userId: string;
	username: string;
	email: string;
	firstName?: string;
	lastName?: string;
	role?: string;
	avatar: string;
	banner?: string;
	bio: string;
	location?: string;
	website: string;
	interests: string[];
	bookmarks: string[];
	followersCount: number;
	followingCount: number;
	postsCount: number;
	isVerified: boolean;
	/** Earned marks (competition standings), separate from verification. */
	badges?: {
		type: "wolf";
		tier?: "champion" | "finalist" | "contender";
		season?: string;
		awardedAt?: string;
	}[];
	/** Absent on accounts that have never opened settings; the gateway
	    falls back to all-on, which is how the app behaved before. */
	notificationPrefs?: {
		like: boolean;
		repost: boolean;
		reply: boolean;
		follow: boolean;
		mention: boolean;
		live: boolean;
		fromFollowingOnly: boolean;
	};
	onboardingCompleted: boolean;
	createdAt?: string;
}

export const userAtom = atom<User | null>(null);
export const initialUserAtom = atom<any | null>(null);
