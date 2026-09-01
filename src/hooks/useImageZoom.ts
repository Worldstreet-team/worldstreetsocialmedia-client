"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Pinch, double-tap and pan zoom for a lightbox image — built on TOUCH
 * events, deliberately.
 *
 * iOS Safari's multi-touch Pointer Event stream is the known-unreliable
 * path: it drops or cancels the second pointer as soon as its own scroll or
 * gesture recogniser engages, so a `pointers.size === 2` check frequently
 * never holds and the pinch simply never fires (iOS audit 2026-09-01).
 * `e.touches.length === 2` is rock solid on iOS, and Android Chrome
 * supports touch events just as well.
 *
 * The container must carry `touchAction: "none"` while zoomed so the page
 * doesn't steal the pan, and `"pan-y"` at rest so a vertical swipe still
 * scrolls whatever is behind the viewer.
 */
export interface ZoomState {
	scale: number;
	x: number;
	y: number;
}

const MAX_SCALE = 4;
const MIN_SCALE = 1;
const DOUBLE_TAP_MS = 300;
const DOUBLE_TAP_SCALE = 2.5;

export function useImageZoom() {
	const [zoom, setZoom] = useState<ZoomState>({ scale: 1, x: 0, y: 0 });
	const pinchRef = useRef<{ dist: number; scale: number } | null>(null);
	const panRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(
		null,
	);
	const lastTapRef = useRef(0);
	const zoomRef = useRef(zoom);
	zoomRef.current = zoom;

	const reset = useCallback(() => setZoom({ scale: 1, x: 0, y: 0 }), []);

	const clamp = (z: ZoomState): ZoomState => {
		const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, z.scale));
		if (scale === 1) return { scale: 1, x: 0, y: 0 };
		// Keep the picture from being flung entirely off its own frame.
		const limit = 400 * (scale - 1);
		return {
			scale,
			x: Math.min(limit, Math.max(-limit, z.x)),
			y: Math.min(limit, Math.max(-limit, z.y)),
		};
	};

	const onTouchStart = useCallback((e: React.TouchEvent) => {
		if (e.touches.length === 2) {
			const [a, b] = [e.touches[0], e.touches[1]];
			pinchRef.current = {
				dist: Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY),
				scale: zoomRef.current.scale,
			};
			panRef.current = null;
			return;
		}
		if (e.touches.length === 1) {
			const now = Date.now();
			if (now - lastTapRef.current < DOUBLE_TAP_MS) {
				// Double-tap toggles between fit and a useful magnification —
				// the gesture everyone already knows from Photos.
				lastTapRef.current = 0;
				setZoom((z) =>
					z.scale > 1
						? { scale: 1, x: 0, y: 0 }
						: { scale: DOUBLE_TAP_SCALE, x: 0, y: 0 },
				);
				return;
			}
			lastTapRef.current = now;
			if (zoomRef.current.scale > 1) {
				panRef.current = {
					x: e.touches[0].clientX,
					y: e.touches[0].clientY,
					ox: zoomRef.current.x,
					oy: zoomRef.current.y,
				};
			}
		}
	}, []);

	const onTouchMove = useCallback((e: React.TouchEvent) => {
		if (e.touches.length === 2 && pinchRef.current) {
			const [a, b] = [e.touches[0], e.touches[1]];
			const dist = Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
			const next = pinchRef.current.scale * (dist / pinchRef.current.dist);
			setZoom((z) => clamp({ ...z, scale: next }));
			return;
		}
		if (e.touches.length === 1 && panRef.current) {
			const p = panRef.current;
			setZoom((z) =>
				clamp({
					...z,
					x: p.ox + (e.touches[0].clientX - p.x),
					y: p.oy + (e.touches[0].clientY - p.y),
				}),
			);
		}
	}, []);

	const onTouchEnd = useCallback((e: React.TouchEvent) => {
		if (e.touches.length < 2) pinchRef.current = null;
		if (e.touches.length === 0) panRef.current = null;
	}, []);

	/**
	 * Trackpad/ctrl+wheel on desktop, so both platforms agree. Used as a
	 * callback ref: `ref={bindWheelRef}`. Non-passive, because the browser's
	 * own page zoom has to be prevented for ours to mean anything.
	 */
	const wheelCleanup = useRef<(() => void) | null>(null);
	const bindWheelRef = useCallback((el: HTMLElement | null) => {
		wheelCleanup.current?.();
		wheelCleanup.current = null;
		if (!el) return;
		const onWheel = (e: WheelEvent) => {
			if (!e.ctrlKey && !e.metaKey) return;
			e.preventDefault();
			setZoom((z) => clamp({ ...z, scale: z.scale - e.deltaY * 0.01 }));
		};
		el.addEventListener("wheel", onWheel, { passive: false });
		wheelCleanup.current = () => el.removeEventListener("wheel", onWheel);
	}, []);

	useEffect(() => {
		// A new image starts fit-to-frame.
		return () => {
			pinchRef.current = null;
			panRef.current = null;
		};
	}, []);

	return {
		zoom,
		reset,
		zoomed: zoom.scale > 1,
		handlers: { onTouchStart, onTouchMove, onTouchEnd },
		bindWheelRef,
	};
}
