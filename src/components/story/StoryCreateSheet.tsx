"use client";

import { CaretRight, Clock, ImageSquare, Microphone, TextAa } from "@phosphor-icons/react";
import { motion, useReducedMotionConfig } from "framer-motion";
import ConfirmModalPortal from "@/components/ui/ConfirmModalPortal";
import {
  OverlayHeader,
  OverlayPanel,
  OverlayScrim,
  useOverlayDismiss,
} from "@/components/ui/Overlay";
import {
  STORY_BACKGROUNDS,
  storyCanvasCss,
} from "@/lib/editor/storyBackgrounds";
import { press } from "@/lib/motion-presets";

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
  tags: string[];
  icon: typeof ImageSquare;
}> = [
  {
    kind: "media",
    label: "Media",
    hint: "Photos and clips, with filters, text and stickers",
    tags: ["Photos", "Clips", "Slides"],
    icon: ImageSquare,
  },
  {
    kind: "text",
    label: "Text",
    hint: "Type on designed canvases. Good for a quick take.",
    tags: ["Styles", "Canvases"],
    icon: TextAa,
  },
  {
    kind: "voice",
    label: "Voice",
    hint: "Record a short audio update over a canvas",
    tags: ["Up to 60s"],
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
        <span className="px-1.5 text-center font-editorial text-[calc(15px*var(--ws-fs))] leading-[1.05] text-[#fafaf9]">
          Patience pays.
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
  const reduce = useReducedMotionConfig();

  // Esc + the body scroll lock come from the overlay grammar now.
  useOverlayDismiss(true, onClose);

  return (
    <ConfirmModalPortal>
      <OverlayScrim blur onClose={onClose} />
      {/* A solid Halo sheet (owner 2026-10-11): theme ground, no glass. */}
      <OverlayPanel
        dragClose={onClose}
        variant="sheet"
        ground="solid"
        label="Create a story"
      >
        <OverlayHeader onClose={onClose}>
          <div className="min-w-0 flex-1 pt-1">
            <h2 className="truncate font-display text-[calc(18px*var(--ws-fs))] font-semibold leading-tight text-primary">
              New story
            </h2>
            <p className="truncate font-sans text-[calc(12.5px*var(--ws-fs))] text-muted">
              Pick a lane. You can switch later.
            </p>
          </div>
        </OverlayHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-3 pb-[calc(20px+var(--ws-safe-bottom))]">
          {/* Lanes, stacked: each shows a small version of what it makes,
              so the choice is by looking, not by reading (story flow, 2). */}
          <div className="flex flex-col gap-2.5">
            {LANES.map(({ kind, label, hint, tags }, i) => (
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
                // Carries its own transition so the press never inherits
                // the entrance delay above.
                whileTap={{ ...press.whileTap, transition: press.transition }}
                className="group flex cursor-pointer items-center gap-4 rounded-[22px] bg-primary/[0.06] p-3 pr-4 text-left transition-colors hover:bg-primary/[0.1]"
              >
                <span className="relative flex h-24 w-[72px] shrink-0 items-center justify-center overflow-hidden rounded-[14px]">
                  <LanePreview kind={kind} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-display text-[calc(16px*var(--ws-fs))] font-semibold text-primary">
                    {label}
                  </span>
                  <span className="mt-0.5 block font-sans text-[calc(12.5px*var(--ws-fs))] leading-snug text-muted">
                    {hint}
                  </span>
                  <span className="mt-2 flex flex-wrap gap-1.5">
                    {tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-pill bg-surface px-2.5 py-0.5 font-sans text-[calc(11px*var(--ws-fs))] font-semibold text-muted"
                      >
                        {tag}
                      </span>
                    ))}
                  </span>
                </span>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-pill bg-surface text-muted transition-colors group-hover:bg-brand group-hover:text-brand-on">
                  <CaretRight size={14} weight="bold" />
                </span>
              </motion.button>
            ))}
          </div>

          <p className="mt-4 flex items-center justify-center gap-1.5 font-sans text-[calc(11.5px*var(--ws-fs))] text-subtle">
            <Clock size={13} weight="bold" />
            Stories disappear after 24 hours
          </p>
        </div>
      </OverlayPanel>
    </ConfirmModalPortal>
  );
}
