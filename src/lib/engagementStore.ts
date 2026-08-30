"use client";

export interface LiveStats {
	likes?: number;
	replies?: number;
	reposts?: number;
}

/**
 * Live engagement counts, keyed by post id.
 *
 * Every mounted PostCard reads from this one map instead of holding its own
 * copy, so a like landing anywhere updates the card in the feed, on the
 * profile, in Explore and on the post page at the same moment.
 *
 * It is a module store rather than component state on purpose: the same post
 * is frequently on screen more than once (feed and a quote of it), and those
 * copies must not disagree.
 */
const stats = new Map<string, LiveStats>();
const listeners = new Map<string, Set<() => void>>();

/** Snapshot identity matters: useSyncExternalStore compares by reference. */
export function getStats(postId: string): LiveStats | undefined {
	return stats.get(postId);
}

export function subscribeStats(postId: string, fn: () => void) {
	let set = listeners.get(postId);
	if (!set) {
		set = new Set();
		listeners.set(postId, set);
	}
	set.add(fn);
	return () => {
		set?.delete(fn);
		if (set && set.size === 0) listeners.delete(postId);
	};
}

/**
 * Merge an update in. A new object every time, so subscribers actually see a
 * changed reference; merged rather than replaced, because a like event knows
 * nothing about the reply count.
 */
export function applyStats(postId: string, next: LiveStats) {
	if (!postId) return;
	const prev = stats.get(postId);
	const merged = { ...prev, ...next };
	if (
		prev &&
		prev.likes === merged.likes &&
		prev.replies === merged.replies &&
		prev.reposts === merged.reposts
	) {
		return; // nothing moved, do not wake anyone
	}
	stats.set(postId, merged);
	for (const fn of listeners.get(postId) ?? []) fn();
}

/**
 * Seed from a server payload so a refetch corrects any drift.
 *
 * Only writes when the value actually differs, so re-rendering a list does not
 * fire a storm of no-op notifications.
 */
export function seedStats(postId: string, next: LiveStats) {
	applyStats(postId, next);
}

/**
 * The VIEWER's own relationship to a post — liked / bookmarked / reposted —
 * remembered for the whole session.
 *
 * The counts above were shared but these booleans lived in each card's
 * useState, re-seeded from whatever payload that surface happened to hold.
 * So: like a post on the feed, open the profile (whose tab list is a cached
 * copy from before the tap), and the heart renders empty — and one honest
 * tap on that lying heart UNLIKES the post, corrupting the very signal the
 * For You ranker feeds on. Owner report 2026-08-30.
 *
 * A recorded action beats any payload: once the viewer toggles something,
 * every card for that post renders the toggle until the session ends. A
 * fresh server copy that agrees is a no-op; a stale cached copy that
 * disagrees loses, which is the entire point.
 */
export interface MyEngagement {
	liked?: boolean;
	bookmarked?: boolean;
	reposted?: boolean;
}

const mine = new Map<string, MyEngagement>();
const mineListeners = new Map<string, Set<() => void>>();

export function getMyEngagement(postId: string): MyEngagement | undefined {
	return mine.get(postId);
}

export function subscribeMyEngagement(postId: string, fn: () => void) {
	let set = mineListeners.get(postId);
	if (!set) {
		set = new Set();
		mineListeners.set(postId, set);
	}
	set.add(fn);
	return () => {
		set?.delete(fn);
		if (set && set.size === 0) mineListeners.delete(postId);
	};
}

export function applyMyEngagement(postId: string, next: MyEngagement) {
	if (!postId) return;
	const prev = mine.get(postId);
	const merged = { ...prev, ...next };
	if (
		prev &&
		prev.liked === merged.liked &&
		prev.bookmarked === merged.bookmarked &&
		prev.reposted === merged.reposted
	) {
		return;
	}
	mine.set(postId, merged);
	for (const fn of mineListeners.get(postId) ?? []) fn();
}
