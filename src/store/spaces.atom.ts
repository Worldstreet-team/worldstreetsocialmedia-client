import { atom } from "jotai";
import type { SpaceRow } from "@/components/voice/SpaceCard";

/**
 * The spaces directory (live + upcoming rooms), cached app-wide.
 *
 * Same idiom as trends.atom: the /voice hub and Explore's VoiceStrip both
 * read these two endpoints, and each used to hold its own useState — so
 * every visit refetched behind a skeleton. The atoms make a revisit paint
 * instantly; whoever mounts next revalidates quietly in the background
 * (rooms are live data, so both surfaces always refresh — the loaded flag
 * only decides whether that refresh hides behind a skeleton or not).
 *
 * Demo rows (?demo=1) are merged at display time and never written here.
 */
export const spacesLiveAtom = atom<SpaceRow[]>([]);
export const spacesUpcomingAtom = atom<SpaceRow[]>([]);
/** True once any surface has landed a real fetch this session. */
export const spacesLoadedAtom = atom<boolean>(false);
/** Epoch ms of the last successful fetch (0 = never). */
export const spacesFetchedAtAtom = atom<number>(0);
