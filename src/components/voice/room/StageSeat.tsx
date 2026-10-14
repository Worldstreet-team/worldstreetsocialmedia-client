"use client";

import { MicrophoneSlash } from "@phosphor-icons/react";
import clsx from "clsx";
import { AnimatePresence, motion, useReducedMotionConfig } from "framer-motion";
import type { Room } from "livekit-client";
import { useEffect, useRef } from "react";
import { SafeAvatar } from "@/components/ui/SafeAvatar";
import { UserBadges } from "@/components/ui/UserBadges";
import { pop } from "@/lib/motion-presets";
import type { StageSeatData } from "./roster";

/**
 * The ring around whoever is talking: a thin light ring standing a few
 * pixels off the face, shown while LiveKit counts them as an active
 * speaker. While it shows, it breathes with their voice: a
 * requestAnimationFrame loop reads the participant's `audioLevel` and
 * writes the transform straight onto the element, so React never renders
 * per frame. Reduced motion keeps the ring and drops the breathing.
 *
 * The scale tops out at 1.06, and the seat's gaps leave room for it, so a
 * loud voice never reaches a neighbour.
 */
export function SpeakingRing({
  room,
  identity,
  active,
  inset = "-inset-[7px]",
}: {
  room: Room | null;
  identity?: string;
  active: boolean;
  /** How far off the face the ring stands. */
  inset?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduce = useReducedMotionConfig();

  useEffect(() => {
    const el = ref.current;
    if (!el || !room || !identity || !active || reduce) return;
    let raf = 0;
    let scale = 1;
    const tick = () => {
      const p = room.getParticipantByIdentity(identity);
      // Conversational speech reports low levels; the square root lifts it
      // into the visible range while a shout still caps at the ceiling.
      const level = p?.isSpeaking ? Math.min(1, Math.sqrt(p.audioLevel)) : 0;
      scale += (1 + level * 0.06 - scale) * 0.25;
      el.style.transform = `scale(${scale.toFixed(4)})`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      el.style.transform = "";
    };
  }, [room, identity, active, reduce]);

  return (
    <span
      ref={ref}
      aria-hidden
      className={clsx(
        "pointer-events-none absolute rounded-pill ring-2 ring-[#eef2f6] transition-opacity will-change-transform",
        inset,
        active ? "opacity-100" : "opacity-0",
      )}
    />
  );
}

/**
 * A seat on the stage: a large face, the name, and one line saying what
 * the seat is doing right now. "Speaking" while LiveKit hears them, else
 * the role; a plain speaker whose mic is off reads "Muted", and any muted
 * seat also wears the slashed-mic badge, so the host's role line survives
 * a mute.
 */
export function StageSeat({
  seat,
  room,
  onClick,
  labels,
}: {
  seat: StageSeatData;
  room: Room | null;
  /** Absent: the seat is not a control (your own, for instance). */
  onClick?: () => void;
  labels: {
    you: string;
    speaking: string;
    host: string;
    cohost: string;
    speaker: string;
    muted: string;
  };
}) {
  const roleLine = seat.speaking
    ? labels.speaking
    : seat.role === "host"
      ? labels.host
      : seat.role === "cohost"
        ? labels.cohost
        : seat.micOn === false
          ? labels.muted
          : labels.speaker;
  const shownName = seat.isMe ? labels.you : seat.name;

  const body = (
    <>
      <span className="relative block size-[clamp(68px,22vw,96px)] lg:size-28 xl:size-32">
        <SpeakingRing room={room} identity={seat.id} active={seat.speaking} />
        <span className="absolute inset-0 overflow-hidden rounded-pill bg-[#1c2533]">
          <SafeAvatar src={seat.avatar} eager sizes="128px" />
        </span>
        <AnimatePresence initial={false}>
          {seat.micOn === false && (
            <motion.span
              key="muted"
              {...pop}
              className="absolute bottom-0.5 right-0.5 flex size-7 items-center justify-center rounded-pill bg-[#0b0f15] text-[#eef2f6] ring-2 ring-[#05070a] lg:bottom-1.5 lg:right-1.5"
            >
              <MicrophoneSlash size={14} weight="bold" />
            </motion.span>
          )}
        </AnimatePresence>
      </span>
      <span className="flex w-full min-w-0 flex-col items-center gap-0.5 lg:items-start">
        <span className="flex max-w-full items-center gap-1">
          <span className="min-w-0 truncate font-sans text-[calc(14px*var(--ws-fs))] font-semibold text-primary lg:text-[calc(16px*var(--ws-fs))]">
            {shownName}
          </span>
          {/* Badges only once the gateway confirmed who this id is:
              presence is client-published and trust marks are not
              self-serve. */}
          {seat.resolved && !seat.isMe && (
            <UserBadges
              isVerified={seat.isVerified}
              verification={seat.verification}
              badges={seat.badges}
              size={13}
            />
          )}
        </span>
        <span
          className={clsx(
            "font-sans text-[calc(12.5px*var(--ws-fs))] lg:text-[calc(13.5px*var(--ws-fs))]",
            seat.speaking ? "font-semibold text-primary" : "text-muted",
          )}
        >
          {roleLine}
        </span>
      </span>
    </>
  );

  const cell =
    "flex w-full min-w-0 flex-col items-center gap-3 text-center lg:w-36 lg:items-start lg:text-left xl:w-40";

  if (!onClick) {
    return <div className={cell}>{body}</div>;
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${shownName}: ${roleLine}`}
      className={clsx(cell, "cursor-pointer rounded-xl")}
    >
      {body}
    </button>
  );
}
