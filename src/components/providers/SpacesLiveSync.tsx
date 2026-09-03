"use client";

import { useAtomValue, useSetAtom } from "jotai";
import { useCallback, useEffect } from "react";
import { useRealtime } from "@/components/providers/RealtimeProvider";
import { getSpacesAction } from "@/lib/space.actions";
import {
  spacesFetchedAtAtom,
  spacesLiveAtom,
  spacesLoadedAtom,
  spacesUpcomingAtom,
} from "@/store/spaces.atom";
import { voiceRefreshAtom } from "@/store/voice.atom";

/**
 * THE spaces directory fetcher, mounted once in the root layout.
 *
 * One fetch on load plus the gateway's `spaces` events (started / ended /
 * cancelled) keeps the shared atoms fresh, and everything downstream — the
 * nav pulse (derived count), the right-rail carousel, the /voice hub —
 * reads those atoms instead of fetching for itself. Three surfaces used to
 * issue three identical listing calls per app load, each running the
 * gateway's stale-room sweep against an already-queueing database.
 */
export function SpacesLiveSync() {
  const { client } = useRealtime();
  const setLive = useSetAtom(spacesLiveAtom);
  const setUpcoming = useSetAtom(spacesUpcomingAtom);
  const setLoaded = useSetAtom(spacesLoadedAtom);
  const setFetchedAt = useSetAtom(spacesFetchedAtAtom);
  const refreshTick = useAtomValue(voiceRefreshAtom);

  const sync = useCallback(async () => {
    const res = await getSpacesAction();
    if (res.success) {
      setLive(res.live ?? []);
      setUpcoming(res.upcoming ?? []);
      setLoaded(true);
      setFetchedAt(Date.now());
    }
  }, [setLive, setUpcoming, setLoaded, setFetchedAt]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: refreshTick is the signal; its value is unused.
  useEffect(() => {
    void sync();
  }, [sync, refreshTick]);

  useEffect(() => {
    if (!client) return;
    const channel = client.channels.get("spaces");
    const onEvent = () => void sync();
    void channel.subscribe(onEvent);
    return () => channel.unsubscribe(onEvent);
  }, [client, sync]);

  return null;
}
