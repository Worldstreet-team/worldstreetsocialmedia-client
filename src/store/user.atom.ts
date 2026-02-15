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
	onboardingCompleted: boolean;
	createdAt?: string;
}

export const userAtom = atom<User | null>(null);
export const initialUserAtom = atom<any | null>(null);
