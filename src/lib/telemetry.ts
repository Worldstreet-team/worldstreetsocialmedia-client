"use client";

// MRC-grade impression telemetry.
//
// Viewability standard (Media Rating Council, what the big platforms bill on):
// a card counts as an impression only after ≥50% of its pixels are visible for
// ≥1 continuous second (video upgrades use ≥2s). We track coverage and
// continuous-visibility with an IntersectionObserver, accumulate total dwell,
// and emit two events per card lifetime:
//   impression — the moment the MRC bar is cleared (once per card per session)
//   dwell      — when the card leaves the viewport; value = total visible ms,
//                meta carries peak coverage + longest continuous stretch.
// Events queue locally and flush in batches so telemetry costs the UI nothing.

import { sendEventsAction } from "@/lib/telemetry.actions";
import { detectCountry } from "@/lib/tz-country";

export type Surface =
	| "feed_foryou"
	| "feed_following"
	| "post_detail"
	| "profile"
	| "explore"
	| "bookmarks"
	| "vertical"
	| "story"
	| "live_embed"
	| "dm";

export interface TelemetryEvent {
	post?: string;
	author?: string;
	action: string;
	surface?: Surface;
	position?: number;
	value?: number;
	meta?: Record<string, unknown>;
	sessionId?: string;
	clientTs?: number;
	/** ISO country, timezone-derived; the gateway prefers edge geo headers. */
	country?: string;
}

const FLUSH_INTERVAL_MS = 5_000;
const FLUSH_AT = 20;
/** Ceiling on retained events, so a gateway outage can't grow the queue forever. */
const MAX_QUEUE = 500;
const MRC_COVERAGE = 0.5;
const MRC_CONTINUOUS_MS = 1_000;

let queue: TelemetryEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let flushing = false;
let listenersBound = false;

function sessionId(): string {
	if (typeof window === "undefined") return "";
	let id = sessionStorage.getItem("ws-telemetry-session");
	if (!id) {
		id = crypto.randomUUID();
		sessionStorage.setItem("ws-telemetry-session", id);
	}
	return id;
}

async function flush() {
	if (flushing || queue.length === 0) return;
	flushing = true;
	const batch = queue.splice(0, 100);
	let failed = false;
	try {
		await sendEventsAction(batch);
	} catch {
		failed = true;
		// A dropped batch is not free: impressions are what damp already-seen
		// posts out of the feed, so losing them is exactly how a post the user
		// has read comes back tomorrow. Put them at the FRONT — they are older
		// than whatever arrived while the request was in flight — and let the
		// next flush carry them. Bounded so a gateway outage cannot grow the
		// queue without limit.
		if (queue.length + batch.length <= MAX_QUEUE) queue.unshift(...batch);
	} finally {
		flushing = false;
		// Chain straight into the next batch only on success. After a failure
		// the requeue has just refilled the queue, so this branch would spin
		// against an unreachable gateway as fast as the network rejects — the
		// timer retries instead, one attempt per interval.
		if (!failed && queue.length >= FLUSH_AT) void flush();
		else if (failed) scheduleFlush();
	}
}

function scheduleFlush() {
	if (flushTimer) return;
	flushTimer = setTimeout(() => {
		flushTimer = null;
		void flush();
	}, FLUSH_INTERVAL_MS);
}

function bindLifecycleFlush() {
	if (listenersBound || typeof window === "undefined") return;
	listenersBound = true;
	// Last-chance flush when the tab hides — the closest reliable moment to
	// page exit that still allows an async request.
	document.addEventListener("visibilitychange", () => {
		if (document.visibilityState === "hidden") void flush();
	});
	// And again on pagehide. On phones this is the one that actually fires:
	// switching apps or following a link can put the page straight into the
	// back/forward cache without ever reporting a visibility change, which
	// stranded the last screenful of impressions — the most recent posts the
	// user looked at, and so precisely the ones they would notice returning.
	window.addEventListener("pagehide", () => void flush());
}

export function track(event: TelemetryEvent) {
	if (!event.country) {
		const c = detectCountry();
		if (c) event.country = c;
	}
	if (typeof window === "undefined") return;
	bindLifecycleFlush();
	queue.push({ ...event, sessionId: sessionId(), clientTs: Date.now() });
	if (queue.length >= FLUSH_AT) void flush();
	else scheduleFlush();
}

// ── Impression observation ──────────────────────────────────────────────────

export interface ImpressionMeta {
	post: string;
	author?: string;
	surface: Surface;
	position: number;
	mediaType?: "text" | "image" | "video" | "live";
	cursorDepth?: number;
	promoted?: boolean;
}

interface Watch {
	meta: ImpressionMeta;
	visibleSince: number | null; // wall-clock when coverage last crossed 50%
	totalVisibleMs: number;
	longestContinuousMs: number;
	peakCoverage: number;
	impressionFired: boolean;
	mrcTimer: ReturnType<typeof setTimeout> | null;
}

const watches = new WeakMap<Element, Watch>();
let observer: IntersectionObserver | null = null;

function getObserver(): IntersectionObserver {
	if (observer) return observer;
	observer = new IntersectionObserver(
		(entries) => {
			const now = performance.now();
			for (const entry of entries) {
				const w = watches.get(entry.target);
				if (!w) continue;
				w.peakCoverage = Math.max(w.peakCoverage, entry.intersectionRatio);

				const visible = entry.intersectionRatio >= MRC_COVERAGE;
				if (visible && w.visibleSince === null) {
					w.visibleSince = now;
					if (!w.impressionFired && !w.mrcTimer) {
						// Fire only if still ≥50% visible after the continuous second.
						w.mrcTimer = setTimeout(() => {
							w.mrcTimer = null;
							if (w.visibleSince !== null && !w.impressionFired) {
								w.impressionFired = true;
								track({
									post: w.meta.post,
									author: w.meta.author,
									action: "impression",
									surface: w.meta.surface,
									position: w.meta.position,
									meta: {
										coverage: Math.round(w.peakCoverage * 100) / 100,
										viewportW: window.innerWidth,
										viewportH: window.innerHeight,
										mediaType: w.meta.mediaType,
										cursorDepth: w.meta.cursorDepth,
										promoted: w.meta.promoted,
									},
								});
							}
						}, MRC_CONTINUOUS_MS);
					}
				} else if (!visible && w.visibleSince !== null) {
					const stretch = now - w.visibleSince;
					w.totalVisibleMs += stretch;
					w.longestContinuousMs = Math.max(w.longestContinuousMs, stretch);
					w.visibleSince = null;
					if (w.mrcTimer) {
						clearTimeout(w.mrcTimer);
						w.mrcTimer = null;
					}
				}
			}
		},
		{ threshold: [0, MRC_COVERAGE, 1] },
	);
	return observer;
}

/** Start watching an element; returns a cleanup that emits the dwell event. */
export function observeImpression(
	el: Element,
	meta: ImpressionMeta,
): () => void {
	const w: Watch = {
		meta,
		visibleSince: null,
		totalVisibleMs: 0,
		longestContinuousMs: 0,
		peakCoverage: 0,
		impressionFired: false,
		mrcTimer: null,
	};
	watches.set(el, w);
	getObserver().observe(el);

	return () => {
		getObserver().unobserve(el);
		watches.delete(el);
		if (w.mrcTimer) clearTimeout(w.mrcTimer);
		if (w.visibleSince !== null) {
			const stretch = performance.now() - w.visibleSince;
			w.totalVisibleMs += stretch;
			w.longestContinuousMs = Math.max(w.longestContinuousMs, stretch);
		}
		// Only report dwell for cards that were actually seen.
		if (w.totalVisibleMs >= 250) {
			track({
				post: meta.post,
				author: meta.author,
				action: "dwell",
				surface: meta.surface,
				position: meta.position,
				value: Math.round(w.totalVisibleMs),
				meta: {
					coverage: Math.round(w.peakCoverage * 100) / 100,
					visibleMs: Math.round(w.longestContinuousMs),
					mediaType: meta.mediaType,
					cursorDepth: meta.cursorDepth,
					promoted: meta.promoted,
				},
			});
		}
	};
}
