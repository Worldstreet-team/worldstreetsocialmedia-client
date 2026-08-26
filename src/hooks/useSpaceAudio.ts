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
 * Live audio for a Street Voice room.
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
  const [muted, setMuted] = useState(true);
  const [speakingIds, setSpeakingIds] = useState<string[]>([]);
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
        room.on(RoomEvent.Disconnected, () => {
          if (!cancelled) setState("failed");
        });

        // Relay-only ICE, same as the broadcaster dock: direct UDP dies on
        // some networks and takes the connection with it.
        await room.connect(res.url, res.token, {
          rtcConfig: { iceTransportPolicy: "relay" },
        });
        if (cancelled) return;
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
      setState("idle");
      setCanSpeak(false);
      setMuted(true);
      setSpeakingIds([]);
    };
  }, [spaceId, live]);

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

  return { state, canSpeak, muted, speakingIds, toggleMute };
}
