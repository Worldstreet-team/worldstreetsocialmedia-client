"use client";

import { formatCompact } from "@/lib/utils";
import {
  ArrowSquareOut,
  ArrowsInSimple,
  CaretDown,
  ChatCircle,
  Fire,
  Flag,
  HandPalm,
  HandsClapping,
  Heart,
  LinkSimple,
  Microphone,
  MicrophoneSlash,
  NotePencil,
  PaperPlaneRight,
  SignOut,
  Smiley,
  SpeakerHigh,
  ThumbsUp,
  Users,
} from "@phosphor-icons/react";
import clsx from "clsx";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useSetAtom, useAtomValue } from "jotai";
import type { Room } from "livekit-client";
import { useRouter } from "next/navigation";
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
import ReportSheet from "@/components/safety/ReportSheet";
import {
  EqBars,
  hostName,
  spaceBackground,
  spaceListenerCount,
  type SpaceRow,
} from "@/components/voice/SpaceCard";
import {
  inviteSpeakAction,
  muteSpeakerAction,
  removeFromSpaceAction,
  setCohostAction,
} from "@/lib/space.actions";
import type { useSpaceAudio } from "@/hooks/useSpaceAudio";
import {
  type RoomChatMessage,
  type RoomMember,
  useSpaceRoom,
} from "@/hooks/useSpaceRoom";
import { useT } from "@/i18n/client";
import { pendingDraftAtom } from "@/store/drafts.atom";
import { userAtom } from "@/store/user.atom";

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
  /** Presence, chat and reactions — hoisted beside the audio for the same
   *  reason: minimizing must not remove you from the room. */
  roomLive: ReturnType<typeof useSpaceRoom>;
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
 * The room's text lane, for everyone who would rather type than talk.
 *
 * One pane, two mounts: a fixed aside on desktop (the room grows wider to
 * seat it) and a slide-up sheet on phones. Messages are ephemeral — they
 * ride the room's Ably channel and live exactly as long as your stay —
 * and every name and face comes from the server-resolved roster, never
 * from the payload.
 */
function ChatPane({
  messages,
  meId,
  nameOf,
  avatarOf,
  onSend,
  placeholder,
  emptyLine,
  sendLabel,
}: {
  messages: RoomChatMessage[];
  meId: string;
  nameOf: (id: string) => string;
  avatarOf: (id: string) => string | undefined;
  onSend: (text: string) => boolean;
  placeholder: string;
  emptyLine: string;
  sendLabel: string;
}) {
  const [text, setText] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  // Follow the stream only while the reader is at the bottom; never yank
  // someone away from a message they scrolled back to.
  const stickRef = useRef(true);

  useEffect(() => {
    const el = listRef.current;
    if (el && stickRef.current) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        ref={listRef}
        role="log"
        aria-label={placeholder}
        onScroll={() => {
          const el = listRef.current;
          if (!el) return;
          stickRef.current =
            el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
        className="flex-1 min-h-0 overflow-y-auto no-scrollbar px-4 py-3"
      >
        {messages.length === 0 ? (
          <p className="pt-6 text-center font-sans text-[12px] glass-ink-faint">
            {emptyLine}
          </p>
        ) : (
          <div className="flex flex-col gap-2.5">
            {messages.map((m) => (
              <div key={m.id} className="flex items-start gap-2">
                <span className="relative mt-0.5 h-[18px] w-[18px] shrink-0 overflow-hidden rounded-pill bg-[#1c1917]">
                  <SafeAvatar src={avatarOf(m.from)} />
                </span>
                <p className="min-w-0 font-sans text-[12.5px] leading-snug glass-ink [overflow-wrap:anywhere]">
                  <span
                    className={clsx(
                      "mr-1.5 font-semibold",
                      m.from === meId ? "text-gold" : "glass-ink-dim",
                    )}
                  >
                    {nameOf(m.from)}
                  </span>
                  {m.text}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
      <form
        className="flex shrink-0 items-center gap-2 border-t border-[#fafaf9]/8 px-3 py-2.5"
        onSubmit={(e) => {
          e.preventDefault();
          if (onSend(text)) setText("");
        }}
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={500}
          placeholder={placeholder}
          aria-label={placeholder}
          className="h-10 w-full min-w-0 flex-1 rounded-pill glass-chip px-3.5 font-sans text-[13px] glass-ink outline-none placeholder:opacity-50"
        />
        <button
          type="submit"
          disabled={!text.trim()}
          aria-label={sendLabel}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-pill bg-[#fafaf9] text-[#0c0a09] transition-opacity disabled:opacity-30 cursor-pointer disabled:cursor-default"
        >
          <PaperPlaneRight size={15} weight="fill" />
        </button>
      </form>
    </div>
  );
}

/**
 * The room itself — a Spaces-style stage over the room's mesh art, with a
 * text lane beside it (desktop) or beneath a toggle (phones).
 *
 * Presence (Ably `space:<id>`) is the guest list — ids only; faces and
 * badges are server-resolved. Reactions float up the stage with the sender's
 * name, Meet-style. Listeners join with no publish rights (the LiveKit token
 * enforces it), so their dock shows "Request to speak" rather than a dead
 * mic; the mic appears only once the host brings them to stage.
 */
export default function SpaceRoom({
  row,
  audio: audioConn,
  roomLive,
  onMinimize,
  onLeave,
  onEnd,
}: SpaceRoomProps) {
  const t = useT();
  const { toast } = useToast();
  const reduce = useReducedMotion();
  const router = useRouter();
  const me = useAtomValue(userAtom);
  const setPendingDraft = useSetAtom(pendingDraftAtom);
  const {
    members,
    reactions,
    messages,
    sendChat,
    profileOf,
    realtime,
    hand,
    react,
    toggleHand,
    setSpeaker,
  } = roomLive;
  const {
    state: audio,
    canSpeak,
    muted,
    toggleMute,
    room,
    needsUnlock,
    unlockAudio,
    reconnect,
    speakingIds,
  } = audioConn;

  // Host and co-hosts share the stage tools; only the host manages
  // co-hosts themselves or ends the room.
  const canManage = Boolean(row.isHost || row.isCohost);

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
  // The share menu (copy link / post about it).
  const [shareOpen, setShareOpen] = useState(false);
  const shareRef = useRef<HTMLDivElement>(null);
  // The phone chat sheet; on desktop the pane is always seated.
  const [chatOpen, setChatOpen] = useState(false);
  const [seenCount, setSeenCount] = useState(0);
  // Report a participant through the standard safety flow.
  const [reportFor, setReportFor] = useState<RoomMember | null>(null);
  useOverlayDismiss(menuFor !== null, () => setMenuFor(null));

  useEffect(() => {
    if (!shareOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!shareRef.current?.contains(e.target as Node)) setShareOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [shareOpen]);

  // Chat-open marks everything read; the badge and ticker run off the rest.
  useEffect(() => {
    if (chatOpen) setSeenCount(messages.length);
  }, [chatOpen, messages.length]);
  const unread = Math.max(0, messages.length - seenCount);

  const myId = me?._id ? String(me._id) : "";
  const nameOf = (id: string) =>
    id === myId
      ? me?.username || "you"
      : (profileOf(id)?.username ??
        members.find((m) => m.id === id)?.username ??
        "listener");
  const avatarOf = (id: string) =>
    id === myId
      ? me?.avatar
      : (profileOf(id)?.avatar ?? members.find((m) => m.id === id)?.avatar);

  /** Is this participant currently allowed to publish (on stage)? */
  const isOnStage = (profileId: string) => {
    const p = room?.getParticipantByIdentity(profileId);
    if (p?.permissions) return Boolean(p.permissions.canPublish);
    return Boolean(staged[profileId]);
  };

  /**
   * Hand the mic to someone. The gateway flips the live LiveKit permission
   * (updateParticipant), so their mic appears in place with no rejoin.
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

  /** Ask a listener up — they accept or decline; nobody is conscripted. */
  const inviteToSpeak = async (profileId: string, username: string) => {
    const res = await inviteSpeakAction(row.id, profileId);
    if (res.success) {
      toast(`${username} — ${tf("voice.invited", "invited to speak")}`, {
        type: "success",
      });
    } else {
      toast(res.message || t("voice.endFailed"), { type: "error" });
    }
  };

  /** Server-enforced mute; they can unmute themselves. */
  const muteTarget = async (profileId: string, username: string) => {
    const res = await muteSpeakerAction(row.id, profileId);
    if (res.success) {
      toast(`${username} — ${tf("voice.mutedThem", "muted")}`, {
        type: "success",
      });
    } else {
      toast(res.message || t("voice.endFailed"), { type: "error" });
    }
  };

  /** Remove is a ban: disconnected now, and the door stays shut. */
  const removeTarget = async (profileId: string, username: string) => {
    const res = await removeFromSpaceAction(row.id, profileId);
    if (res.success) {
      toast(
        `${username} — ${tf("voice.removedThem", "removed from the space")}`,
        { type: "success" },
      );
    } else {
      toast(res.message || t("voice.endFailed"), { type: "error" });
    }
  };

  /** Host only: appoint or dismiss a deputy. */
  const cohostTarget = async (
    profileId: string,
    username: string,
    grant: boolean,
  ) => {
    const res = await setCohostAction(row.id, profileId, grant);
    if (res.success) {
      toast(
        `${username} — ${
          grant
            ? tf("voice.cohostMade", "co-host now")
            : tf("voice.cohostDropped", "no longer a co-host")
        }`,
        { type: "success" },
      );
    } else {
      toast(res.message || t("voice.endFailed"), { type: "error" });
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
      // With the participant popover or a sheet open, Escape closes that.
      if (e.key !== "Escape") return;
      if (menuFor || shareOpen || chatOpen || reportFor) {
        setShareOpen(false);
        setChatOpen(false);
        return;
      }
      onMinimize();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onMinimize, menuFor, shareOpen, chatOpen, reportFor]);

  const roomUrl = () => `${window.location.origin}/voice/${row.id}`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(roomUrl());
      toast(t("voice.linkCopied"), { type: "success" });
    } catch {
      toast(t("voice.linkFailed"), { type: "error" });
    }
  };

  /**
   * Share the room as a post: seed the composer with the title and link,
   * dock the room (audio keeps playing) and go where the composer lives.
   */
  const postAbout = () => {
    setPendingDraft(
      `${tf("voice.postPrefix", "Live now on Space Voice:")} ${row.title}\n${roomUrl()}`,
    );
    onMinimize();
    router.push("/");
  };

  const listeners = members.filter(
    (m) => m.id !== (row.host._id ? String(row.host._id) : "") &&
      m.username !== row.host.username,
  );
  // The stage is a tier, not a badge: speakers and co-hosts sit in their
  // own row under the host, the audience below. The layout itself says who
  // can talk.
  const cohostIds = new Set(row.cohosts ?? []);
  const onStageMembers = listeners.filter(
    (m) => cohostIds.has(m.id) || isOnStage(m.id),
  );
  const audience = listeners.filter(
    (m) => !cohostIds.has(m.id) && !isOnStage(m.id),
  );
  // A huge room stays renderable: the grid caps and the rest is a count.
  const AUDIENCE_CAP = 40;
  const audienceShown = audience.slice(0, AUDIENCE_CAP);
  const audienceOverflow = audience.length - audienceShown.length;
  const listenerCount = realtime
    ? Math.max(members.length, 1)
    : Math.max(spaceListenerCount(row), 1);

  // Non-managers tap a face to see the person; the room stays alive in the
  // dock underneath.
  const viewProfile = (m: RoomMember) => {
    onMinimize();
    router.push(`/profile/${m.username}`);
  };

  const speakingNames = speakingIds
    .map((id) =>
      id === (row.host._id ? String(row.host._id) : "")
        ? hostName(row.host)
        : members.find((m) => m.id === id)?.username,
    )
    .filter(Boolean) as string[];
  // The host's LiveKit identity is their profile id; presence carries it as
  // the clientId when the row itself predates the `_id` field.
  const hostIdentity =
    row.host._id ??
    members.find((m) => m.username === row.host.username)?.id;

  const menuOnStage = menuFor ? isOnStage(menuFor.id) : false;

  const lastMsg = messages[messages.length - 1];
  const showTicker =
    !chatOpen && unread > 0 && lastMsg && lastMsg.from !== myId;

  /**
   * One avatar cell, both tiers. Everyone can tap a face: managers get the
   * stage controls, everyone else gets the person's profile (the room
   * docks underneath). The cell's padding reserves the breathing ring's
   * headroom so it can never overlap a neighbour.
   */
  const memberCell = (m: RoomMember, onStage: boolean, large: boolean) => {
    const label = `${m.username}: ${
      onStage
        ? tf("voice.stageTier", "On stage")
        : m.hand
          ? t("voice.speakRequests")
          : t("voice.listeners")
    }`;
    return (
      <button
        key={m.id}
        type="button"
        onClick={() => (canManage ? setMenuFor(m) : viewProfile(m))}
        aria-label={label}
        {...(canManage ? { "aria-haspopup": "dialog" as const } : {})}
        className="flex flex-col items-center gap-0.5 cursor-pointer"
      >
        <span className="block p-1.5">
          <span
            className={clsx(
              "relative block",
              large ? "h-14 w-14" : "h-12 w-12",
            )}
          >
            <SpeakingRing room={room} identity={m.id} />
            <span
              className={clsx(
                "absolute inset-0 overflow-hidden rounded-pill bg-[#1c1917]",
                // A hand a manager can act on gets a ring, so it reads as
                // a request, not paint.
                canManage && m.hand && !onStage && "ring-2 ring-gold",
                cohostIds.has(m.id) && "ring-2 ring-brand/45",
              )}
            >
              <SafeAvatar src={m.avatar} />
            </span>
            {m.hand && !onStage && (
              <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-pill bg-[#fafaf9] text-[#0c0a09]">
                <HandPalm size={11} weight="fill" />
              </span>
            )}
            {onStage && !cohostIds.has(m.id) && (
              <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-pill bg-success text-[#0c0a09]">
                <Microphone size={11} weight="fill" />
              </span>
            )}
          </span>
        </span>
        <span className="flex max-w-full items-center gap-0.5">
          <span className="min-w-0 truncate font-sans text-[10.5px] glass-ink-dim">
            {m.username}
          </span>
          {/* Badges only once the gateway confirmed who this id is —
              presence is client-published and trust marks are not
              self-serve. */}
          {m.resolved && (
            <UserBadges
              isVerified={m.isVerified}
              verification={m.verification}
              badges={m.badges as any}
              size={10}
            />
          )}
        </span>
        {cohostIds.has(m.id) && (
          <span className="rounded-pill bg-brand/15 px-1.5 py-px font-sans text-[8.5px] font-bold uppercase tracking-[0.1em] text-gold">
            {tf("voice.cohostBadge", "Co-host")}
          </span>
        )}
      </button>
    );
  };

  const chatPane = (
    <ChatPane
      messages={messages}
      meId={myId}
      nameOf={nameOf}
      avatarOf={avatarOf}
      onSend={sendChat}
      placeholder={tf("voice.chatPlaceholder", "Message the room")}
      emptyLine={tf(
        "voice.chatEmpty",
        "Nothing yet. Say something to the room.",
      )}
      sendLabel={tf("voice.chatSend", "Send")}
    />
  );

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
          className="relative flex h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl sm:h-[86vh] sm:w-[560px] lg:w-[900px] sm:rounded-2xl glass-dock backdrop-blur-xl backdrop-saturate-150"
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
                <div ref={shareRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setShareOpen((v) => !v)}
                    aria-label={t("voice.share")}
                    aria-haspopup="menu"
                    aria-expanded={shareOpen}
                    className="flex h-9 items-center gap-1.5 rounded-pill glass-chip px-3 font-sans text-[12px] font-semibold transition-colors cursor-pointer"
                  >
                    <LinkSimple size={14} weight="bold" />
                    {t("voice.share")}
                  </button>
                  {shareOpen && (
                    <div
                      role="menu"
                      className="absolute right-0 top-full z-20 mt-2 w-[196px] overflow-hidden rounded-xl border border-[#fafaf9]/10 bg-[#1c1917] py-1 shadow-nav"
                    >
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setShareOpen(false);
                          void copyLink();
                        }}
                        className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left font-sans text-[13px] font-medium text-[#fafaf9] transition-colors hover:bg-[#fafaf9]/8 cursor-pointer"
                      >
                        <LinkSimple size={15} weight="bold" />
                        {tf("voice.copyLink", "Copy link")}
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setShareOpen(false);
                          postAbout();
                        }}
                        className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left font-sans text-[13px] font-medium text-[#fafaf9] transition-colors hover:bg-[#fafaf9]/8 cursor-pointer"
                      >
                        <NotePencil size={15} weight="bold" />
                        {tf("voice.postAbout", "Post about it")}
                      </button>
                    </div>
                  )}
                </div>
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
                {formatCompact(listenerCount)} {t("voice.listeners")}
              </span>
              {row.community && (
                <span className="truncate rounded-pill bg-[#fafaf9]/12 px-2 py-px text-[10.5px] font-medium">
                  {row.community.name}
                </span>
              )}
            </div>
          </div>

          {/* Below the band: the stage column, and on desktop the text lane
              beside it — the window grows to seat it rather than crowding
              the stage. */}
          <div className="relative flex min-h-0 flex-1">
            <div className="relative flex min-w-0 flex-1 flex-col">
              {/* Stage */}
              <div className="relative flex-1 min-h-0 overflow-y-auto no-scrollbar px-5 py-4">
                {/* Host seat. The cell's padding reserves the room the
                    breathing ring needs at its 1.18 ceiling. */}
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

                {/* Stage tier: co-hosts and speakers, under the host. */}
                {realtime && onStageMembers.length > 0 && (
                  <div className="mt-5">
                    <h3 className="glass-eyebrow font-sans">
                      {tf("voice.stageTier", "On stage")}
                    </h3>
                    <div className="mt-2 grid grid-cols-3 gap-x-1 gap-y-2 sm:grid-cols-4">
                      {onStageMembers.map((m) => memberCell(m, true, true))}
                    </div>
                  </div>
                )}

                {/* Audience */}
                <div className="mt-6">
                  <h3 className="glass-eyebrow font-sans">
                    {t("voice.inTheRoom")}
                  </h3>
                  {realtime && audienceShown.length > 0 ? (
                    <>
                      <div className="mt-2 grid grid-cols-4 gap-x-1 gap-y-2 sm:grid-cols-5">
                        {audienceShown.map((m) => memberCell(m, false, false))}
                      </div>
                      {audienceOverflow > 0 && (
                        <p className="mt-2 font-sans text-[11.5px] glass-ink-faint">
                          +{formatCompact(audienceOverflow)}
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="mt-3 font-sans text-[12.5px] glass-ink-dim">
                      {realtime
                        ? t("voice.roomQuiet")
                        : `${formatCompact(listenerCount)} ${t("voice.listeners")}`}
                    </p>
                  )}
                </div>

                {/* Who is talking, for ears that can't see the rings. */}
                <span className="sr-only" aria-live="polite">
                  {speakingNames.join(", ")}
                </span>
              </div>

              {/* Floating reactions — Meet-style: up the left edge, wearing
                  the sender's name, so a host can acknowledge the person and
                  not just the confetti. */}
              <div className="pointer-events-none absolute inset-y-0 left-0 w-40 overflow-hidden">
                <AnimatePresence>
                  {reactions.map((r, i) => {
                    const kind = REACTION_BY_KIND.has(r.emoji as ReactionKind)
                      ? (r.emoji as ReactionKind)
                      : LEGACY_REACTIONS[r.emoji];
                    const def = kind ? REACTION_BY_KIND.get(kind) : undefined;
                    if (!def) return null;
                    return (
                      <motion.div
                        key={r.id}
                        initial={{ opacity: 0, y: 24, scale: 0.7 }}
                        animate={{
                          opacity: 1,
                          y: reduce ? -30 : -170 - (i % 3) * 40,
                          scale: 1,
                        }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 1.8, ease: "easeOut" }}
                        className="absolute bottom-2"
                        style={{ left: 14 + (r.id % 3) * 36 }}
                      >
                        <span className="flex flex-col items-center gap-1">
                          <def.Icon
                            size={24}
                            weight="fill"
                            className={def.tint}
                          />
                          {r.from?.name && (
                            <span className="max-w-[92px] truncate rounded-pill bg-[#0c0a09]/60 px-2 py-px font-sans text-[9.5px] font-semibold text-[#fafaf9]/85">
                              {r.from.name}
                            </span>
                          )}
                        </span>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>

              {/* Autoplay was refused (iOS until a gesture): the honest fix
                  is a tap, so offer the tap. */}
              {needsUnlock && audio === "listening" && (
                <div className="pointer-events-none absolute inset-x-0 bottom-20 flex justify-center">
                  <button
                    type="button"
                    onClick={() => void unlockAudio()}
                    className="pointer-events-auto flex h-10 items-center gap-2 rounded-pill bg-brand px-4 font-sans text-[13px] font-semibold text-brand-on shadow-nav transition-colors hover:bg-brand-active cursor-pointer"
                  >
                    <SpeakerHigh size={15} weight="fill" />
                    {tf("voice.tapToListen", "Tap to listen")}
                  </button>
                </div>
              )}

              {/* New-chat ticker (phones): the latest line slides in above
                  the dock so the stage never hides a conversation. */}
              <AnimatePresence>
                {showTicker && (
                  <motion.button
                    type="button"
                    initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2, ease: EASE }}
                    onClick={() => setChatOpen(true)}
                    className="absolute inset-x-3 bottom-2 z-10 flex items-center gap-2 rounded-pill bg-[#0c0a09]/75 px-3 py-2 text-left lg:hidden cursor-pointer"
                  >
                    <span className="relative h-[18px] w-[18px] shrink-0 overflow-hidden rounded-pill bg-[#1c1917]">
                      <SafeAvatar src={avatarOf(lastMsg.from)} />
                    </span>
                    <span className="min-w-0 flex-1 truncate font-sans text-[12px] glass-ink">
                      <span className="mr-1.5 font-semibold glass-ink-dim">
                        {nameOf(lastMsg.from)}
                      </span>
                      {lastMsg.text}
                    </span>
                    {unread > 1 && (
                      <span className="shrink-0 rounded-pill bg-brand px-1.5 py-px font-sans text-[10px] font-bold text-brand-on tabular-nums">
                        {unread}
                      </span>
                    )}
                  </motion.button>
                )}
              </AnimatePresence>

              {/* Dock */}
              <div className="shrink-0 border-t border-[#fafaf9]/8 px-4 py-3 pb-safe">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                    {canSpeak ? (
                      // On stage: a real mic. The token grants publish, so
                      // this is never a dead control.
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
                    {/* The text lane, for phones — desktop seats it beside
                        the stage instead. */}
                    <button
                      type="button"
                      onClick={() => setChatOpen((v) => !v)}
                      aria-pressed={chatOpen}
                      aria-label={tf("voice.chat", "Chat")}
                      className={clsx(
                        "relative flex h-10 w-10 items-center justify-center rounded-pill transition-colors cursor-pointer lg:hidden",
                        chatOpen ? "glass-chip-active" : "glass-chip",
                      )}
                    >
                      <ChatCircle size={16} weight={chatOpen ? "fill" : "bold"} />
                      {unread > 0 && !chatOpen && (
                        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-pill bg-brand px-1 font-sans text-[9px] font-bold text-brand-on tabular-nums">
                          {unread > 9 ? "9+" : unread}
                        </span>
                      )}
                    </button>
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
                <p className="mt-2 flex items-center justify-center gap-2 text-center font-sans text-[10.5px] glass-ink-faint">
                  {audio === "connecting"
                    ? t("voice.audioConnecting")
                    : audio === "reconnecting"
                      ? tf("voice.reconnecting", "Reconnecting to the room…")
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
                  {audio === "failed" && (
                    <button
                      type="button"
                      onClick={reconnect}
                      className="rounded-pill glass-chip px-2.5 py-0.5 font-sans text-[10.5px] font-semibold glass-ink transition-colors cursor-pointer"
                    >
                      {tf("voice.rejoin", "Rejoin")}
                    </button>
                  )}
                </p>
              </div>
            </div>

            {/* Desktop text lane. Solid own fill, no second blur: the panel
                behind it already carries the one blur this stack gets. */}
            <aside
              aria-label={tf("voice.chat", "Chat")}
              className="hidden w-[300px] shrink-0 flex-col border-l border-[#fafaf9]/8 bg-[#0c0a09]/25 lg:flex"
            >
              <div className="flex h-10 shrink-0 items-center px-4 pt-2">
                <span className="glass-eyebrow font-sans">
                  {tf("voice.chat", "Chat")}
                </span>
              </div>
              {chatPane}
            </aside>

            {/* Phone chat sheet: slides over the lower stage, solid fill,
                the dock stays reachable underneath it is replaced by the
                pane's own input. */}
            <AnimatePresence>
              {chatOpen && (
                <motion.div
                  initial={reduce ? { opacity: 0 } : { opacity: 0, y: 40 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduce ? { opacity: 0 } : { opacity: 0, y: 40 }}
                  transition={{ duration: 0.2, ease: EASE }}
                  className="absolute inset-x-0 bottom-0 top-[26%] z-10 flex flex-col rounded-t-2xl border-t border-[#fafaf9]/10 bg-[#131009] lg:hidden"
                >
                  <div className="flex shrink-0 items-center justify-between px-4 pt-3 pb-1">
                    <span className="glass-eyebrow font-sans">
                      {tf("voice.chat", "Chat")}
                    </span>
                    <button
                      type="button"
                      onClick={() => setChatOpen(false)}
                      aria-label={t("common.close")}
                      className="flex h-8 w-8 items-center justify-center rounded-pill glass-chip cursor-pointer"
                    >
                      <CaretDown size={14} weight="bold" />
                    </button>
                  </div>
                  {chatPane}
                </motion.div>
              )}
            </AnimatePresence>
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
                        {menuFor.resolved && (
                          <UserBadges
                            isVerified={menuFor.isVerified}
                            verification={(menuFor as any).verification}
                            size={12}
                          />
                        )}
                      </span>
                      <span className="truncate font-sans text-[11px] text-subtle">
                        {cohostIds.has(menuFor.id)
                          ? tf("voice.cohostBadge", "Co-host")
                          : menuOnStage
                            ? tf("voice.onStageLabel", "On stage")
                            : menuFor.hand
                              ? t("voice.speakRequests")
                              : t("voice.listeners")}
                      </span>
                    </span>
                  </span>
                </OverlayHeader>
                <div className="flex flex-col gap-0.5 px-2 pb-3">
                  {(() => {
                    const m = menuFor;
                    const targetCohost = cohostIds.has(m.id);
                    const item =
                      "flex h-11 w-full items-center gap-2.5 rounded-lg px-3 text-left font-sans text-[13.5px] font-medium transition-colors hover:bg-chip cursor-pointer";
                    const run = (fn: () => void) => () => {
                      setMenuFor(null);
                      fn();
                    };
                    return (
                      <>
                        {/* Stage controls. A co-host is managed only by the
                            host, and through the role, not the mic. */}
                        {targetCohost ? (
                          row.isHost && (
                            <button
                              type="button"
                              onClick={run(() =>
                                void cohostTarget(m.id, m.username, false),
                              )}
                              className={clsx(item, "text-primary")}
                            >
                              <MicrophoneSlash size={16} weight="bold" />
                              {tf("voice.removeCohost", "Remove co-host")}
                            </button>
                          )
                        ) : menuOnStage ? (
                          <>
                            <button
                              type="button"
                              onClick={run(() =>
                                void muteTarget(m.id, m.username),
                              )}
                              className={clsx(item, "text-primary")}
                            >
                              <MicrophoneSlash size={16} weight="bold" />
                              {tf("voice.mute", "Mute")}
                            </button>
                            <button
                              type="button"
                              onClick={run(() =>
                                void revokeMic(m.id, m.username),
                              )}
                              className={clsx(item, "text-primary")}
                            >
                              <HandPalm size={16} weight="bold" />
                              {tf("voice.removeFromStage", "Remove from stage")}
                            </button>
                          </>
                        ) : m.hand ? (
                          <button
                            type="button"
                            onClick={run(() =>
                              void grantMic(m.id, m.username),
                            )}
                            className={clsx(item, "text-primary")}
                          >
                            <Microphone size={16} weight="bold" />
                            {tf("voice.bringToStage", "Bring to stage")}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={run(() =>
                              void inviteToSpeak(m.id, m.username),
                            )}
                            className={clsx(item, "text-primary")}
                          >
                            <Microphone size={16} weight="bold" />
                            {tf("voice.invite", "Invite to speak")}
                          </button>
                        )}
                        {/* Deputies: host only, two seats. */}
                        {row.isHost &&
                          !targetCohost &&
                          (row.cohosts?.length ?? 0) < 2 && (
                            <button
                              type="button"
                              onClick={run(() =>
                                void cohostTarget(m.id, m.username, true),
                              )}
                              className={clsx(item, "text-primary")}
                            >
                              <Users size={16} weight="bold" />
                              {tf("voice.makeCohost", "Make co-host")}
                            </button>
                          )}
                        <button
                          type="button"
                          onClick={run(() => viewProfile(m))}
                          className={clsx(item, "text-primary")}
                        >
                          <ArrowSquareOut size={16} weight="bold" />
                          {tf("voice.viewProfile", "View profile")}
                        </button>
                        <button
                          type="button"
                          onClick={run(() => setReportFor(m))}
                          className={clsx(item, "text-primary")}
                        >
                          <Flag size={16} weight="bold" />
                          {tf("voice.report", "Report")}
                        </button>
                        {/* Removal: a ban, not a shove. Co-hosts can't
                            remove co-hosts; that is the host's call. */}
                        {(row.isHost || !targetCohost) && (
                          <button
                            type="button"
                            onClick={run(() =>
                              void removeTarget(m.id, m.username),
                            )}
                            className={clsx(item, "text-danger")}
                          >
                            <SignOut size={16} weight="bold" />
                            {tf("voice.removeFromSpace", "Remove from space")}
                          </button>
                        )}
                      </>
                    );
                  })()}
                </div>
              </OverlayPanel>
            </div>
          )}
        </AnimatePresence>

        {/* The standard safety flow, aimed at a person in the room. */}
        {reportFor && (
          <div onClick={(e) => e.stopPropagation()}>
            <ReportSheet
              targetType="user"
              targetId={reportFor.id}
              subject={`@${reportFor.username}`}
              onClose={() => setReportFor(null)}
            />
          </div>
        )}
      </motion.div>
    </ConfirmModalPortal>
  );
}
