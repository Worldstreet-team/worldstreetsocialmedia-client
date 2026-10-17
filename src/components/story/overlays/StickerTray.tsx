"use client";

import { MagnifyingGlass, X } from "@phosphor-icons/react";
import clsx from "clsx";
import type { EmojiClickData, Theme } from "emoji-picker-react";
import dynamic from "next/dynamic";
// The picker is ~300KB and renders only after someone opens it, so the
// chunk waits for that first render. `Theme` is a runtime enum that would
// pull the whole library back in; it is imported as a type and the values
// it holds ("light" / "dark") are written out at the call site.
const EmojiPicker = dynamic(() => import("emoji-picker-react"), {
  ssr: false,
});
import { motion } from "framer-motion";
import { useTheme } from "next-themes";
import { useEffect, useId, useState } from "react";
import { UserBadges } from "@/components/ui/UserBadges";
import type { MentionUser } from "@/components/feed/MentionAutocomplete";

import { MENTION_COLORS } from "@/lib/editor/overlays";
import { menu, thumbSpring } from "@/lib/motion-presets";
import { searchUsersAction } from "@/lib/user.actions";
import { SafeAvatar } from "@/components/ui/SafeAvatar";

interface StickerTrayProps {
  onAddEmoji: (emoji: string) => void;
  onAddMention: (user: MentionUser) => void;
  onClose: () => void;
}

// The ticker tab is gone (owner 2026-10-12: "remove those tickers").
type Tab = "tag" | "emoji";
const TABS: { id: Tab; label: string }[] = [
  { id: "tag", label: "Tag" },
  { id: "emoji", label: "Emoji" },
];

/**
 * The sticker tray: tag a person, or drop an emoji from the same picker
 * the composer ships.
 */
export default function StickerTray({
  onAddEmoji,
  onAddMention,
  onClose,
}: StickerTrayProps) {
  const [tab, setTab] = useState<Tab>("tag");
  const [query, setQuery] = useState("");
  const [people, setPeople] = useState<MentionUser[]>([]);
  const [searching, setSearching] = useState(false);
  const { resolvedTheme } = useTheme();
  const thumbId = useId();

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


  return (
    // Unfolds from the stage's bottom edge; the host's AnimatePresence gives
    // it the exit.
    <motion.div
      {...menu("bottom")}
      // The tray grows upward when a taller tab opens; as the layout root,
      // the tab fill slides sideways only and ignores that jump.
      layoutRoot
      className="absolute inset-x-0 bottom-0 z-30 glass-dock backdrop-blur-2xl backdrop-saturate-150 glass-ink rounded-b-none rounded-t-2xl flex flex-col max-h-[78%]"
    >
      <div className="flex shrink-0 items-center justify-between gap-2 px-3 py-2">
        <div className="flex items-center gap-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              aria-pressed={tab === t.id}
              className={clsx(
                "relative h-8 px-3 rounded-pill font-sans text-[calc(12px*var(--ws-fs))] font-semibold transition-colors cursor-pointer",
                tab === t.id ? "text-[#0c0a09]" : "glass-chip",
              )}
            >
              {/* The white fill is one element that slides between tabs. */}
              {tab === t.id && (
                <motion.span
                  layoutId={`${thumbId}-tab`}
                  transition={thumbSpring}
                  className="pointer-events-none absolute inset-0 rounded-pill glass-chip-active"
                />
              )}
              <span className="relative">{t.label}</span>
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
              className="flex-1 bg-transparent outline-none text-base sm:text-[calc(13px*var(--ws-fs))] font-sans glass-ink placeholder:glass-ink-faint"
            />
          </div>
          <div className="mt-2 flex-1 min-h-0 overflow-y-auto no-scrollbar">
            {searching && (
              <p className="py-3 text-center font-sans text-[calc(12px*var(--ws-fs))] glass-ink-faint">
                Searching…
              </p>
            )}
            {!searching && query.trim() && people.length === 0 && (
              <p className="py-3 text-center font-sans text-[calc(12px*var(--ws-fs))] glass-ink-faint">
                No one found for “{query.trim()}”
              </p>
            )}
            {!searching && !query.trim() && (
              <p className="py-3 text-center font-sans text-[calc(12px*var(--ws-fs))] glass-ink-faint">
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
                    <span className="truncate font-sans text-[calc(13px*var(--ws-fs))] font-semibold glass-ink">
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
                  <span className="block truncate font-sans text-[calc(11px*var(--ws-fs))] glass-ink-dim">
                    @{user.username}
                  </span>
                </span>
                <span
                  className="shrink-0 rounded-pill px-2 py-0.5 font-sans text-[calc(11px*var(--ws-fs))] font-bold"
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

      {/* Emoji stickers same picker/theming as the composer popover. */}
      {tab === "emoji" && (
        <div className="flex-1 min-h-0 ws-emoji-picker">
          <EmojiPicker
            onEmojiClick={(data: EmojiClickData) => onAddEmoji(data.emoji)}
            theme={resolvedTheme === "light" ? ("light" as Theme) : ("dark" as Theme)}
            width="100%"
            height={260}
            lazyLoadEmojis={true}
            previewConfig={{ showPreview: false }}
          />
        </div>
      )}
    </motion.div>
  );
}
