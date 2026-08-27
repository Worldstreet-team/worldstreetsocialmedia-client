import { atom } from "jotai";
import type { AppNotification } from "@/components/notifications/types";

/**
 * The notification list, fetched ONCE per app load and shared.
 *
 * `NotificationCountSync` already pulled this on every load and kept only
 * `filter(!read).length`, throwing the rest away — so the popover opening and
 * fetching the same list again was the second request for data the app was
 * already holding. It reads this instead, which is why the panel has no
 * loading state on open: there is nothing to wait for.
 *
 * Kept fresh by the realtime `user` channel rather than by polling — a new
 * notification arrives as an event, so a refetch is only needed when one does.
 */
export const notificationsAtom = atom<AppNotification[]>([]);

/** Distinguishes "loaded and genuinely empty" from "not fetched yet". */
export const notificationsLoadedAtom = atom(false);
