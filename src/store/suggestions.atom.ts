import { atom } from "jotai";

export interface UserSuggestion {
	_id: string;
	firstName: string;
	lastName: string;
	username: string;
	avatar: string;
}

export const suggestionsAtom = atom<UserSuggestion[]>([]);
export const suggestionsLoadedAtom = atom<boolean>(false);
/**
 * When the right rail last fetched. `loaded` alone froze the rail for the
 * life of the tab (and Explore warming the same atoms froze it before it
 * ever fetched); the rail now revalidates when this is older than its TTL.
 */
export const railFetchedAtAtom = atom<number>(0);
