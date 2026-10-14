"use client";

import {
  ArrowsInSimple,
  CaretDown,
  ChatCircle,
  HandPalm,
  Headphones,
  LinkSimple,
  NotePencil,
  ShareNetwork,
  Sparkle,
  SpeakerHigh,
} from "@phosphor-icons/react";
import { AnimatePresence, motion, useReducedMotionConfig } from "framer-motion";
import { useAtomValue, useSetAtom } from "jotai";
import { useRouter } from "next/navigation";
import {
  type CSSProperties,
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import ReportSheet from "@/components/safety/ReportSheet";
import ConfirmModalPortal from "@/components/ui/ConfirmModalPortal";
import { useOverlayDismiss } from "@/components/ui/Overlay";
import { SafeAvatar } from "@/components/ui/SafeAvatar";
import { Tabs } from "@/components/ui/Tabs";
import { useToast } from "@/components/ui/Toast/ToastContext";
import { ListenerGrid } from "@/components/voice/room/ListenerGrid";
import { ManagerMenu } from "@/components/voice/room/ManagerMenu";
import {
  ROOM_HOUSE_NIGHT,
  RoomBackdrop,
} from "@/components/voice/room/RoomBackdrop";
import { RoomBar } from "@/components/voice/room/RoomBar";
import { RoomChat } from "@/components/voice/room/RoomChat";
import { ReactionFloats } from "@/components/voice/room/reactions";
import {
  type RoomAudio,
  type RoomLive,
  useRoomRoster,
} from "@/components/voice/room/roster";
import { StageSeat } from "@/components/voice/room/StageSeat";
import { VividPanel } from "@/components/voice/room/Vivid";
import {
  ElapsedTimer,
  type SpaceRow,
  spaceCategoryLabel,
  spaceCommunities,
} from "@/components/voice/SpaceCard";
import type { RoomMember } from "@/hooks/useSpaceRoom";
import { useT } from "@/i18n/client";
import { isDemoId } from "@/lib/demoSeed";
import {
  DUR,
  EASE,
  EASE_OUT_EXPO,
  EASE_SHEET,
  menuStagger,
  pop,
  press,
  staggerItem,
  swap,
} from "@/lib/motion-presets";
import {
  inviteSpeakAction,
  muteSpeakerAction,
  removeFromSpaceAction,
  setCohostAction,
} from "@/lib/space.actions";
import { formatCompact } from "@/lib/utils";
import { pendingDraftAtom } from "@/store/drafts.atom";
import { userAtom } from "@/store/user.atom";

/**
 * The room is fixed dark in both themes, so inside it the brand INK is the
 * room's own light ink (an ink palette's light-mode brand is near black,
 * which would vanish here) and the house background is always the night
 * picture. The text and surface tokens are re-pointed by `.ws-on-dark`.
 */
const ROOM_STYLE = {
  "--ws-space-house": ROOM_HOUSE_NIGHT,
  "--ws-brand-gold-text": "#eef2f6",
} as CSSProperties;

/** Wide enough to seat the Chat | Vivid panel beside the stage. */
const WIDE = "(min-width: 1024px)";
const subscribeWide = (cb: () => void) => {
  const mq = window.matchMedia(WIDE);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};
const useWide = () =>
  useSyncExternalStore(
    subscribeWide,
    () => window.matchMedia(WIDE).matches,
    () => false,
  );

type PanelTab = "chat" | "vivid";

interface SpaceRoomProps {
  row: SpaceRow;
  /**
   * The audio connection, owned by VoiceRoomHost. It lives up there, not
   * here, because this component unmounts on minimize, and audio that dies
   * the moment you dock the room makes the dock a lie.
   */
  audio: RoomAudio;
  /** Presence, chat and reactions, hoisted beside the audio for the same
   *  reason: minimizing must not remove you from the room. */
  roomLive: RoomLive;
  /** Collapse to the floating dock; the room keeps running. */
  onMinimize: () => void;
  /** Leave for good (listeners). */
  onLeave: () => void;
  /** Host only: ends the room for everyone. */
  onEnd: (row: SpaceRow) => void;
}

/**
 * The room itself (owner pick 2026-10-14, "the room" mock): a stage over
 * the room's own art. On air, the time and the topic, then the title; the
 * stage as large faces, each saying what it is doing; everyone else as a
 * grid of faces with first names and raised hands; a side panel with the
 * room's Chat and Vivid's notes; and a bar along the foot with your own
 * mic and the five things you can do.
 *
 * Presence (Ably `space:<id>`) is the guest list: ids only, faces and
 * badges server-resolved. Listeners join with no publish rights (the
 * LiveKit token enforces it), so their bar offers Raise, not a dead mic;
 * the mic appears only once the host brings them up.
 */
export default function SpaceRoom({
  row,
  audio,
  roomLive,
  onMinimize,
  onLeave,
  onEnd,
}: SpaceRoomProps) {
  const t = useT();
  const { toast } = useToast();
  const reduce = useReducedMotionConfig();
  const router = useRouter();
  const me = useAtomValue(userAtom);
  const setPendingDraft = useSetAtom(pendingDraftAtom);
  const {
    reactions,
    messages,
    sendChat,
    profileOf,
    members,
    realtime,
    hand,
    react,
    toggleHand,
    setSpeaker,
  } = roomLive;
  const {
    state: audioState,
    canSpeak,
    muted,
    toggleMute,
    room,
    needsUnlock,
    unlockAudio,
  } = audio;

  // Host and co-hosts share the stage tools; only the host manages
  // co-hosts themselves or ends the room.
  const canManage = Boolean(row.isHost || row.isCohost);
  const demo = isDemoId(row.id);
  const wide = useWide();

  // Missing-i18n fallback: t() returns the key untranslated when a catalog
  // lacks it; these strings are newer than the dictionaries.
  const tf = useCallback(
    (key: string, fallback: string) => {
      const v = t(key);
      return v === key ? fallback : v;
    },
    [t],
  );

  // The participant the host tapped: an anchored popover with stage
  // controls. Null when closed.
  const [menuFor, setMenuFor] = useState<RoomMember | null>(null);
  // Optimistic stage map: the gateway grant succeeded but LiveKit's
  // permission flip hasn't landed yet.
  const [staged, setStaged] = useState<Record<string, boolean>>({});
  // The share menu (copy link / post about it).
  const [shareOpen, setShareOpen] = useState(false);
  const shareRef = useRef<HTMLDivElement>(null);
  const [reactOpen, setReactOpen] = useState(false);
  // The side panel's tab. Chat is where the room talks back, so it leads.
  const [tab, setTab] = useState<PanelTab>("chat");
  // The phone sheet carrying the same panel; on a wide screen it is seated.
  const [sheetOpen, setSheetOpen] = useState(false);
  const [seenCount, setSeenCount] = useState(0);
  // Report a participant through the standard safety flow.
  const [reportFor, setReportFor] = useState<RoomMember | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);
  useOverlayDismiss(menuFor !== null, () => setMenuFor(null));

  const myId = me?._id ? String(me._id) : "";
  const roster = useRoomRoster({ row, audio, live: roomLive, myId, staged });

  // Land focus in the room, so Space and Escape speak to it at once and a
  // screen reader starts at the room, not the page under it.
  useEffect(() => {
    rootRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    if (!shareOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!shareRef.current?.contains(e.target as Node)) setShareOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [shareOpen]);

  // Growing past the phone layout seats the panel; a sheet left open
  // underneath would only swallow the next Escape.
  useEffect(() => {
    if (wide) setSheetOpen(false);
  }, [wide]);

  // Chat on screen marks everything read; the badge and ticker run off the
  // rest.
  const chatVisible = tab === "chat" && (wide || sheetOpen);
  useEffect(() => {
    if (chatVisible) setSeenCount(messages.length);
  }, [chatVisible, messages.length]);
  const unread = Math.max(0, messages.length - seenCount);

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

  const fail = (message?: string) =>
    toast(message || t("voice.endFailed"), { type: "error" });

  /**
   * Hand the mic to someone. The gateway flips the live LiveKit permission
   * (updateParticipant), so their mic appears in place with no rejoin.
   */
  const grantMic = async (m: RoomMember) => {
    const res = await setSpeaker(m.id, true);
    if (res?.success) {
      setStaged((s) => ({ ...s, [m.id]: true }));
      toast(`${m.username}: ${t("voice.approve")}`, { type: "success" });
    } else fail(res?.message);
  };

  /** Take the mic back. */
  const revokeMic = async (m: RoomMember) => {
    const res = await setSpeaker(m.id, false);
    if (res?.success) {
      setStaged((s) => ({ ...s, [m.id]: false }));
      toast(`${m.username}: ${tf("voice.offStage", "back in the audience")}`, {
        type: "success",
      });
    } else fail(res?.message);
  };

  /** Ask a listener up: they accept or decline; nobody is conscripted. */
  const inviteToSpeak = async (m: RoomMember) => {
    const res = await inviteSpeakAction(row.id, m.id);
    if (res.success) {
      toast(`${m.username}: ${tf("voice.invited", "invited to speak")}`, {
        type: "success",
      });
    } else fail(res.message);
  };

  /** Server-enforced mute; they can unmute themselves. */
  const muteTarget = async (m: RoomMember) => {
    const res = await muteSpeakerAction(row.id, m.id);
    if (res.success) {
      toast(`${m.username}: ${tf("voice.mutedThem", "muted")}`, {
        type: "success",
      });
    } else fail(res.message);
  };

  /** Remove is a ban: disconnected now, and the door stays shut. */
  const removeTarget = async (m: RoomMember) => {
    const res = await removeFromSpaceAction(row.id, m.id);
    if (res.success) {
      toast(
        `${m.username}: ${tf("voice.removedThem", "removed from the space")}`,
        { type: "success" },
      );
    } else fail(res.message);
  };

  /** Host only: appoint or dismiss a deputy. */
  const cohostTarget = async (m: RoomMember, grant: boolean) => {
    const res = await setCohostAction(row.id, m.id, grant);
    if (res.success) {
      toast(
        `${m.username}: ${
          grant
            ? tf("voice.cohostMade", "co-host now")
            : tf("voice.cohostDropped", "no longer a co-host")
        }`,
        { type: "success" },
      );
    } else fail(res.message);
  };

  // The talking flow (owner 2026-10-12): while your mic is open the bar
  // counts how long you've been on air, and Space toggles the mic from
  // anywhere in the room except a text field.
  const micLive = canSpeak && !muted && audioState === "listening";
  const [liveSince, setLiveSince] = useState<number | null>(null);
  useEffect(() => {
    setLiveSince((v) => (micLive ? (v ?? Date.now()) : null));
  }, [micLive]);
  useEffect(() => {
    if (!canSpeak || audioState !== "listening") return;
    const onSpace = (e: KeyboardEvent) => {
      if (e.code !== "Space" || e.repeat) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el?.closest("input, textarea, select, [contenteditable='true']"))
        return;
      e.preventDefault();
      void toggleMute();
    };
    document.addEventListener("keydown", onSpace);
    return () => document.removeEventListener("keydown", onSpace);
  }, [canSpeak, audioState, toggleMute]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Escape collapses to the dock; it must never silently drop the room.
      // With a popover, menu or sheet open, Escape closes that instead.
      if (e.key !== "Escape") return;
      if (menuFor || shareOpen || reactOpen || sheetOpen || reportFor) {
        setShareOpen(false);
        setReactOpen(false);
        setSheetOpen(false);
        return;
      }
      onMinimize();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onMinimize, menuFor, shareOpen, reactOpen, sheetOpen, reportFor]);

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

  // A face opens the person; the room stays alive in the dock underneath.
  // Demo people have no profiles to open.
  const openProfile = (username: string) => {
    if (demo) {
      toast(t("voice.demoRow"), { type: "success" });
      return;
    }
    onMinimize();
    router.push(`/profile/${username}`);
  };

  // Managers get the stage controls for anyone but themselves; everyone
  // else gets the person's profile.
  const pickMember = (m: RoomMember) => {
    if (m.id === myId) return;
    if (canManage) setMenuFor(m);
    else openProfile(m.username);
  };

  // The bar's Chat: on a wide screen the panel is already seated, so it
  // brings the Chat tab forward and puts the cursor in it; on a phone it
  // opens (or closes) the sheet on Chat.
  const openChat = () => {
    if (wide) {
      setTab("chat");
      requestAnimationFrame(() => chatInputRef.current?.focus());
      return;
    }
    if (sheetOpen && tab === "chat") {
      setSheetOpen(false);
      return;
    }
    setTab("chat");
    setSheetOpen(true);
  };

  const lastMsg = messages[messages.length - 1];
  const showTicker =
    !wide && !chatVisible && unread > 0 && lastMsg && lastMsg.from !== myId;

  const category = spaceCategoryLabel(row);
  const communities = spaceCommunities(row);
  const menuOnStage = menuFor ? roster.isOnStage(menuFor.id) : false;

  const seatLabels = {
    you: tf("voice.you", "You"),
    speaking: tf("voice.speaking", "Speaking"),
    host: tf("voice.hostBadge", "Host"),
    cohost: tf("voice.cohostBadge", "Co-host"),
    speaker: tf("voice.speaker", "Speaker"),
    muted: tf("voice.mutedRole", "Muted"),
  };

  const panelTabs = (
    <Tabs<PanelTab>
      items={[
        {
          key: "chat",
          label: tf("voice.chat", "Chat"),
          Icon: ChatCircle,
          badge: tab === "chat" ? undefined : unread || undefined,
        },
        { key: "vivid", label: tf("voice.vivid", "Vivid"), Icon: Sparkle },
      ]}
      value={tab}
      onChange={setTab}
      ariaLabel={tf("voice.roomPanel", "Room panel")}
    />
  );

  const chatPane = (
    <RoomChat
      messages={messages}
      meId={myId}
      nameOf={nameOf}
      avatarOf={avatarOf}
      onSend={sendChat}
      inputRef={chatInputRef}
      labels={{
        placeholder: tf("voice.chatPlaceholder", "Message the room"),
        empty: tf("voice.chatEmpty", "Nothing yet. Say something to the room."),
        send: tf("voice.chatSend", "Send"),
      }}
    />
  );

  // No notes backend yet: one honest state. The notes phase passes notes,
  // a transcript opener and Ask here.
  const vividPane = <VividPanel notes={null} />;

  const iconBtn =
    "flex h-10 min-w-10 cursor-pointer items-center justify-center gap-2 rounded-pill px-2.5 font-sans text-[calc(14.5px*var(--ws-fs))] font-medium text-muted transition-colors hover:bg-primary/[0.07] hover:text-primary sm:px-3.5";

  return (
    <ConfirmModalPortal>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: DUR.base, ease: EASE }}
        className="fixed inset-0 z-modal"
      >
        <div
          ref={rootRef}
          role="dialog"
          aria-modal="true"
          aria-label={row.title}
          tabIndex={-1}
          style={ROOM_STYLE}
          className="ws-on-dark absolute inset-0 flex flex-col overflow-hidden outline-none"
        >
          <RoomBackdrop row={row} />

          <motion.div
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: DUR.slow, ease: EASE_OUT_EXPO }}
            className="relative flex min-h-0 flex-1 flex-col"
          >
            {/* Header: on air, the time and the topic, then the title. */}
            <header className="flex shrink-0 items-start gap-3 px-4 pt-[max(var(--ws-safe-top),14px)] sm:px-6 sm:pt-6 lg:px-10 lg:pt-8">
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 font-sans text-[calc(12.5px*var(--ws-fs))] text-muted lg:text-[calc(13.5px*var(--ws-fs))]">
                  {/* A badge, so it may shout; everything after it is words. */}
                  <span className="flex shrink-0 items-center gap-1.5 rounded-pill bg-danger/15 px-2 py-0.5 font-sans text-[calc(10.5px*var(--ws-fs))] font-bold uppercase tracking-[0.12em] text-[#ff9b9b]">
                    <span className="size-1.5 animate-pulse rounded-pill bg-danger" />
                    {tf("voice.onAir", "On air")}
                  </span>
                  <ElapsedTimer
                    since={row.startedAt}
                    className="font-semibold text-primary"
                  />
                  {/* Each separator travels with the words after it, so a
                      wrap never strands a dot at the end of a line. */}
                  {category && (
                    <span className="flex shrink-0 items-center gap-2">
                      <span aria-hidden className="text-subtle">
                        ·
                      </span>
                      {category}
                    </span>
                  )}
                  {communities.length > 0 && (
                    <span className="flex min-w-0 items-center gap-2">
                      <span aria-hidden className="text-subtle">
                        ·
                      </span>
                      <span className="min-w-0 truncate">
                        {communities[0].name}
                        {communities.length > 1 &&
                          ` +${communities.length - 1}`}
                      </span>
                    </span>
                  )}
                  {demo && (
                    <span className="rounded-pill bg-primary/10 px-2 py-0.5 font-semibold text-primary">
                      {t("voice.demoChip")}
                    </span>
                  )}
                </div>
                <h1 className="mt-2 line-clamp-3 font-display text-[calc(20px*var(--ws-fs))] font-semibold leading-tight tracking-[-0.01em] text-primary sm:text-[calc(24px*var(--ws-fs))] sm:line-clamp-2 lg:mt-3 lg:text-[calc(32px*var(--ws-fs))]">
                  {row.title}
                </h1>
                {row.description && (
                  <p className="mt-2 hidden max-w-[72ch] line-clamp-2 font-sans text-[calc(14px*var(--ws-fs))] leading-relaxed text-muted sm:block">
                    {row.description}
                  </p>
                )}
              </div>

              <div className="-mr-2 flex shrink-0 items-center gap-0.5 sm:mr-0 sm:gap-1">
                <span className="flex h-10 items-center gap-1.5 px-2 font-sans text-[calc(13.5px*var(--ws-fs))] font-semibold text-primary tabular-nums sm:px-3 sm:text-[calc(14.5px*var(--ws-fs))]">
                  <Headphones size={17} className="text-muted sm:hidden" />
                  {/* People coming and going is not your doing: it rolls. */}
                  <span className="relative inline-flex overflow-hidden">
                    <AnimatePresence mode="popLayout" initial={false}>
                      <motion.span
                        key={formatCompact(roster.listenerCount)}
                        {...swap}
                        className="inline-block"
                      >
                        {formatCompact(roster.listenerCount)}
                      </motion.span>
                    </AnimatePresence>
                  </span>
                  <span className="hidden sm:inline">
                    {t("voice.listeners")}
                  </span>
                  <span className="sr-only sm:hidden">
                    {t("voice.listeners")}
                  </span>
                </span>
                <div ref={shareRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setShareOpen((v) => !v)}
                    aria-label={t("voice.share")}
                    aria-haspopup="menu"
                    aria-expanded={shareOpen}
                    className={iconBtn}
                  >
                    <ShareNetwork size={18} className="sm:hidden" />
                    <span className="hidden sm:inline">{t("voice.share")}</span>
                  </button>
                  <AnimatePresence>
                    {shareOpen && (
                      <motion.div
                        key="share-menu"
                        role="menu"
                        {...menuStagger("top-right")}
                        className="absolute right-0 top-full z-dropdown mt-2 w-[212px] overflow-hidden rounded-[22px] bg-[#111722]/90 p-1.5 shadow-pop backdrop-blur-2xl"
                      >
                        <motion.button
                          variants={staggerItem}
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setShareOpen(false);
                            void copyLink();
                          }}
                          className="flex h-11 w-full cursor-pointer items-center gap-2.5 rounded-pill px-3.5 text-left font-sans text-[calc(13.5px*var(--ws-fs))] font-medium text-primary transition-colors hover:bg-primary/[0.08]"
                        >
                          <LinkSimple size={16} />
                          {tf("voice.copyLink", "Copy link")}
                        </motion.button>
                        <motion.button
                          variants={staggerItem}
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setShareOpen(false);
                            postAbout();
                          }}
                          className="flex h-11 w-full cursor-pointer items-center gap-2.5 rounded-pill px-3.5 text-left font-sans text-[calc(13.5px*var(--ws-fs))] font-medium text-primary transition-colors hover:bg-primary/[0.08]"
                        >
                          <NotePencil size={16} />
                          {tf("voice.postAbout", "Post about it")}
                        </motion.button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                <button
                  type="button"
                  onClick={onMinimize}
                  aria-label={t("voice.minimize")}
                  className={iconBtn}
                >
                  <ArrowsInSimple size={18} className="sm:hidden" />
                  <span className="hidden sm:inline">
                    {tf("voice.minimiseShort", "Minimise")}
                  </span>
                </button>
              </div>
            </header>

            {/* The stage and the room, with the panel beside them on a wide
                screen. */}
            <div className="relative flex min-h-0 flex-1 gap-10 px-4 sm:px-6 lg:px-10">
              <div className="relative flex min-w-0 flex-1 flex-col">
                <div
                  ref={scrollRef}
                  className="min-h-0 flex-1 overflow-y-auto no-scrollbar pb-6"
                >
                  <section
                    aria-label={tf("voice.onStageLabel", "On stage")}
                    className="pt-6 lg:pt-12"
                  >
                    <div className="grid grid-cols-3 gap-x-2 gap-y-6 sm:grid-cols-4 lg:flex lg:flex-wrap lg:gap-x-10 lg:gap-y-8">
                      {roster.stage.map((seat) => {
                        const target = seat.member;
                        const onClick = seat.isMe
                          ? undefined
                          : target
                            ? () => pickMember(target)
                            : () => openProfile(seat.username);
                        return (
                          <StageSeat
                            key={seat.id || `host-${seat.username}`}
                            seat={seat}
                            room={room}
                            onClick={onClick}
                            labels={seatLabels}
                          />
                        );
                      })}
                    </div>
                  </section>

                  <div aria-hidden className="my-7 h-px bg-hairline lg:my-10" />

                  <section aria-labelledby="ws-room-audience">
                    <div className="flex min-h-8 items-center gap-2.5">
                      <h2
                        id="ws-room-audience"
                        className="font-sans text-[calc(13.5px*var(--ws-fs))] font-semibold text-primary lg:text-[calc(14.5px*var(--ws-fs))]"
                      >
                        {t("voice.inTheRoom")}
                      </h2>
                      {realtime && (
                        <span className="relative inline-flex overflow-hidden font-sans text-[calc(13.5px*var(--ws-fs))] text-muted tabular-nums lg:text-[calc(14.5px*var(--ws-fs))]">
                          <AnimatePresence mode="popLayout" initial={false}>
                            <motion.span
                              key={roster.audience.length}
                              {...swap}
                              className="inline-block"
                            >
                              {formatCompact(roster.audience.length)}
                            </motion.span>
                          </AnimatePresence>
                        </span>
                      )}
                      <AnimatePresence initial={false}>
                        {roster.hands > 0 && (
                          <motion.span
                            key="hands"
                            {...pop}
                            className="ml-auto flex h-8 items-center gap-1.5 rounded-pill bg-primary/[0.08] px-3 font-sans text-[calc(12.5px*var(--ws-fs))] font-semibold text-primary tabular-nums"
                          >
                            <HandPalm size={13} weight="fill" />
                            {roster.hands}{" "}
                            {roster.hands === 1
                              ? tf("voice.handRaisedOne", "hand raised")
                              : tf("voice.handsRaisedMany", "hands raised")}
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </div>
                    {realtime && roster.audience.length > 0 ? (
                      <ListenerGrid
                        members={roster.audience}
                        myId={myId}
                        scrollRoot={scrollRef}
                        onPick={pickMember}
                        labels={{
                          you: seatLabels.you,
                          handUp: tf("voice.handRaised", "Hand raised"),
                          listener: t("voice.listeners"),
                          more: (n) =>
                            `+${n} ${tf("voice.moreScroll", "more · scroll to see everyone")}`,
                        }}
                      />
                    ) : (
                      <p className="mt-3 font-sans text-[calc(13.5px*var(--ws-fs))] text-muted">
                        {realtime
                          ? t("voice.roomQuiet")
                          : `${formatCompact(roster.listenerCount)} ${t("voice.listeners")}`}
                      </p>
                    )}
                  </section>

                  {/* Who is talking, for ears that can't see the rings. */}
                  <span className="sr-only" aria-live="polite">
                    {roster.speakingNames.join(", ")}
                  </span>
                </div>

                <ReactionFloats reactions={reactions} />

                {/* Autoplay was refused (iOS until a gesture): the honest fix
                    is a tap, so offer the tap. */}
                <AnimatePresence>
                  {needsUnlock && audioState === "listening" && (
                    <div
                      key="unlock"
                      className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center"
                    >
                      <motion.button
                        {...pop}
                        {...press}
                        type="button"
                        onClick={() => void unlockAudio()}
                        className="pointer-events-auto flex h-11 cursor-pointer items-center gap-2 rounded-pill bg-[#eef2f6] px-5 font-sans text-[calc(14px*var(--ws-fs))] font-semibold text-[#05070a] shadow-pop"
                      >
                        <SpeakerHigh size={16} weight="fill" />
                        {tf("voice.tapToListen", "Tap to listen")}
                      </motion.button>
                    </div>
                  )}
                </AnimatePresence>

                {/* New-chat ticker (phones): the latest line slides in above
                    the bar so the stage never hides a conversation. */}
                <AnimatePresence>
                  {showTicker && (
                    <motion.button
                      type="button"
                      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: DUR.base, ease: EASE }}
                      onClick={openChat}
                      className="absolute inset-x-0 bottom-2 flex cursor-pointer items-center gap-2 rounded-pill bg-[#0b0f15]/90 px-3 py-2 text-left"
                    >
                      <span className="relative size-5 shrink-0 overflow-hidden rounded-pill bg-[#1c2533]">
                        <SafeAvatar src={avatarOf(lastMsg.from)} eager />
                      </span>
                      <span className="min-w-0 flex-1 truncate font-sans text-[calc(13px*var(--ws-fs))] text-primary">
                        <span className="mr-1.5 font-semibold text-muted">
                          {nameOf(lastMsg.from)}
                        </span>
                        {lastMsg.text}
                      </span>
                      {unread > 1 && (
                        <span className="shrink-0 rounded-pill bg-[#eef2f6] px-1.5 py-px font-sans text-[calc(10.5px*var(--ws-fs))] font-bold text-[#05070a] tabular-nums">
                          {unread}
                        </span>
                      )}
                    </motion.button>
                  )}
                </AnimatePresence>
              </div>

              {/* The panel, seated. A plain tint on the art: the menus that
                  float over the room carry the stack's one backdrop blur. */}
              {wide && (
                <aside
                  aria-label={tf("voice.roomPanel", "Room panel")}
                  className="mb-4 mt-8 flex w-[360px] shrink-0 flex-col overflow-hidden rounded-[20px] bg-primary/[0.045] xl:w-[400px]"
                >
                  <div className="shrink-0 px-3 pt-2">{panelTabs}</div>
                  <div className="min-h-0 flex-1">
                    {tab === "chat" ? chatPane : vividPane}
                  </div>
                </aside>
              )}
            </div>

            <div className="relative shrink-0 px-3 pb-safe pt-2 sm:px-6 lg:px-10 lg:pb-6">
              <RoomBar
                avatar={me?.avatar}
                audio={audio}
                liveSince={liveSince}
                hand={hand}
                canRaise={!canManage}
                onRaise={toggleHand}
                reactOpen={reactOpen}
                onReactOpen={setReactOpen}
                onReact={react}
                onChat={openChat}
                chatActive={!wide && sheetOpen}
                unread={chatVisible ? 0 : unread}
                isHost={row.isHost}
                onLeave={onLeave}
                onEnd={() => onEnd(row)}
                tf={tf}
              />
            </div>

            {/* The panel on a phone: the same Chat and Vivid in a sheet over
                the lower room. Solid fill, no second blur. */}
            <AnimatePresence>
              {!wide && sheetOpen && (
                <>
                  <motion.button
                    key="sheet-scrim"
                    type="button"
                    aria-label={t("common.close")}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: DUR.base, ease: EASE }}
                    onClick={() => setSheetOpen(false)}
                    className="absolute inset-0 cursor-default bg-[#05070a]/55"
                  />
                  <motion.div
                    key="sheet"
                    role="dialog"
                    aria-label={tf("voice.roomPanel", "Room panel")}
                    initial={reduce ? { opacity: 0 } : { y: "100%" }}
                    animate={reduce ? { opacity: 1 } : { y: 0 }}
                    exit={
                      reduce
                        ? { opacity: 0 }
                        : {
                            y: "100%",
                            transition: { duration: DUR.base, ease: EASE },
                          }
                    }
                    transition={{ duration: DUR.slow, ease: EASE_SHEET }}
                    className="absolute inset-x-0 bottom-0 top-[14%] flex flex-col rounded-t-[28px] bg-[#0b0f15]"
                  >
                    <div className="flex shrink-0 items-center gap-2 pl-3 pr-2 pt-2">
                      <div className="min-w-0 flex-1">{panelTabs}</div>
                      <button
                        type="button"
                        onClick={() => setSheetOpen(false)}
                        aria-label={t("common.close")}
                        className="flex size-10 cursor-pointer items-center justify-center rounded-pill text-muted transition-colors hover:bg-primary/[0.08] hover:text-primary"
                      >
                        <CaretDown size={18} weight="bold" />
                      </button>
                    </div>
                    <div className="min-h-0 flex-1 pb-safe">
                      {tab === "chat" ? chatPane : vividPane}
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </motion.div>
        </div>

        {/* The host's controls for one person. Outside the fixed-dark room
            on purpose: a popover follows the person's theme. */}
        <AnimatePresence>
          {menuFor && (
            <ManagerMenu
              key="manager"
              member={menuFor}
              onClose={() => setMenuFor(null)}
              isHost={row.isHost}
              isCohost={roster.cohostIds.has(menuFor.id)}
              onStage={menuOnStage}
              cohostSeatsLeft={(row.cohosts?.length ?? 0) < 2}
              tf={tf}
              actions={{
                grant: (m) => void grantMic(m),
                revoke: (m) => void revokeMic(m),
                invite: (m) => void inviteToSpeak(m),
                mute: (m) => void muteTarget(m),
                remove: (m) => void removeTarget(m),
                cohost: (m, grant) => void cohostTarget(m, grant),
                profile: (m) => openProfile(m.username),
                report: (m) => setReportFor(m),
              }}
            />
          )}
        </AnimatePresence>

        {/* The standard safety flow, aimed at a person in the room. */}
        {reportFor && (
          <ReportSheet
            targetType="user"
            targetId={reportFor.id}
            subject={`@${reportFor.username}`}
            onClose={() => setReportFor(null)}
          />
        )}
      </motion.div>
    </ConfirmModalPortal>
  );
}
