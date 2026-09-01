"use client";

import { useSyncExternalStore } from "react";
import {
	effectiveFollowing,
	subscribeMyFollowAny,
	subscribeMyFollowState,
} from "@/lib/engagementStore";

/**
 * The session's follow truth for one account: what YOU did this session
 * out-votes whatever stale cached payload the surface rendered from.
 */
export function useEffectiveFollowing(
	profileId: string | undefined,
	payloadSaysFollowing: boolean | undefined,
): boolean {
	return useSyncExternalStore(
		(onChange) =>
			profileId ? subscribeMyFollowState(profileId, onChange) : () => {},
		() =>
			profileId
				? effectiveFollowing(profileId, payloadSaysFollowing)
				: Boolean(payloadSaysFollowing),
		() => Boolean(payloadSaysFollowing),
	);
}

let followVersion = 0;
subscribeMyFollowAny(() => {
	followVersion++;
});

/** A tick that changes when ANY follow state does — for list filters. */
export function useFollowVersion(): number {
	return useSyncExternalStore(
		(onChange) => subscribeMyFollowAny(onChange),
		() => followVersion,
		() => 0,
	);
}
