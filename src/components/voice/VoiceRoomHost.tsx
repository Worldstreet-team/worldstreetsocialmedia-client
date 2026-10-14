"use client";

import { Check, Microphone, MicrophoneSlash, X } from "@phosphor-icons/react";
import { AnimatePresence, motion } from "framer-motion";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRealtime } from "@/components/providers/RealtimeProvider";
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
  hostName,
  spaceBackground,
  SpaceThumb,
  spaceListenerCount,
  type SpaceRow,
} from "@/components/voice/SpaceCard";
import SpaceRoom from "@/components/voice/SpaceRoom";
import { RailRoom } from "@/components/voice/RailRoom";
import { useDemoRoomLive } from "@/components/voice/room/demoRoom";
import type { RoomLive } from "@/components/voice/room/roster";
import { useAppPathname } from "@/i18n/useAppPathname";
import { useT } from "@/i18n/client";
import { useSpaceAudio } from "@/hooks/useSpaceAudio";
import { useSpaceHeartbeat } from "@/hooks/useSpaceHeartbeat";
import { useSpaceRoom } from "@/hooks/useSpaceRoom";
import { isDemoId } from "@/lib/demoSeed";
import { press, swap } from "@/lib/motion-presets";
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

  // The third rail (owner 2026-10-12): when the right rail is on screen, a
  // minimised room docks into its slot instead of the floating pill. The
  // slot is looked up on every route change and resize, since the rail is
  // only there on wide screens and on pages that have it.
  const pathname = useAppPathname();
  const [railSlot, setRailSlot] = useState<HTMLElement | null>(null);
  useEffect(() => {
    const find = () => {
      const el = document.getElementById("ws-rail-room");
      const aside = el?.parentElement;
      setRailSlot(el && aside && aside.getClientRects().length > 0 ? el : null);
    };
    // After the route's layout has painted.
    const id = window.requestAnimationFrame(find);
    window.addEventListener("resize", find);
    return () => {
      window.cancelAnimationFrame(id);
      window.removeEventListener("resize", find);
    };
  }, [pathname, session?.minimized]);

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
  const realLive = useSpaceRoom(liveSpaceId);
  // A `demo-` room (`/voice?demo=1`) has no channel to be present on, so a
  // design review would only ever see an empty stage. The demo layer seeds
  // people locally for those ids and nothing else.
  const demoLive = useDemoRoomLive(
    session && isDemoId(session.row.id) ? session.row : null,
  );
  const roomLive: RoomLive = demoLive ?? realLive;

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
    void channel.subscribe("notification", onNotif).catch(() => {});
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
          {/* Invited to speak, in the Halo style (owner pick, round 3): the
              host's face in a halo, then one clear choice. */}
          <ConfirmModalPortal>
            <AnimatePresence>
              {invite && (
                <>
                  <OverlayScrim
                    key="invite-scrim"
                    blur
                    onClose={() => {
                      const inv = invite;
                      setInvite(null);
                      if (inv) void respondInviteAction(inv.spaceId, false);
                    }}
                  />
                  <OverlayPanel
                    key="invite-panel"
                    variant="center"
                    ground="solid"
                    label={tf("voice.inviteTitle", "Invited to speak")}
                    className="max-w-[360px]"
                  >
                    <div className="flex flex-col items-center gap-3 px-6 pb-6 pt-7 text-center">
                      <span className="mb-1 flex h-24 w-24 items-center justify-center rounded-pill bg-brand/10">
                        <span className="block h-[72px] w-[72px] overflow-hidden rounded-pill bg-raised ring-2 ring-brand/30">
                          <SafeAvatar src={session?.row.host.avatar} />
                        </span>
                      </span>
                      <h2 className="font-display text-[calc(19px*var(--ws-fs))] font-semibold text-primary">
                        {tf("voice.inviteTitle", "Invited to speak")}
                      </h2>
                      <p className="max-w-[30ch] font-sans text-[calc(14px*var(--ws-fs))] leading-relaxed text-muted">
                        {invite.from}{" "}
                        {tf(
                          "voice.inviteBody",
                          "wants to bring you to the stage. Your mic stays muted until you turn it on.",
                        )}
                      </p>
                      <button
                        type="button"
                        onClick={async () => {
                          const inv = invite;
                          setInvite(null);
                          const res = await respondInviteAction(inv.spaceId, true);
                          if (!res.success || !res.granted) {
                            toast(res.message || tf("voice.inviteGone", "That invitation is gone"), { type: "error" });
                          }
                        }}
                        className="mt-2 flex h-12 w-full cursor-pointer items-center justify-center rounded-pill bg-brand font-sans text-[calc(14px*var(--ws-fs))] font-bold text-brand-on transition-colors hover:bg-brand-active"
                      >
                        {tf("voice.accept", "Join the stage")}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const inv = invite;
                          setInvite(null);
                          void respondInviteAction(inv.spaceId, false);
                        }}
                        className="flex h-11 w-full cursor-pointer items-center justify-center rounded-pill bg-primary/[0.06] font-sans text-[calc(14px*var(--ws-fs))] font-semibold text-primary transition-colors hover:bg-primary/[0.1]"
                      >
                        {tf("voice.notNow", "Not now")}
                      </button>
                    </div>
                  </OverlayPanel>
                </>
              )}
            </AnimatePresence>
          </ConfirmModalPortal>
          {endedRow && (
            <ConfirmModalPortal>
              <OverlayScrim onClose={() => setEndedRow(null)} />
              <OverlayPanel
                variant="center"
                label={tf("voice.endedTitle", "This space has ended")}
              >
                <div className="flex flex-col items-center px-6 pb-6 pt-5 text-center">
                  <SpaceThumb
                    row={endedRow}
                    glyphSize={18}
                    className="h-12 w-12 rounded-pill"
                  />
                  <h2 className="mt-3 font-display text-[calc(17px*var(--ws-fs))] font-semibold leading-snug text-primary">
                    {tf("voice.endedTitle", "This space has ended")}
                  </h2>
                  <p className="mt-1 max-w-[30ch] font-sans text-[calc(13px*var(--ws-fs))] leading-relaxed text-muted">
                    {endedRow.title}
                  </p>
                  <p className="mt-2 font-sans text-[calc(12px*var(--ws-fs))] text-subtle tabular-nums">
                    {formatCompact(spaceListenerCount(endedRow))}{" "}
                    {tf("voice.wereHere", "people were in the room")}
                  </p>
                  <div className="mt-4 flex w-full items-center justify-center gap-2.5">
                    <span className="relative h-8 w-8 shrink-0 overflow-hidden rounded-pill bg-chip">
                      <SafeAvatar src={endedRow.host.avatar} />
                    </span>
                    <span className="flex min-w-0 items-center gap-1">
                      <span className="truncate font-sans text-[calc(13.5px*var(--ws-fs))] font-semibold text-primary">
                        {hostName(endedRow.host)}
                      </span>
                      <UserBadges
                        isVerified={endedRow.host.isVerified}
                        verification={(endedRow.host as any).verification}
                        size={12}
                      />
                    </span>
                    <motion.button
                      {...press}
                      type="button"
                      disabled={followBusy || alreadyFollowing}
                      onClick={() => void followHost()}
                      className={
                        alreadyFollowing
                          ? "flex h-8 shrink-0 items-center gap-1 rounded-pill bg-raised px-3 font-sans text-[calc(12px*var(--ws-fs))] font-semibold text-muted cursor-default"
                          : "flex h-8 shrink-0 items-center rounded-pill bg-primary px-3 font-sans text-[calc(12px*var(--ws-fs))] font-semibold text-page transition-colors hover:bg-muted cursor-pointer disabled:opacity-60"
                      }
                    >
                      <AnimatePresence mode="wait" initial={false}>
                        <motion.span
                          key={alreadyFollowing ? "following" : "follow"}
                          {...swap}
                          className="flex items-center gap-1"
                        >
                          {alreadyFollowing ? (
                            <>
                              <Check size={12} weight="bold" />
                              {tf("voice.followingHost", "Following")}
                            </>
                          ) : (
                            tf("voice.followHost", "Follow")
                          )}
                        </motion.span>
                      </AnimatePresence>
                    </motion.button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEndedRow(null)}
                    className="mt-5 h-10 w-full rounded-pill bg-chip font-sans text-[calc(13px*var(--ws-fs))] font-semibold text-primary transition-colors hover:bg-raised cursor-pointer"
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

  if (railSlot && railSlot.isConnected) {
    return (
      <>
        {createPortal(
          <RailRoom
            row={row}
            audio={audio}
            roomLive={roomLive}
            onExpand={() => setSession({ row, minimized: false })}
            onLeave={row.isHost ? end : leave}
          />,
          railSlot,
        )}
        {overlays}
      </>
    );
  }

  return (
    <>
      {createPortal(
        <motion.div
          initial={swap.initial}
          animate={swap.animate}
          className="fixed inset-x-3 bottom-nav z-toast sm:inset-x-auto sm:right-4 md:bottom-4"
        >
          {/* The live bar (owner pick, Space Voice on a phone): faces of who's
              in the room, the title and count, and the two controls that
              matter while you're elsewhere in the app. */}
          <div
            className="ws-on-dark relative overflow-hidden rounded-pill shadow-pop sm:w-[360px]"
            style={{ background: spaceBackground(row) }}
          >
          {/* The room's cover under a deep wash, frosted (owner 2026-10-13):
              the collapsed room keeps the room's colour, dark in both themes. */}
          <div className="flex items-center gap-2.5 bg-[#04060a]/80 py-1.5 pl-1.5 pr-1.5 backdrop-blur-2xl backdrop-saturate-150">
            <button
              type="button"
              onClick={() => setSession({ row, minimized: false })}
              aria-label={t("voice.expandRoom")}
              className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 text-left"
            >
              <span className="flex shrink-0 -space-x-2.5">
                {[row.host.avatar, ...roomLive.members.filter((m) => m.username !== row.host.username).slice(0, 2).map((m) => m.avatar)].map((src, i) => (
                  <span
                    // biome-ignore lint/suspicious/noArrayIndexKey: positional faces
                    key={i}
                    // Positioned: SafeAvatar fills its nearest positioned
                    // box, which without this was the whole pill.
                    className="relative block h-9 w-9 overflow-hidden rounded-pill bg-raised ring-2 ring-surface"
                  >
                    <SafeAvatar src={src} />
                  </span>
                ))}
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="truncate font-sans text-[calc(13.5px*var(--ws-fs))] font-semibold text-primary">
                  {row.title}
                </span>
                <span className="flex items-center gap-1.5 font-sans text-[calc(11.5px*var(--ws-fs))] text-muted tabular-nums">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-pill bg-danger" />
                  {formatCompact(Math.max(roomLive.members.length, 1))} {t("voice.listeners")}
                </span>
              </span>
            </button>
            {audio.canSpeak && (
              <button
                type="button"
                onClick={audio.toggleMute}
                aria-label={t("voice.micToggle")}
                aria-pressed={!audio.muted}
                className={
                  audio.muted
                    ? "flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-pill bg-primary/[0.08] text-primary"
                    : "flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-pill bg-brand text-brand-on"
                }
              >
                {audio.muted ? <MicrophoneSlash size={16} weight="bold" /> : <Microphone size={16} weight="fill" />}
              </button>
            )}
            <button
              type="button"
              onClick={row.isHost ? end : leave}
              aria-label={row.isHost ? t("voice.end") : t("voice.leave")}
              className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-pill bg-danger/15 text-danger transition-colors hover:bg-danger/25"
            >
              <X size={14} weight="bold" />
            </button>
          </div>
          </div>
        </motion.div>,
        document.body,
      )}
      {overlays}
    </>
  );
}
