"use client";

import clsx from "clsx";
import { motion } from "framer-motion";
import { useAtom } from "jotai";
import { feedTabAtom } from "@/store/ui.atom";

const TABS = [
  { key: "foryou", label: "For You" },
  { key: "following", label: "Following" },
] as const;

/**
 * Feed header tabs, spec Tab style: full-height hit area, 2px gold underline
 * that slides between tabs (motion-base, the one easing). Hover lightens one
 * ladder step — no scale.
 */
export function FeedTabs() {
  const [tab, setTab] = useAtom(feedTabAtom);

  return (
    <div role="tablist" aria-label="Timeline" className="flex h-full w-full">
      {TABS.map(({ key, label }) => {
        const active = tab === key;
        return (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => setTab(key)}
            className={clsx(
              "relative flex-1 h-full flex items-center justify-center font-sans text-sm transition-colors cursor-pointer hover:bg-raised/40",
              active
                ? "font-semibold text-primary"
                : "font-medium text-muted hover:text-primary",
            )}
          >
            {label}
            {active && (
              <motion.span
                layoutId="feed-tab-underline"
                transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
                className="absolute bottom-0 h-0.5 w-14 rounded-pill bg-brand"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
