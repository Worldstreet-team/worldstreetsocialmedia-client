"use client";

import { useSyncExternalStore } from "react";
import { formatTimeAgo } from "@/lib/utils";
import {
	getMinute,
	getMinuteServer,
	subscribeMinute,
} from "@/lib/timeTick";

/**
 * A relative age that stays true.
 *
 * Subscribing HERE rather than in the card is the whole point: a tick
 * repaints these few words, not the post around them. One shared clock drives
 * every instance (see timeTick), so a hundred of these on screen is still one
 * timer and no requests.
 *
 * `fallback` covers rows that only ever had a pre-formatted label — those
 * render exactly as before and simply never update.
 */
export function TimeAgo({
	date,
	fallback,
}: {
	date?: string | null;
	fallback?: string;
}) {
	useSyncExternalStore(subscribeMinute, getMinute, getMinuteServer);
	if (!date) return <>{fallback ?? ""}</>;
	// The server and the browser format this at different moments (a post
	// under a minute old reads in seconds) and in different timezones, so
	// the text cannot match at hydration ("Hydration failed because the
	// server rendered text didn't match", owner 2026-10-01). The mismatch is
	// expected and the clock above redraws it right after hydration.
	return (
		<time dateTime={date} suppressHydrationWarning>
			{formatTimeAgo(date)}
		</time>
	);
}
