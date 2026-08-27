"use client";

import { AnimatePresence } from "framer-motion";
import { OverlayPanel, OverlayScrim } from "@/components/ui/Overlay";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
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
  Settings,
  Sparkles,
} from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  commandPaletteOpenAtom,
  searchOpenAtom,
  searchSeedAtom,
  welcomeTourOpenAtom,
} from "@/store/ui.atom";
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
  const setSearchOpen = useSetAtom(searchOpenAtom);
  const setSearchSeed = useSetAtom(searchSeedAtom);
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

  // Global shortcuts: Ctrl/Cmd+K toggles the palette, Esc closes. When
  // nothing has focus, `/` opens SEARCH — the palette is for commands, and
  // slash means search everywhere else on the web — and `n` jumps to the
  // composer.
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
        setSearchOpen(true);
      } else if (e.key.toLowerCase() === "n") {
        e.preventDefault();
        focusComposer();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, close, setOpen, setSearchOpen, focusComposer]);

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
        id: "nav-settings",
        group: "Navigate",
        label: "Settings",
        keywords: "preferences account privacy blocked topics theme language",
        icon: Settings,
        run: () => go("/settings"),
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
        run: () => {
          const q = query.trim();
          close();
          setSearchSeed(q);
          setSearchOpen(true);
        },
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
        // dvh + a shallower top offset on phones: at 15vh of the *expanded*
        // viewport the panel started below the fold once the keyboard opened.
        <>
          {/* The scrim used to be blurred too. Two backdrop-filters stacked
              turned the page behind into soup — the panel owns the blur. */}
          <OverlayScrim onClose={close} label="Close command menu" />

          <OverlayPanel
            variant="center"
            label="Command menu"
            className="max-w-[560px]"
          >
            <div className="flex h-13 shrink-0 items-center gap-3 border-b border-hairline px-4">
              <Search className="h-4 w-4 shrink-0 text-subtle" />
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
                placeholder="Search WorldStreet pages and actions…"
                // text-base below sm so focusing it doesn't zoom iOS Safari.
                className="min-w-0 flex-1 bg-transparent font-sans text-base text-primary outline-none placeholder:text-subtle sm:text-sm"
              />
              <kbd className="hidden h-5 items-center rounded-sm bg-chip px-1.5 font-sans text-[10px] text-muted sm:flex">
                esc
              </kbd>
            </div>

            <div
              ref={listRef}
              className="flex-1 min-h-0 max-h-[360px] overflow-y-auto overscroll-contain py-2"
            >
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
                    <p className="glass-eyebrow px-4 pt-2.5 pb-1 font-sans">
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
                          className={`w-full flex items-center gap-3 px-4 h-12 sm:h-11 font-sans text-sm font-medium text-left transition-colors cursor-pointer ${
                            active
                              ? "bg-chip text-primary"
                              : "text-muted"
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
                          <span className="truncate">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            {/* Keyboard legend is meaningless on a touch device and it's the
                first thing to cost vertical room there. */}
            <div className="hidden h-9 shrink-0 items-center gap-4 border-t border-hairline px-4 font-sans text-[11px] text-subtle sm:flex">
              <span>↑↓ navigate</span>
              <span>↵ open</span>
              <span>esc close</span>
            </div>
          </OverlayPanel>
        </>
      )}
    </AnimatePresence>
  );
}
