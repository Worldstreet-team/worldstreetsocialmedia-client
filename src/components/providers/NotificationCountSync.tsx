"use client";

import { useEffect } from "react";
import { useSetAtom } from "jotai";
import { usePathname } from "next/navigation";
import { unreadNotificationsCountAtom } from "@/store/ui.atom";
import {
  notificationsAtom,
  notificationsLoadedAtom,
} from "@/store/notifications.atom";
import { useGatewayRead } from "@/hooks/useGateway";
import { cacheKeys, fetchCached, invalidate } from "@/lib/cache";

/** Notifications arrive as realtime events, so a minute of reuse costs nothing
 *  in freshness and removes a duplicate request on every notifications visit. */
const NOTIFICATIONS_TTL = 60_000;
import { useUserEvents } from "@/hooks/useUserEvents";

/**
 * The nav's unread badge. Seeded once per app load, then kept honest in
 * realtime: the gateway publishes to this person's channel the moment a
 * like, reply, repost, follow or mention is written, so the badge moves
 * while they are looking at it rather than on the next navigation.
 */
export function NotificationCountSync() {
  const setCount = useSetAtom(unreadNotificationsCountAtom);
  // The list itself is KEPT now, not discarded. This request already happened
  // on every load; holding its result is what lets the header popover open
  // with content instead of skeletons and a second identical fetch.
  const setNotifications = useSetAtom(notificationsAtom);
  const setLoaded = useSetAtom(notificationsLoadedAtom);
  const pathname = usePathname();
  const read = useGatewayRead();

  useEffect(() => {
    let cancelled = false;
    // Direct gateway read — same wrapper shape the action returned, minus
    // the Next hop and the per-client action serialization.
    fetchCached(
      cacheKeys.notifications(),
      () => read("/api/notifications"),
      NOTIFICATIONS_TTL,
    ).then((res: any) => {
      if (cancelled) return;
      if (res.success && Array.isArray(res.data)) {
        setNotifications(res.data);
        setCount(res.data.filter((n: { read: boolean }) => !n.read).length);
      }
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [setCount, setNotifications, setLoaded, read]);

  const refresh = () => {
    // Something arrived: the cached copy is stale by definition, so drop it
    // before refetching or fetchCached would hand back the old list.
    invalidate(cacheKeys.notifications());
    void fetchCached(
      cacheKeys.notifications(),
      () => read("/api/notifications"),
      NOTIFICATIONS_TTL,
    ).then((res: any) => {
      if (res.success && Array.isArray(res.data)) setNotifications(res.data);
    });
  };

  useUserEvents(() => {
    // Something arrived, so the cached list is now behind. Refetch HERE, on the
    // event, rather than polling or re-fetching every time the panel opens.
    refresh();
    // On the notifications page the list owns the arrival: it shows a "new
    // activity" pill and zeroes the badge. Incrementing here too would leave
    // the badge contradicting the list the person is looking at.
    if (pathname?.startsWith("/notifications")) return;
    setCount((c) => c + 1);
  });

  return null;
}
