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
    bio: string;
    website: string;
    interests: string[];
    followersCount: number;
    followingCount: number;
    isVerified: boolean;
    onboardingCompleted: boolean;
}

export const userAtom = atom<User | null>(null);
