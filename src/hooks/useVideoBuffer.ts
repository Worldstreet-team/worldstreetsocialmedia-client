"use client";

import { useEffect, useRef } from "react";

/**
 * Warm the next few videos while the reader watches the current one.
 *
 * The vertical feed only MOUNTS the slides either side of the active one —
 * mounting more would mean more decoders and, for live slides, more LiveKit
 * rooms. So the slide after next has never started downloading when the reader
 * flicks onto it, and the first frame arrives as a black plate.
 *
 * This keeps a small pool of detached `<video preload="auto">` elements for the
 * upcoming URLs. They are never in the document and never play; they exist so
 * the bytes (and the browser's own media cache entry) are already there when
 * the real element mounts. Anything that leaves the window is torn down, so the
 * pool stays bounded at `ahead` entries rather than growing with the feed.
 *
 * Live slides are deliberately excluded — a LiveKit room is negotiated, not
 * fetched, so there is nothing to warm ahead of time.
 */
export function useVideoBuffer(
	urls: (string | undefined)[],
	active: number,
	ahead = 2,
) {
	const poolRef = useRef<Map<string, HTMLVideoElement>>(new Map());

	// Only the upcoming window matters, and it changes far less often than the
	// component renders — so the effect keys off the window itself, not the
	// (freshly allocated every render) urls array.
	const upcoming: string[] = [];
	for (let i = active + 1; i <= active + ahead; i++) {
		const url = urls[i];
		if (url) upcoming.push(url);
	}
	const windowKey = upcoming.join("|");

	useEffect(() => {
		// Buffering ahead spends bandwidth the reader did not ask for. On a
		// metered or slow connection that is a worse trade than a black frame.
		const conn = (
			navigator as Navigator & {
				connection?: { saveData?: boolean; effectiveType?: string };
			}
		).connection;
		if (conn?.saveData) return;
		if (conn?.effectiveType && /(^|-)2g$/.test(conn.effectiveType)) return;

		const pool = poolRef.current;
		const want = new Set(windowKey ? windowKey.split("|") : []);

		for (const [url, el] of pool) {
			if (want.has(url)) continue;
			release(el);
			pool.delete(url);
		}

		for (const url of want) {
			if (pool.has(url)) continue;
			const el = document.createElement("video");
			el.preload = "auto";
			el.muted = true;
			el.playsInline = true;
			el.src = url;
			pool.set(url, el);
		}
	}, [windowKey]);

	// Leaving the feed must not leave downloads running.
	useEffect(() => {
		const pool = poolRef.current;
		return () => {
			for (const el of pool.values()) release(el);
			pool.clear();
		};
	}, []);
}

/**
 * Detaching the source is not enough on its own: without the reload the
 * browser keeps the in-flight request alive and the "cancelled" buffer goes on
 * consuming the connection.
 */
function release(el: HTMLVideoElement) {
	el.removeAttribute("src");
	el.load();
}
