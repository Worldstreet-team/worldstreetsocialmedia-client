"use client";

import { useRef, useState } from "react";
import { mainScroller } from "@/lib/utils";
import { haptic } from "@/lib/haptics";

/** mainScroller falls back to window; only an element has scrollTop. */
function scrollerTop(): number {
	const s = mainScroller();
	return s instanceof HTMLElement ? s.scrollTop : (s?.scrollY ?? 1);
}

const TRIGGER_PX = 70;
const MAX_PULL_PX = 110;
/** Finger travel is damped so the indicator feels weighted, not taped on. */
const DRAG_RATIO = 0.5;

/**
 * The owned pull-to-refresh. The browser one is disabled at the scroller
 * (`overscroll-y-contain`) because installed mode has no browser chrome and
 * the in-page feed must own the gesture; X does exactly this (their PWA is
 * Chrome's canonical overscroll-behavior example).
 *
 * Mechanics: only arms when the main scroller is at the very top, decides
 * vertical intent within the first 10px, never calls preventDefault (the
 * scroller cannot move further up anyway), and hands back `pull` for the
 * spacer plus `refreshing` while the caller's refresh promise runs.
 */
export function usePullToRefresh(onRefresh: () => Promise<unknown> | unknown) {
	const [pull, setPullState] = useState(0);
	const [refreshing, setRefreshing] = useState(false);
	/** Mirror for handlers: the release decision must not live inside a
	 *  state updater (React double-invokes updaters in dev, and effects in
	 *  an updater fire the refresh twice). */
	const pullRef = useRef(0);
	const setPull = (v: number) => {
		pullRef.current = v;
		setPullState(v);
	};
	const gRef = useRef<{
		y: number;
		x: number;
		intent: "none" | "pull" | "off";
		fired: boolean;
	} | null>(null);

	const onTouchStart = (e: React.TouchEvent) => {
		if (refreshing || e.touches.length !== 1) {
			gRef.current = null;
			return;
		}
		const top = scrollerTop() <= 0;
		gRef.current = top
			? {
					y: e.touches[0].clientY,
					x: e.touches[0].clientX,
					intent: "none",
					fired: false,
				}
			: null;
	};

	const onTouchMove = (e: React.TouchEvent) => {
		const g = gRef.current;
		if (!g || g.intent === "off" || e.touches.length !== 1) return;
		const dy = e.touches[0].clientY - g.y;
		const dx = e.touches[0].clientX - g.x;
		if (g.intent === "none") {
			if (Math.abs(dy) < 10 && Math.abs(dx) < 10) return;
			// Downward and more vertical than horizontal, or it is not ours.
			g.intent = dy > 0 && dy >= Math.abs(dx) ? "pull" : "off";
			if (g.intent === "off") return;
		}
		// The scroller reclaims the gesture the moment it leaves the top.
		if (scrollerTop() > 0) {
			g.intent = "off";
			setPull(0);
			return;
		}
		const next = Math.min(MAX_PULL_PX, Math.max(0, dy * DRAG_RATIO));
		if (!g.fired && next >= TRIGGER_PX) {
			g.fired = true;
			haptic(8);
		}
		setPull(next);
	};

	const onTouchEnd = () => {
		const g = gRef.current;
		gRef.current = null;
		if (!g || g.intent !== "pull") return;
		if (pullRef.current >= TRIGGER_PX) {
			// Hold a compact spinner row while the refresh promise runs.
			setPull(44);
			setRefreshing(true);
			void Promise.resolve()
				.then(() => onRefresh())
				.finally(() => {
					setRefreshing(false);
					setPull(0);
				});
		} else {
			setPull(0);
		}
	};

	return {
		pull,
		refreshing,
		armed: pull >= TRIGGER_PX,
		handlers: { onTouchStart, onTouchMove, onTouchEnd },
	};
}
