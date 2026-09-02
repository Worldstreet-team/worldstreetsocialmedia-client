"use client";

import { useAtomValue } from "jotai";
import { useCallback, useEffect, useRef, useState } from "react";
import { requestSpeakAction, setSpeakerAction } from "@/lib/space.actions";
import { useRealtime } from "@/components/providers/RealtimeProvider";
import { userAtom } from "@/store/user.atom";

export interface RoomMember {
  id: string;
  username: string;
  avatar?: string;
  hand: boolean;
  isVerified?: boolean;
  verification?: { tier?: "bronze" | "silver" | "gold" } | null;
  badges?: import("@/components/ui/UserBadges").ProfileBadge[];
}

export interface RoomReaction {
  id: number;
  emoji: string;
}

let reactionSeq = 0;

/**
 * The live layer of a Space Voice room, carried on Ably channel
 * `space:<id>`: presence gives the real listener list (who is here, hands
 * raised), and lightweight `reaction` messages float over the stage.
 *
 * Deployed-gateway reality check: the Ably token this app runs on may not
 * yet grant `space:*` capabilities. Every attach/enter/publish failure is
 * caught and collapses `realtime` to false — the room stays fully usable on
 * REST + the caller's poll, it just shows counts instead of faces. When the
 * gateway's token capability ships, this hook lights up with no client
 * change.
 */
export function useSpaceRoom(spaceId: string | null) {
  const { client } = useRealtime();
  const me = useAtomValue(userAtom);
  const [members, setMembers] = useState<RoomMember[]>([]);
  const [reactions, setReactions] = useState<RoomReaction[]>([]);
  const [realtime, setRealtime] = useState(false);
  const [hand, setHand] = useState(false);
  const channelRef = useRef<ReturnType<
    NonNullable<typeof client>["channels"]["get"]
  > | null>(null);

  useEffect(() => {
    if (!client || !spaceId || !me) return;
    let cancelled = false;
    const channel = client.channels.get(`space:${spaceId}`);
    channelRef.current = channel;

    const syncMembers = async () => {
      try {
        const present = await channel.presence.get();
        if (cancelled) return;
        setMembers(
          present.map((p) => ({
            id: p.clientId ?? "",
            username:
              (p.data as RoomMember | undefined)?.username ?? "listener",
            avatar: (p.data as RoomMember | undefined)?.avatar,
            hand: !!(p.data as RoomMember | undefined)?.hand,
            isVerified: (p.data as RoomMember | undefined)?.isVerified,
          })),
        );
      } catch {
        /* presence denied — realtime already flagged off */
      }
    };

    const onReaction = (msg: { data?: { emoji?: string } }) => {
      const emoji = msg.data?.emoji;
      if (!emoji) return;
      const id = ++reactionSeq;
      setReactions((prev) => [...prev.slice(-11), { id, emoji }]);
      // Reactions are ephemeral by design — they burn away on their own.
      setTimeout(() => {
        setReactions((prev) => prev.filter((r) => r.id !== id));
      }, 2400);
    };

    (async () => {
      try {
        await channel.attach();
        if (cancelled) return;
        await channel.presence.enter({
          username: me.username,
          avatar: me.avatar,
          isVerified: me.isVerified,
          // Tier and marks ride presence too — without them the host's
          // participant popover showed every member as gold and wolf/W
          // marks never appeared in a room (tick audit 2026-09-02).
          verification: (me as any).verification ?? null,
          badges: (me as any).badges ?? [],
          hand: false,
        });
        if (cancelled) return;
        setRealtime(true);
        await syncMembers();
        channel.presence.subscribe(syncMembers);
        void channel.subscribe("reaction", onReaction);
      } catch {
        // Capability (40160) or transport failure — REST-only mode.
        if (!cancelled) setRealtime(false);
      }
    })();

    return () => {
      cancelled = true;
      channelRef.current = null;
      try {
        channel.presence.unsubscribe(syncMembers);
        channel.unsubscribe("reaction", onReaction);
        void channel.presence.leave();
        void channel.detach();
      } catch {
        /* leaving a channel we never attached to */
      }
      setMembers([]);
      setRealtime(false);
      setHand(false);
    };
  }, [client, spaceId, me]);

  const react = useCallback((emoji: string) => {
    // Show your own reaction instantly, whether or not publish is allowed.
    const id = ++reactionSeq;
    setReactions((prev) => [...prev.slice(-11), { id, emoji }]);
    setTimeout(() => {
      setReactions((prev) => prev.filter((r) => r.id !== id));
    }, 2400);
    channelRef.current?.publish("reaction", { emoji }).catch(() => {});
  }, []);

  const toggleHand = useCallback(() => {
    setHand((prev) => {
      const next = !prev;
      // Presence moves the hand on everyone's screen immediately…
      channelRef.current?.presence
        .update({
          username: me?.username,
          avatar: me?.avatar,
          isVerified: me?.isVerified,
          verification: (me as any)?.verification ?? null,
          badges: (me as any)?.badges ?? [],
          hand: next,
        })
        .catch(() => {});
      // …and the gateway records it, so the host is actually notified and
      // the request survives a reload. Presence alone made raising a hand
      // decorative: nobody was told, and there was no way to grant the mic.
      if (spaceId) void requestSpeakAction(spaceId, !next);
      return next;
    });
  }, [me, spaceId]);

  /** Host only: hand someone the mic, or take it back. */
  const setSpeaker = useCallback(
    async (profileId: string, grant: boolean) => {
      if (!spaceId) return { success: false, message: "No room" };
      return await setSpeakerAction(spaceId, profileId, grant);
    },
    [spaceId],
  );

  return { members, reactions, realtime, hand, react, toggleHand, setSpeaker };
}
