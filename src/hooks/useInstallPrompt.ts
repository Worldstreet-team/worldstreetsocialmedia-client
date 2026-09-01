"use client";

import { useEffect, useState } from "react";

/**
 * The install seam. Chrome-family browsers hand us a deferred
 * `beforeinstallprompt` we can fire from our own button; iOS never will, so
 * the row falls back to Share → Add to Home Screen instructions. The event
 * often fires before any settings surface mounts, so it is stashed at module
 * level by the always-mounted PwaSync provider, not captured per-component.
 */
type DeferredPrompt = { prompt: () => Promise<unknown> } | null;

let deferred: DeferredPrompt = null;
const listeners = new Set<() => void>();

export function stashInstallPrompt(e: Event) {
	e.preventDefault();
	deferred = e as unknown as { prompt: () => Promise<unknown> };
	for (const fn of listeners) fn();
}

export function useInstallPrompt() {
	const [, bump] = useState(0);

	useEffect(() => {
		const fn = () => bump((n) => n + 1);
		listeners.add(fn);
		return () => {
			listeners.delete(fn);
		};
	}, []);

	const isStandalone =
		typeof window !== "undefined" &&
		(window.matchMedia("(display-mode: standalone)").matches ||
			(navigator as { standalone?: boolean }).standalone === true);

	const isIOS =
		typeof navigator !== "undefined" &&
		(/iphone|ipad|ipod/i.test(navigator.userAgent) ||
			// iPadOS reports as a Mac with touch.
			(navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));

	return {
		/** A real prompt is in hand (Android/desktop Chrome family). */
		canPrompt: deferred !== null,
		isIOS,
		isStandalone,
		promptInstall: async () => {
			if (!deferred) return;
			await deferred.prompt();
			deferred = null;
			for (const fn of listeners) fn();
		},
	};
}
