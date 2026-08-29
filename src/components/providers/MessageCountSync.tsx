"use client";

import { useEffect } from "react";
import { useSetAtom } from "jotai";
import { unreadMessagesCountAtom } from "@/store/messageCache";
import { useGatewayRead } from "@/hooks/useGateway";

/**
 * Seeds the DM badge from the server on app load.
 *
 * Without this the badge started at zero every reload and only counted
 * messages that arrived while the tab was open, so it was a per-session
 * counter pretending to be an account-level one.
 */
export function MessageCountSync() {
  const setCount = useSetAtom(unreadMessagesCountAtom);
  const read = useGatewayRead();

  useEffect(() => {
    let cancelled = false;
    read("/api/messages/conversations").then((res) => {
      if (cancelled || !res.success || !Array.isArray(res.data)) return;
      setCount(
        res.data.reduce(
          (sum: number, c: { unreadCount?: number }) => sum + (c.unreadCount ?? 0),
          0,
        ),
      );
    });
    return () => {
      cancelled = true;
    };
  }, [setCount, read]);

  return null;
}
