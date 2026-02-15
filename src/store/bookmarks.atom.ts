import { atom } from "jotai";
import { type PostProps } from "@/components/feed/PostCard";

export const bookmarksAtom = atom<PostProps[]>([]);
export const bookmarksLoadedAtom = atom<boolean>(false);
