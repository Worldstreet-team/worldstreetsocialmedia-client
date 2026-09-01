"use client";

import { MagnifyingGlass, X } from "@phosphor-icons/react";
import clsx from "clsx";
import EmojiPicker, { type EmojiClickData, Theme } from "emoji-picker-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { UserBadges } from "@/components/ui/UserBadges";
import type { MentionUser } from "@/components/feed/MentionAutocomplete";

import { CASHTAG_COLORS, MENTION_COLORS } from "@/lib/editor/overlays";
import { searchUsersAction } from "@/lib/user.actions";
import { SafeAvatar } from "@/components/ui/SafeAvatar";

interface StickerTrayProps {
  onAddCashtag: (symbol: string) => void;
  onAddEmoji: (emoji: string) => void;
  onAddMention: (user: MentionUser) => void;
  onClose: () => void;
}

type Tab = "tag" | "cashtag" | "emoji";
const TABS: { id: Tab; label: string }[] = [
  { id: "tag", label: "Tag" },
  { id: "cashtag", label: "Ticker" },
  { id: "emoji", label: "Emoji" },
];

const SYMBOL_RE = /^[A-Za-z]{1,6}$/;

/**
 * The sticker tray — the brand-unique cashtag chip (any $SYMBOL, styled
 * like RichText's convert chips, no market API needed) plus the emoji
 * picker the composer already ships.
 */
export default function StickerTray({
  onAddCashtag,
  onAddEmoji,
  onAddMention,
  onClose,
}: StickerTrayProps) {
  const [tab, setTab] = useState<Tab>("tag");
  const [symbol, setSymbol] = useState("");
  const [query, setQuery] = useState("");
  const [people, setPeople] = useState<MentionUser[]>([]);
  const [searching, setSearching] = useState(false);
  const { resolvedTheme } = useTheme();
  const valid = SYMBOL_RE.test(symbol);

  // Debounced people search — the gateway 400s on an empty query, so a blank
  // box simply shows nothing rather than firing a doomed request.
  useEffect(() => {
    const term = query.trim();
    if (!term) {
      setPeople([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    let cancelled = false;
    const timer = setTimeout(async () => {
      const res = await searchUsersAction(term);
      if (cancelled) return;
      setPeople(
        res.success && Array.isArray(res.data) ? res.data.slice(0, 6) : [],
      );
      setSearching(false);
    }, 180);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  const submitCashtag = () => {
    if (!valid) return;
    onAddCashtag(symbol.toUpperCase());
    setSymbol("");
  };

  return (
    <div className="absolute inset-x-0 bottom-0 z-30 glass-dock backdrop-blur-2xl backdrop-saturate-150 glass-ink rounded-b-none rounded-t-2xl flex flex-col max-h-[78%]">
      <div className="flex shrink-0 items-center justify-between gap-2 px-3 py-2">
        <div className="flex items-center gap-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              aria-pressed={tab === t.id}
              className={clsx(
                "h-8 px-3 rounded-pill font-sans text-[12px] font-semibold transition-colors cursor-pointer",
                tab === t.id
                  ? "glass-chip-active"
                  : "glass-chip ",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close stickers"
          className="flex h-9 w-9 items-center justify-center rounded-pill glass-chip transition-colors cursor-pointer"
        >
          <X size={15} weight="bold" />
        </button>
      </div>

      {/* Tag someone */}
      {tab === "tag" && (
        <div className="flex-1 min-h-0 flex flex-col px-3 pb-3">
          <div className="flex shrink-0 items-center h-10 rounded-pill glass-input px-3 gap-2">
            <MagnifyingGlass size={15} className="shrink-0 glass-ink-faint" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search people"
              aria-label="Search people to tag"
              className="flex-1 bg-transparent outline-none text-base sm:text-[13px] font-sans glass-ink placeholder:glass-ink-faint"
            />
          </div>
          <div className="mt-2 flex-1 min-h-0 overflow-y-auto no-scrollbar">
            {searching && (
              <p className="py-3 text-center font-sans text-[12px] glass-ink-faint">
                Searching…
              </p>
            )}
            {!searching && query.trim() && people.length === 0 && (
              <p className="py-3 text-center font-sans text-[12px] glass-ink-faint">
                No one found for “{query.trim()}”
              </p>
            )}
            {!searching && !query.trim() && (
              <p className="py-3 text-center font-sans text-[12px] glass-ink-faint">
                Search for someone to tag on your story
              </p>
            )}
            {people.map((user) => (
              <button
                key={user._id}
                type="button"
                onClick={() => onAddMention(user)}
                className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-[#fafaf9]/8 cursor-pointer"
              >
                <span className="relative h-8 w-8 shrink-0 overflow-hidden rounded-pill">
                  <SafeAvatar src={user.avatar} className="object-cover" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1">
                    <span className="truncate font-sans text-[13px] font-semibold glass-ink">
                      {user.firstName || user.lastName
                        ? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim()
                        : user.username}
                    </span>
                    <UserBadges
                      isVerified={user.isVerified}
                      verification={(user as any).verification}
                      badges={(user as any).badges}
                      size={12}
                    />
                  </span>
                  <span className="block truncate font-sans text-[11px] glass-ink-dim">
                    @{user.username}
                  </span>
                </span>
                <span
                  className="shrink-0 rounded-pill px-2 py-0.5 font-sans text-[11px] font-bold"
                  style={{
                    color: MENTION_COLORS.text,
                    background: MENTION_COLORS.pill,
                  }}
                >
                  @{user.username}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Cashtag chip builder */}
      {tab === "cashtag" && (
        <div className="shrink-0 px-3 pb-3">
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center h-10 rounded-pill glass-input transition-colors px-4 gap-1">
              <span className="text-gold font-semibold font-sans">$</span>
              <input
                type="text"
                value={symbol}
                onChange={(e) =>
                  setSymbol(
                    e.target.value.replace(/[^A-Za-z]/g, "").slice(0, 6),
                  )
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
              className="shrink-0 h-10 px-5 rounded-pill font-semibold text-sm font-sans glass-cta transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              Add
            </button>
          </div>
          {symbol && valid && (
            <div className="mt-3 flex justify-center">
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
      )}

      {/* Emoji stickers same picker/theming as the composer popover. */}
      {tab === "emoji" && (
        <div className="flex-1 min-h-0 ws-emoji-picker">
          <EmojiPicker
            onEmojiClick={(data: EmojiClickData) => onAddEmoji(data.emoji)}
            theme={resolvedTheme === "light" ? Theme.LIGHT : Theme.DARK}
            width="100%"
            height={260}
            lazyLoadEmojis={true}
            previewConfig={{ showPreview: false }}
          />
        </div>
      )}
    </div>
  );
}
