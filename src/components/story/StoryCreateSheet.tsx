"use client";

import { ImageSquare, Microphone, TextAa, X } from "@phosphor-icons/react";
import { motion, useReducedMotion } from "framer-motion";
import { useEffect } from "react";
import ConfirmModalPortal from "@/components/ui/ConfirmModalPortal";
import {
  STORY_BACKGROUNDS,
  storyCanvasCss,
} from "@/lib/editor/storyBackgrounds";

export type StoryKind = "media" | "text" | "voice";

interface StoryCreateSheetProps {
  onClose: () => void;
  onPick: (kind: StoryKind) => void;
}

const EASE = [0.2, 0, 0, 1] as const;

const LANES: Array<{
  kind: StoryKind;
  label: string;
  hint: string;
  icon: typeof ImageSquare;
}> = [
  {
    kind: "media",
    label: "Media",
    hint: "Photos and clips, with edits",
    icon: ImageSquare,
  },
  {
    kind: "text",
    label: "Text",
    hint: "Type on designed canvases",
    icon: TextAa,
  },
  {
    kind: "voice",
    label: "Voice",
    hint: "Share an audio update",
    icon: Microphone,
  },
];

/** Each lane previews itself: the media tile is a soft frame, text shows the
 *  serif voice on its canvas, voice shows a waveform. */
function LanePreview({ kind }: { kind: StoryKind }) {
  if (kind === "text") {
    return (
      <span
        className="flex h-full w-full items-center justify-center"
        style={{ background: storyCanvasCss(STORY_BACKGROUNDS[1]) }}
      >
        <span className="font-editorial text-[19px] leading-none text-[#fafaf9]">
          Aa
        </span>
      </span>
    );
  }
  if (kind === "voice") {
    return (
      <span
        className="flex h-full w-full items-center justify-center gap-[3px]"
        style={{ background: storyCanvasCss(STORY_BACKGROUNDS[3]) }}
      >
        {["a", "b", "c", "d", "e", "f"].map((id, i) => (
          <span
            key={id}
            className="w-[2px] rounded-pill bg-[#fafaf9]/85"
            style={{ height: `${[0.35, 0.7, 1, 0.55, 0.8, 0.3][i] * 22}px` }}
          />
        ))}
      </span>
    );
  }
  return (
    <span
      className="flex h-full w-full items-center justify-center"
      style={{ background: storyCanvasCss(STORY_BACKGROUNDS[0]) }}
    >
      <ImageSquare size={20} weight="light" className="text-[#fafaf9]/80" />
    </span>
  );
}

/**
 * The story entry point — a sheer glass sheet over a blurred feed. The three
 * lanes carry their own preview so the choice is visual, not a text menu.
 */
export default function StoryCreateSheet({
  onClose,
  onPick,
}: StoryCreateSheetProps) {
  const reduce = useReducedMotion();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <ConfirmModalPortal>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2, ease: EASE }}
        className="fixed inset-0 z-modal flex items-end sm:items-center justify-center glass-veil-sheer backdrop-blur-md backdrop-saturate-150 sm:p-6"
        onClick={onClose}
      >
        <motion.div
          initial={
            reduce ? { opacity: 0 } : { opacity: 0, y: 20, scale: 0.985 }
          }
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.32, ease: EASE }}
          role="dialog"
          aria-modal="true"
          aria-label="Create a story"
          className="w-full sm:max-w-[440px] glass-dock backdrop-blur-xl backdrop-saturate-150 glass-ink rounded-t-2xl sm:rounded-2xl p-5 sm:p-6 pb-safe"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <span className="glass-eyebrow font-sans block">New</span>
              <h2 className="font-display text-[22px] leading-tight font-semibold tracking-tight mt-2">
                Create a story
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-pill glass-chip transition-colors cursor-pointer"
            >
              <X size={16} weight="bold" />
            </button>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2">
            {LANES.map(({ kind, label, hint, icon: Icon }, i) => (
              <motion.button
                key={kind}
                type="button"
                onClick={() => onPick(kind)}
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.32,
                  ease: EASE,
                  delay: reduce ? 0 : 0.06 + i * 0.05,
                }}
                // Flat by request: a plain wash, no sheen, no chrome.
                className="flex flex-col items-center gap-2.5 rounded-xl bg-[#fafaf9]/[0.05] hover:bg-[#fafaf9]/[0.1] transition-colors px-3 pt-4 pb-3.5 text-center cursor-pointer"
              >
                <span className="relative flex h-16 w-12 shrink-0 items-center justify-center overflow-hidden rounded-[10px]">
                  <LanePreview kind={kind} />
                </span>
                <span className="flex items-center gap-1.5">
                  <Icon size={13} weight="bold" className="text-[#fafaf9]/70" />
                  <span className="font-sans text-[13px] font-semibold glass-ink">
                    {label}
                  </span>
                </span>
                <span className="block font-sans text-[11px] leading-snug glass-ink-dim">
                  {hint}
                </span>
              </motion.button>
            ))}
          </div>

          <p className="mt-4 text-center font-sans text-[11px] glass-ink-faint">
            Stories disappear after 24 hours
          </p>
        </motion.div>
      </motion.div>
    </ConfirmModalPortal>
  );
}
