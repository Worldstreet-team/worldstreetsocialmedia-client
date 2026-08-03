import { atom } from "jotai";

/** Which timeline the feed header tabs show. */
export const feedTabAtom = atom<"foryou" | "following">("foryou");

/** Ctrl/Cmd+K command palette. Written by triggers, read by <CommandPalette>. */
export const commandPaletteOpenAtom = atom(false);

/**
 * First-run welcome tour. Auto-opens once per browser (localStorage
 * "ws-social-welcome-v1"); the palette can reopen it any time.
 */
export const welcomeTourOpenAtom = atom(false);

/**
 * Unread notifications count for the nav badges. Seeded once per app load by
 * <NotificationCountSync> (root layout); the notifications page zeroes it
 * when it marks everything read.
 */
export const unreadNotificationsCountAtom = atom(0);

/**
 * Author ids the session has followed (optimistic, client-side).
 * Seeds empty; RightSidebar's Follow buttons add to it and the feed's
 * "Following" tab filters by it, so following someone immediately
 * populates that tab.
 */
export const followingIdsAtom = atom<string[]>([]);
