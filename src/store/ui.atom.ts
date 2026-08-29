import { atom } from "jotai";

/**
 * Which timeline the feed header tabs show. Each is a different gateway
 * QUERY, not a client-side filter: "foryou" is ranked, "following" is
 * chronological among people you follow, "newest" is chronological across
 * everyone — the escape hatch from ranking.
 */
export type FeedTab = "foryou" | "following" | "newest";
export const feedTabAtom = atom<FeedTab>("foryou");

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

/** Threads in Business holding news for this account. Seeded by BmCountSync,
 *  zeroed thread-by-thread as deal rooms are opened. */
export const unreadBmCountAtom = atom(0);

export const badgeForNavKey = (
	labelKey: string,
	notifications: number,
	messages: number,
	bm = 0,
) =>
	labelKey === "nav.notifications"
		? notifications
		: labelKey === "nav.messages"
			? messages
			: labelKey === "nav.bm"
				? bm
				: 0;

/**
 * The search window. Separate from `commandPaletteOpenAtom` on purpose: the
 * palette is for commands (navigate, compose, replay the tour), search is for
 * content (people, posts, communities, topics). Folding search into the
 * palette is what left the rail's search box unable to find a single user.
 */
export const searchOpenAtom = atom(false);

/** Seeds the search window's input, so a caller can hand it a query. */
export const searchSeedAtom = atom("");

/**
 * The story rail, shared by both StoriesRail instances.
 *
 * The rail is mounted twice — once in `app/page.tsx` and once in
 * `(main)/layout.tsx` — and only the one that is actually on screen fetches.
 * While each copy held its own `useState`, the hidden copy stayed empty
 * forever (its mount effect returns early), so as soon as it became the
 * visible one the stories vanished and never came back. Shared state means
 * whichever copy is showing renders what the other one fetched.
 */
export const storyRailAtom = atom<any[]>([]);

/**
 * Profile ids currently online, from the global presence channel.
 * A Set because every consumer asks "is this one id in there?".
 */
export const onlineIdsAtom = atom<Set<string>>(new Set<string>());

/** The docked messenger panel on the right rail. */
export const messageDockOpenAtom = atom(false);

/**
 * Set by AdSlot while campaigns are LIVE on the profile being viewed: the
 * book affordance leaves the About column and becomes a small glimmer icon
 * in the header action row (owner ruling — the campaign is the tenant of
 * the slot; booking moves up with the message icons). Null when no live
 * campaign, or on profiles that don't sell.
 */
export const profileAdHeaderAtom = atom<{
	username: string;
	isMe: boolean;
	fromUsdMinor: number | null;
} | null>(null);

/** The owner pressed the header megaphone — AdSlot answers by opening its
 *  rates sheet. A request flag, not shared open-state: the sheet stays
 *  owned by AdSlot. */
export const profileRatesRequestAtom = atom(false);
