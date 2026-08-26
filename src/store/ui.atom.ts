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

/** Create-FAB surfaces. The sheets live outside the components that trigger
 *  them, so the FAB can open them from any route. */
export const goLiveOpenAtom = atom(false);

/** The verified-subscription sheet, openable from the sidebar and settings. */
export const premiumOpenAtom = atom(false);

/** Bumped by the FAB; StoriesRail opens its own Story Studio in response
 *  (it owns the reload-after-post wiring). */
export const storyStudioSignalAtom = atom(0);

/**
 * Which unread count a nav row shows. Three navs used to answer this three
 * different ways (display title, i18n key, a hardcoded field), so a rename in
 * one place silently dropped a badge in another.
 */
/** Survives navigation, like feedTabAtom: the chosen filter is a preference. */
export const notificationFilterAtom = atom<"all" | "mentions" | "follows" | "verified">(
	"all",
);

export const badgeForNavKey = (
	labelKey: string,
	notifications: number,
	messages: number,
) =>
	labelKey === "nav.notifications"
		? notifications
		: labelKey === "nav.messages"
			? messages
			: 0;
