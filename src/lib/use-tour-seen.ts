"use client";

import { useCallback, useEffect } from "react";
import { usePreferences } from "@/components/providers/PreferencesProvider";

/**
 * Has this account already dismissed a one-time card?
 *
 * It used to be a localStorage flag, so every new browser, phone or cleared
 * cache replayed the welcome tour and every "what's new" card (owner
 * 2026-09-21: "hope this stays in the database so users don't have to see
 * the pop up every time or when they enter a new device"). The list now
 * lives on the account, in `prefs.advanced.seenTours`, which the gateway
 * already stores and syncs to the person's other devices.
 *
 * - `ready` is false until the account's copy has loaded. A card must not
 *   open before then, or a new device would flash it in the second before
 *   the answer arrives.
 * - localStorage stays as a fast local echo (it answers before the network
 *   does) and as the migration path: a key found only on this device is
 *   written up to the account the first time it is seen.
 */
export function useTourSeen(key: string) {
	const { prefs, setPrefs, synced } = usePreferences();
	const onAccount = prefs.advanced.seenTours.includes(key);
	const onDevice =
		typeof window !== "undefined" && !!window.localStorage.getItem(key);

	const markSeen = useCallback(() => {
		try {
			window.localStorage.setItem(key, "1");
		} catch {
			/* private mode: the account copy still holds it */
		}
		if (!prefs.advanced.seenTours.includes(key))
			setPrefs({
				advanced: { seenTours: [...prefs.advanced.seenTours, key] },
			});
	}, [key, prefs.advanced.seenTours, setPrefs]);

	// Seen here before the account learned to remember: tell the account.
	useEffect(() => {
		if (synced && onDevice && !onAccount) markSeen();
	}, [synced, onDevice, onAccount, markSeen]);

	// And the reverse, so the local echo is right on the next cold start.
	useEffect(() => {
		if (!onAccount || onDevice) return;
		try {
			window.localStorage.setItem(key, "1");
		} catch {
			/* ignore */
		}
	}, [onAccount, onDevice, key]);

	return { ready: synced, seen: onAccount || onDevice, markSeen };
}
