"use client";

import clsx from "clsx";
import { useEffect, useState } from "react";
import type { PresetId } from "@/lib/editor/document";
import { createAdjustments } from "@/lib/editor/document";
import { cssFilterFor, getGrainTileUrl, PRESETS } from "@/lib/editor/presets";

interface PresetCarouselProps {
  /** Small snapshot of the user's actual image (the IG/TikTok pattern). */
  thumbUrl: string | null;
  active: PresetId | null;
  onSelect: (id: PresetId | null) => void;
}

/**
 * Horizontal filter strip — every thumb is the user's own image with the
 * preset's CSS filter applied, so the choice is made on real pixels.
 * Tapping the active preset clears it.
 */
export default function PresetCarousel({
  thumbUrl,
  active,
  onSelect,
}: PresetCarouselProps) {
  // Grain's thumb gets the same noise tile the export uses; generated on the
  // client only (canvas), so resolve it post-mount.
  const [grainUrl, setGrainUrl] = useState<string | null>(null);
  useEffect(() => {
    setGrainUrl(getGrainTileUrl());
  }, []);

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
              ? "border-gold"
              : "border-hairline group-hover:border-subtle",
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
          {grain && grainUrl && (
            <span
              aria-hidden
              className="absolute inset-0 pointer-events-none"
              style={{
                backgroundImage: `url(${grainUrl})`,
                backgroundRepeat: "repeat",
                mixBlendMode: "overlay",
                opacity: 0.28,
              }}
            />
          )}
        </span>
        <span
          className={clsx(
            "text-[11px] font-sans transition-colors",
            isActive ? "text-gold font-semibold" : "text-muted",
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
