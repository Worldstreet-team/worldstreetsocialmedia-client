"use client";

/**
 * One clock for every relative timestamp in the app.
 *
 * Costs nothing over the wire — it re-formats data already in memory and
 * never fetches. The care here is in keeping the local cost near zero too:
 *
 * - ONE interval for the whole app, however many timestamps are on screen.
 *   A timer per card would be hundreds on a long feed.
 * - It only exists while something is subscribed, and stops the moment the
 *   last timestamp unmounts.
 * - It stops entirely while the tab is hidden. A backgrounded tab should do
 *   no work at all; on return it ticks immediately, because the labels went
 *   stale while nobody was looking.
 * - Subscribers are the small `<TimeAgo>` spans, not the cards around them,
 *   so a tick repaints a few words rather than a timeline of posts.
 *
 * A minute is the right period: below an hour `formatTimeAgo` is minute
 * resolution, so ticking faster would recompute identical strings, and
 * ticking slower would let "3m" sit visibly wrong.
 */

const TICK_MS = 60_000;

let listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;
let boundVisibility = false;
/**
 * The snapshot React compares between renders. It MUST be a cached value —
 * returning Date.now() from the getter would hand back a new number on every
 * read and spin useSyncExternalStore forever.
 */
let stamp = 0;

function fire() {
	stamp = Date.now();
	for (const l of listeners) l();
}

function startTimer() {
	if (timer || listeners.size === 0) return;
	if (typeof document !== "undefined" && document.visibilityState === "hidden")
		return;
	timer = setInterval(fire, TICK_MS);
}

function stopTimer() {
	if (!timer) return;
	clearInterval(timer);
	timer = null;
}

function onVisibility() {
	if (document.visibilityState === "hidden") {
		stopTimer();
		return;
	}
	// Back in view: correct the labels now, then resume the cadence.
	fire();
	startTimer();
}

export function subscribeMinute(onChange: () => void): () => void {
	listeners.add(onChange);
	if (typeof document !== "undefined" && !boundVisibility) {
		boundVisibility = true;
		document.addEventListener("visibilitychange", onVisibility);
	}
	startTimer();
	return () => {
		listeners.delete(onChange);
		if (listeners.size === 0) stopTimer();
	};
}

export function getMinute(): number {
	return stamp;
}

/** Stable across the server render; the client corrects on its first tick. */
export function getMinuteServer(): number {
	return 0;
}
