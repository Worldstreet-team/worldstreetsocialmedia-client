"use client";

import {
  ArrowsInSimple,
  HandPalm,
  LinkSimple,
  Microphone,
  MicrophoneSlash,
  SignOut,
  Users,
} from "@phosphor-icons/react";
import clsx from "clsx";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { UserBadges } from "@/components/ui/UserBadges";
import ConfirmModalPortal from "@/components/ui/ConfirmModalPortal";
import { SafeAvatar } from "@/components/ui/SafeAvatar";
import { useToast } from "@/components/ui/Toast/ToastContext";
import {
  EqBars,
  hostName,
  spaceBackground,
  type SpaceRow,
} from "@/components/voice/SpaceCard";
import { useSpaceAudio } from "@/hooks/useSpaceAudio";
import { useSpaceRoom } from "@/hooks/useSpaceRoom";
import { useT } from "@/i18n/client";
import { storyCanvasCss } from "@/lib/editor/storyBackgrounds";

const EASE = [0.2, 0, 0, 1] as const;
const REACTIONS = ["👏", "🔥", "💛", "📈", "😂"];

interface SpaceRoomProps {
  row: SpaceRow;
  /** Collapse to the floating dock — the room keeps running. */
  onMinimize: () => void;
  /** Leave for good (listeners). */
  onLeave: () => void;
  /** Host only — ends the room for everyone. */
  onEnd: (row: SpaceRow) => void;
}

function elapsedLabel(startedAt?: string) {
  if (!startedAt) return null;
  const mins = Math.max(
    0,
    Math.floor((Date.now() - new Date(startedAt).getTime()) / 60_000),
  );
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

/**
 * The room itself — a Spaces-style stage over the room's mesh art.
 *
 * Presence (Ably `space:<id>`) is the guest list: real faces when the token
 * allows it, an honest count when it doesn't. Reactions float up the stage.
 * The mic tile is present but disabled — audio transport is the LiveKit
 * hookup, and this UI refuses to pretend otherwise.
 */
export default function SpaceRoom({
  row,
  onMinimize,
  onLeave,
  onEnd,
}: SpaceRoomProps) {
  const t = useT();
  const { toast } = useToast();
  const reduce = useReducedMotion();
  const { members, reactions, realtime, hand, react, toggleHand, setSpeaker } =
    useSpaceRoom(row.id);
  const {
    state: audio,
    canSpeak,
    muted,
    speakingIds,
    toggleMute,
  } = useSpaceAudio(row.id, row.status === "live");
  /**
   * Hand the mic to someone who asked for it.
   *
   * Their token was minted as a listener, so the grant only takes effect when
   * their client reconnects — the gateway notifies them to do exactly that.
   */
  const grantMic = async (profileId: string, username: string) => {
    const res = await setSpeaker(profileId, true);
    if (res?.success) {
      toast(`${username} — ${t("voice.approve")}`, { type: "success" });
    } else {
      toast(res?.message || t("voice.endFailed"), { type: "error" });
    }
  };

  const hostSpeaking = speakingIds.length > 0;
  const [elapsed, setElapsed] = useState(() => elapsedLabel(row.startedAt));

  useEffect(() => {
    const timer = setInterval(
      () => setElapsed(elapsedLabel(row.startedAt)),
      30_000,
    );
    return () => clearInterval(timer);
  }, [row.startedAt]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Escape collapses to the dock; it must never silently drop the room.
      if (e.key === "Escape") onMinimize();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onMinimize]);

  const shareRoom = async () => {
    const url = `${window.location.origin}/voice/${row.id}`;
    try {
      await navigator.clipboard.writeText(url);
      toast(t("voice.linkCopied"), { type: "success" });
    } catch {
      toast(t("voice.linkFailed"), { type: "error" });
    }
  };

  const listeners = members.filter((m) => m.username !== row.host.username);
  const listenerCount = realtime
    ? Math.max(members.length, 1)
    : Math.max(row.membersCount, 1);

  return (
    <ConfirmModalPortal>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2, ease: EASE }}
        className="fixed inset-0 z-modal glass-veil backdrop-blur-lg backdrop-saturate-150 glass-ink flex items-end sm:items-center justify-center sm:p-6"
        onClick={onMinimize}
      >
        <motion.div
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.99 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.32, ease: EASE }}
          role="dialog"
          aria-modal="true"
          aria-label={row.title}
          className="relative flex h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl sm:h-auto sm:max-h-[86vh] sm:w-[560px] sm:rounded-2xl glass-dock backdrop-blur-xl backdrop-saturate-150"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Mesh header band — the card's art carries into the room. */}
          <div
            className="relative shrink-0 px-5 pb-5 pt-4"
            style={{ background: spaceBackground(row) }}
          >
            <span className="absolute inset-0 bg-gradient-to-t from-[#16130f] via-[#0c0a09]/35 to-[#0c0a09]/20" />
            <div className="relative flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1.5 rounded-[4px] bg-danger px-1.5 py-px text-[9px] font-bold tracking-wide text-white font-sans">
                  <span className="h-1 w-1 rounded-pill bg-white animate-pulse" />
                  {t("live.badge")}
                </span>
                {elapsed && (
                  <span className="font-sans text-[11px] font-medium text-[#fafaf9]/70 tabular-nums">
                    {elapsed}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={shareRoom}
                  aria-label={t("voice.share")}
                  className="flex h-9 items-center gap-1.5 rounded-pill glass-chip backdrop-blur-md px-3 font-sans text-[12px] font-semibold transition-colors cursor-pointer"
                >
                  <LinkSimple size={14} weight="bold" />
                  {t("voice.share")}
                </button>
                <button
                  type="button"
                  onClick={onMinimize}
                  aria-label={t("voice.minimize")}
                  className="flex h-9 w-9 items-center justify-center rounded-pill glass-chip backdrop-blur-md transition-colors cursor-pointer"
                >
                  <ArrowsInSimple size={15} weight="bold" />
                </button>
              </div>
            </div>
            <h2 className="relative mt-4 font-display text-[21px] font-semibold leading-snug text-[#fafaf9]">
              {row.title}
            </h2>
            {row.description && (
              <p className="relative mt-1.5 font-sans text-[12.5px] leading-relaxed text-[#fafaf9]/70">
                {row.description}
              </p>
            )}
            <div className="relative mt-2 flex items-center gap-2 font-sans text-[12px] text-[#fafaf9]/70">
              <EqBars className="text-gold" />
              <span className="flex items-center gap-1 font-semibold tabular-nums">
                <Users size={13} weight="bold" />
                {listenerCount} {t("voice.listeners")}
              </span>
              {row.community && (
                <span className="truncate rounded-pill bg-[#fafaf9]/12 px-2 py-px text-[10.5px] font-medium">
                  {row.community.name}
                </span>
              )}
            </div>
          </div>

          {/* Stage */}
          <div className="relative flex-1 min-h-0 overflow-y-auto no-scrollbar px-5 py-5">
            {/* Host seat */}
            <div className="flex flex-col items-center gap-2">
              <span
                className={clsx(
                  "relative h-20 w-20 overflow-hidden rounded-pill bg-[#1c1917] ring-offset-2 ring-offset-transparent transition-all",
                  hostSpeaking
                    ? "ring-[3px] ring-brand"
                    : "ring-2 ring-brand/45",
                )}
              >
                <SafeAvatar src={row.host.avatar} />
              </span>
              <span className="flex items-center gap-1">
                <span className="font-sans text-[14px] font-semibold glass-ink">
                  {hostName(row.host)}
                </span>
                <UserBadges
                  isVerified={row.host.isVerified}
                  badges={(row.host as any).badges}
                  size={13}
                />
              </span>
              <span className="rounded-pill bg-brand/15 px-2.5 py-px font-sans text-[10px] font-bold uppercase tracking-[0.1em] text-gold">
                {t("voice.hostBadge")}
              </span>
            </div>

            {/* Listeners */}
            <div className="mt-7">
              <h3 className="glass-eyebrow font-sans">
                {t("voice.inTheRoom")}
              </h3>
              {realtime && listeners.length > 0 ? (
                <div className="mt-3 grid grid-cols-4 gap-x-2 gap-y-4 sm:grid-cols-5">
                  {listeners.map((m) => {
                    // A raised hand is only actionable by the host, and only
                    // while they're actually hosting this room.
                    const grantable = row.isHost && m.hand;
                    const Tag = grantable ? "button" : "div";
                    return (
                      <Tag
                        key={m.id}
                        {...(grantable
                          ? {
                              type: "button" as const,
                              onClick: () => void grantMic(m.id, m.username),
                              title: t("voice.approve"),
                              "aria-label": `${t("voice.approve")}: ${m.username}`,
                            }
                          : {})}
                        className={clsx(
                          "flex flex-col items-center gap-1.5",
                          grantable && "cursor-pointer",
                        )}
                      >
                        <span
                          className={clsx(
                            "relative h-12 w-12 overflow-hidden rounded-pill bg-[#1c1917]",
                            // A hand the host can act on gets a ring, so it
                            // reads as a request rather than decoration.
                            grantable && "ring-2 ring-gold",
                          )}
                        >
                          <SafeAvatar src={m.avatar} />
                          {m.hand && (
                            <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-pill bg-[#fafaf9] text-[#0c0a09]">
                              <HandPalm size={11} weight="fill" />
                            </span>
                          )}
                        </span>
                        <span className="max-w-full truncate font-sans text-[10.5px] glass-ink-dim">
                          {m.username}
                        </span>
                      </Tag>
                    );
                  })}
                </div>
              ) : (
                <p className="mt-3 font-sans text-[12.5px] glass-ink-dim">
                  {realtime
                    ? t("voice.roomQuiet")
                    : `${listenerCount} ${t("voice.listeners")}`}
                </p>
              )}
            </div>

            {/* Floating reactions */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 top-1/3 overflow-hidden">
              <AnimatePresence>
                {reactions.map((r, i) => (
                  <motion.span
                    key={r.id}
                    initial={{ opacity: 0, y: 30, scale: 0.7 }}
                    animate={{ opacity: 1, y: -140 - (i % 3) * 40, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 1.8, ease: "easeOut" }}
                    className="absolute bottom-2 text-[26px]"
                    style={{ right: 24 + (r.id % 5) * 30 }}
                  >
                    {r.emoji}
                  </motion.span>
                ))}
              </AnimatePresence>
            </div>
          </div>

          {/* Dock */}
          <div className="shrink-0 border-t border-[#fafaf9]/8 px-4 py-3 pb-safe">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={!canSpeak || audio !== "listening"}
                  onClick={toggleMute}
                  aria-pressed={canSpeak && !muted}
                  title={
                    canSpeak ? t("voice.micToggle") : t("voice.listenOnly")
                  }
                  aria-label={
                    canSpeak ? t("voice.micToggle") : t("voice.listenOnly")
                  }
                  className={clsx(
                    "flex h-10 w-10 items-center justify-center rounded-pill transition-colors",
                    !canSpeak || audio !== "listening"
                      ? "glass-chip opacity-40 cursor-not-allowed"
                      : muted
                        ? "glass-chip backdrop-blur-md cursor-pointer"
                        : "bg-danger text-white cursor-pointer",
                  )}
                >
                  {canSpeak && !muted ? (
                    <Microphone size={16} weight="fill" />
                  ) : (
                    <MicrophoneSlash size={16} weight="bold" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={toggleHand}
                  aria-pressed={hand}
                  aria-label={t("voice.raiseHand")}
                  className={clsx(
                    "flex h-10 w-10 items-center justify-center rounded-pill transition-colors cursor-pointer",
                    hand ? "glass-chip-active" : "glass-chip backdrop-blur-md",
                  )}
                >
                  <HandPalm size={16} weight="bold" />
                </button>
                <span className="mx-1 h-5 w-px bg-[#fafaf9]/12" />
                {REACTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => react(emoji)}
                    aria-label={`React ${emoji}`}
                    className="flex h-10 w-10 items-center justify-center rounded-pill text-[17px] transition-colors hover:bg-[#fafaf9]/10 cursor-pointer"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
              {row.isHost ? (
                <button
                  type="button"
                  onClick={() => onEnd(row)}
                  className="flex items-center gap-1.5 rounded-pill bg-danger/90 px-4 h-10 font-sans text-[12.5px] font-semibold text-white hover:bg-danger transition-colors cursor-pointer"
                >
                  {t("voice.end")}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onLeave}
                  className="flex items-center gap-1.5 rounded-pill glass-chip backdrop-blur-md px-4 h-10 font-sans text-[12.5px] font-semibold transition-colors cursor-pointer"
                >
                  <SignOut size={14} weight="bold" />
                  {t("voice.leave")}
                </button>
              )}
            </div>
            <p className="mt-2 text-center font-sans text-[10.5px] glass-ink-faint">
              {audio === "connecting"
                ? t("voice.audioConnecting")
                : audio === "listening"
                  ? canSpeak
                    ? muted
                      ? t("voice.youAreMuted")
                      : t("voice.youAreLive")
                    : t("voice.listenOnly")
                  : audio === "unavailable"
                    ? t("voice.audioUnavailable")
                    : audio === "failed"
                      ? t("voice.audioFailed")
                      : t("voice.listenOnly")}
            </p>
          </div>
        </motion.div>
      </motion.div>
    </ConfirmModalPortal>
  );
}
