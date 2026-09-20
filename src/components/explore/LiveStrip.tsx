"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useLiveNow } from "@/hooks/useLiveNow";
import { useT } from "@/i18n/client";
import { SafeAvatar } from "@/components/ui/SafeAvatar";
import { StageAvatar } from "@/components/live/StageAvatar";
import { ExploreSection, Rail } from "./ExploreSection";
import { staggerItem, staggerParent, staggerPop } from "@/lib/motion-presets";

/**
 * Who is broadcasting, right now. Ably-backed via useLiveNow, so a stream
 * that ends leaves the rail without a refresh.
 *
 * Rings, not cards (owner ruling 2026-08-27): the same grammar as the stories
 * rail, because it is the same promise — a face, a ring that means "now", one
 * tap in. The stream list carries no thumbnail, so a card was showing a
 * generated mesh instead of the broadcast; a ring shows the broadcaster, which
 * is the part that was ever real. No "see all" — the ring row IS the list.
 */
export function LiveStrip({ delay }: { delay: number }) {
  const t = useT();
  const { entries, loaded } = useLiveNow();

  if (loaded && entries.length === 0) return null;

  return (
    <ExploreSection label={t("explore.section.live")} live delay={delay}>
      <Rail>
        {!loaded
          ? [0, 1, 2].map((i) => (
              <div key={i} className="flex w-[68px] shrink-0 flex-col items-center gap-1.5">
                <div className="skeleton h-16 w-16 rounded-pill" />
                <div className="skeleton h-3 w-12 rounded-sm" />
              </div>
            ))
          : (
            // `contents` keeps the rings as the rail's own flex children. A
            // ring that goes live later mounts into a settled tree and rises
            // by itself, so the cascade only ever plays once.
            <motion.div
              className="contents"
              variants={staggerParent}
              initial="hidden"
              animate="show"
            >
            {entries.map((row) => (
              <motion.div key={row.id} variants={staggerItem} className="shrink-0">
              <Link
                href={`/live?tab=live&s=${row.id}`}
                className="flex w-[68px] flex-col items-center gap-1.5"
                title={row.title}
              >
                <span className="relative block h-16 w-16 rounded-pill p-[3px] ring-2 ring-danger">
                  <StageAvatar
                    avatar={row.avatar}
                    stage={(row as any).stage}
                    innerClassName="bg-sunken"
                  />
                  {/* The badge doubles as the live dot — a red ring alone
                      reads as "unseen" on a surface that also has story
                      rings, so the word stays. */}
                  <motion.span
                    variants={staggerPop}
                    className="absolute -bottom-1 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-[4px] bg-danger px-1.5 py-px font-sans text-[calc(9px*var(--ws-fs))] font-bold tracking-wide text-white"
                  >
                    <span className="h-1 w-1 animate-pulse rounded-pill bg-white" />
                    {t("live.badge")}
                  </motion.span>
                </span>
                <span className="block w-full truncate text-center font-sans text-[calc(12px*var(--ws-fs))] font-medium text-muted">
                  @{row.username}
                </span>
              </Link>
              </motion.div>
            ))}
            </motion.div>
          )}
      </Rail>
    </ExploreSection>
  );
}
