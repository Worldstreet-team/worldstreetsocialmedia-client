"use client";

import { useEffect } from "react";
import { heartbeatSpaceAction } from "@/lib/space.actions";

/**
 * "Still here" for a room you are hosting.
 *
 * Without it a host who closed the tab, lost their laptop lid, or crashed left
 * a room sitting at status "live" forever — advertising itself at the top of
 * everyone's rail, with nobody inside and no way in. The gateway closes rooms
 * whose host has gone quiet for three minutes; this is what keeps a room that
 * genuinely is being hosted from being swept up with them.
 *
 * A minute between beats gives the sweep three misses of tolerance, so one
 * flaky request or a brief sleep never costs a host their room.
 */
const BEAT_MS = 60_000;

export function useSpaceHeartbeat({
  spaceId,
  active,
  onDead,
}: {
  spaceId: string | null;
  /** Only the host beats; a listener leaving is not the room ending. */
  active: boolean;
  /** The gateway says this room is no longer live — ended from elsewhere. */
  onDead?: () => void;
}) {
  useEffect(() => {
    if (!spaceId || !active) return;

    let cancelled = false;

    const beat = async () => {
      const res = await heartbeatSpaceAction(spaceId);
      if (cancelled) return;
      // `alive: false` means the row is no longer live-and-hosted-by-me:
      // ended in another tab, or swept. Either way this client is holding a
      // room that doesn't exist, and should stop pretending.
      if (res.success && !res.alive) onDead?.();
    };

    // Beat immediately so a room is protected from the first second, not
    // from the first minute.
    void beat();
    const id = setInterval(() => void beat(), BEAT_MS);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [spaceId, active, onDead]);
}
