"use client";

import {
  ArrowSquareOut,
  Flag,
  HandPalm,
  Microphone,
  MicrophoneSlash,
  SignOut,
  Users,
} from "@phosphor-icons/react";
import clsx from "clsx";
import { motion } from "framer-motion";
import {
  OverlayHeader,
  OverlayPanel,
  OverlayScrim,
} from "@/components/ui/Overlay";
import { SafeAvatar } from "@/components/ui/SafeAvatar";
import { UserBadges } from "@/components/ui/UserBadges";
import type { RoomMember } from "@/hooks/useSpaceRoom";
import { staggerItem, staggerParent } from "@/lib/motion-presets";

export interface ManagerActions {
  grant: (m: RoomMember) => void;
  revoke: (m: RoomMember) => void;
  invite: (m: RoomMember) => void;
  mute: (m: RoomMember) => void;
  remove: (m: RoomMember) => void;
  cohost: (m: RoomMember, grant: boolean) => void;
  profile: (m: RoomMember) => void;
  report: (m: RoomMember) => void;
}

/**
 * The host's (and co-hosts') controls for one person, in the overlay
 * grammar's anchored variant: a bottom sheet on a phone, a floating card
 * on a desktop, no dim behind it there (a popover is not a modal). It sits
 * outside the room's fixed-dark subtree on purpose, so it follows the
 * person's theme like every other popover in the app.
 *
 * Mount inside AnimatePresence; closing is the caller's.
 */
export function ManagerMenu({
  member: m,
  onClose,
  isHost,
  isCohost,
  onStage,
  cohostSeatsLeft,
  actions,
  tf,
}: {
  member: RoomMember;
  onClose: () => void;
  /** You are the host (only the host manages co-hosts). */
  isHost: boolean;
  /** The person you opened is a co-host. */
  isCohost: boolean;
  /** The person you opened can publish right now. */
  onStage: boolean;
  /** Deputies are capped at two. */
  cohostSeatsLeft: boolean;
  actions: ManagerActions;
  tf: (key: string, fallback: string) => string;
}) {
  const item =
    "flex h-11 w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 text-left font-sans text-[calc(13.5px*var(--ws-fs))] font-medium transition-colors hover:bg-chip";
  const run = (fn: () => void) => () => {
    onClose();
    fn();
  };
  const role = isCohost
    ? tf("voice.cohostBadge", "Co-host")
    : onStage
      ? tf("voice.onStageLabel", "On stage")
      : m.hand
        ? tf("voice.speakRequests", "Wants to speak")
        : tf("voice.listeners", "listening");

  return (
    <>
      <OverlayScrim dim={false} onClose={onClose} />
      <OverlayPanel dragClose={onClose} variant="anchored" label={m.username}>
        <OverlayHeader onClose={onClose}>
          <span className="flex min-w-0 flex-1 items-center gap-2.5">
            <span className="relative h-8 w-8 shrink-0 overflow-hidden rounded-pill bg-chip">
              <SafeAvatar src={m.avatar} eager />
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="flex items-center gap-1">
                <span className="truncate font-sans text-[calc(13.5px*var(--ws-fs))] font-semibold text-primary">
                  {m.name || m.username}
                </span>
                {m.resolved && (
                  <UserBadges
                    isVerified={m.isVerified}
                    verification={m.verification}
                    size={12}
                  />
                )}
              </span>
              <span className="truncate font-sans text-[calc(11.5px*var(--ws-fs))] text-muted">
                @{m.username} · {role}
              </span>
            </span>
          </span>
        </OverlayHeader>
        <motion.div
          variants={staggerParent}
          initial="hidden"
          animate="show"
          className="flex flex-col gap-0.5 px-2 pb-3"
        >
          {/* Stage controls. A co-host is managed only by the host, and
              through the role, not the mic. */}
          {isCohost ? (
            isHost && (
              <motion.button
                variants={staggerItem}
                type="button"
                onClick={run(() => actions.cohost(m, false))}
                className={clsx(item, "text-primary")}
              >
                <MicrophoneSlash size={16} weight="bold" />
                {tf("voice.removeCohost", "Remove co-host")}
              </motion.button>
            )
          ) : onStage ? (
            <>
              <motion.button
                variants={staggerItem}
                type="button"
                onClick={run(() => actions.mute(m))}
                className={clsx(item, "text-primary")}
              >
                <MicrophoneSlash size={16} weight="bold" />
                {tf("voice.mute", "Mute")}
              </motion.button>
              <motion.button
                variants={staggerItem}
                type="button"
                onClick={run(() => actions.revoke(m))}
                className={clsx(item, "text-primary")}
              >
                <HandPalm size={16} weight="bold" />
                {tf("voice.removeFromStage", "Remove from stage")}
              </motion.button>
            </>
          ) : m.hand ? (
            <motion.button
              variants={staggerItem}
              type="button"
              onClick={run(() => actions.grant(m))}
              className={clsx(item, "text-primary")}
            >
              <Microphone size={16} weight="bold" />
              {tf("voice.bringToStage", "Bring to stage")}
            </motion.button>
          ) : (
            <motion.button
              variants={staggerItem}
              type="button"
              onClick={run(() => actions.invite(m))}
              className={clsx(item, "text-primary")}
            >
              <Microphone size={16} weight="bold" />
              {tf("voice.invite", "Invite to speak")}
            </motion.button>
          )}
          {/* Deputies: host only, two seats. */}
          {isHost && !isCohost && cohostSeatsLeft && (
            <motion.button
              variants={staggerItem}
              type="button"
              onClick={run(() => actions.cohost(m, true))}
              className={clsx(item, "text-primary")}
            >
              <Users size={16} weight="bold" />
              {tf("voice.makeCohost", "Make co-host")}
            </motion.button>
          )}
          <motion.button
            variants={staggerItem}
            type="button"
            onClick={run(() => actions.profile(m))}
            className={clsx(item, "text-primary")}
          >
            <ArrowSquareOut size={16} weight="bold" />
            {tf("voice.viewProfile", "View profile")}
          </motion.button>
          <motion.button
            variants={staggerItem}
            type="button"
            onClick={run(() => actions.report(m))}
            className={clsx(item, "text-primary")}
          >
            <Flag size={16} weight="bold" />
            {tf("voice.report", "Report")}
          </motion.button>
          {/* Removal is a ban, not a shove. Co-hosts can't remove co-hosts;
              that is the host's call. */}
          {(isHost || !isCohost) && (
            <motion.button
              variants={staggerItem}
              type="button"
              onClick={run(() => actions.remove(m))}
              className={clsx(item, "text-danger")}
            >
              <SignOut size={16} weight="bold" />
              {tf("voice.removeFromSpace", "Remove from space")}
            </motion.button>
          )}
        </motion.div>
      </OverlayPanel>
    </>
  );
}
