"use client";

import { useCallback, useEffect, useState } from "react";
import { CaretDown } from "@phosphor-icons/react";
import clsx from "clsx";
import { useT } from "@/i18n/client";

/** Per-section collapse memory. Keyed off `sectionId`, never off the label —
 *  the label is translated and would give every locale its own memory. */
const storageKey = (sectionId: string) => `ws-explore-collapsed-${sectionId}`;

type ExploreSectionProps = {
  label: string;
  live?: boolean;
  trailing?: React.ReactNode;
  delay: number;
  /** Full-bleed children (PostCard owns its own padding). */
  bleed?: boolean;
  children: React.ReactNode;
} & (
  | {
      /** Opt in to a collapsible body. Sections that omit this render
       *  byte-for-byte the markup they always have. */
      collapsible: true;
      /** Stable, untranslated key for the localStorage entry and the panel id. */
      sectionId: string;
    }
  | { collapsible?: false; sectionId?: never }
);

/**
 * One discovery block: eyebrow, optional live dot, optional trailing link.
 * Every section on Explore uses this so the eight blocks read as one page
 * instead of eight transplants.
 *
 * Opting in to `collapsible` turns the eyebrow row into a disclosure button
 * and remembers the choice in localStorage, so a reader who does not care
 * about (say) topics only has to say so once.
 */
export function ExploreSection({
  label,
  live = false,
  trailing,
  delay,
  bleed = false,
  collapsible = false,
  sectionId,
  children,
}: ExploreSectionProps) {
  const t = useT();
  const [collapsed, setCollapsed] = useState(false);
  // Transitions stay off for the first painted frame — see the effect below.
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    if (!collapsible || !sectionId) return;

    try {
      if (window.localStorage.getItem(storageKey(sectionId)) === "1") {
        setCollapsed(true);
      }
    } catch {
      // Storage blocked (private mode, hardened browser) — stay expanded.
    }

    // Restoring a collapsed section is a *state*, not a gesture: enabling the
    // transition only after that state has painted stops the section from
    // animating itself shut on every single page load. Two frames, because
    // the restore commits during the first one.
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setAnimated(true));
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, [collapsible, sectionId]);

  const toggle = useCallback(() => {
    if (!sectionId) return;
    const next = !collapsed;
    setCollapsed(next);
    setAnimated(true);
    try {
      window.localStorage.setItem(storageKey(sectionId), next ? "1" : "0");
    } catch {
      // Non-persisting toggle is still a working toggle.
    }
  }, [collapsed, sectionId]);

  const panelId = sectionId ? `explore-section-${sectionId}` : undefined;

  const dot = live ? (
    <span className="relative flex h-2 w-2 shrink-0">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-pill bg-danger opacity-60" />
      <span className="relative inline-flex h-2 w-2 rounded-pill bg-danger" />
    </span>
  ) : null;

  return (
    <section
      className={clsx("animate-rise pt-6", !bleed && "px-4")}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className={clsx("mb-3 flex items-center gap-2", bleed && "px-4")}>
        {collapsible ? (
          // The row minus the trailing control is the target. `-my-3` keeps the
          // 40px hit target from adding 24px of height, so a collapsible header
          // sits exactly where a plain one does.
          <button
            type="button"
            onClick={toggle}
            aria-expanded={!collapsed}
            aria-controls={panelId}
            title={collapsed ? t("explore.expandSection") : t("explore.collapseSection")}
            className="group -my-3 flex min-h-10 min-w-0 flex-1 cursor-pointer items-center gap-2 text-left"
          >
            {dot}
            <h2 className="min-w-0 truncate font-sans text-[11px] font-semibold uppercase tracking-[0.14em] text-subtle transition-colors group-hover:text-muted">
              {label}
            </h2>
            <CaretDown
              size={12}
              weight="bold"
              className={clsx(
                "shrink-0 text-subtle transition-transform duration-200 group-hover:text-muted",
                collapsed && "-rotate-90",
              )}
            />
          </button>
        ) : (
          <>
            {dot}
            <h2 className="min-w-0 flex-1 font-sans text-[11px] font-semibold uppercase tracking-[0.14em] text-subtle">
              {label}
            </h2>
          </>
        )}
        {/* The trailing control is a *sibling* of the toggle, never a child —
            a button may not contain a link — so a "See all" click can neither
            reach nor collapse the section. */}
        {trailing}
      </div>

      {collapsible ? (
        <div
          className={clsx(
            // grid-rows 1fr -> 0fr animates to the content's own height, so
            // nothing here has to know how tall a section is. grid-cols-1 is
            // load-bearing: an implicit auto column would be sized by the
            // horizontally-scrolling rails' max-content and blow the column out.
            "grid grid-cols-1",
            animated && "transition-[grid-template-rows] duration-200",
            collapsed ? "grid-rows-[0fr]" : "grid-rows-[1fr]",
          )}
        >
          <div
            id={panelId}
            inert={collapsed || undefined}
            className={clsx(
              "min-h-0 overflow-hidden",
              // overflow clips to the padding box, so the section's px-4 is
              // re-created here; without it every `-mx-*` rail inside would
              // lose its bleed the moment the section became collapsible.
              !bleed && "-mx-4 px-4",
            )}
          >
            {children}
          </div>
        </div>
      ) : (
        children
      )}
    </section>
  );
}

/** The trailing "see all" link, identical across sections. */
export function SectionLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      // Stops a click from ever bubbling into a collapsible section's header.
      onClick={(e) => e.stopPropagation()}
      className="shrink-0 font-sans text-[11px] font-semibold text-gold hover:underline"
    >
      {children}
    </a>
  );
}

/** Horizontal rail that bleeds to the column edges. */
export function Rail({ children }: { children: React.ReactNode }) {
  return (
    <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {children}
    </div>
  );
}
