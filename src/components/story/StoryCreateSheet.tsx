"use client";

import { ImageSquare, Microphone, TextAa } from "@phosphor-icons/react";
import { motion, useReducedMotion } from "framer-motion";
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

  // Esc + the body scroll lock come from the overlay grammar now.
  useOverlayDismiss(true, onClose);

  return (
    <ConfirmModalPortal>
      <OverlayScrim onClose={onClose} />
      <OverlayPanel variant="sheet" label="Create a story">
        <OverlayHeader onClose={onClose}>
          <div className="min-w-0 flex-1">
            <span className="block font-sans text-[10px] font-bold uppercase tracking-[0.14em] text-subtle">
              New
            </span>
            <h2 className="truncate font-sans text-[14px] font-semibold leading-tight text-primary">
              Create a story
            </h2>
          </div>
        </OverlayHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[calc(20px+var(--ws-safe-bottom))]">
          <div className="grid grid-cols-3 gap-2">
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
                className="flex cursor-pointer flex-col items-center gap-2.5 rounded-xl bg-chip px-3 pt-4 pb-3.5 text-center transition-colors hover:bg-raised"
              >
                <span className="relative flex h-16 w-12 shrink-0 items-center justify-center overflow-hidden rounded-[10px]">
                  <LanePreview kind={kind} />
                </span>
                <span className="flex items-center gap-1.5">
                  <Icon size={13} weight="bold" className="text-muted" />
                  <span className="font-sans text-[13px] font-semibold text-primary">
                    {label}
                  </span>
                </span>
                <span className="block font-sans text-[11px] leading-snug text-muted">
                  {hint}
                </span>
              </motion.button>
            ))}
          </div>

          <p className="mt-4 text-center font-sans text-[11px] text-subtle">
            Stories disappear after 24 hours
          </p>
        </div>
      </OverlayPanel>
    </ConfirmModalPortal>
  );
}
