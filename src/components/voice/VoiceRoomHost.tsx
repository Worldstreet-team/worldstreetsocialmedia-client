"use client";

import { CaretUp, Waveform, X } from "@phosphor-icons/react";
import { motion } from "framer-motion";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRealtime } from "@/components/providers/RealtimeProvider";
import { useToast } from "@/components/ui/Toast/ToastContext";
import { EqBars, spaceBackground } from "@/components/voice/SpaceCard";
import SpaceRoom from "@/components/voice/SpaceRoom";
import { useT } from "@/i18n/client";
import { useSpaceAudio } from "@/hooks/useSpaceAudio";
import { useSpaceHeartbeat } from "@/hooks/useSpaceHeartbeat";
import { isDemoId } from "@/lib/demoSeed";
import { endSpaceAction, leaveSpaceAction } from "@/lib/space.actions";
import { userAtom } from "@/store/user.atom";
import { voiceRefreshAtom, voiceSessionAtom } from "@/store/voice.atom";

/**
 * Mounted once in the root layout: whichever room you're in renders here,
 * so it outlives navigation. Expanded it's the full stage; minimised it's a
 * dock pill that keeps the room alive while you use the rest of the app.
 */
export default function VoiceRoomHost() {
  const t = useT();
  const { toast } = useToast();
  const [session, setSession] = useAtom(voiceSessionAtom);
  const bumpRefresh = useSetAtom(voiceRefreshAtom);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Hooks can't sit behind the early return below, so the heartbeat reads the
  // session defensively and simply does nothing when there isn't one.
  // The audio connection lives HERE, above the maximize/minimize split, so
  // docking the room never tears it down. It used to live inside SpaceRoom,
  // which unmounts on minimize — the dock said "in the room" over dead air.
  const audio = useSpaceAudio(
    session && !isDemoId(session.row.id) ? session.row.id : null,
    session?.row.status === "live",
  );

  // Speaker grants/revokes arrive on my own `user:` channel — the gateway
  // flips the live LiveKit permission, but the token itself is minted
  // per-join, so on either event we reconnect with a fresh token (and, on a
  // grant, republish rights). This lives HERE so a promotion still lands
  // while the room is minimized to the dock.
  const { client } = useRealtime();
  const me = useAtomValue(userAtom);
  const liveSpaceId =
    session && !isDemoId(session.row.id) && session.row.status === "live"
      ? session.row.id
      : null;
  const isHost = Boolean(session?.row.isHost);
  const reconnect = audio.reconnect;
  useEffect(() => {
    if (!client || !me?._id || !liveSpaceId) return;
    const channel = client.channels.get(`user:${me._id}`);
    const onNotif = (m: { data?: Record<string, unknown> }) => {
      const d = m?.data ?? {};
      if (d.spaceId !== liveSpaceId) return;
      // Newer copy than the dictionaries: t() echoes the key when missing.
      const tf = (key: string, fallback: string) => {
        const v = t(key);
        return v === key ? fallback : v;
      };
      if (d.type === "space:speaker_granted") {
        toast(tf("voice.onStage", "You're on stage"), { type: "success" });
        reconnect();
      } else if (d.type === "space:speaker_revoked") {
        toast(
          tf("voice.offStageSelf", "The host moved you back to the audience"),
          { type: "success" },
        );
        reconnect();
      } else if (d.type === "space:speak_request" && isHost) {
        // The gateway records the hand and tells the host directly, so a
        // request lands even while the room is docked.
        const from = typeof d.from === "string" ? d.from : "Someone";
        toast(`${from} — ${t("voice.speakRequests")}`, { type: "success" });
      }
    };
    void channel.subscribe("notification", onNotif);
    return () => channel.unsubscribe("notification", onNotif);
  }, [client, me?._id, liveSpaceId, isHost, reconnect, toast, t]);

  const hostedId =
    session?.row.isHost && !isDemoId(session.row.id) ? session.row.id : null;
  useSpaceHeartbeat({
    spaceId: hostedId,
    active: Boolean(hostedId),
    // Ended from another tab, or swept after this client went quiet: stop
    // showing a room that is no longer there.
    onDead: () => {
      setSession(null);
      bumpRefresh((n) => n + 1);
    },
  });

  // The host ended the space (or the sweep reaped it): LiveKit deleted the
  // room and every listener was disconnected with ROOM_DELETED. Close the
  // session here — this also covers the minimized dock, which used to sit
  // in the corner advertising a room that no longer existed.
  useEffect(() => {
    if (!audio.ended || !session || session.row.isHost) return;
    toast(t("voice.endedByHost"), { type: "success" });
    setSession(null);
    bumpRefresh((n) => n + 1);
  }, [audio.ended, session, toast, t, setSession, bumpRefresh]);

  if (!session) return null;
  const { row, minimized } = session;

  const leave = async () => {
    setSession(null);
    if (!isDemoId(row.id) && !row.isHost) {
      await leaveSpaceAction(row.id);
      bumpRefresh((n) => n + 1);
    }
  };

  const end = async () => {
    setSession(null);
    if (isDemoId(row.id)) return;
    const res = await endSpaceAction(row.id);
    if (res.success) {
      toast(t("voice.ended"), { type: "success" });
      bumpRefresh((n) => n + 1);
    } else {
      toast(res.message || t("voice.endFailed"), { type: "error" });
    }
  };

  if (!minimized) {
    return (
      <SpaceRoom
        row={row}
        audio={audio}
        onMinimize={() => setSession({ row, minimized: true })}
        onLeave={leave}
        onEnd={end}
      />
    );
  }

  if (!mounted) return null;

  return createPortal(
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
      className="fixed bottom-nav right-4 z-toast md:bottom-4"
    >
      <div className="flex items-center gap-2 rounded-pill glass-dock backdrop-blur-xl backdrop-saturate-150 py-2 pl-2 pr-2.5 shadow-nav">
        <button
          type="button"
          onClick={() => setSession({ row, minimized: false })}
          aria-label={t("voice.expandRoom")}
          className="flex items-center gap-2.5 cursor-pointer"
        >
          <span
            className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-pill"
            style={{ background: spaceBackground(row) }}
          >
            <span className="absolute inset-0 bg-[#0c0a09]/35" />
            <Waveform
              size={14}
              weight="fill"
              className="relative text-[#fafaf9]"
            />
          </span>
          <span className="hidden min-w-0 max-w-[168px] flex-col items-start sm:flex">
            <span className="w-full truncate font-sans text-[12.5px] font-semibold glass-ink">
              {row.title}
            </span>
            <span className="flex items-center gap-1.5 font-sans text-[10.5px] glass-ink-dim">
              <EqBars className="h-2.5 text-gold" />
              {t("voice.inRoomNow")}
            </span>
          </span>
          <CaretUp size={13} weight="bold" className="shrink-0 opacity-60" />
        </button>
        <button
          type="button"
          onClick={row.isHost ? end : leave}
          aria-label={row.isHost ? t("voice.end") : t("voice.leave")}
          className="flex h-8 w-8 items-center justify-center rounded-pill bg-danger/90 text-white transition-colors hover:bg-danger cursor-pointer"
        >
          <X size={13} weight="bold" />
        </button>
      </div>
    </motion.div>,
    document.body,
  );
}
