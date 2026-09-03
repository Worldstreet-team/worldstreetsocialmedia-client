"use client";

import type { Room } from "livekit-client";
import { useCallback, useEffect, useRef, useState } from "react";
import { getSpaceTokenAction } from "@/lib/space.actions";

export type AudioState =
  | "idle"
  | "connecting"
  | "listening"
  | "reconnecting"
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
  // iOS/Safari block un-gestured playback: tracks are attached but silent
  // until a tap calls unlockAudio(). True means the room must show the
  // "tap to listen" affordance — the alternative is a listener sitting in
  // a silent room believing it is quiet.
  const [needsUnlock, setNeedsUnlock] = useState(false);
  // The connected Room, exposed so the stage can read per-participant
  // audio levels (the breathing ring) and live publish permissions
  // (who is on stage) without re-rendering per frame.
  const [room, setRoom] = useState<Room | null>(null);
  // Bumping this tears the connection down and rebuilds it with a freshly
  // minted token — the recovery path for a dead connection, and the
  // fallback when a permission flip never reached this client live.
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
        // NOT_LIVE is not a failure: the room ended between the card and
        // the click, and "it's over" is the honest message.
        if (res.code === "NOT_LIVE") {
          setEnded(true);
          setState("idle");
        } else {
          setState(res.code === "AUDIO_OFF" ? "unavailable" : "failed");
        }
        return;
      }
      setCanSpeak(Boolean(res.canSpeak));

      try {
        const {
          Room: LKRoom,
          RoomEvent,
          Track,
          DisconnectReason,
          AudioPresets,
        } = await import("livekit-client");
        room = new LKRoom({
          // Talk, not music: the speech preset halves listener bandwidth
          // with no perceptible loss for voice. dtx stops sending during
          // silence, red rides out lossy mobile networks — both default
          // on, pinned here so a library default change can't regress us.
          publishDefaults: {
            audioPreset: AudioPresets.speech,
            dtx: true,
            red: true,
          },
        });
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
        // The browser refused autoplay (iOS Safari until a gesture). The
        // tracks are subscribed and silent; surface the tap-to-listen chip.
        room.on(RoomEvent.AudioPlaybackStatusChanged, () => {
          if (!cancelled && room) setNeedsUnlock(!room.canPlaybackAudio);
        });
        room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
          if (!cancelled) {
            setSpeakingIds(speakers.map((s) => s.identity));
          }
        });
        // LiveKit resumes dropped connections on its own (ICE restart,
        // resubscribe). Say so instead of pretending all is well over
        // dead air, and clear the banner when it lands.
        room.on(RoomEvent.SignalReconnecting, () => {
          if (!cancelled) setState("reconnecting");
        });
        room.on(RoomEvent.Reconnecting, () => {
          if (!cancelled) setState("reconnecting");
        });
        room.on(RoomEvent.Reconnected, () => {
          if (!cancelled) setState("listening");
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
        // A host-side mute lands as a server mute of the published track;
        // reflect it, or the mic button claims live while the server has
        // the track silenced.
        room.on(RoomEvent.TrackMuted, (_pub, participant) => {
          if (cancelled || !room) return;
          if (participant.identity === room.localParticipant.identity) {
            setMuted(true);
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

        // Direct first: most networks take the normal ICE path, and the
        // relay hop costs latency for everyone. Relay is the retry, not
        // the default — some corporate/mobile networks kill direct UDP,
        // which is why the fallback exists at all.
        try {
          await room.connect(res.url, res.token);
        } catch (err) {
          if (cancelled) throw err;
          await room.connect(res.url, res.token, {
            rtcConfig: { iceTransportPolicy: "relay" },
          });
        }
        if (cancelled) return;
        setRoom(room);
        setNeedsUnlock(!room.canPlaybackAudio);
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
      setNeedsUnlock(false);
      setEnded(false);
    };
  }, [spaceId, live, epoch]);

  /**
   * Drop the connection and rejoin with a freshly minted token. The retry
   * for a failed connection, and the fallback when the gateway's live
   * permission flip never reached this client.
   */
  const reconnect = useCallback(() => setEpoch((n) => n + 1), []);

  /** Must be called from a tap/click handler; one success unlocks the
   *  session and the chip goes away. */
  const unlockAudio = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    try {
      await room.startAudio();
      setNeedsUnlock(!room.canPlaybackAudio);
    } catch {
      // Still blocked — the chip stays and the next tap tries again.
    }
  }, []);

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
    needsUnlock,
    unlockAudio,
    room,
    reconnect,
  };
}
