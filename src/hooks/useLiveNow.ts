"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRealtime } from "@/components/providers/RealtimeProvider";
import { listLiveStreamsAction } from "@/lib/live.actions";

export interface LiveEntry {
	id: string;
	title: string;
	category: string;
	viewers: number;
	username: string;
	avatar: string;
	/** Real name and verification, so the rail can address a broadcaster the
	 *  way every other surface does. Optional: these ride along from Xstream,
	 *  which may not populate them, and the name falls back to the handle. */
	firstName?: string;
	lastName?: string;
	isVerified?: boolean;
	/** Co-hosts currently ON the stage (merged co-live / approved guests).
	 *  Empty for a solo broadcast. */
	stage?: { username: string; avatar: string }[];
}

/**
 * ONE live-streams store for the whole app.
 *
 * Every consumer used to own its poll and its own copy of the answer, so a
 * profile page with the right rail ran three timers and three requests for
 * one piece of shared truth — and each new surface that wanted a live badge
 * added another. Now the first subscriber starts the poll, the last one to
 * leave stops it, and everyone reads the same snapshot.
 *
 * A shared cache also means arriving on a page renders what is already known
 * instead of a fetch: navigation costs nothing until the poll or an Ably
 * event actually changes something.
 */
let sharedEntries: LiveEntry[] = [];
let sharedLoaded = false;
let inFlight: Promise<void> | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;
const subscribers = new Set<() => void>();

function emit() {
	for (const fn of subscribers) fn();
}

/** Coalesced: concurrent callers share one request, not one each. */
function loadLive(): Promise<void> {
	if (inFlight) return inFlight;
	inFlight = listLiveStreamsAction()
		.then((res: any) => {
			if (res.success) sharedEntries = res.streams;
			sharedLoaded = true;
			emit();
		})
		.catch(() => {
			sharedLoaded = true;
			emit();
		})
		.finally(() => {
			inFlight = null;
		});
	return inFlight;
}

/**
 * Who is live, right now. Xstream is the source of truth (not the stories
 * rail, which only carried other people's auto-stories and left your own
 * broadcast invisible). Ably's "live" channel pushes start and end events so
 * the rail reacts the instant someone goes live; a slow poll underneath
 * covers reconnects and viewer-count drift.
 */
export function useLiveNow(pollMs = 20_000) {
	const { client } = useRealtime();
	const [, bump] = useState(0);

	useEffect(() => {
		const onChange = () => bump((n) => n + 1);
		subscribers.add(onChange);
		// Render what is already known; only fetch if nobody has yet.
		if (!sharedLoaded) void loadLive();
		// The poll respects the tab: hidden tabs stop asking (this ran on a
		// 20s clock app-wide, for every user, on every page — the single
		// heaviest poll in the audit 2026-09-01), and returning refetches
		// once so the rail is honest again immediately. The Ably `live`
		// channel below stays subscribed either way, so a broadcast starting
		// mid-hide still lands the moment it matters.
		const startPoll = () => {
			if (!pollTimer)
				pollTimer = setInterval(() => void loadLive(), pollMs);
		};
		const stopPoll = () => {
			if (pollTimer) {
				clearInterval(pollTimer);
				pollTimer = null;
			}
		};
		const onVisibility = () => {
			if (document.visibilityState === "hidden") stopPoll();
			else {
				void loadLive();
				startPoll();
			}
		};
		if (document.visibilityState !== "hidden") startPoll();
		document.addEventListener("visibilitychange", onVisibility);
		return () => {
			subscribers.delete(onChange);
			document.removeEventListener("visibilitychange", onVisibility);
			// Last one out turns off the poll — a backgrounded surface should
			// not keep the app talking to the gateway.
			if (subscribers.size === 0) stopPoll();
		};
	}, [pollMs]);

	// Instant reaction to the gateway's Ably broadcasts. Subscribing per
	// consumer is fine — Ably multiplexes one channel — and the load it
	// triggers is coalesced.
	useEffect(() => {
		if (!client) return;
		const channel = client.channels.get("live");
		const onEvent = () => void loadLive();
		void channel.subscribe("started", onEvent);
		void channel.subscribe("ended", onEvent);
		return () => {
			channel.unsubscribe("started", onEvent);
			channel.unsubscribe("ended", onEvent);
		};
	}, [client]);

	const refresh = useCallback(() => loadLive(), []);
	return { entries: sharedEntries, loaded: sharedLoaded, refresh };
}

/**
 * Raw live events off the gateway's Ably channel. Any surface that renders
 * "someone is live" needs this: without it a badge, ring or slide keeps
 * claiming live long after the broadcast ended, and only a refresh fixes it.
 */
export function useLiveEvents(
	handler: (event: "started" | "ended", data: { streamId?: string; postId?: string }) => void,
) {
	const { client } = useRealtime();
	const ref = useRef(handler);
	ref.current = handler;

	useEffect(() => {
		if (!client) return;
		const channel = client.channels.get("live");
		const onStarted = (m: any) => ref.current("started", m?.data ?? {});
		const onEnded = (m: any) => ref.current("ended", m?.data ?? {});
		void channel.subscribe("started", onStarted);
		void channel.subscribe("ended", onEnded);
		return () => {
			channel.unsubscribe("started", onStarted);
			channel.unsubscribe("ended", onEnded);
		};
	}, [client]);
}
