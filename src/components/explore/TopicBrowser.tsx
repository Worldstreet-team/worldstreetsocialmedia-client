"use client";

import { useId, useState } from "react";
import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { CATEGORIES, VERTICALS } from "@/data/categories";
import { VERTICAL_ICON } from "@/data/verticalIcons";
import { useT } from "@/i18n/client";
import { ExploreSection } from "./ExploreSection";
import {
  press,
  staggerItem,
  staggerParentFast,
  swap,
  thumbSpring,
} from "@/lib/motion-presets";

/**
 * The taxonomy's first browse surface. Pick a vertical, get its categories.
 *
 * A chip sets the search query rather than routing to a topic page, so browse
 * and search share one code path and no new endpoint is needed.
 *
 * Sensitive categories are excluded. They are opt-in by contract, and a browse
 * grid is not opting in.
 */
export function TopicBrowser({
  onPick,
  delay,
}: {
  onPick: (label: string) => void;
  delay: number;
}) {
  const t = useT();
  const [vertical, setVertical] = useState("markets");
  // Per instance, so a second browser on the page never steals the thumb.
  const thumbId = useId();
  const active = VERTICALS.find((v) => v.id === vertical);

  return (
    <ExploreSection
      label={t("explore.section.topics")}
      delay={delay}
      collapsible
      sectionId="topics"
    >
      {/* layoutScroll: the row scrolls sideways, and the thumb has to be
          measured inside that scroll or it slides from the wrong place. */}
      <motion.div
        layoutScroll
        className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {VERTICALS.map((v) => {
          const Icon = VERTICAL_ICON[v.id];
          const on = vertical === v.id;
          return (
            <button
              key={v.id}
              type="button"
              onClick={() => setVertical(v.id)}
              aria-pressed={on}
              className={clsx(
                "relative flex h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-pill bg-raised px-3.5 font-sans text-[calc(13px*var(--ws-fs))] transition-colors",
                on
                  ? "font-semibold text-page"
                  : "font-medium text-muted hover:text-primary",
              )}
            >
              {/* One fill that slides between chips, not a background each
                  chip switches on. */}
              {on && (
                <motion.span
                  aria-hidden
                  layoutId={thumbId}
                  transition={thumbSpring}
                  className="absolute inset-0 rounded-pill bg-primary"
                />
              )}
              <span className="relative flex items-center gap-1.5">
                {Icon && <Icon size={15} weight={on ? "fill" : "duotone"} />}
                {v.label}
              </span>
            </button>
          );
        })}
      </motion.div>

      <AnimatePresence mode="wait" initial={false}>
        {active && (
          <motion.p
            key={active.id}
            {...swap}
            className="mt-2.5 font-sans text-[calc(12.5px*var(--ws-fs))] leading-relaxed text-muted"
          >
            {active.blurb}
          </motion.p>
        )}
      </AnimatePresence>

      {/* Two-row horizontal rail, not a wrapping stack: with up to 11
          categories a wrap grid grows four rows deep and pushes Popular off
          screen. grid-flow-col fills columns top-to-bottom so the rail reads
          as slides; snap keeps a swipe landing on a whole chip. */}
      {/* Re-keyed per vertical, so picking one deals its chips in. The
          fast parent keeps eleven chips inside the cascade budget. */}
      <motion.div
        key={vertical}
        variants={staggerParentFast}
        initial="hidden"
        animate="show"
        className="-mx-4 mt-3 grid auto-cols-max grid-flow-col grid-rows-2 gap-2 overflow-x-auto px-4 pb-1 snap-x [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {CATEGORIES.filter((c) => c.vertical === vertical && !c.sensitive).map((c) => (
          <motion.button
            key={c.id}
            type="button"
            variants={staggerItem}
            {...press}
            // The gateway's post search is a literal regex over content — the
            // display label ("Stocks & Equities") appears in no post, so a
            // click searches the category's strongest keyword instead.
            onClick={() => onPick(c.keywords[0] ?? c.label)}
            className="flex h-10 shrink-0 cursor-pointer snap-start items-center rounded-pill bg-raised px-3.5 font-sans text-[calc(12.5px*var(--ws-fs))] font-medium text-muted transition-colors hover:bg-chip hover:text-primary"
          >
            {c.label}
          </motion.button>
        ))}
      </motion.div>
    </ExploreSection>
  );
}
