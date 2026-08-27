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
