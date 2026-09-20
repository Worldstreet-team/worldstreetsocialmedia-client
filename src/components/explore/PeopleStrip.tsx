"use client";

import type { ProfileBadge } from "@/components/ui/UserBadges";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useT } from "@/i18n/client";
import { SafeAvatar } from "@/components/ui/SafeAvatar";
import { UserBadges } from "@/components/ui/UserBadges";
import type { UserSuggestion } from "@/store/suggestions.atom";
import { ExploreSection } from "./ExploreSection";
import {
  press,
  snappySpring,
  staggerItem,
  staggerParent,
} from "@/lib/motion-presets";

/**
 * Follow suggestions, minus anyone already followed this session.
 *
 * Follow is bg-primary, never gold: it is a repeated action, and gold is
 * reserved for the one CTA per surface.
 */
export function PeopleStrip({
  people,
  loading,
  onFollow,
  delay,
}: {
  people: (UserSuggestion & { isVerified?: boolean; badges?: ProfileBadge[] })[];
  loading: boolean;
  onFollow: (id: string) => void;
  delay: number;
}) {
  const t = useT();
  const shown = people.slice(0, 4);

  // Rows only re-measure when the set of people changes. Without this, a
  // strip loading above would send these gliding down the page after it.
  const layoutKey = shown.map((u) => u._id).join();

  if (!loading && shown.length === 0) return null;

  return (
    <ExploreSection
      label={t("explore.section.people")}
      delay={delay}
      collapsible
      sectionId="people"
    >
      <div className="relative -mx-2 flex flex-col">
        {loading
          ? [0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-3 px-2 py-2.5">
                <div className="skeleton h-10 w-10 shrink-0 rounded-pill" />
                <div className="flex-1">
                  <div className="skeleton mb-1.5 h-3.5 w-28 rounded-sm" />
                  <div className="skeleton h-3 w-20 rounded-sm" />
                </div>
              </div>
            ))
          : (
            // Cascade once when suggestions land. A followed row fades out,
            // the rest close the gap, and its replacement rises alone.
            <motion.div
              className="contents"
              variants={staggerParent}
              initial="hidden"
              animate="show"
            >
            {/* popLayout, not the default: the rows only measure on the
                render where the id set changes, so the leaving row has to
                be out of the flow on that same render or the rest snap. */}
            <AnimatePresence mode="popLayout">
            {shown.map((u) => {
              const name =
                u.firstName || u.lastName
                  ? `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim()
                  : u.username;
              return (
                <motion.div
                  key={u._id}
                  layout
                  layoutDependency={layoutKey}
                  variants={staggerItem}
                  // An object, not the "exit" label: a label would make the
                  // row its own variant root and drop it from the cascade.
                  exit={staggerItem.exit}
                  transition={{ layout: snappySpring }}
                  className="flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-surface"
                >
                  <Link
                    href={`/profile/${u.username}`}
                    className="relative h-10 w-10 shrink-0 overflow-hidden rounded-pill bg-raised"
                  >
                    <SafeAvatar src={u.avatar} />
                  </Link>
                  <Link href={`/profile/${u.username}`} className="min-w-0 flex-1">
                    <span className="flex items-center gap-1">
                      <span className="truncate font-sans text-[calc(14px*var(--ws-fs))] font-semibold text-primary hover:underline">
                        {name}
                      </span>
                      <UserBadges
                        isVerified={u.isVerified}
                        verification={(u as any).verification}
                        badges={u.badges}
                        size={13}
                      />
                    </span>
                    <span className="block truncate font-sans text-[calc(12.5px*var(--ws-fs))] text-subtle">
                      @{u.username}
                    </span>
                  </Link>
                  <motion.button
                    type="button"
                    onClick={() => onFollow(u._id)}
                    {...press}
                    className="h-8 shrink-0 cursor-pointer rounded-pill bg-primary px-4 font-sans text-[calc(13px*var(--ws-fs))] font-semibold text-page transition-colors hover:bg-muted"
                  >
                    {t("rail.follow")}
                  </motion.button>
                </motion.div>
              );
            })}
            </AnimatePresence>
            </motion.div>
          )}
      </div>
    </ExploreSection>
  );
}
