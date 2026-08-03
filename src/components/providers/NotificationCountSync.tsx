"use client";

import { useEffect } from "react";
import { useSetAtom } from "jotai";
import { unreadNotificationsCountAtom } from "@/store/ui.atom";
import { getNotificationsAction } from "@/lib/notification.actions";

/**
 * Seeds the nav's unread-notifications badge once per app load. Renders
 * nothing. Lives in the root layout so the badge is right on every page,
 * not just after visiting /notifications.
 */
export function NotificationCountSync() {
  const setCount = useSetAtom(unreadNotificationsCountAtom);

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

  return null;
}
