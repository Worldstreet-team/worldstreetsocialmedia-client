"use client";

import {
  ArrowsInSimple,
  Fire,
  HandPalm,
  HandsClapping,
  Heart,
  LinkSimple,
  Microphone,
  MicrophoneSlash,
  SignOut,
  Smiley,
  ThumbsUp,
  Users,
} from "@phosphor-icons/react";
import clsx from "clsx";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { Room } from "livekit-client";
import { useEffect, useRef, useState } from "react";
import { UserBadges } from "@/components/ui/UserBadges";
import ConfirmModalPortal from "@/components/ui/ConfirmModalPortal";
import {
  OverlayHeader,
  OverlayPanel,
  OverlayScrim,
  useOverlayDismiss,
} from "@/components/ui/Overlay";
import { SafeAvatar } from "@/components/ui/SafeAvatar";
import { useToast } from "@/components/ui/Toast/ToastContext";
import {
  EqBars,
  hostName,
  spaceBackground,
  type SpaceRow,
} from "@/components/voice/SpaceCard";
import type { useSpaceAudio } from "@/hooks/useSpaceAudio";
import { type RoomMember, useSpaceRoom } from "@/hooks/useSpaceRoom";
import { useT } from "@/i18n/client";

const EASE = [0.2, 0, 0, 1] as const;

/**
 * The reaction vocabulary. Ids ride the Ably `reaction` payload — never
 * emoji characters — and each id maps to a Phosphor glyph here. The legacy
 * table keeps older clients' emoji payloads rendering during a deploy.
 */
type ReactionKind = "heart" | "clap" | "fire" | "laugh" | "plus-one";

const REACTION_SET: {
  kind: ReactionKind;
  Icon: typeof Heart;
  tint: string;
  label: string;
}[] = [
  { kind: "heart", Icon: Heart, tint: "text-danger", label: "Heart" },
  { kind: "clap", Icon: HandsClapping, tint: "text-[#fafaf9]", label: "Clap" },
  { kind: "fire", Icon: Fire, tint: "text-warning", label: "Fire" },
  { kind: "laugh", Icon: Smiley, tint: "text-[#fafaf9]", label: "Laugh" },
  { kind: "plus-one", Icon: ThumbsUp, tint: "text-success", label: "Plus one" },
];

const REACTION_BY_KIND = new Map(REACTION_SET.map((r) => [r.kind, r]));

const LEGACY_REACTIONS: Record<string, ReactionKind> = {
  "👏": "clap",
  "🔥": "fire",
  "💛": "heart",
  "❤️": "heart",
  "😂": "laugh",
  "📈": "plus-one",
};

interface SpaceRoomProps {
  row: SpaceRow;
  /**
   * The audio connection, owned by VoiceRoomHost. It lives up there — not
   * here — because this component unmounts on minimize, and audio that dies
   * the moment you dock the room makes the dock a lie.
   */
  audio: ReturnType<typeof useSpaceAudio>;
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
 * The ring that breathes with the voice. An absolutely positioned pill
 * behind the avatar — never a border — whose scale tracks the LiveKit
 * participant's `audioLevel` through a requestAnimationFrame loop with
 * exponential smoothing. It writes `style.transform`/`style.opacity` on the
 * ref imperatively: React never re-renders per frame.
 *
 * Scale caps at 1.18 and the cell around the avatar reserves padding for
 * it, so a loud speaker can never bleed into a neighbouring avatar.
 */
function SpeakingRing({
  room,
  identity,
}: {
  room: Room | null;
  identity?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el || !room || !identity) return;
    let raf = 0;
    let scale = 1;
    let opacity = 0;
    const tick = () => {
      const p = room.getParticipantByIdentity(identity);
      // Conversational speech reports low levels; sqrt lifts it into the
      // visible range while a shout still caps at the reserved 1.18.
      const level = p?.isSpeaking ? Math.min(1, Math.sqrt(p.audioLevel)) : 0;
      const targetScale = reduce ? 1 : 1 + level * 0.18;
      const targetOpacity = level > 0.02 ? (reduce ? 0.6 : 0.4 + level * 0.6) : 0;
      scale += (targetScale - scale) * 0.25;
      opacity += (targetOpacity - opacity) * 0.25;
      el.style.transform = `scale(${scale.toFixed(4)})`;
      el.style.opacity = opacity.toFixed(3);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      el.style.transform = "";
      el.style.opacity = "0";
    };
  }, [room, identity, reduce]);

  return (
    <span
      ref={ref}
      aria-hidden
      className="pointer-events-none absolute inset-0 rounded-pill bg-success/40 opacity-0 will-change-transform"
    />
  );
}

/**
 * The room itself — a Spaces-style stage over the room's mesh art.
 *
 * Presence (Ably `space:<id>`) is the guest list: real faces when the token
 * allows it, an honest count when it doesn't. Reactions float up the stage.
 * Listeners join with no publish rights (the LiveKit token enforces it), so
 * their dock shows "Request to speak" rather than a dead mic; the mic
 * appears only once the host brings them to stage.
 */
export default function SpaceRoom({
  row,
  audio: audioConn,
  onMinimize,
  onLeave,
  onEnd,
}: SpaceRoomProps) {
  const t = useT();
  const { toast } = useToast();
  const reduce = useReducedMotion();
  const { members, reactions, realtime, hand, react, toggleHand, setSpeaker } =
    useSpaceRoom(row.id);
  const { state: audio, canSpeak, muted, toggleMute, room } = audioConn;

  // Missing-i18n fallback: t() returns the key untranslated when a catalog
  // lacks it; these strings are newer than the dictionaries.
  const tf = (key: string, fallback: string) => {
    const v = t(key);
    return v === key ? fallback : v;
  };

  // The participant the host tapped — an anchored popover with stage
  // controls. Null when closed.
  const [menuFor, setMenuFor] = useState<RoomMember | null>(null);
  // Optimistic stage map: the gateway grant succeeded but LiveKit's
  // permission flip hasn't landed yet.
  const [staged, setStaged] = useState<Record<string, boolean>>({});
  useOverlayDismiss(menuFor !== null, () => setMenuFor(null));

  /** Is this participant currently allowed to publish (on stage)? */
  const isOnStage = (profileId: string) => {
    const p = room?.getParticipantByIdentity(profileId);
    if (p?.permissions) return Boolean(p.permissions.canPublish);
    return Boolean(staged[profileId]);
  };

  /**
   * Hand the mic to someone. Their token was minted as a listener, so the
   * gateway flips the live LiveKit permission AND notifies them to rejoin —
   * their client re-mints the token and republishes with the new rights.
   */
  const grantMic = async (profileId: string, username: string) => {
    const res = await setSpeaker(profileId, true);
    if (res?.success) {
      setStaged((s) => ({ ...s, [profileId]: true }));
      toast(`${username} — ${t("voice.approve")}`, { type: "success" });
    } else {
      toast(res?.message || t("voice.endFailed"), { type: "error" });
    }
  };

  /** Take the mic back. */
  const revokeMic = async (profileId: string, username: string) => {
    const res = await setSpeaker(profileId, false);
    if (res?.success) {
      setStaged((s) => ({ ...s, [profileId]: false }));
      toast(
        `${username} — ${tf("voice.offStage", "back in the audience")}`,
        { type: "success" },
      );
    } else {
      toast(res?.message || t("voice.endFailed"), { type: "error" });
    }
  };

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
      // With the participant popover open, Escape belongs to the popover.
      if (e.key === "Escape" && !menuFor) onMinimize();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onMinimize, menuFor]);

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
  // The host's LiveKit identity is their profile id; presence carries it as
  // the clientId when the row itself predates the `_id` field.
  const hostIdentity =
    row.host._id ??
    members.find((m) => m.username === row.host.username)?.id;

  const menuOnStage = menuFor ? isOnStage(menuFor.id) : false;

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
                  className="flex h-9 items-center gap-1.5 rounded-pill glass-chip px-3 font-sans text-[12px] font-semibold transition-colors cursor-pointer"
                >
                  <LinkSimple size={14} weight="bold" />
                  {t("voice.share")}
                </button>
                <button
                  type="button"
                  onClick={onMinimize}
                  aria-label={t("voice.minimize")}
                  className="flex h-9 w-9 items-center justify-center rounded-pill glass-chip transition-colors cursor-pointer"
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
          <div className="relative flex-1 min-h-0 overflow-y-auto no-scrollbar px-5 py-4">
            {/* Host seat. The cell's padding reserves the room the breathing
                ring needs at its 1.18 ceiling. */}
            <div className="flex flex-col items-center gap-1.5">
              <span className="block p-2">
                <span className="relative block h-20 w-20">
                  <SpeakingRing room={room} identity={hostIdentity} />
                  <span className="absolute inset-0 overflow-hidden rounded-pill bg-[#1c1917] ring-2 ring-brand/45">
                    <SafeAvatar src={row.host.avatar} />
                  </span>
                </span>
              </span>
              <span className="flex items-center gap-1">
                <span className="font-sans text-[14px] font-semibold glass-ink">
                  {hostName(row.host)}
                </span>
                <UserBadges
                  isVerified={row.host.isVerified}
                  verification={(row.host as any).verification}
                  badges={(row.host as any).badges}
                  size={13}
                />
              </span>
              <span className="rounded-pill bg-brand/15 px-2.5 py-px font-sans text-[10px] font-bold uppercase tracking-[0.1em] text-gold">
                {t("voice.hostBadge")}
              </span>
            </div>

            {/* Listeners */}
            <div className="mt-6">
              <h3 className="glass-eyebrow font-sans">
                {t("voice.inTheRoom")}
              </h3>
              {realtime && listeners.length > 0 ? (
                <div className="mt-2 grid grid-cols-4 gap-x-1 gap-y-2 sm:grid-cols-5">
                  {listeners.map((m) => {
                    const onStage = isOnStage(m.id);
                    // The host manages anyone from their avatar; a raised
                    // hand just makes the invitation explicit.
                    const Tag = row.isHost ? "button" : "div";
                    return (
                      <Tag
                        key={m.id}
                        {...(row.isHost
                          ? {
                              type: "button" as const,
                              onClick: () => setMenuFor(m),
                              "aria-label": `${tf("voice.manage", "Manage")}: ${m.username}`,
                              "aria-haspopup": "dialog" as const,
                            }
                          : {})}
                        className={clsx(
                          "flex flex-col items-center gap-0.5",
                          row.isHost && "cursor-pointer",
                        )}
                      >
                        {/* p-1.5 reserves the ring's headroom in the cell so
                            it can never overlap a neighbouring avatar. */}
                        <span className="block p-1.5">
                          <span className="relative block h-12 w-12">
                            <SpeakingRing room={room} identity={m.id} />
                            <span
                              className={clsx(
                                "absolute inset-0 overflow-hidden rounded-pill bg-[#1c1917]",
                                // A hand the host can act on gets a ring, so
                                // it reads as a request, not decoration.
                                row.isHost && m.hand && "ring-2 ring-gold",
                              )}
                            >
                              <SafeAvatar src={m.avatar} />
                            </span>
                            {m.hand && !onStage && (
                              <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-pill bg-[#fafaf9] text-[#0c0a09]">
                                <HandPalm size={11} weight="fill" />
                              </span>
                            )}
                            {onStage && (
                              <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-pill bg-success text-[#0c0a09]">
                                <Microphone size={11} weight="fill" />
                              </span>
                            )}
                          </span>
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
                {reactions.map((r, i) => {
                  const kind = REACTION_BY_KIND.has(r.emoji as ReactionKind)
                    ? (r.emoji as ReactionKind)
                    : LEGACY_REACTIONS[r.emoji];
                  const def = kind ? REACTION_BY_KIND.get(kind) : undefined;
                  if (!def) return null;
                  return (
                    <motion.span
                      key={r.id}
                      initial={{ opacity: 0, y: 30, scale: 0.7 }}
                      animate={{ opacity: 1, y: -140 - (i % 3) * 40, scale: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 1.8, ease: "easeOut" }}
                      className="absolute bottom-2"
                      style={{ right: 24 + (r.id % 5) * 30 }}
                    >
                      <def.Icon size={26} weight="fill" className={def.tint} />
                    </motion.span>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>

          {/* Dock */}
          <div className="shrink-0 border-t border-[#fafaf9]/8 px-4 py-3 pb-safe">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                {canSpeak ? (
                  // On stage: a real mic. The token grants publish, so this
                  // is never a dead control.
                  <button
                    type="button"
                    disabled={audio !== "listening"}
                    onClick={toggleMute}
                    aria-pressed={!muted}
                    title={t("voice.micToggle")}
                    aria-label={t("voice.micToggle")}
                    className={clsx(
                      "flex h-10 w-10 items-center justify-center rounded-pill transition-colors",
                      audio !== "listening"
                        ? "glass-chip opacity-40 cursor-not-allowed"
                        : muted
                          ? "glass-chip cursor-pointer"
                          : "bg-danger text-white cursor-pointer",
                    )}
                  >
                    {muted ? (
                      <MicrophoneSlash size={16} weight="bold" />
                    ) : (
                      <Microphone size={16} weight="fill" />
                    )}
                  </button>
                ) : (
                  // In the audience: no publish rights, so no mic at all —
                  // the honest control is asking for one.
                  <button
                    type="button"
                    onClick={toggleHand}
                    aria-pressed={hand}
                    className={clsx(
                      "flex h-10 items-center gap-1.5 rounded-pill px-3.5 font-sans text-[12px] font-semibold transition-colors cursor-pointer",
                      hand ? "glass-chip-active" : "glass-chip",
                    )}
                  >
                    <HandPalm size={15} weight={hand ? "fill" : "bold"} />
                    {hand
                      ? t("voice.lowerHand")
                      : tf("voice.requestSpeak", "Request to speak")}
                  </button>
                )}
                <span className="mx-1 h-5 w-px bg-[#fafaf9]/12" />
                {REACTION_SET.map(({ kind, Icon, tint, label }) => (
                  <button
                    key={kind}
                    type="button"
                    onClick={() => react(kind)}
                    aria-label={`React: ${label}`}
                    className="flex h-10 w-10 items-center justify-center rounded-pill transition-colors hover:bg-[#fafaf9]/10 cursor-pointer"
                  >
                    <Icon size={17} weight="fill" className={tint} />
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
                  className="flex items-center gap-1.5 rounded-pill glass-chip px-4 h-10 font-sans text-[12.5px] font-semibold transition-colors cursor-pointer"
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

        {/* Host's participant popover — the overlay grammar's anchored
            variant: no dim on desktop (a popover is not a modal). */}
        <AnimatePresence>
          {menuFor && (
            <div onClick={(e) => e.stopPropagation()}>
              <OverlayScrim dim={false} onClose={() => setMenuFor(null)} />
              <OverlayPanel dragClose={() => setMenuFor(null)} variant="anchored" label={menuFor.username}>
                <OverlayHeader onClose={() => setMenuFor(null)}>
                  <span className="flex min-w-0 flex-1 items-center gap-2.5">
                    <span className="relative h-8 w-8 shrink-0 overflow-hidden rounded-pill bg-chip">
                      <SafeAvatar src={menuFor.avatar} />
                    </span>
                    <span className="flex min-w-0 flex-col">
                      <span className="flex items-center gap-1">
                        <span className="truncate font-sans text-[13.5px] font-semibold text-primary">
                          {menuFor.username}
                        </span>
                        <UserBadges
                          isVerified={menuFor.isVerified}
                          verification={(menuFor as any).verification}
                          size={12}
                        />
                      </span>
                      <span className="truncate font-sans text-[11px] text-subtle">
                        {menuOnStage
                          ? tf("voice.onStageLabel", "On stage")
                          : menuFor.hand
                            ? t("voice.speakRequests")
                            : t("voice.listeners")}
                      </span>
                    </span>
                  </span>
                </OverlayHeader>
                <div className="flex flex-col gap-0.5 px-2 pb-3">
                  {menuOnStage ? (
                    <button
                      type="button"
                      onClick={() => {
                        const m = menuFor;
                        setMenuFor(null);
                        void revokeMic(m.id, m.username);
                      }}
                      className="flex h-11 w-full items-center gap-2.5 rounded-lg px-3 text-left font-sans text-[13.5px] font-medium text-danger transition-colors hover:bg-chip cursor-pointer"
                    >
                      <MicrophoneSlash size={16} weight="bold" />
                      {tf("voice.removeFromStage", "Remove from stage")}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        const m = menuFor;
                        setMenuFor(null);
                        void grantMic(m.id, m.username);
                      }}
                      className="flex h-11 w-full items-center gap-2.5 rounded-lg px-3 text-left font-sans text-[13.5px] font-medium text-primary transition-colors hover:bg-chip cursor-pointer"
                    >
                      <Microphone size={16} weight="bold" />
                      {tf("voice.bringToStage", "Bring to stage")}
                    </button>
                  )}
                </div>
              </OverlayPanel>
            </div>
          )}
        </AnimatePresence>
      </motion.div>
    </ConfirmModalPortal>
  );
}
