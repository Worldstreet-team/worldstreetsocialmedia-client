"use client";

import { Check } from "@phosphor-icons/react";
import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { memo } from "react";
import GrainOverlay from "@/components/editor/GrainOverlay";
import ScrollStrip from "@/components/ui/ScrollStrip";
import type { PresetId } from "@/lib/editor/document";
import { createAdjustments } from "@/lib/editor/document";
import { cssFilterFor, PRESETS } from "@/lib/editor/presets";
import { pop, staggerItem, staggerParentFast } from "@/lib/motion-presets";

interface PresetCarouselProps {
  /** Small snapshot of the user's actual image (the IG/TikTok pattern). */
  thumbUrl: string | null;
  active: PresetId | null;
  onSelect: (id: PresetId | null) => void;
  /** False once the host has shown the strip before: the thumbs cascade on
   *  first open only, never on a tab switch back to them. */
  cascade?: boolean;
}

/**
 * Horizontal filter strip — every thumb is the user's own image with the
 * preset's CSS filter applied, so the choice is made on real pixels.
 * Tapping the active preset clears it. Memoized: parents re-render at
 * keystroke/slider rate and the seven thumbs never change with them.
 */
function PresetCarousel({
  thumbUrl,
  active,
  onSelect,
  cascade = true,
}: PresetCarouselProps) {
  const neutral = createAdjustments();

  const renderThumb = (
    id: PresetId | null,
    label: string,
    filter: string,
    grain: boolean,
  ) => {
    const isActive = active === id;
    return (
      <motion.button
        key={id ?? "none"}
        type="button"
        role="option"
        onClick={() => onSelect(isActive ? null : id)}
        aria-selected={isActive}
        variants={staggerItem}
        className="flex flex-col items-center gap-1.5 shrink-0 cursor-pointer group"
      >
        <span
          className={clsx(
            // Borderless: the unselected thumbs recede instead of wearing a rim.
            "relative block h-16 w-16 rounded-lg overflow-hidden transition-opacity",
            isActive ? "opacity-100" : "opacity-60 group-hover:opacity-90",
          )}
        >
          {thumbUrl ? (
            // biome-ignore lint/performance/noImgElement: thumbs are tiny canvas data: URLs — next/image can't optimize those.
            <img
              src={thumbUrl}
              alt=""
              className="h-full w-full object-cover"
              style={filter ? { filter } : undefined}
              draggable={false}
            />
          ) : (
            <span className="block h-full w-full skeleton" />
          )}
          {grain && <GrainOverlay />}
          {/* initial={false}: the check lands on a choice, not on open. */}
          <AnimatePresence initial={false}>
            {isActive && (
              <motion.span
                key="check"
                {...pop}
                className="absolute bottom-1 right-1 flex h-4 w-4 items-center justify-center rounded-pill bg-[#fafaf9] text-[#0c0a09]"
              >
                <Check size={9} weight="bold" />
              </motion.span>
            )}
          </AnimatePresence>
        </span>
        <span
          className={clsx(
            "text-[calc(11px*var(--ws-fs))] font-sans transition-colors",
            isActive ? "glass-ink font-semibold" : "glass-ink-dim",
          )}
        >
          {label}
        </span>
      </motion.button>
    );
  };

  return (
    // ScrollStrip supplies the edge fade + nudge buttons, so it is obvious
    // that the strip carries more filters than fit the dock.
    <ScrollStrip ariaLabel="Filters" className="gap-3 -mx-1 px-1">
      <motion.span
        role="listbox"
        aria-label="Filters"
        className="contents"
        variants={staggerParentFast}
        initial={cascade ? "hidden" : false}
        animate="show"
      >
        {renderThumb(null, "None", "", false)}
        {PRESETS.map((preset) =>
          renderThumb(
            preset.id,
            preset.label,
            cssFilterFor(neutral, preset.id),
            !!preset.grain,
          ),
        )}
      </motion.span>
    </ScrollStrip>
  );
}

export default memo(PresetCarousel);
