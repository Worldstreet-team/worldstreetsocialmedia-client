"use client";

import clsx from "clsx";
import { Check } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  fontFamilyFor,
  fontWeightFor,
  type OverlayFonts,
  PILL_PAD_X,
  PILL_PAD_Y,
  PILL_RADIUS,
  TEXT_COLORS,
  TEXT_LINE_HEIGHT,
  TEXT_SIZE_FRACTION,
  type TextColor,
  type TextOverlay,
  type TextStyle,
  TICKER_COLORS,
} from "@/lib/editor/overlays";

interface TextToolProps {
  /** Existing overlay when re-editing; null for a new one. */
  overlay: TextOverlay | null;
  stageW: number;
  fonts: OverlayFonts;
  /** Empty text on Done means delete/cancel. */
  onDone: (
    values: Pick<TextOverlay, "text" | "style" | "pill" | "color">,
  ) => void;
  onCancel: () => void;
}

const STYLES: { id: TextStyle; label: string }[] = [
  { id: "display", label: "Display" },
  { id: "clean", label: "Clean" },
  { id: "ticker", label: "Ticker" },
];

const COLORS: TextColor[] = ["light", "dark", "gold"];

/**
 * Full-screen text takeover (IG model): type against a scrim with the
 * exact style you'll get — Display (Poppins), Clean (Public Sans), or the
 * signature Ticker (gold mono pill). Ticker forces its own colors/pill,
 * so those controls hide for it.
 */
export default function TextTool({
  overlay,
  stageW,
  fonts,
  onDone,
  onCancel,
}: TextToolProps) {
  const [text, setText] = useState(overlay?.text ?? "");
  const [style, setStyle] = useState<TextStyle>(overlay?.style ?? "display");
  const [color, setColor] = useState<TextColor>(overlay?.color ?? "light");
  const [pill, setPill] = useState(overlay?.pill ?? false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const ticker = style === "ticker";
  const colors = ticker ? TICKER_COLORS : TEXT_COLORS[color];
  const showPill = ticker || pill;
  const fontPx = TEXT_SIZE_PREVIEW(stageW, overlay?.scale ?? 1);

  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-scrim">
      <div className="flex shrink-0 items-center justify-end px-3 py-2">
        <button
          type="button"
          onClick={() => onDone({ text: text.trim(), style, pill, color })}
          className="flex items-center gap-2 bg-brand text-brand-on px-5 h-11 sm:h-9 rounded-pill font-semibold text-sm hover:bg-brand-active transition-colors font-sans cursor-pointer"
        >
          <Check className="w-4 h-4" />
          Done
        </button>
      </div>

      {/* Live-styled input, centered like the placed overlay will be. */}
      <div className="flex-1 min-h-0 flex items-center justify-center px-6">
        <textarea
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.stopPropagation();
              onCancel();
            }
          }}
          rows={2}
          maxLength={120}
          placeholder="Type something"
          className="w-full max-w-full bg-transparent outline-none resize-none text-center overflow-hidden"
          style={{
            fontFamily: fontFamilyFor(style, fonts),
            fontWeight: fontWeightFor(style),
            fontSize: fontPx,
            lineHeight: TEXT_LINE_HEIGHT,
            color: colors.text,
            background: showPill ? colors.pill : undefined,
            padding: `${fontPx * PILL_PAD_Y}px ${fontPx * PILL_PAD_X}px`,
            borderRadius: showPill ? fontPx * PILL_RADIUS : undefined,
            caretColor: "#EAB308",
            fontVariantNumeric: ticker ? "tabular-nums" : undefined,
          }}
        />
      </div>

      {/* Style / color / pill controls */}
      <div className="shrink-0 px-4 pb-6 pb-safe space-y-3">
        <div className="flex justify-center gap-1.5">
          {STYLES.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setStyle(id)}
              aria-pressed={style === id}
              className={clsx(
                "h-9 px-4 rounded-pill text-[13px] font-medium font-sans transition-colors cursor-pointer",
                style === id
                  ? "bg-brand/10 text-gold"
                  : "border border-hairline text-muted hover:bg-raised hover:text-primary",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        {!ticker && (
          <div className="flex items-center justify-center gap-3">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                aria-label={`${c} text`}
                aria-pressed={color === c}
                className="flex h-10 w-10 items-center justify-center cursor-pointer"
              >
                <span
                  className={clsx(
                    "block h-6 w-6 rounded-pill border-2 transition-colors",
                    color === c ? "border-gold" : "border-hairline",
                  )}
                  style={{ background: TEXT_COLORS[c].text }}
                />
              </button>
            ))}
            <button
              type="button"
              onClick={() => setPill((p) => !p)}
              aria-pressed={pill}
              className={clsx(
                "h-9 px-4 rounded-pill text-[13px] font-medium font-sans transition-colors cursor-pointer",
                pill
                  ? "bg-brand/10 text-gold"
                  : "border border-hairline text-muted hover:bg-raised hover:text-primary",
              )}
            >
              Pill
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/** Preview font size — same fraction the placed overlay uses at its scale. */
function TEXT_SIZE_PREVIEW(stageW: number, scale: number) {
  return Math.max(18, TEXT_SIZE_FRACTION * stageW * scale);
}
