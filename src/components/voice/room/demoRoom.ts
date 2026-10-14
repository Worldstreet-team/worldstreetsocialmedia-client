"use client";

import { useAtomValue } from "jotai";
import { useCallback, useMemo, useState } from "react";
import type { SpaceRow } from "@/components/voice/SpaceCard";
import type {
  RoomChatMessage,
  RoomMember,
  RoomReaction,
} from "@/hooks/useSpaceRoom";
import { userAtom } from "@/store/user.atom";
import type { RoomLive } from "./roster";

/*
 * DESIGN-REVIEW ONLY. A `demo-` room from `/voice?demo=1` has no Ably
 * channel and no LiveKit room, so the real live layer is empty and the
 * stage, the listener grid and the hands could never be judged with people
 * in them. This fills the same shape with seeded people, local-only chat,
 * reactions and your own hand. It runs for `demo-` ids and nothing else,
 * never touches the gateway, and the room wears a Demo chip while it does
 * (see lib/demoSeed.ts: no fake data shipped as real).
 */

const FIRST = [
  "Femi",
  "Gbenga",
  "Ngozi",
  "Bisi",
  "Chidi",
  "Ifeoma",
  "Musa",
  "Emeka",
  "Uche",
  "Sola",
  "Tobi",
  "Amaka",
  "Kunle",
  "Zainab",
  "Dayo",
  "Halima",
  "Segun",
  "Funke",
  "Obi",
  "Lara",
  "Kemi",
  "Tunde",
  "Yemi",
  "Ada",
];
const LAST = ["Okafor", "Adebayo", "Bakare", "Eze", "Bello", "Nwosu", "Ojo"];

const avatar = (seed: string) =>
  `https://api.dicebear.com/9.x/notionists/png?seed=${seed}&size=96&backgroundColor=1c1917`;

function seedMembers(row: SpaceRow): RoomMember[] {
  const n = Math.min(Math.max(row.membersCount, 12), 400);
  return Array.from({ length: n }, (_, i) => {
    const first = FIRST[i % FIRST.length];
    const last = LAST[(i * 3) % LAST.length];
    const handle = `${first.toLowerCase()}${i > FIRST.length ? i : ""}`;
    return {
      id: `demo-member-${i}`,
      username: handle,
      name: `${first} ${last}`,
      avatar: avatar(`${row.id}-${i}`),
      // Two hands up, so the hand badges and the count have something to
      // show.
      hand: i === 4 || i === 15,
      resolved: true,
    };
  });
}

let seq = 0;

export function useDemoRoomLive(row: SpaceRow | null): RoomLive | null {
  const me = useAtomValue(userAtom);
  const [hand, setHand] = useState(false);
  const [messages, setMessages] = useState<RoomChatMessage[]>([]);
  const [reactions, setReactions] = useState<RoomReaction[]>([]);
  const rowId = row?.id ?? "";
  const myId = me?._id ? String(me._id) : "";

  // biome-ignore lint/correctness/useExhaustiveDependencies: seeded once per room id
  const seeded = useMemo(() => (row ? seedMembers(row) : []), [rowId]);
  const stageHint = useMemo(
    () => new Set(seeded.slice(0, 2).map((m) => m.id)),
    [seeded],
  );

  const members = useMemo<RoomMember[]>(() => {
    if (!row) return [];
    const self: RoomMember[] =
      myId && !row.isHost
        ? [
            {
              id: myId,
              username: me?.username ?? "you",
              avatar: me?.avatar,
              hand,
              resolved: true,
            },
          ]
        : [];
    return [...seeded.slice(0, 2), ...self, ...seeded.slice(2)];
  }, [row, seeded, myId, me?.username, me?.avatar, hand]);

  const react = useCallback(
    (emoji: string) => {
      const id = ++seq + 1_000_000;
      setReactions((prev) => [
        ...prev.slice(-11),
        {
          id,
          emoji,
          from: me ? { name: me.username, avatar: me.avatar } : null,
        },
      ]);
      window.setTimeout(
        () => setReactions((prev) => prev.filter((r) => r.id !== id)),
        2400,
      );
    },
    [me],
  );

  const sendChat = useCallback(
    (text: string) => {
      const clean = text.trim().slice(0, 500);
      if (!clean || !myId) return false;
      setMessages((prev) => [
        ...prev,
        { id: `demo-${++seq}`, from: myId, text: clean, at: Date.now() },
      ]);
      return true;
    },
    [myId],
  );

  if (!row) return null;
  return {
    members,
    reactions,
    messages,
    sendChat,
    profileOf: () => undefined,
    realtime: true,
    hand,
    react,
    toggleHand: () => setHand((h) => !h),
    setSpeaker: async () => ({
      success: false as const,
      message: "This is a demo room",
    }),
    stageHint,
  };
}
