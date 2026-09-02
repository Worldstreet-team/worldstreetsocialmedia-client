"use client";

import { useEffect } from "react";
import { useAtomValue } from "jotai";
import { unreadNotificationsCountAtom } from "@/store/ui.atom";
import { unreadMessagesCountAtom } from "@/store/messageCache";
import { stashInstallPrompt } from "@/hooks/useInstallPrompt";

/**
 * The PWA plumbing, mounted once in the root layout.
 *
 * - Registers /sw.js in production builds only: in dev, Turbopack asset URLs
 *   churn and a worker would serve yesterday's chunks over HMR.
 * - Mirrors the unread total onto the home-screen icon via the Badging API,
 *   so the installed app carries its count like a native one.
 * - Stashes `beforeinstallprompt` so the settings Install row can fire it
 *   whenever it mounts, long after the event actually fired.
 */
export function PwaSync() {
	const notif = useAtomValue(unreadNotificationsCountAtom);
	const dms = useAtomValue(unreadMessagesCountAtom);

	useEffect(() => {
		if (process.env.NODE_ENV !== "production") return;
		if (!("serviceWorker" in navigator)) return;
		navigator.serviceWorker.register("/sw.js").catch(() => {});
	}, []);

	useEffect(() => {
		window.addEventListener("beforeinstallprompt", stashInstallPrompt);
		return () =>
			window.removeEventListener("beforeinstallprompt", stashInstallPrompt);
	}, []);

	useEffect(() => {
		const nav = navigator as Navigator & {
			setAppBadge?: (n: number) => Promise<void>;
			clearAppBadge?: () => Promise<void>;
		};
		if (typeof nav.setAppBadge !== "function") return;
		const total = notif + dms;
		try {
			if (total > 0) void nav.setAppBadge(total);
			else void nav.clearAppBadge?.();
		} catch {
			// Badging is a garnish; never let it throw into React.
		}
	}, [notif, dms]);

	return null;
}
