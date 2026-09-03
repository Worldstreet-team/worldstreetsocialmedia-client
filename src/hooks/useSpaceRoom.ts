"use client";

import { useAtomValue } from "jotai";
import { useCallback, useEffect, useRef, useState } from "react";
import { requestSpeakAction, setSpeakerAction } from "@/lib/space.actions";
import { resolveProfileIdsAction } from "@/lib/user.actions";
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
  /** False until the gateway confirmed who this id is. Unresolved members
   *  render name and face from presence but never a badge — badges are
   *  trust marks and presence payloads are client-published. */
  resolved: boolean;
}

export interface RoomReaction {
  id: number;
  /** Reaction kind id (see SpaceRoom's REACTION_SET) or legacy emoji. */
  emoji: string;
  /** Who sent it, for the Meet-style attribution chip. */
  from?: { name: string; avatar?: string } | null;
}

export interface RoomChatMessage {
  id: string;
  /** Sender profile id (the Ably clientId — enforced by the token). */
  from: string;
  text: string;
  at: number;
}

/** What the gateway's resolver returns for one profile id. */
interface ResolvedProfile {
  id: string;
  username: string;
  name: string;
  avatar?: string;
  isVerified?: boolean;
  tier?: "bronze" | "silver" | "gold";
  badges?: import("@/components/ui/UserBadges").ProfileBadge[];
}

let reactionSeq = 0;
let chatSeq = 0;

const CHAT_LIMIT = 200;
const CHAT_MAX_LEN = 500;

/**
 * The live layer of a Space Voice room, carried on Ably channel
 * `space:<id>`.
 *
 * Three planes ride it: presence (who is here, hands raised), `reaction`
 * floats, and the `chat` stream for people who would rather type. The
 * channel is client-publishable, so nothing display-worthy is trusted from
 * a payload: presence and chat carry ids, and every name, face and badge
 * is resolved server-side through /api/users/resolve — a tampered client
 * can shout, but it cannot wear someone else's verification.
 *
 * Deployed-gateway reality check: if the Ably token doesn't grant
 * `space:*`, every attach/enter/publish failure collapses `realtime` to
 * false and the room stays usable on REST + the caller's poll.
 */
export function useSpaceRoom(spaceId: string | null) {
  const { client } = useRealtime();
  const me = useAtomValue(userAtom);
  const [members, setMembers] = useState<RoomMember[]>([]);
  const [reactions, setReactions] = useState<RoomReaction[]>([]);
  const [messages, setMessages] = useState<RoomChatMessage[]>([]);
  const [realtime, setRealtime] = useState(false);
  const [hand, setHand] = useState(false);
  const channelRef = useRef<ReturnType<
    NonNullable<typeof client>["channels"]["get"]
  > | null>(null);
  // Server-confirmed identities, kept across leaves so chat history stays
  // named after someone walks out. Ref for reads inside callbacks, state
  // bump to re-render when a resolve lands.
  const profilesRef = useRef<Map<string, ResolvedProfile>>(new Map());
  const [, setProfileTick] = useState(0);
  const resolvingRef = useRef<Set<string>>(new Set());

  const myId = me?._id ? String(me._id) : "";

  /** Fetch identities for ids we haven't confirmed yet, batched. */
  const resolveIds = useCallback((ids: string[]) => {
    const missing = ids.filter(
      (id) =>
        id && !profilesRef.current.has(id) && !resolvingRef.current.has(id),
    );
    if (missing.length === 0) return;
    for (const id of missing) resolvingRef.current.add(id);
    void resolveProfileIdsAction(missing)
      .then((res) => {
        if (res.success) {
          for (const u of res.users as ResolvedProfile[]) {
            if (u?.id) profilesRef.current.set(String(u.id), u);
          }
          setProfileTick((n) => n + 1);
        }
      })
      .finally(() => {
        for (const id of missing) resolvingRef.current.delete(id);
      });
  }, []);

  /** A member row from a presence entry plus whatever we have confirmed. */
  const shapeMember = useCallback(
    (id: string, data: Record<string, unknown> | undefined): RoomMember => {
      const known = profilesRef.current.get(id);
      if (known) {
        return {
          id,
          username: known.username,
          avatar: known.avatar,
          hand: !!data?.hand,
          isVerified: known.isVerified,
          verification: known.tier ? { tier: known.tier } : null,
          badges: known.badges,
          resolved: true,
        };
      }
      // Not confirmed yet: presence name and face as placeholders, no
      // trust marks. Resolution replaces this row in-place when it lands.
      return {
        id,
        username: typeof data?.username === "string" ? data.username : "listener",
        avatar: typeof data?.avatar === "string" ? data.avatar : undefined,
        hand: !!data?.hand,
        resolved: false,
      };
    },
    [],
  );

  useEffect(() => {
    if (!client || !spaceId || !me) return;
    let cancelled = false;
    const channel = client.channels.get(`space:${spaceId}`);
    channelRef.current = channel;

    const syncMembers = async () => {
      try {
        const present = await channel.presence.get();
        if (cancelled) return;
        const ids = present.map((p) => p.clientId ?? "").filter(Boolean);
        resolveIds(ids);
        setMembers(
          present.map((p) =>
            shapeMember(p.clientId ?? "", p.data as Record<string, unknown>),
          ),
        );
      } catch {
        /* presence denied — realtime already flagged off */
      }
    };
    // Presence fires per join/leave/update and each sync refetches the whole
    // set; in a busy room that is quadratic. One trailing refetch per 300ms
    // window keeps the roster honest without the stampede.
    let syncTimer: ReturnType<typeof setTimeout> | null = null;
    const syncSoon = () => {
      if (syncTimer) return;
      syncTimer = setTimeout(() => {
        syncTimer = null;
        void syncMembers();
      }, 300);
    };

    const onReaction = (msg: {
      clientId?: string;
      data?: { emoji?: string };
    }) => {
      const emoji = msg.data?.emoji;
      if (!emoji) return;
      // Our own reactions render optimistically in react(); Ably echoes
      // every publish back, and without this skip each one floated twice.
      if (msg.clientId && msg.clientId === myId) return;
      const sender = msg.clientId
        ? profilesRef.current.get(msg.clientId)
        : undefined;
      const id = ++reactionSeq;
      setReactions((prev) => [
        ...prev.slice(-11),
        {
          id,
          emoji,
          from: sender
            ? { name: sender.username, avatar: sender.avatar }
            : null,
        },
      ]);
      // Reactions are ephemeral by design — they burn away on their own.
      setTimeout(() => {
        setReactions((prev) => prev.filter((r) => r.id !== id));
      }, 2400);
    };

    const onChat = (msg: {
      clientId?: string;
      data?: { id?: string; text?: string };
    }) => {
      const text = typeof msg.data?.text === "string" ? msg.data.text : "";
      const from = msg.clientId ?? "";
      if (!text.trim() || !from) return;
      const id =
        typeof msg.data?.id === "string" && msg.data.id
          ? msg.data.id
          : `${from}-${Date.now()}`;
      if (!profilesRef.current.has(from)) resolveIds([from]);
      setMessages((prev) => {
        // The echo of our own publish (and any duplicate) is dropped by id.
        if (prev.some((m) => m.id === id)) return prev;
        return [
          ...prev.slice(-(CHAT_LIMIT - 1)),
          { id, from, text: text.slice(0, CHAT_MAX_LEN), at: Date.now() },
        ];
      });
    };

    (async () => {
      try {
        await channel.attach();
        if (cancelled) return;
        await channel.presence.enter({
          // Display fields still ride presence for clients from before the
          // server-resolved roster; new clients ignore them for anyone the
          // resolver has confirmed.
          username: me.username,
          avatar: me.avatar,
          hand: false,
        });
        if (cancelled) return;
        setRealtime(true);
        await syncMembers();
        channel.presence.subscribe(syncSoon);
        void channel.subscribe("reaction", onReaction);
        void channel.subscribe("chat", onChat);
      } catch {
        // Capability (40160) or transport failure — REST-only mode.
        if (!cancelled) setRealtime(false);
      }
    })();

    return () => {
      cancelled = true;
      channelRef.current = null;
      if (syncTimer) clearTimeout(syncTimer);
      try {
        channel.presence.unsubscribe(syncSoon);
        channel.unsubscribe("reaction", onReaction);
        channel.unsubscribe("chat", onChat);
        void channel.presence.leave();
        void channel.detach();
      } catch {
        /* leaving a channel we never attached to */
      }
      setMembers([]);
      setMessages([]);
      setRealtime(false);
      setHand(false);
    };
  }, [client, spaceId, me, myId, resolveIds, shapeMember]);

  // A resolve landing re-shapes the current roster in place.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the map size is the signal a resolve landed.
  useEffect(() => {
    setMembers((prev) =>
      prev.map((m) => (m.resolved ? m : shapeMember(m.id, { ...m }))),
    );
  }, [profilesRef.current.size, shapeMember]);

  const react = useCallback(
    (emoji: string) => {
      // Show your own reaction instantly; the Ably echo is skipped by
      // clientId in onReaction, so it renders exactly once everywhere.
      const id = ++reactionSeq;
      setReactions((prev) => [
        ...prev.slice(-11),
        {
          id,
          emoji,
          from: me ? { name: me.username, avatar: me.avatar } : null,
        },
      ]);
      setTimeout(() => {
        setReactions((prev) => prev.filter((r) => r.id !== id));
      }, 2400);
      channelRef.current?.publish("reaction", { emoji }).catch(() => {});
    },
    [me],
  );

  /** Say it in text. Optimistic locally, deduped by id on the echo. */
  const sendChat = useCallback(
    (text: string) => {
      const clean = text.trim().slice(0, CHAT_MAX_LEN);
      if (!clean || !myId) return false;
      const id = `${myId}-${Date.now()}-${++chatSeq}`;
      setMessages((prev) => [
        ...prev.slice(-(CHAT_LIMIT - 1)),
        { id, from: myId, text: clean, at: Date.now() },
      ]);
      channelRef.current?.publish("chat", { id, text: clean }).catch(() => {});
      return true;
    },
    [myId],
  );

  /** Confirmed identity for a profile id (chat rendering). */
  const profileOf = useCallback(
    (id: string): ResolvedProfile | undefined => profilesRef.current.get(id),
    [],
  );

  const toggleHand = useCallback(() => {
    setHand((prev) => {
      const next = !prev;
      // Presence moves the hand on everyone's screen immediately…
      channelRef.current?.presence
        .update({
          username: me?.username,
          avatar: me?.avatar,
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

  return {
    members,
    reactions,
    messages,
    sendChat,
    profileOf,
    realtime,
    hand,
    react,
    toggleHand,
    setSpeaker,
  };
}
