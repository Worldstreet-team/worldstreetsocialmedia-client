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
	const [entries, setEntries] = useState<LiveEntry[]>([]);
	const [loaded, setLoaded] = useState(false);

	const refresh = useCallback(async () => {
		const res = await listLiveStreamsAction();
		if (res.success) setEntries(res.streams);
		setLoaded(true);
	}, []);

	useEffect(() => {
		void refresh();
		const poll = setInterval(() => void refresh(), pollMs);
		return () => clearInterval(poll);
	}, [refresh, pollMs]);

	// Instant reaction to the gateway's Ably broadcasts.
	useEffect(() => {
		if (!client) return;
		const channel = client.channels.get("live");
		const onEvent = () => void refresh();
		void channel.subscribe("started", onEvent);
		void channel.subscribe("ended", onEvent);
		return () => {
			channel.unsubscribe("started", onEvent);
			channel.unsubscribe("ended", onEvent);
		};
	}, [client, refresh]);

	return { entries, loaded, refresh };
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
