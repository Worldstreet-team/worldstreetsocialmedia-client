"use client";

import { useEffect } from "react";
import { useSetAtom } from "jotai";
import { usePathname } from "next/navigation";
import { unreadNotificationsCountAtom } from "@/store/ui.atom";
import { getNotificationsAction } from "@/lib/notification.actions";
import { useUserEvents } from "@/hooks/useUserEvents";

/**
 * The nav's unread badge. Seeded once per app load, then kept honest in
 * realtime: the gateway publishes to this person's channel the moment a
 * like, reply, repost, follow or mention is written, so the badge moves
 * while they are looking at it rather than on the next navigation.
 */
export function NotificationCountSync() {
  const setCount = useSetAtom(unreadNotificationsCountAtom);
  const pathname = usePathname();

  useEffect(() => {
    let cancelled = false;
    getNotificationsAction().then((res) => {
      if (!cancelled && res.success && Array.isArray(res.data)) {
        setCount(res.data.filter((n: { read: boolean }) => !n.read).length);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [setCount]);

  useUserEvents(() => {
    // On the notifications page the list owns the arrival: it shows a "new
    // activity" pill and zeroes the badge. Incrementing here too would leave
    // the badge contradicting the list the person is looking at.
    if (pathname?.startsWith("/notifications")) return;
    setCount((c) => c + 1);
  });

  return null;
}
