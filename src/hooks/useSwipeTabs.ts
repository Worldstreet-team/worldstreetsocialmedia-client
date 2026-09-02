"use client";

import { useCallback, useRef } from "react";
import { haptic } from "@/lib/haptics";

/**
 * Horizontal swipe between sibling timelines — the thumb gesture every
 * native feed has. Deliberately modest mechanics: the content follows the
 * finger a damped distance as a hint, and the actual switch happens on
 * release, letting the existing re-key rise animate the new timeline in.
 * (X does not even attempt this on web; the damped-hint approach keeps 60fps
 * without mounting the neighbour timeline.)
 *
 * Arbitration, in order:
 * - only single-touch, and never within 28px of the screen edges (those
 *   belong to the OS back gestures);
 * - never from inside an editable target or a horizontally scrollable
 *   ancestor (story rail, tab bar, media carousels own their own axis);
 * - intent decided once at 12px of travel: needs |dx| > 1.4·|dy|, otherwise
 *   the gesture is vertical and we never look at it again.
 */
export function useSwipeTabs<T extends string>(
	order: readonly T[],
	current: T,
	onSwitch: (next: T) => void,
) {
	const contentRef = useRef<HTMLElement | null>(null);
	const g = useRef<{
		x: number;
		y: number;
		t: number;
		intent: "none" | "horizontal" | "abort";
		dx: number;
	} | null>(null);

	const orderRef = useRef(order);
	orderRef.current = order;
	const currentRef = useRef(current);
	currentRef.current = current;
	const switchRef = useRef(onSwitch);
	switchRef.current = onSwitch;

	const bindContentRef = useCallback((el: HTMLElement | null) => {
		contentRef.current = el;
	}, []);

	const setHint = (dx: number) => {
		const el = contentRef.current;
		if (!el) return;
		if (dx === 0) {
			el.style.transition = "transform 200ms var(--ws-ease)";
			el.style.transform = "";
			return;
		}
		el.style.transition = "none";
		// Damped and capped: a hint, not a carousel.
		const hint = Math.max(-64, Math.min(64, dx * 0.3));
		el.style.transform = `translateX(${hint}px)`;
	};

	const badStart = (target: EventTarget | null, x: number) => {
		if (x < 28 || x > window.innerWidth - 28) return true;
		let el = target as HTMLElement | null;
		while (el && el !== document.body) {
			const tag = el.tagName;
			if (tag === "TEXTAREA" || tag === "INPUT" || el.isContentEditable)
				return true;
			if (el.scrollWidth > el.clientWidth + 1) {
				const o = getComputedStyle(el).overflowX;
				if (o === "auto" || o === "scroll") return true;
			}
			el = el.parentElement;
		}
		return false;
	};

	const onTouchStart = (e: React.TouchEvent) => {
		if (e.touches.length !== 1) {
			g.current = null;
			return;
		}
		const t = e.touches[0];
		if (badStart(e.target, t.clientX)) return;
		g.current = {
			x: t.clientX,
			y: t.clientY,
			t: Date.now(),
			intent: "none",
			dx: 0,
		};
	};

	const onTouchMove = (e: React.TouchEvent) => {
		const s = g.current;
		if (!s || s.intent === "abort") return;
		const t = e.touches[0];
		const dx = t.clientX - s.x;
		const dy = t.clientY - s.y;
		if (s.intent === "none") {
			if (Math.abs(dx) < 12 && Math.abs(dy) < 12) return;
			s.intent = Math.abs(dx) > Math.abs(dy) * 1.4 ? "horizontal" : "abort";
			if (s.intent === "abort") return;
		}
		s.dx = dx;
		if (!matchMedia("(prefers-reduced-motion: reduce)").matches) setHint(dx);
	};

	const onTouchEnd = () => {
		const s = g.current;
		g.current = null;
		if (!s || s.intent !== "horizontal") return;
		setHint(0);
		const dt = Math.max(1, Date.now() - s.t);
		const fast = Math.abs(s.dx) / dt > 0.45 && Math.abs(s.dx) > 40;
		if (Math.abs(s.dx) < 70 && !fast) return;
		const list = orderRef.current;
		const i = list.indexOf(currentRef.current);
		// Finger left = the next timeline slides in from the right.
		const next = s.dx < 0 ? list[i + 1] : list[i - 1];
		if (!next) return;
		haptic(8);
		switchRef.current(next);
	};

	return {
		bindContentRef,
		handlers: { onTouchStart, onTouchMove, onTouchEnd },
	};
}
