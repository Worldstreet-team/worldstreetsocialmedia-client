"use client";

import {
  fontFamilyFor,
  fontWeightFor,
  letterSpacingFor,
  type OverlayFonts,
  PILL_PAD_Y,
  type PillStyle,
  pillGeometry,
  plateColorFor,
  TEXT_LINE_HEIGHT,
  type TextStyle,
} from "@/lib/editor/overlays";

interface TextBlockProps {
  text: string;
  style: TextStyle;
  pill: PillStyle;
  color: string;
  /** Resolved font size in CSS px for this stage. */
  fontPx: number;
  fonts: OverlayFonts;
}

/**
 * THE text renderer for stories. Both the editor (TextTool) and the placed
 * overlay (OverlayLayer) render this exact component, and every measurement
 * comes from `pillGeometry` — the same helper the canvas exporter uses. So
 * what you type is what sits on the canvas is what lands in the posted file.
 *
 * It sizes to its content (`width: max-content`), which is why the plate
 * hugs the words instead of stretching into a band.
 */
export default function TextBlock({
  text,
  style,
  pill,
  color,
  fontPx,
  fonts,
}: TextBlockProps) {
  const geo = pillGeometry(pill);
  const plate = plateColorFor(color, pill);
  const lineH = fontPx * TEXT_LINE_HEIGHT;
  const padX = fontPx * geo.padX;
  const boxH = fontPx * geo.boxH;
  const radius = fontPx * geo.radius;
  const offsetY = fontPx * geo.offsetY;
  const lines = text.split("\n");
  const outline = pill === "outline";

  return (
    <div
      style={{
        width: "max-content",
        textAlign: "center",
        fontFamily: fontFamilyFor(style, fonts),
        fontWeight: fontWeightFor(style),
        fontSize: fontPx,
        lineHeight: TEXT_LINE_HEIGHT,
        letterSpacing: `${letterSpacingFor(style) * fontPx}px`,
        color: outline ? "transparent" : color,
        WebkitTextStroke: outline
          ? `${Math.max(1, fontPx * geo.strokeW)}px ${color}`
          : undefined,
        fontVariantNumeric: style === "ticker" ? "tabular-nums" : undefined,
        // The solid plate wraps the whole block; per-line plates live inside.
        background: pill === "solid" ? plate : undefined,
        padding:
          pill === "solid" ? `${fontPx * PILL_PAD_Y}px ${padX}px` : undefined,
        borderRadius: pill === "solid" ? radius : undefined,
      }}
    >
      {lines.map((line, i) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: lines are positional by definition.
          key={i}
          style={{
            height: lineH,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span style={{ position: "relative", whiteSpace: "pre" }}>
            {geo.perLine && line.trim() !== "" && (
              // Plate sits BEHIND the text and is nudged independently, so a
              // marker swipe can ride low without dragging the words with it.
              <span
                aria-hidden="true"
                style={{
                  position: "absolute",
                  left: -padX,
                  right: -padX,
                  top: "50%",
                  height: boxH,
                  transform: `translateY(calc(-50% + ${offsetY}px))`,
                  background: plate,
                  borderRadius: radius,
                }}
              />
            )}
            <span style={{ position: "relative" }}>{line}</span>
          </span>
        </div>
      ))}
    </div>
  );
}
