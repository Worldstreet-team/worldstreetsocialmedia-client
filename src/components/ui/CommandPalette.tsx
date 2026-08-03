"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useAtom, useAtomValue } from "jotai";
import type { LucideIcon } from "lucide-react";
// 03-icons: everything here stays inside the standardized lucide set —
// house/search/bell/message-circle/bookmark for nav, plus for create.
import {
  Bell,
  Bookmark,
  Home,
  MessageCircle,
  Plus,
  Search,
  Sparkles,
} from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { commandPaletteOpenAtom, welcomeTourOpenAtom } from "@/store/ui.atom";
import { userAtom } from "@/store/user.atom";

/**
 * Ctrl/Cmd+K command palette. One overlay for navigation, composing and
 * search. z-modal + overlay/scrim per the z-index scale; panel animates
 * opacity/translate only at motion-base.
 */

interface PaletteItem {
  id: string;
  group: "Navigate" | "Actions";
  label: string;
  keywords: string;
  icon?: LucideIcon;
  /** Avatar url — the icon set has no plain `user`, so Profile shows the avatar. */
  image?: string;
  run: () => void;
}

const GROUP_ORDER = ["Actions", "Navigate"] as const;

export function CommandPalette() {
  const [open, setOpen] = useAtom(commandPaletteOpenAtom);
  const setTourOpen = useAtom(welcomeTourOpenAtom)[1];
  const user = useAtomValue(userAtom);
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setActiveIndex(0);
  }, [setOpen]);

  const go = useCallback(
    (href: string) => {
      close();
      router.push(href);
    },
    [close, router],
  );

  const focusComposer = useCallback(() => {
    close();
    const el = document.querySelector<HTMLTextAreaElement>(
      "#post-composer-input",
    );
    if (el) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      el.focus();
    } else {
      router.push("/");
    }
  }, [close, router]);

  // Global shortcuts: Ctrl/Cmd+K toggles, Esc closes. When nothing has
  // focus, `/` opens the palette and `n` jumps to the composer.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
        return;
      }
      if (e.key === "Escape" && open) {
        close();
        return;
      }

      if (open || e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      const typing =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable;
      if (typing) return;

      if (e.key === "/") {
        e.preventDefault();
        setOpen(true);
      } else if (e.key.toLowerCase() === "n") {
        e.preventDefault();
        focusComposer();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, close, setOpen, focusComposer]);

  // Lock page scroll behind the overlay.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const items = useMemo<PaletteItem[]>(() => {
    const base: PaletteItem[] = [
      {
        id: "new-post",
        group: "Actions",
        label: "New post",
        keywords: "compose write publish",
        icon: Plus,
        run: focusComposer,
      },
      {
        id: "welcome-tour",
        group: "Actions",
        label: "Replay the welcome tour",
        keywords: "help onboarding guide intro tutorial",
        icon: Sparkles,
        run: () => {
          close();
          setTourOpen(true);
        },
      },
      {
        id: "nav-home",
        group: "Navigate",
        label: "Home",
        keywords: "feed timeline",
        icon: Home,
        run: () => go("/"),
      },
      {
        id: "nav-explore",
        group: "Navigate",
        label: "Explore",
        keywords: "search trends discover",
        icon: Search,
        run: () => go("/explore"),
      },
      {
        id: "nav-notifications",
        group: "Navigate",
        label: "Notifications",
        keywords: "alerts mentions activity",
        icon: Bell,
        run: () => go("/notifications"),
      },
      {
        id: "nav-messages",
        group: "Navigate",
        label: "Messages",
        keywords: "dm chat inbox",
        icon: MessageCircle,
        run: () => go("/messages"),
      },
      {
        id: "nav-bookmarks",
        group: "Navigate",
        label: "Bookmarks",
        keywords: "saved posts",
        icon: Bookmark,
        run: () => go("/bookmarks"),
      },
      {
        id: "nav-profile",
        group: "Navigate",
        label: "Profile",
        keywords: `account ${user?.username ?? ""}`,
        image: user?.avatar,
        run: () =>
          go(user?.username ? `/profile/${user.username}` : "/profile"),
      },
    ];

    const q = query.trim().toLowerCase();
    const filtered = q
      ? base.filter(
          (item) =>
            item.label.toLowerCase().includes(q) ||
            item.keywords.toLowerCase().includes(q),
        )
      : base;

    if (q) {
      filtered.push({
        id: "search-explore",
        group: "Actions",
        label: `Search for "${query.trim()}"`,
        keywords: "",
        icon: Search,
        run: () => go(`/explore?q=${encodeURIComponent(query.trim())}`),
      });
    }

    // Keep the flat (keyboard) order identical to the rendered group order,
    // otherwise arrowing down can visually jump upward.
    return filtered.sort(
      (a, b) => GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group),
    );
  }, [query, user, go, focusComposer, close, setTourOpen]);

  const onInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      items[activeIndex]?.run();
    }
  };

  // Keep the highlighted row in view when arrowing through a long list.
  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-modal flex items-start justify-center px-4 pt-[15vh]">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
            className="absolute inset-0 bg-scrim"
            onClick={close}
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Command menu"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
            className="relative w-full max-w-[560px] bg-surface border border-hairline rounded-xl shadow-nav overflow-hidden"
          >
            <div className="flex items-center gap-3 px-4 h-12 border-b border-hairline">
              <Search className="w-4 h-4 text-subtle shrink-0" />
              <input
                // biome-ignore lint/a11y/noAutofocus: focus belongs in the palette the moment it opens
                autoFocus
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  // The result set changes with the query; restart the highlight.
                  setActiveIndex(0);
                }}
                onKeyDown={onInputKeyDown}
                placeholder="Search WorldStreet — pages and actions…"
                className="flex-1 bg-transparent font-sans text-sm text-primary placeholder:text-subtle outline-none"
              />
              <kbd className="hidden sm:flex items-center rounded-sm border border-hairline bg-raised px-1.5 h-5 text-[10px] font-sans text-subtle">
                esc
              </kbd>
            </div>

            <div ref={listRef} className="max-h-[360px] overflow-y-auto py-2">
              {items.length === 0 && (
                <p className="px-4 py-6 text-center font-sans text-sm text-muted">
                  Nothing matches. Try a page name like Explore.
                </p>
              )}

              {GROUP_ORDER.map((group) => {
                const groupItems = items.filter((i) => i.group === group);
                if (groupItems.length === 0) return null;
                return (
                  <div key={group}>
                    {/* UI/Label: Public Sans Medium 11, uppercase, +1 tracking. */}
                    <p className="px-4 pt-2 pb-1 font-sans font-medium text-[11px] uppercase tracking-[1px] text-subtle">
                      {group}
                    </p>
                    {groupItems.map((item) => {
                      const index = items.indexOf(item);
                      const active = index === activeIndex;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          data-index={index}
                          onClick={item.run}
                          onMouseEnter={() => setActiveIndex(index)}
                          className={`w-full flex items-center gap-3 px-4 h-11 font-sans text-sm font-medium text-left transition-colors cursor-pointer ${
                            active ? "bg-raised text-primary" : "text-muted"
                          }`}
                        >
                          {item.icon ? (
                            <item.icon className="w-4 h-4 shrink-0" />
                          ) : item.image ? (
                            <Image
                              src={item.image}
                              alt=""
                              width={16}
                              height={16}
                              className="w-4 h-4 shrink-0 rounded-pill object-cover"
                            />
                          ) : (
                            <span className="w-4 shrink-0" />
                          )}
                          <span>{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            <div className="flex items-center gap-4 px-4 h-9 border-t border-hairline font-sans text-[11px] text-subtle">
              <span>↑↓ navigate</span>
              <span>↵ open</span>
              <span>esc close</span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
