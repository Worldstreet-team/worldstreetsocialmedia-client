"use client";

import {
  ChatCircle,
  CircleNotch,
  HandPalm,
  Microphone,
  MicrophoneSlash,
  SignOut,
  Smiley,
  StopCircle,
} from "@phosphor-icons/react";
import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { type ReactNode, useEffect, useRef } from "react";
import { SafeAvatar } from "@/components/ui/SafeAvatar";
import { formatElapsed, useNow } from "@/components/voice/useNow";
import { pop, press, swap } from "@/lib/motion-presets";
import { MicLevel } from "./MicLevel";
import { type ReactionKind, ReactTray } from "./reactions";
import type { RoomAudio } from "./roster";

/** "02:41" since the mic opened, on the shared clock. A leaf, so the tick
 *  redraws five characters and not the room. */
function LiveFor({ since }: { since: number }) {
  const now = useNow();
  if (!now) return null;
  return <span className="tabular-nums">{formatElapsed(now - since)}</span>;
}

/**
 * One control in the bar. On a phone it is a tile with the label under the
 * glyph, five across; from `sm` it is a pill with the label beside it.
 * Either way the target is at least 44px tall.
 */
function BarButton({
  icon,
  label,
  onClick,
  tone = "ghost",
  pressed,
  disabled,
  badge,
  haspopup,
}: {
  icon: ReactNode;
  label: ReactNode;
  onClick: () => void;
  tone?: "ghost" | "on" | "white" | "leave" | "end";
  /** Toggle state for a button whose label does not change with it. */
  pressed?: boolean;
  disabled?: boolean;
  badge?: number;
  haspopup?: boolean;
}) {
  return (
    <motion.button
      {...press}
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={haspopup ? undefined : pressed}
      aria-haspopup={haspopup ? "menu" : undefined}
      aria-expanded={haspopup ? pressed : undefined}
      className={clsx(
        "relative flex min-w-0 flex-1 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl px-1 py-1.5 font-sans text-[calc(11.5px*var(--ws-fs))] font-semibold transition-colors sm:h-12 sm:flex-none sm:flex-row sm:gap-2 sm:rounded-pill sm:px-5 sm:py-0 sm:text-[calc(14.5px*var(--ws-fs))]",
        "disabled:cursor-not-allowed disabled:opacity-40",
        tone === "ghost" && "text-primary hover:bg-primary/[0.08]",
        tone === "on" && "bg-primary/[0.12] text-primary",
        tone === "white" && "bg-[#eef2f6] text-[#05070a] hover:bg-white",
        tone === "leave" && "bg-danger/20 text-[#ff8f8f] hover:bg-danger/30",
        tone === "end" && "bg-danger text-white hover:bg-danger/90",
      )}
    >
      <span className="relative flex size-6 items-center justify-center sm:size-5">
        {icon}
        <AnimatePresence>
          {badge !== undefined && badge > 0 && (
            <motion.span
              key="badge"
              {...pop}
              className="absolute -right-2.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-pill bg-[#eef2f6] px-1 font-sans text-[calc(9.5px*var(--ws-fs))] font-bold text-[#05070a] tabular-nums"
            >
              {badge > 9 ? "9+" : badge}
            </motion.span>
          )}
        </AnimatePresence>
      </span>
      <span className="max-w-full truncate">{label}</span>
    </motion.button>
  );
}

/**
 * The bar along the foot of the room: you, what your mic is doing, and the
 * five things you can do. The left side says the truth about your audio
 * (on air with the time and your own level, muted, listening, reconnecting,
 * dropped with a Rejoin); the right side is Raise, React, Chat, Mute and
 * Leave, each shown only when it means something for you: the audience
 * asks for the mic, the stage has one.
 */
export function RoomBar({
  avatar,
  audio,
  liveSince,
  hand,
  canRaise,
  onRaise,
  reactOpen,
  onReactOpen,
  onReact,
  onChat,
  chatActive,
  unread,
  isHost,
  onLeave,
  onEnd,
  tf,
}: {
  avatar?: string;
  audio: RoomAudio;
  /** When your mic opened, or null while it is closed. */
  liveSince: number | null;
  hand: boolean;
  /** The audience asks for the mic; the host and co-hosts already run it. */
  canRaise: boolean;
  onRaise: () => void;
  reactOpen: boolean;
  onReactOpen: (open: boolean) => void;
  onReact: (kind: ReactionKind) => void;
  onChat: () => void;
  chatActive: boolean;
  unread: number;
  isHost: boolean;
  onLeave: () => void;
  onEnd: () => void;
  tf: (key: string, fallback: string) => string;
}) {
  const { state, canSpeak, muted, room, toggleMute, reconnect } = audio;
  const onAir = canSpeak && !muted && state === "listening";
  const reactRef = useRef<HTMLDivElement>(null);

  // The tray closes on a tap anywhere outside it and its button.
  useEffect(() => {
    if (!reactOpen) return;
    const onDown = (e: PointerEvent) => {
      if (!reactRef.current?.contains(e.target as Node)) onReactOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [reactOpen, onReactOpen]);

  // What the left side says, in order of what matters most right now.
  let title: string;
  let sub: ReactNode = null;
  let busy = false;
  let rejoin = false;
  if (state === "connecting") {
    title = tf("voice.audioConnecting", "Connecting audio…");
    busy = true;
  } else if (state === "reconnecting") {
    title = tf("voice.reconnecting", "Reconnecting to the room…");
    busy = true;
  } else if (state === "failed") {
    title = tf("voice.audioDropped", "Audio dropped");
    sub = tf("voice.readAlong", "You can still read along in the room");
    rejoin = true;
  } else if (state === "unavailable") {
    title = tf("voice.audioOffShort", "Audio is off here");
    sub = tf(
      "voice.audioUnavailable",
      "Audio isn't switched on for this deployment",
    );
  } else if (onAir) {
    title = tf("voice.youreOnAir", "You're on air");
    sub = (
      <>
        {liveSince !== null && <LiveFor since={liveSince} />}
        {/* Only where there is a keyboard to press it on. */}
        <span className="hidden pointer-fine:inline">
          {liveSince !== null && " · "}
          {tf("voice.spaceMutes", "press Space to mute")}
        </span>
      </>
    );
  } else if (canSpeak && state === "listening") {
    title = tf("voice.youreMuted", "You're muted");
    sub = (
      <>
        <span className="hidden pointer-fine:inline">
          {tf("voice.spaceTalks", "press Space to talk")}
        </span>
        <span className="pointer-fine:hidden">
          {tf("voice.tapToTalk", "Tap Unmute to talk")}
        </span>
      </>
    );
  } else {
    title = tf("voice.youreListening", "You're listening");
    sub = hand
      ? tf("voice.handIsUp", "Your hand is up. The host can see it.")
      : canRaise
        ? tf("voice.raiseToSpeak", "Raise your hand to ask to speak")
        : null;
  }

  const iconSize = 20;

  return (
    <div className="flex flex-col gap-2 rounded-[20px] bg-primary/[0.06] p-2.5 lg:flex-row lg:items-center lg:gap-4 lg:py-3 lg:pl-4 lg:pr-3">
      <div className="flex min-w-0 flex-1 items-center gap-3 px-1 lg:px-0">
        <span className="relative size-10 shrink-0 overflow-hidden rounded-pill bg-[#1c2533]">
          <SafeAvatar src={avatar} eager sizes="40px" />
        </span>
        <div className="flex min-w-0 flex-col">
          <span className="flex items-center gap-1.5 truncate font-sans text-[calc(14.5px*var(--ws-fs))] font-semibold text-primary">
            {busy && (
              <CircleNotch
                size={14}
                weight="bold"
                className="shrink-0 animate-spin"
              />
            )}
            <AnimatePresence mode="wait" initial={false}>
              <motion.span key={title} {...swap} className="truncate">
                {title}
              </motion.span>
            </AnimatePresence>
          </span>
          {sub && (
            <span className="truncate font-sans text-[calc(12.5px*var(--ws-fs))] text-muted">
              {sub}
            </span>
          )}
        </div>
        {canSpeak && state === "listening" && (
          <MicLevel room={room} live={onAir} className="ml-1 shrink-0" />
        )}
        {rejoin && (
          <motion.button
            {...press}
            type="button"
            onClick={reconnect}
            className="ml-auto flex h-10 shrink-0 cursor-pointer items-center rounded-pill bg-[#eef2f6] px-4 font-sans text-[calc(13px*var(--ws-fs))] font-semibold text-[#05070a]"
          >
            {tf("voice.rejoin", "Rejoin")}
          </motion.button>
        )}
      </div>

      <div className="relative flex items-stretch gap-1 sm:items-center sm:justify-end sm:gap-1.5">
        {canRaise && !canSpeak && (
          <BarButton
            icon={
              <HandPalm size={iconSize} weight={hand ? "fill" : "regular"} />
            }
            label={
              hand ? tf("voice.lower", "Lower") : tf("voice.raise", "Raise")
            }
            onClick={onRaise}
            tone={hand ? "white" : "ghost"}
          />
        )}
        <div
          ref={reactRef}
          className="relative flex min-w-0 flex-1 sm:flex-none"
        >
          <BarButton
            icon={
              <Smiley size={iconSize} weight={reactOpen ? "fill" : "regular"} />
            }
            label={tf("voice.react", "React")}
            onClick={() => onReactOpen(!reactOpen)}
            pressed={reactOpen}
            haspopup
            tone={reactOpen ? "on" : "ghost"}
          />
          <ReactTray
            open={reactOpen}
            onReact={onReact}
            label={tf("voice.react", "React")}
            className="bottom-full left-0 mb-3 sm:left-1/2 sm:-ml-[118px]"
          />
        </div>
        <BarButton
          icon={
            <ChatCircle
              size={iconSize}
              weight={chatActive ? "fill" : "regular"}
            />
          }
          label={tf("voice.chat", "Chat")}
          onClick={onChat}
          pressed={chatActive}
          tone={chatActive ? "on" : "ghost"}
          badge={chatActive ? 0 : unread}
        />
        {canSpeak && (
          <BarButton
            icon={
              // Keyed, no exit: the new glyph lands at once. A mic state
              // must never wait on the old one leaving.
              <motion.span
                key={muted ? "off" : "on"}
                initial={pop.initial}
                animate={pop.animate}
                className="flex"
              >
                {muted ? (
                  <MicrophoneSlash size={iconSize} weight="bold" />
                ) : (
                  <Microphone size={iconSize} weight="fill" />
                )}
              </motion.span>
            }
            label={
              muted ? tf("voice.unmute", "Unmute") : tf("voice.mute", "Mute")
            }
            onClick={() => void toggleMute()}
            disabled={state !== "listening"}
            tone={onAir ? "white" : "on"}
          />
        )}
        {isHost ? (
          <BarButton
            icon={<StopCircle size={iconSize} weight="fill" />}
            label={tf("voice.end", "End")}
            onClick={onEnd}
            tone="end"
          />
        ) : (
          <BarButton
            icon={<SignOut size={iconSize} weight="bold" />}
            label={tf("voice.leave", "Leave")}
            onClick={onLeave}
            tone="leave"
          />
        )}
      </div>
    </div>
  );
}
