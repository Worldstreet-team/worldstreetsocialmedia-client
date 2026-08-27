"use client";

import { useFeedEvents } from "@/hooks/useUserEvents";
import { applyStats } from "@/lib/engagementStore";

/**
 * The single subscription behind every live like and reply count.
 *
 * The gateway mirrors post engagement onto the shared `feed` channel, so one
 * attach here keeps every mounted card current. The alternative, a channel per
 * visible post, would be twenty attaches on a timeline screen.
 */
export function EngagementSync() {
	useFeedEvents((event, data: any) => {
		if (event !== "engagement" || !data?.postId) return;
		applyStats(String(data.postId), {
			likes: typeof data.likes === "number" ? data.likes : undefined,
			replies: typeof data.replies === "number" ? data.replies : undefined,
			reposts: typeof data.reposts === "number" ? data.reposts : undefined,
		});
	});
	return null;
}
