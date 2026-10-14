"use client";

import {
  Fire,
  HandsClapping,
  Heart,
  Smiley,
  ThumbsUp,
} from "@phosphor-icons/react";
import clsx from "clsx";
import { AnimatePresence, motion, useReducedMotionConfig } from "framer-motion";
import type { RoomReaction } from "@/hooks/useSpaceRoom";
import {
  EASE_OUT_EXPO,
  menuStagger,
  press,
  staggerPop,
} from "@/lib/motion-presets";

/**
 * The reaction vocabulary. Ids ride the Ably `reaction` payload, never
 * emoji characters, and each id maps to a Phosphor glyph here. The legacy
 * table keeps older clients' emoji payloads rendering during a deploy.
 */
export type ReactionKind = "heart" | "clap" | "fire" | "laugh" | "plus-one";

export const REACTION_SET: {
  kind: ReactionKind;
  Icon: typeof Heart;
  tint: string;
  label: string;
}[] = [
  { kind: "heart", Icon: Heart, tint: "text-danger", label: "Heart" },
  { kind: "clap", Icon: HandsClapping, tint: "text-[#eef2f6]", label: "Clap" },
  { kind: "fire", Icon: Fire, tint: "text-warning", label: "Fire" },
  { kind: "laugh", Icon: Smiley, tint: "text-[#eef2f6]", label: "Laugh" },
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

/**
 * How long a reaction takes to float up. It burns away in the room hook
 * at 2.4s; the float lands well before so it never vanishes mid-flight.
 */
const FLOAT_SECONDS = 1.8;

/**
 * Reactions floating up the left edge, Meet-style, wearing the sender's
 * name so a host can acknowledge the person and not just the confetti.
 */
export function ReactionFloats({ reactions }: { reactions: RoomReaction[] }) {
  const reduce = useReducedMotionConfig();
  return (
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
              initial={{ opacity: 0, y: 24, scale: 0.8 }}
              animate={{
                opacity: 1,
                y: reduce ? -30 : -190 - (i % 3) * 40,
                scale: 1,
              }}
              exit={{ opacity: 0 }}
              transition={{ duration: FLOAT_SECONDS, ease: EASE_OUT_EXPO }}
              className="absolute bottom-3"
              style={{ left: 16 + (r.id % 3) * 36 }}
            >
              <span className="flex flex-col items-center gap-1">
                <def.Icon size={26} weight="fill" className={def.tint} />
                {r.from?.name && (
                  <span className="max-w-[92px] truncate rounded-pill bg-[#05070a]/70 px-2 py-px font-sans text-[calc(10.5px*var(--ws-fs))] font-semibold text-[#eef2f6]/90">
                    {r.from.name}
                  </span>
                )}
              </span>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

/**
 * The tray the React button opens: the five reactions in a row. It stays
 * open while you react, the way Meet's does, and closes on a tap outside
 * or Escape (the room handles both).
 */
export function ReactTray({
  open,
  onReact,
  label,
  className,
}: {
  open: boolean;
  onReact: (kind: ReactionKind) => void;
  label: string;
  /** Where it sits; the caller knows what it is anchored to. */
  className?: string;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="react-tray"
          role="menu"
          aria-label={label}
          {...menuStagger("bottom")}
          className={clsx(
            "absolute z-dropdown flex w-[236px] items-center justify-between rounded-pill bg-[#111722]/90 p-1.5 shadow-pop backdrop-blur-2xl",
            className,
          )}
        >
          {REACTION_SET.map(({ kind, Icon, tint, label: name }) => (
            <motion.button
              key={kind}
              variants={staggerPop}
              {...press}
              type="button"
              role="menuitem"
              onClick={() => onReact(kind)}
              aria-label={name}
              className="flex size-10 cursor-pointer items-center justify-center rounded-pill transition-colors hover:bg-primary/10"
            >
              <Icon size={20} weight="fill" className={tint} />
            </motion.button>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
