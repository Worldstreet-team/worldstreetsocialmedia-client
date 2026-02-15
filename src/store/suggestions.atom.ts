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
