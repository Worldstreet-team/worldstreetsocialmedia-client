"use client";

import { CaretUp, Check, Waveform, X } from "@phosphor-icons/react";
import { motion } from "framer-motion";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRealtime } from "@/components/providers/RealtimeProvider";
import ConfirmModal from "@/components/ui/ConfirmModal";
import ConfirmModalPortal from "@/components/ui/ConfirmModalPortal";
import {
  OverlayPanel,
  OverlayScrim,
  useOverlayDismiss,
} from "@/components/ui/Overlay";
import { SafeAvatar } from "@/components/ui/SafeAvatar";
import { useToast } from "@/components/ui/Toast/ToastContext";
import { UserBadges } from "@/components/ui/UserBadges";
import {
  EqBars,
  hostName,
  spaceBackground,
  spaceListenerCount,
  type SpaceRow,
} from "@/components/voice/SpaceCard";
import SpaceRoom from "@/components/voice/SpaceRoom";
import { useT } from "@/i18n/client";
import { useSpaceAudio } from "@/hooks/useSpaceAudio";
import { useSpaceHeartbeat } from "@/hooks/useSpaceHeartbeat";
import { useSpaceRoom } from "@/hooks/useSpaceRoom";
import { isDemoId } from "@/lib/demoSeed";
import { formatCompact } from "@/lib/utils";
import {
  endSpaceAction,
  getSpaceAction,
  leaveSpaceAction,
  respondInviteAction,
} from "@/lib/space.actions";
import { followUserAction } from "@/lib/user.actions";
import { followingIdsAtom } from "@/store/ui.atom";
import { userAtom } from "@/store/user.atom";
import { voiceRefreshAtom, voiceSessionAtom } from "@/store/voice.atom";

/** Which room this browser was in, so a reload doesn't orphan it. */
const SESSION_KEY = "ws-voice-session";

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
  // A pending "come up and speak" from the host — consent, not conscription.
  const [invite, setInvite] = useState<{ spaceId: string; from: string } | null>(
    null,
  );
  // The room this listener was in when it ended: the closing sheet's data.
  const [endedRow, setEndedRow] = useState<SpaceRow | null>(null);
  const [followingIds, setFollowingIds] = useAtom(followingIdsAtom);
  const [followBusy, setFollowBusy] = useState(false);
  useOverlayDismiss(endedRow !== null, () => setEndedRow(null));

  // Newer copy than the dictionaries: t() echoes the key when missing.
  const tf = (key: string, fallback: string) => {
    const v = t(key);
    return v === key ? fallback : v;
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  // Hooks can't sit behind the early return below, so the heartbeat reads the
  // session defensively and simply does nothing when there isn't one.
  // The audio connection lives HERE, above the maximize/minimize split, so
  // docking the room never tears it down. It used to live inside SpaceRoom,
  // which unmounts on minimize — the dock said "in the room" over dead air.
  const liveSpaceId =
    session && !isDemoId(session.row.id) && session.row.status === "live"
      ? session.row.id
      : null;
  const audio = useSpaceAudio(liveSpaceId, session?.row.status === "live");
  // Presence, chat and reactions live up here for the same reason the audio
  // does: minimizing used to remove you from the guest list (and silently
  // strand your raised hand) because SpaceRoom unmounts on minimize.
  const roomLive = useSpaceRoom(liveSpaceId);

  // Stage changes arrive on my own `user:` channel. The gateway flips the
  // live LiveKit permission (updateParticipant), which normally lands before
  // the toast does — the mic simply appears. The reconnect is only the
  // fallback for a flip that never reached this connection, so it waits and
  // checks rather than dropping everyone's audio on every grant.
  const { client } = useRealtime();
  const me = useAtomValue(userAtom);
  const isHost = Boolean(session?.row.isHost);
  const reconnect = audio.reconnect;
  const room = audio.room;
  useEffect(() => {
    if (!client || !me?._id || !liveSpaceId) return;
    const channel = client.channels.get(`user:${me._id}`);
    const grantWithFallback = () => {
      setTimeout(() => {
        const can = Boolean(room?.localParticipant?.permissions?.canPublish);
        if (!can) reconnect();
      }, 2000);
    };
    const onNotif = (m: { data?: Record<string, unknown> }) => {
      const d = m?.data ?? {};
      if (d.spaceId !== liveSpaceId) return;
      if (d.type === "space:speaker_granted") {
        toast(tf("voice.onStage", "You're on stage"), { type: "success" });
        grantWithFallback();
      } else if (d.type === "space:speaker_revoked") {
        toast(
          tf("voice.offStageSelf", "The host moved you back to the audience"),
          { type: "success" },
        );
        // No rejoin needed: LiveKit unpublishes revoked tracks itself and
        // the permission event already flipped the local mic state.
      } else if (d.type === "space:cohost_granted") {
        toast(tf("voice.cohostNow", "You're a co-host now"), {
          type: "success",
        });
        grantWithFallback();
      } else if (d.type === "space:cohost_revoked") {
        toast(
          tf("voice.cohostOver", "The host took back your co-host role"),
          { type: "success" },
        );
      } else if (d.type === "space:muted") {
        toast(tf("voice.mutedByHost", "The host muted your mic"), {
          type: "success",
        });
      } else if (d.type === "space:removed") {
        toast(
          tf("voice.removedFromSpace", "You were removed from this space"),
          { type: "error" },
        );
        setSession(null);
        bumpRefresh((n) => n + 1);
      } else if (d.type === "space:speaker_invite") {
        setInvite({
          spaceId: String(d.spaceId ?? ""),
          from: typeof d.from === "string" ? d.from : "The host",
        });
      } else if (d.type === "space:speak_request" && isHost) {
        // The gateway records the hand and tells the host directly, so a
        // request lands even while the room is docked.
        const from = typeof d.from === "string" ? d.from : "Someone";
        toast(`${from} — ${t("voice.speakRequests")}`, { type: "success" });
      }
    };
    void channel.subscribe("notification", onNotif);
    return () => channel.unsubscribe("notification", onNotif);
    // biome-ignore lint/correctness/useExhaustiveDependencies: tf is render-stable per t.
  }, [client, me?._id, liveSpaceId, isHost, reconnect, room, toast, t, setSession, bumpRefresh]);

  // Host-class heartbeat: co-hosts beat too, so a room with a deputy in it
  // survives a host drop (succession-lite; the sweep only reaps rooms no
  // host-class client has touched for three minutes).
  const managedId =
    session &&
    !isDemoId(session.row.id) &&
    (session.row.isHost || session.row.isCohost)
      ? session.row.id
      : null;
  useSpaceHeartbeat({
    spaceId: managedId,
    active: Boolean(managedId),
    // Ended from another tab, or swept after this client went quiet: stop
    // showing a room that is no longer there.
    onDead: () => {
      setSession(null);
      bumpRefresh((n) => n + 1);
    },
  });

  // The host ended the space (or the sweep reaped it): LiveKit deleted the
  // room and every listener was disconnected with ROOM_DELETED. Close the
  // session and show the closing sheet — the "it's over" moment is where a
  // good room converts listeners into followers, not a toast.
  useEffect(() => {
    if (!audio.ended || !session || session.row.isHost) return;
    setEndedRow(session.row);
    setSession(null);
    bumpRefresh((n) => n + 1);
  }, [audio.ended, session, setSession, bumpRefresh]);

  // Remember which room this browser is in, and pick a hosted room back up
  // after a reload — the sweep gives a silent host three minutes, and a
  // host who refreshed mid-room used to spend them hunting the directory.
  useEffect(() => {
    try {
      if (session && !isDemoId(session.row.id)) {
        localStorage.setItem(SESSION_KEY, session.row.id);
      } else if (session === null) {
        localStorage.removeItem(SESSION_KEY);
      }
    } catch {}
  }, [session]);
  useEffect(() => {
    if (!mounted || session) return;
    let stale = false;
    try {
      const id = localStorage.getItem(SESSION_KEY);
      if (!id) return;
      void getSpaceAction(id).then((res) => {
        if (stale) return;
        // Hosts only: auto-restoring a listener would start audio without
        // a gesture (blocked anyway) and surprise them. The host has a
        // room dying without them; that is worth restoring unasked.
        if (res.success && res.space?.status === "live" && res.space.isHost) {
          setSession({ row: res.space, minimized: true });
        } else {
          localStorage.removeItem(SESSION_KEY);
        }
      });
    } catch {}
    return () => {
      stale = true;
    };
    // biome-ignore lint/correctness/useExhaustiveDependencies: restore runs once after mount.
  }, [mounted]);

  const endedHostId = endedRow?.host._id ? String(endedRow.host._id) : "";
  const alreadyFollowing =
    !!endedHostId && followingIds.includes(endedHostId);
  const followHost = async () => {
    if (!endedHostId || followBusy || alreadyFollowing) return;
    setFollowBusy(true);
    const res = await followUserAction(endedHostId);
    setFollowBusy(false);
    if (res.success) {
      setFollowingIds((prev) =>
        prev.includes(endedHostId) ? prev : [...prev, endedHostId],
      );
      toast(tf("voice.followedHost", "Following"), { type: "success" });
    } else {
      toast(res.message || t("voice.endFailed"), { type: "error" });
    }
  };

  const overlays = mounted
    ? createPortal(
        <>
          <ConfirmModal
            isOpen={invite !== null}
            onClose={() => {
              const inv = invite;
              setInvite(null);
              if (inv) void respondInviteAction(inv.spaceId, false);
            }}
            onConfirm={async () => {
              const inv = invite;
              setInvite(null);
              if (!inv) return;
              const res = await respondInviteAction(inv.spaceId, true);
              if (!res.success || !res.granted) {
                toast(
                  res.message ||
                    tf("voice.inviteGone", "That invitation is gone"),
                  { type: "error" },
                );
              }
            }}
            title={tf("voice.inviteTitle", "Invited to speak")}
            message={`${invite?.from ?? ""} — ${tf(
              "voice.inviteBody",
              "wants to bring you to the stage. Your mic stays muted until you turn it on.",
            )}`}
            confirmText={tf("voice.accept", "Join the stage")}
            cancelText={tf("voice.notNow", "Not now")}
          />
          {endedRow && (
            <ConfirmModalPortal>
              <OverlayScrim onClose={() => setEndedRow(null)} />
              <OverlayPanel
                variant="center"
                label={tf("voice.endedTitle", "This space has ended")}
              >
                <div className="flex flex-col items-center px-6 pb-6 pt-5 text-center">
                  <span
                    className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-pill"
                    style={{ background: spaceBackground(endedRow) }}
                  >
                    <Waveform size={18} weight="fill" className="text-[#fafaf9]" />
                  </span>
                  <h2 className="mt-3 font-display text-[17px] font-semibold leading-snug text-primary">
                    {tf("voice.endedTitle", "This space has ended")}
                  </h2>
                  <p className="mt-1 max-w-[30ch] font-sans text-[13px] leading-relaxed text-muted">
                    {endedRow.title}
                  </p>
                  <p className="mt-2 font-sans text-[12px] text-subtle tabular-nums">
                    {formatCompact(spaceListenerCount(endedRow))}{" "}
                    {tf("voice.wereHere", "people were in the room")}
                  </p>
                  <div className="mt-4 flex w-full items-center justify-center gap-2.5">
                    <span className="relative h-8 w-8 shrink-0 overflow-hidden rounded-pill bg-chip">
                      <SafeAvatar src={endedRow.host.avatar} />
                    </span>
                    <span className="flex min-w-0 items-center gap-1">
                      <span className="truncate font-sans text-[13.5px] font-semibold text-primary">
                        {hostName(endedRow.host)}
                      </span>
                      <UserBadges
                        isVerified={endedRow.host.isVerified}
                        verification={(endedRow.host as any).verification}
                        size={12}
                      />
                    </span>
                    <button
                      type="button"
                      disabled={followBusy || alreadyFollowing}
                      onClick={() => void followHost()}
                      className={
                        alreadyFollowing
                          ? "flex h-8 shrink-0 items-center gap-1 rounded-pill bg-raised px-3 font-sans text-[12px] font-semibold text-muted cursor-default"
                          : "flex h-8 shrink-0 items-center rounded-pill bg-primary px-3 font-sans text-[12px] font-semibold text-page transition-colors hover:bg-muted cursor-pointer disabled:opacity-60"
                      }
                    >
                      {alreadyFollowing ? (
                        <>
                          <Check size={12} weight="bold" />
                          {tf("voice.followingHost", "Following")}
                        </>
                      ) : (
                        tf("voice.followHost", "Follow")
                      )}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEndedRow(null)}
                    className="mt-5 h-10 w-full rounded-pill bg-chip font-sans text-[13px] font-semibold text-primary transition-colors hover:bg-raised cursor-pointer"
                  >
                    {t("common.close")}
                  </button>
                </div>
              </OverlayPanel>
            </ConfirmModalPortal>
          )}
        </>,
        document.body,
      )
    : null;

  if (!session) return <>{overlays}</>;
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
      <>
        <SpaceRoom
          row={row}
          audio={audio}
          roomLive={roomLive}
          onMinimize={() => setSession({ row, minimized: true })}
          onLeave={leave}
          onEnd={end}
        />
        {overlays}
      </>
    );
  }

  if (!mounted) return null;

  return (
    <>
      {createPortal(
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
      )}
      {overlays}
    </>
  );
}
