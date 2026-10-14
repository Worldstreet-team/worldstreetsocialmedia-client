"use client";

import { useSyncExternalStore } from "react";

/**
 * One clock for every ticking number on Space Voice.
 *
 * The directory shows an elapsed timer on each live room, a countdown on
 * the next scheduled one and "in 2d 4h" on the rest. One interval per
 * number would be twenty timers drifting apart on a busy page, each turning
 * its digit a few milliseconds after its neighbour. Here there is ONE
 * interval, started by the first reader and stopped by the last, and every
 * counter turns on the same tick.
 *
 * Readers should be small leaves (a timer span, not a whole card) so a tick
 * re-renders a few characters rather than the list.
 */
let now = 0;
let timer: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<() => void>();

function tick() {
	now = Date.now();
	for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
	listeners.add(listener);
	if (!timer) {
		// The clock may have been idle since the last page that used it;
		// React re-reads the snapshot after subscribing, so this lands
		// before the first visible second.
		now = Date.now();
		timer = setInterval(tick, 1000);
	}
	return () => {
		listeners.delete(listener);
		if (listeners.size === 0 && timer) {
			clearInterval(timer);
			timer = null;
		}
	};
}

const getSnapshot = () => now;
// The server has no clock worth rendering: 0 means "not yet", and readers
// render nothing for it, so the first client frame never disagrees with
// the HTML it hydrates.
const getServerSnapshot = () => 0;

/** Epoch ms, refreshed once a second while anything is reading it; 0 until
 *  the first client tick. */
export function useNow(): number {
	return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** "42:18" under an hour, "1:12:04" past it. */
export function formatElapsed(ms: number): string {
	const total = Math.max(0, Math.floor(ms / 1000));
	const h = Math.floor(total / 3600);
	const m = Math.floor((total % 3600) / 60);
	const s = total % 60;
	const pad = (n: number) => String(n).padStart(2, "0");
	return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

/** The big countdown: "01:42:10", with days leading past a day ("2d 04:10:03"). */
export function formatCountdown(ms: number): string {
	const total = Math.max(0, Math.floor(ms / 1000));
	const d = Math.floor(total / 86_400);
	const h = Math.floor((total % 86_400) / 3600);
	const m = Math.floor((total % 3600) / 60);
	const s = total % 60;
	const pad = (n: number) => String(n).padStart(2, "0");
	const clock = `${pad(h)}:${pad(m)}:${pad(s)}`;
	return d > 0 ? `${d}d ${clock}` : clock;
}

/** The quiet form for the rest of the timeline: "in 2d 4h", "in 3h 12m",
 *  "in 12m", "in under a minute". */
export function formatStartsIn(ms: number): string {
	if (ms <= 0) return "Starting now";
	const mins = Math.floor(ms / 60_000);
	if (mins < 1) return "in under a minute";
	const d = Math.floor(mins / 1440);
	const h = Math.floor((mins % 1440) / 60);
	const m = mins % 60;
	if (d > 0) return h > 0 ? `in ${d}d ${h}h` : `in ${d}d`;
	if (h > 0) return m > 0 ? `in ${h}h ${m}m` : `in ${h}h`;
	return `in ${m}m`;
}
