"use client";

import { Check, Plus } from "@phosphor-icons/react";
import clsx from "clsx";
import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { HexColorPicker } from "react-colorful";
import TextBlock from "@/components/story/overlays/TextBlock";
import ScrollStrip from "@/components/ui/ScrollStrip";
import {
  fontFamilyFor,
  fontWeightFor,
  INK_LIGHT,
  letterSpacingFor,
  type OverlayFonts,
  type PillStyle,
  TEXT_PALETTES,
  TEXT_SIZE_FRACTION,
  type TextOverlay,
  type TextStyle,
} from "@/lib/editor/overlays";

interface TextToolProps {
  /** Existing overlay when re-editing; null for a new one. */
  overlay: TextOverlay | null;
  stageW: number;
  fonts: OverlayFonts;
  /** Ink that reads on the current canvas — the starting colour for new text. */
  defaultColor?: string;
  /** Empty text on Done means delete/cancel. */
  onDone: (
    values: Pick<TextOverlay, "text" | "style" | "pill" | "color">,
  ) => void;
  onCancel: () => void;
}

/** Each voice names itself in its own face — the specimen IS the control. */
const VOICES: { id: TextStyle; label: string; specimen: string }[] = [
  { id: "display", label: "Display", specimen: "Ag" },
  { id: "editorial", label: "Editorial", specimen: "Ag" },
  { id: "clean", label: "Clean", specimen: "Ag" },
  { id: "poster", label: "Poster", specimen: "Ag" },
  { id: "condensed", label: "Condensed", specimen: "Ag" },
  { id: "script", label: "Script", specimen: "Ag" },
  { id: "ticker", label: "Ticker", specimen: "$Ag" },
];

const PILLS: { id: PillStyle; label: string }[] = [
  { id: "none", label: "Plain" },
  { id: "solid", label: "Plate" },
  { id: "line", label: "Ragged" },
  { id: "marker", label: "Marker" },
  { id: "outline", label: "Hollow" },
];

type Tab = "font" | "style" | "colour";
const TABS: { id: Tab; label: string }[] = [
  { id: "font", label: "Font" },
  { id: "style", label: "Style" },
  { id: "colour", label: "Colour" },
];

const EASE = [0.2, 0, 0, 1] as const;

/**
 * Full-screen text takeover: type against a blurred scrim in the exact face,
 * plate and colour you'll get — the preview renders the same <TextBlock> the
 * placed overlay does, so nothing shifts on Done.
 */
export default function TextTool({
  overlay,
  stageW,
  fonts,
  defaultColor = INK_LIGHT,
  onDone,
  onCancel,
}: TextToolProps) {
  const [text, setText] = useState(overlay?.text ?? "");
  const [style, setStyle] = useState<TextStyle>(overlay?.style ?? "display");
  const [color, setColor] = useState<string>(overlay?.color ?? defaultColor);
  const [pill, setPill] = useState<PillStyle>(overlay?.pill ?? "none");
  const [tab, setTab] = useState<Tab>("font");
  const [paletteId, setPaletteId] = useState(TEXT_PALETTES[0].id);
  const [customOpen, setCustomOpen] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const fontPx = previewFontPx(stageW, overlay?.scale ?? 1);
  const palette =
    TEXT_PALETTES.find((p) => p.id === paletteId) ?? TEXT_PALETTES[0];
  const custom = !TEXT_PALETTES.some((p) =>
    p.colors.some((c) => c.toLowerCase() === color.toLowerCase()),
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2, ease: EASE }}
      className="absolute inset-0 z-20 flex flex-col glass-veil-sheer backdrop-blur-md backdrop-saturate-150"
    >
      <div className="flex shrink-0 items-center justify-between px-3 py-2.5">
        <button
          type="button"
          onClick={onCancel}
          className="h-9 px-3 rounded-pill font-sans text-[13px] font-medium glass-ink-dim hover:glass-ink transition-colors cursor-pointer"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => onDone({ text: text.trim(), style, pill, color })}
          className="flex items-center gap-2 glass-cta px-5 h-10 rounded-pill font-semibold text-[13px] transition-colors font-sans cursor-pointer active:brightness-95"
        >
          <Check size={14} weight="bold" />
          Done
        </button>
      </div>

      {/* The live block, sized exactly as it will be placed. A transparent
          textarea sits on top of it so the caret is where the words are. */}
      <div className="flex-1 min-h-0 flex items-center justify-center px-6 overflow-hidden">
        <div className="relative max-w-full">
          <TextBlock
            text={text || "Type something"}
            style={style}
            pill={text ? pill : "none"}
            color={text ? color : "rgba(250,250,249,0.3)"}
            fontPx={fontPx}
            fonts={fonts}
          />
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
            maxLength={120}
            spellCheck={false}
            className="absolute inset-0 h-full w-full bg-transparent text-transparent caret-brand outline-none resize-none overflow-hidden text-center"
            style={{
              fontFamily: fontFamilyFor(style, fonts),
              fontWeight: fontWeightFor(style),
              fontSize: fontPx,
              lineHeight: 1.25,
              letterSpacing: `${letterSpacingFor(style) * fontPx}px`,
            }}
          />
        </div>
      </div>

      {/* Controls, tabbed so the stage keeps its room */}
      <div className="shrink-0 px-3 pb-4 pb-safe space-y-2.5">
        <div className="flex justify-center gap-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              aria-pressed={tab === t.id}
              className={clsx(
                "relative h-7 px-3 rounded-pill font-sans text-[11px] font-semibold uppercase tracking-[0.08em] transition-colors cursor-pointer",
                tab === t.id ? "text-[#0c0a09]" : "glass-ink-dim",
              )}
            >
              {tab === t.id && (
                <motion.span
                  layoutId="ws-text-tab"
                  transition={
                    reduce ? { duration: 0 } : { duration: 0.2, ease: EASE }
                  }
                  className="absolute inset-0 rounded-pill glass-fill"
                />
              )}
              <span className="relative">{t.label}</span>
            </button>
          ))}
        </div>

        {tab === "font" && (
          <ScrollStrip ariaLabel="Typeface">
            {VOICES.map((voice) => {
              const active = style === voice.id;
              return (
                <button
                  key={voice.id}
                  type="button"
                  onClick={() => setStyle(voice.id)}
                  aria-pressed={active}
                  aria-label={voice.label}
                  className="relative flex h-[52px] w-[62px] shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl transition-colors cursor-pointer"
                >
                  {active && (
                    <motion.span
                      layoutId="ws-voice-pick"
                      transition={
                        reduce ? { duration: 0 } : { duration: 0.2, ease: EASE }
                      }
                      className="absolute inset-0 rounded-xl glass-chip-active"
                    />
                  )}
                  <span
                    className={clsx(
                      "relative text-[19px] leading-none transition-colors",
                      active ? "text-[#0c0a09]" : "text-[#fafaf9]/85",
                    )}
                    style={{
                      fontFamily: fontFamilyFor(voice.id, fonts),
                      fontWeight: fontWeightFor(voice.id),
                      letterSpacing: `${letterSpacingFor(voice.id) * 19}px`,
                    }}
                  >
                    {voice.specimen}
                  </span>
                  <span
                    className={clsx(
                      "relative font-sans text-[9px] font-semibold uppercase tracking-[0.08em] transition-colors",
                      active ? "text-[#0c0a09]/60" : "text-[#fafaf9]/40",
                    )}
                  >
                    {voice.label}
                  </span>
                </button>
              );
            })}
          </ScrollStrip>
        )}

        {tab === "style" && (
          <ScrollStrip ariaLabel="Text style">
            {PILLS.map((option) => {
              const active = pill === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setPill(option.id)}
                  aria-pressed={active}
                  aria-label={option.label}
                  className="relative flex h-[52px] w-[64px] shrink-0 flex-col items-center justify-center gap-1 rounded-xl transition-colors cursor-pointer"
                >
                  {active && (
                    <motion.span
                      layoutId="ws-pill-pick"
                      transition={
                        reduce ? { duration: 0 } : { duration: 0.2, ease: EASE }
                      }
                      className="absolute inset-0 rounded-xl glass-chip-active"
                    />
                  )}
                  {/* Each chip previews its own treatment at a legible size. */}
                  <span className="relative flex h-6 items-center justify-center">
                    <TextBlock
                      text="Ag"
                      style="clean"
                      pill={option.id}
                      color={active ? "#0c0a09" : "#fafaf9"}
                      fontPx={15}
                      fonts={fonts}
                    />
                  </span>
                  <span
                    className={clsx(
                      "relative font-sans text-[9px] font-semibold uppercase tracking-[0.08em] transition-colors",
                      active ? "text-[#0c0a09]/60" : "text-[#fafaf9]/40",
                    )}
                  >
                    {option.label}
                  </span>
                </button>
              );
            })}
          </ScrollStrip>
        )}

        {tab === "colour" && (
          <div className="space-y-2">
            <ScrollStrip ariaLabel="Palette">
              {TEXT_PALETTES.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPaletteId(p.id)}
                  aria-pressed={paletteId === p.id}
                  className={clsx(
                    "h-7 shrink-0 px-3 rounded-pill font-sans text-[11px] font-medium transition-colors cursor-pointer",
                    paletteId === p.id
                      ? "glass-chip-active"
                      : "glass-chip backdrop-blur-md",
                  )}
                >
                  {p.label}
                </button>
              ))}
            </ScrollStrip>
            <div className="flex items-center justify-center gap-2">
              {palette.colors.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => {
                    setColor(c);
                    setCustomOpen(false);
                  }}
                  aria-label={c}
                  aria-pressed={color.toLowerCase() === c.toLowerCase()}
                  className={clsx(
                    "flex h-9 w-9 items-center justify-center rounded-pill transition-opacity cursor-pointer",
                    color.toLowerCase() === c.toLowerCase()
                      ? "opacity-100"
                      : "opacity-55 hover:opacity-90",
                  )}
                >
                  <span
                    className="flex h-6 w-6 items-center justify-center rounded-pill shadow-[0_2px_10px_rgba(0,0,0,0.55)]"
                    style={{ background: c }}
                  >
                    {color.toLowerCase() === c.toLowerCase() && (
                      <Check
                        size={12}
                        weight="bold"
                        style={{
                          color:
                            c.toLowerCase() === "#0c0a09"
                              ? "#fafaf9"
                              : "#0c0a09",
                        }}
                      />
                    )}
                  </span>
                </button>
              ))}
              {/* Custom colour — the palette's escape hatch. */}
              <button
                type="button"
                onClick={() => setCustomOpen((v) => !v)}
                aria-label="Custom colour"
                aria-pressed={customOpen}
                className={clsx(
                  "flex h-9 w-9 items-center justify-center rounded-pill transition-opacity cursor-pointer",
                  custom || customOpen ? "opacity-100" : "opacity-70",
                )}
              >
                <span
                  className="flex h-6 w-6 items-center justify-center rounded-pill shadow-[0_2px_10px_rgba(0,0,0,0.55)]"
                  style={{
                    background: custom
                      ? color
                      : "conic-gradient(#EF4444,#EAB308,#10B981,#0EA5E9,#8B5CF6,#EF4444)",
                  }}
                >
                  {!custom && (
                    <Plus size={11} weight="bold" className="text-[#0c0a09]" />
                  )}
                </span>
              </button>
            </div>
            {customOpen && (
              <div className="flex justify-center pt-1">
                <div className="ws-color-picker">
                  <HexColorPicker color={color} onChange={setColor} />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

/** Preview font size — same fraction the placed overlay uses at its scale. */
function previewFontPx(stageW: number, scale: number) {
  return Math.max(18, TEXT_SIZE_FRACTION * stageW * scale);
}
