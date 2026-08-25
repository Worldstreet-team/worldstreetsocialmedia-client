"use client";

import { X } from "@phosphor-icons/react";
import EmojiPicker, { type EmojiClickData, Theme } from "emoji-picker-react";
import { useTheme } from "next-themes";
import { useState } from "react";
import { CASHTAG_COLORS } from "@/lib/editor/overlays";

interface StickerTrayProps {
  onAddCashtag: (symbol: string) => void;
  onAddEmoji: (emoji: string) => void;
  onClose: () => void;
}

const SYMBOL_RE = /^[A-Za-z]{1,6}$/;

/**
 * The sticker tray — the brand-unique cashtag chip (any $SYMBOL, styled
 * like RichText's convert chips, no market API needed) plus the emoji
 * picker the composer already ships.
 */
export default function StickerTray({
  onAddCashtag,
  onAddEmoji,
  onClose,
}: StickerTrayProps) {
  const [symbol, setSymbol] = useState("");
  const { resolvedTheme } = useTheme();
  const valid = SYMBOL_RE.test(symbol);

  const submitCashtag = () => {
    if (!valid) return;
    onAddCashtag(symbol.toUpperCase());
    setSymbol("");
  };

  return (
    <div
      className="absolute inset-x-0 bottom-0 z-20 glass-panel glass-ink rounded-b-none flex flex-col max-h-[70%]"
      style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}
    >
      <div className="flex shrink-0 items-center justify-between px-3 py-2 border-b glass-divider">
        <span className="font-display text-sm font-semibold">Stickers</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close stickers"
          className="flex h-10 w-10 items-center justify-center rounded-pill glass-chip transition-colors cursor-pointer"
        >
          <X size={16} weight="bold" />
        </button>
      </div>

      {/* Cashtag chip builder */}
      <div className="shrink-0 px-3 py-3 border-b glass-divider">
        <div className="flex items-center gap-2">
          <div className="flex-1 flex items-center h-11 sm:h-10 rounded-pill glass-input transition-colors px-4 gap-1">
            <span className="text-gold font-semibold font-sans">$</span>
            <input
              type="text"
              value={symbol}
              onChange={(e) =>
                setSymbol(e.target.value.replace(/[^A-Za-z]/g, "").slice(0, 6))
              }
              onKeyDown={(e) => {
                if (e.key === "Enter") submitCashtag();
              }}
              placeholder="XAU"
              aria-label="Cashtag symbol"
              className="flex-1 bg-transparent outline-none text-base sm:text-sm font-sans uppercase glass-ink placeholder:glass-ink-faint tabular-nums"
            />
          </div>
          <button
            type="button"
            onClick={submitCashtag}
            disabled={!valid}
            className="shrink-0 h-11 sm:h-10 px-5 rounded-pill font-semibold text-sm font-sans glass-cta transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            Add
          </button>
        </div>
        {symbol && valid && (
          <div className="mt-2 flex justify-center">
            <span
              className="rounded-pill px-3 py-1 text-sm font-semibold tabular-nums"
              style={{
                color: CASHTAG_COLORS.text,
                background: CASHTAG_COLORS.pill,
                border: `1.5px solid ${CASHTAG_COLORS.border}`,
                fontFamily:
                  'ui-monospace, "SF Mono", "Cascadia Mono", Menlo, monospace',
              }}
            >
              ${symbol.toUpperCase()}
            </span>
          </div>
        )}
      </div>

      {/* Emoji stickers — same picker/theming as the composer popover. */}
      <div className="flex-1 min-h-0 ws-emoji-picker">
        <EmojiPicker
          onEmojiClick={(data: EmojiClickData) => onAddEmoji(data.emoji)}
          theme={resolvedTheme === "light" ? Theme.LIGHT : Theme.DARK}
          width="100%"
          height={300}
          lazyLoadEmojis={true}
          previewConfig={{ showPreview: false }}
        />
      </div>
    </div>
  );
}
