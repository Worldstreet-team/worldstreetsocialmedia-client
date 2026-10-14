"use client";

import { useMemo } from "react";
import {
  hostName,
  type SpaceRow,
  spaceListenerCount,
} from "@/components/voice/SpaceCard";
import type { useSpaceAudio } from "@/hooks/useSpaceAudio";
import type { RoomMember, useSpaceRoom } from "@/hooks/useSpaceRoom";

/**
 * The live layer of a room as the views consume it. The demo room
 * (`demoRoom.ts`) returns the same shape, plus `stageHint`: with no LiveKit
 * connection there are no publish permissions to read, so the seeded
 * speakers are named instead.
 */
export type RoomLive = ReturnType<typeof useSpaceRoom> & {
  stageHint?: ReadonlySet<string>;
};

export type RoomAudio = ReturnType<typeof useSpaceAudio>;

export type StageRole = "host" | "cohost" | "speaker";

/** One face on the stage, with everything its seat says about it. */
export interface StageSeatData {
  /** Profile id, which is also the LiveKit identity. Empty when the row
   *  predates `host._id` and presence has not told us either. */
  id: string;
  name: string;
  username: string;
  avatar?: string;
  role: StageRole;
  isMe: boolean;
  /** LiveKit's active-speaker set says this person is talking now. */
  speaking: boolean;
  /** Mic open, muted, or unknown (no audio link to ask, or not joined). */
  micOn: boolean | null;
  /** The presence row, for the host's popover. Null for the host seat. */
  member: RoomMember | null;
  resolved: boolean;
  isVerified?: boolean;
  verification?: { tier?: "bronze" | "silver" | "gold" } | null;
  badges?: RoomMember["badges"];
}

/** What a face is called under itself in the grid: the first word of the
 *  confirmed name, else the handle. */
export function firstName(m: Pick<RoomMember, "name" | "username">) {
  return m.name?.trim().split(/\s+/)[0] || m.username;
}

/**
 * Who is where in the room, worked out once for every view of it (the full
 * stage and the rail). Everything comes from what the room really knows:
 * the stage from LiveKit publish permissions (or the optimistic grant the
 * host just made), speaking from LiveKit's active-speaker set, mute from
 * the participant's mic publication, hands from presence, which moves in
 * lock-step with the gateway's speak request.
 */
export function useRoomRoster({
  row,
  audio,
  live,
  myId,
  staged,
}: {
  row: SpaceRow;
  audio: RoomAudio;
  live: RoomLive;
  myId: string;
  /** Grants the gateway accepted that LiveKit has not flipped yet. */
  staged?: Record<string, boolean>;
}) {
  const { members, realtime, stageHint } = live;
  const { room, speakingIds, stageVersion, canSpeak, muted, state } = audio;

  return useMemo(() => {
    // stageVersion is read so a mute or a grant redraws the seats; the
    // facts themselves live on `room`.
    void stageVersion;
    const hostKey = row.host._id ? String(row.host._id) : "";
    // The host's LiveKit identity is their profile id; presence carries it
    // as the clientId when the row itself predates the `_id` field.
    const hostId =
      hostKey ||
      members.find((m) => m.username === row.host.username)?.id ||
      "";
    const cohostIds = new Set(row.cohosts ?? []);
    const speaking = new Set(speakingIds);

    /** Is this participant allowed to publish (on stage)? */
    const isOnStage = (id: string) => {
      const p = room?.getParticipantByIdentity(id);
      if (p?.permissions) return Boolean(p.permissions.canPublish);
      if (staged && id in staged) return Boolean(staged[id]);
      return Boolean(stageHint?.has(id));
    };

    /** Open, muted, or unknown. Your own comes from the hook's state,
     *  which answers the instant you press the key. */
    const micOn = (id: string): boolean | null => {
      if (!id) return null;
      if (id === myId) {
        return canSpeak && state === "listening" ? !muted : null;
      }
      const p = room?.getParticipantByIdentity(id);
      return p ? p.isMicrophoneEnabled : null;
    };

    const isHostMember = (m: RoomMember) =>
      (hostId && m.id === hostId) || m.username === row.host.username;
    const others = members.filter((m) => !isHostMember(m));

    const hostMember = members.find(isHostMember);
    const host: StageSeatData = {
      id: hostId,
      name: hostName(row.host),
      username: row.host.username,
      avatar: row.host.avatar ?? hostMember?.avatar,
      role: "host",
      isMe: Boolean(hostId && hostId === myId) || row.isHost,
      speaking: Boolean(hostId && speaking.has(hostId)),
      micOn: micOn(hostId),
      member: null,
      resolved: true,
      isVerified: row.host.isVerified,
      verification: row.host.verification,
      badges: row.host.badges,
    };

    const seatOf = (m: RoomMember, role: StageRole): StageSeatData => ({
      id: m.id,
      name: m.name || m.username,
      username: m.username,
      avatar: m.avatar,
      role,
      isMe: m.id === myId,
      speaking: speaking.has(m.id),
      micOn: micOn(m.id),
      member: m,
      resolved: m.resolved,
      isVerified: m.isVerified,
      verification: m.verification,
      badges: m.badges,
    });

    // Tiers, in order: the host, the co-hosts, then the speakers.
    const cohosts = others.filter((m) => cohostIds.has(m.id));
    const speakers = others.filter(
      (m) => !cohostIds.has(m.id) && isOnStage(m.id),
    );
    const stage: StageSeatData[] = [
      host,
      ...cohosts.map((m) => seatOf(m, "cohost")),
      ...speakers.map((m) => seatOf(m, "speaker")),
    ];

    // The audience, hands first so the host sees who is asking without
    // hunting a grid of hundreds. The sort is stable, so everyone else
    // keeps the order they arrived in.
    const audience = others.filter(
      (m) => !cohostIds.has(m.id) && !isOnStage(m.id),
    );
    const handsUp = audience.filter((m) => m.hand);
    const ordered =
      handsUp.length > 0
        ? [...handsUp, ...audience.filter((m) => !m.hand)]
        : audience;

    const listenerCount = realtime
      ? Math.max(members.length, 1)
      : Math.max(spaceListenerCount(row), 1);

    return {
      hostId,
      cohostIds,
      isOnStage,
      stage,
      audience: ordered,
      hands: handsUp.length,
      listenerCount,
      /** Names for the screen reader's "who is talking" line. */
      speakingNames: stage.filter((s) => s.speaking).map((s) => s.name),
    };
  }, [
    row,
    members,
    realtime,
    stageHint,
    room,
    speakingIds,
    stageVersion,
    canSpeak,
    muted,
    state,
    myId,
    staged,
  ]);
}
