"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useT } from "@/i18n/client";
import {
  LiveSpaceCard,
  UpcomingSpaceRow,
  type SpaceRow,
} from "@/components/voice/SpaceCard";
import { ExploreSection, SectionLink } from "./ExploreSection";
import { staggerItem, staggerParent } from "@/lib/motion-presets";

/**
 * Live and scheduled rooms. Explore is a directory, so opening a card routes
 * to /voice rather than mounting the room here.
 */
export function VoiceStrip({
  live,
  upcoming,
  loading,
  onRemind,
  delay,
}: {
  live: SpaceRow[];
  upcoming: SpaceRow[];
  loading: boolean;
  onRemind: (row: SpaceRow) => void;
  delay: number;
}) {
  const t = useT();
  const router = useRouter();
  const open = () => router.push("/voice");

  if (!loading && live.length === 0 && upcoming.length === 0) return null;

  return (
    <ExploreSection
      label={t("explore.section.voice")}
      live={live.length > 0}
      delay={delay}
      trailing={<SectionLink href="/voice">{t("rail.seeAll")}</SectionLink>}
    >
      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {[0, 1].map((i) => (
            <div key={i} className="skeleton h-[168px] rounded-xl" />
          ))}
        </div>
      ) : (
        // One tree for cards and rows, four items at most, so the skeleton
        // hands over in a single short cascade.
        <motion.div variants={staggerParent} initial="hidden" animate="show">
          {live.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2">
              {live.slice(0, 2).map((row) => (
                <motion.div key={row.id} variants={staggerItem}>
                  <LiveSpaceCard row={row} onOpen={open} />
                </motion.div>
              ))}
            </div>
          )}
          {upcoming.length > 0 && (
            <div className="mt-2.5 flex flex-col gap-2.5">
              {upcoming.slice(0, 2).map((row) => (
                <motion.div key={row.id} variants={staggerItem}>
                  <UpcomingSpaceRow
                    row={row}
                    onRemind={onRemind}
                    onStart={open}
                  />
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      )}
    </ExploreSection>
  );
}
