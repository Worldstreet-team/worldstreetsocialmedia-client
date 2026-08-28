"use client";

import type { Room } from "livekit-client";
import { useCallback, useEffect, useRef, useState } from "react";
import { getSpaceTokenAction } from "@/lib/space.actions";

export type AudioState =
  | "idle"
  | "connecting"
  | "listening"
  | "unavailable"
  | "failed";

/**
 * Live audio for a Space Voice room.
 *
 * The gateway is the authority: it knows who hosts the space and mints a
 * token that can publish only for them. Everyone else gets a
 * subscribe-only token, so a listener cannot start talking by editing
 * anything client-side.
 *
 * `unavailable` is a designed state, not an error — a deployment without
 * LiveKit credentials answers 503 and the room stays a working listening
 * room rather than showing a broken mic.
 */
export function useSpaceAudio(spaceId: string | null, live: boolean) {
  const [state, setState] = useState<AudioState>("idle");
  const [canSpeak, setCanSpeak] = useState(false);
  // The room was deleted out from under us — the host ended the space (or
  // the sweep reaped it). Distinct from "failed": nothing is broken, it's
  // over, and the UI should say so instead of showing a dead mic.
  const [ended, setEnded] = useState(false);
  const [muted, setMuted] = useState(true);
  const [speakingIds, setSpeakingIds] = useState<string[]>([]);
  // The connected Room, exposed so the stage can read per-participant
  // audio levels (the breathing ring) and live publish permissions
  // (who is on stage) without re-rendering per frame.
  const [room, setRoom] = useState<Room | null>(null);
  // Bumping this tears the connection down and rebuilds it with a freshly
  // minted token — the gateway mints publish rights per-join, so a speaker
  // grant/revoke asks the client to reconnect.
  const [epoch, setEpoch] = useState(0);
  const roomRef = useRef<Room | null>(null);
  const audioElsRef = useRef<HTMLAudioElement[]>([]);

  useEffect(() => {
    if (!spaceId || !live) return;
    let cancelled = false;
    let room: Room | null = null;

    (async () => {
      setState("connecting");
      const res = await getSpaceTokenAction(spaceId);
      if (cancelled) return;
      if (!res.success || !res.token || !res.url) {
        setState(res.code === "AUDIO_OFF" ? "unavailable" : "failed");
        return;
      }
      setCanSpeak(Boolean(res.canSpeak));

      try {
        const {
          Room: LKRoom,
          RoomEvent,
          Track,
          DisconnectReason,
        } = await import("livekit-client");
        room = new LKRoom({ adaptiveStream: true });
        roomRef.current = room;

        // Remote audio is attached to detached elements: a room has no video
        // surface to hang them on, and the browser still needs real elements
        // to play through.
        room.on(RoomEvent.TrackSubscribed, (track) => {
          if (track.kind !== Track.Kind.Audio) return;
          const el = track.attach() as HTMLAudioElement;
          el.autoplay = true;
          document.body.appendChild(el);
          audioElsRef.current.push(el);
        });
        room.on(RoomEvent.TrackUnsubscribed, (track) => {
          for (const el of track.detach()) el.remove();
        });
        room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
          if (!cancelled) {
            setSpeakingIds(speakers.map((s) => s.identity));
          }
        });
        room.on(RoomEvent.Disconnected, (reason) => {
          if (cancelled) return;
          // Ending a space now deletes the LiveKit room server-side, which
          // lands here as ROOM_DELETED for everyone still connected.
          if (reason === DisconnectReason.ROOM_DELETED) {
            setEnded(true);
            setState("idle");
          } else {
            setState("failed");
          }
        });
        // A mic grant/revoke flips the live connection's permission from
        // the gateway (updateParticipant). Track it so the mic button
        // appears the moment the host grants, with no rejoin.
        room.on(
          RoomEvent.ParticipantPermissionsChanged,
          (_prev, participant) => {
            if (cancelled || !room) return;
            if (participant.identity === room.localParticipant.identity) {
              const can = Boolean(participant.permissions?.canPublish);
              setCanSpeak(can);
              // A revoked speaker is force-muted by LiveKit; reflect it.
              if (!can) setMuted(true);
            }
          },
        );

        // Relay-only ICE, same as the broadcaster dock: direct UDP dies on
        // some networks and takes the connection with it.
        await room.connect(res.url, res.token, {
          rtcConfig: { iceTransportPolicy: "relay" },
        });
        if (cancelled) return;
        setRoom(room);
        // Nobody is ever unmuted on arrival — speaking is always deliberate.
        setState("listening");
      } catch {
        if (!cancelled) setState("failed");
      }
    })();

    return () => {
      cancelled = true;
      for (const el of audioElsRef.current) el.remove();
      audioElsRef.current = [];
      void roomRef.current?.disconnect();
      roomRef.current = null;
      setRoom(null);
      setState("idle");
      setCanSpeak(false);
      setMuted(true);
      setSpeakingIds([]);
      setEnded(false);
    };
  }, [spaceId, live, epoch]);

  /**
   * Drop the connection and rejoin with a freshly minted token. Called when
   * the gateway says our speaker status changed: the live permission flip
   * (updateParticipant) covers the current session, but the token is the
   * authority, and rejoining republishes with the rights we now hold.
   */
  const reconnect = useCallback(() => setEpoch((n) => n + 1), []);

  const toggleMute = useCallback(async () => {
    const room = roomRef.current;
    if (!room || !canSpeak) return;
    const next = !muted;
    try {
      await room.localParticipant.setMicrophoneEnabled(!next);
      setMuted(next);
    } catch {
      // Mic permission denied — stay visibly muted rather than lying.
      setMuted(true);
    }
  }, [muted, canSpeak]);

  return {
    state,
    canSpeak,
    muted,
    speakingIds,
    toggleMute,
    ended,
    room,
    reconnect,
  };
}
