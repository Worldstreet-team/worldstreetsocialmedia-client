"use client";

import { useAtomValue, useSetAtom } from "jotai";
import { useCallback, useEffect } from "react";
import { useRealtime } from "@/components/providers/RealtimeProvider";
import { getSpacesAction } from "@/lib/space.actions";
import { liveSpacesCountAtom, voiceRefreshAtom } from "@/store/voice.atom";

/**
 * Keeps the "rooms are live" pulse on the Space Voice nav honest from
 * anywhere in the app.
 *
 * No polling: the gateway publishes started/ended/cancelled on the `spaces`
 * channel, so one fetch on load plus those events is enough. A poll here
 * would mean every open tab hitting the directory on a timer forever just to
 * decide whether to show a 6px dot.
 */
export function SpacesLiveSync() {
  const { client } = useRealtime();
  const setCount = useSetAtom(liveSpacesCountAtom);
  const refreshTick = useAtomValue(voiceRefreshAtom);

  const sync = useCallback(async () => {
    const res = await getSpacesAction();
    if (res.success) setCount((res.live ?? []).length);
  }, [setCount]);

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
