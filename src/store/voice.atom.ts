import { atom } from "jotai";
import type { SpaceRow } from "@/components/voice/SpaceCard";

/**
 * The room you are currently in, app-wide.
 *
 * It lives in an atom (not inside /voice) so the room survives navigation:
 * minimise it and it becomes a floating dock that follows you around the
 * app, exactly like the broadcaster's LiveDock. `/voice` only ever writes
 * to this; `VoiceRoomHost` in the root layout does the rendering.
 */
export interface VoiceSession {
  row: SpaceRow;
  minimized: boolean;
}

export const voiceSessionAtom = atom<VoiceSession | null>(null);

/** Bumped whenever a room is created/started/ended so the directory reloads
 *  even though the mutation happened from the dock or the room overlay. */
export const voiceRefreshAtom = atom(0);

/**
 * How many rooms are live right now, app-wide.
 *
 * Drives the pulse on the Street Voice nav item. Deliberately a *count* the
 * nav renders as a dot rather than a number: "3" beside a nav item reads as
 * three unread things waiting for you, and a live room is not an inbox. The
 * count is still carried so the label can say how many are on.
 */
export const liveSpacesCountAtom = atom(0);
