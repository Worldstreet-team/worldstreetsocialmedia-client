"use client";

import clsx from "clsx";
import { memo } from "react";
import GrainOverlay from "@/components/editor/GrainOverlay";
import type { PresetId } from "@/lib/editor/document";
import { createAdjustments } from "@/lib/editor/document";
import { cssFilterFor, PRESETS } from "@/lib/editor/presets";

interface PresetCarouselProps {
  /** Small snapshot of the user's actual image (the IG/TikTok pattern). */
  thumbUrl: string | null;
  active: PresetId | null;
  onSelect: (id: PresetId | null) => void;
}

/**
 * Horizontal filter strip — every thumb is the user's own image with the
 * preset's CSS filter applied, so the choice is made on real pixels.
 * Tapping the active preset clears it. Memoized: parents re-render at
 * keystroke/slider rate and the seven thumbs never change with them.
 */
function PresetCarousel({ thumbUrl, active, onSelect }: PresetCarouselProps) {
  const neutral = createAdjustments();

  const renderThumb = (
    id: PresetId | null,
    label: string,
    filter: string,
    grain: boolean,
  ) => {
    const isActive = active === id;
    return (
      <button
        key={id ?? "none"}
        type="button"
        onClick={() => onSelect(isActive ? null : id)}
        aria-pressed={isActive}
        className="flex flex-col items-center gap-1.5 shrink-0 cursor-pointer group"
      >
        <span
          className={clsx(
            "relative block h-16 w-16 rounded-lg overflow-hidden border transition-colors",
            isActive
              ? "border-[#fafaf9]"
              : "border-[#fafaf9]/15 group-hover:border-[#fafaf9]/40",
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
        </span>
        <span
          className={clsx(
            "text-[11px] font-sans transition-colors",
            isActive ? "glass-ink font-semibold" : "glass-ink-dim",
          )}
        >
          {label}
        </span>
      </button>
    );
  };

  return (
    <div
      className="flex gap-3 overflow-x-auto no-scrollbar py-1 -mx-1 px-1"
      role="listbox"
      aria-label="Filters"
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
    </div>
  );
}

export default memo(PresetCarousel);
