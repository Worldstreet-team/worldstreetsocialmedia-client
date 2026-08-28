"use client";

import type { PostProps } from "@/components/feed/PostCard";

/**
 * Last-known feed snapshot, persisted so re-entering the app paints posts
 * immediately instead of a skeleton — stale-while-revalidate: the snapshot
 * renders, a silent refresh replaces it. Keyed per user (a shared browser
 * must never show one account's timeline under another) and capped small:
 * this is a first paint, not an archive.
 *
 * localStorage can be absent, full, or blocked (private windows, cleared
 * site data) — every touch is try/catched and a miss just means the old
 * skeleton path.
 */

const VERSION = "ws-feed-cache-v1";
const MAX_POSTS = 15;
/**
 * How stale a snapshot may be before it is ignored.
 *
 * This exists for "you reloaded, or came back to the tab" — not "you came back
 * tomorrow". At 24h it painted YESTERDAY'S top posts every morning before the
 * revalidate landed, which is exactly what seeing the same post over and over
 * feels like. Ten minutes keeps the instant paint where it is honest (a reload
 * moments later genuinely should show the same feed) and falls through to a
 * fresh fetch beyond that.
 */
const MAX_AGE_MS = 10 * 60 * 1000;

interface FeedSnapshot {
	posts: PostProps[];
	savedAt: number;
}

const keyFor = (userId: string) => `${VERSION}:${userId}`;

export function saveFeedSnapshot(userId: string, posts: PostProps[]): void {
	if (!userId || posts.length === 0) return;
	try {
		const snapshot: FeedSnapshot = {
			posts: posts.slice(0, MAX_POSTS),
			savedAt: Date.now(),
		};
		localStorage.setItem(keyFor(userId), JSON.stringify(snapshot));
	} catch {
		// Quota or blocked storage — the feed works without the snapshot.
	}
}

export function loadFeedSnapshot(userId: string): PostProps[] | null {
	if (!userId) return null;
	try {
		const raw = localStorage.getItem(keyFor(userId));
		if (!raw) return null;
		const snapshot = JSON.parse(raw) as FeedSnapshot;
		if (!Array.isArray(snapshot.posts) || snapshot.posts.length === 0)
			return null;
		if (Date.now() - (snapshot.savedAt ?? 0) > MAX_AGE_MS) {
			localStorage.removeItem(keyFor(userId));
			return null;
		}
		return snapshot.posts;
	} catch {
		return null;
	}
}
