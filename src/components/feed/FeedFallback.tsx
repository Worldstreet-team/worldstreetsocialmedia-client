"use client";

import { useAtomValue } from "jotai";
import { feedAtom } from "@/store/feed.atom";
import Feed from "@/components/feed/Feed";
import { FeedSkeleton } from "@/components/feed/FeedSkeleton";

/**
 * The Suspense fallback for the streamed feed — cache-aware, per the owner's
 * rule: "if no network request, no skeleton, just show the posts."
 *
 * The fallback used to be a bare FeedSkeleton, so any re-render of the home
 * segment (back navigation, dev recompiles) flashed five skeleton cards over
 * a timeline that was sitting in feedAtom the whole time. Now, when the atom
 * holds posts, the fallback IS the feed: it renders from cache immediately,
 * and when the streamed server component resolves it swaps in an identical
 * Feed over identical data — invisible. The skeleton survives only for the
 * genuinely cold first paint, where there is nothing else to show.
 */
export function FeedFallback() {
	const cached = useAtomValue(feedAtom);
	if (cached.posts.length > 0) return <Feed />;
	return <FeedSkeleton count={5} />;
}
