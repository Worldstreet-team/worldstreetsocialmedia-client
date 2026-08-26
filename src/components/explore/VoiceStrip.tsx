"use client";

import { useRouter } from "next/navigation";
import { useT } from "@/i18n/client";
import {
  LiveSpaceCard,
  UpcomingSpaceRow,
  type SpaceRow,
} from "@/components/voice/SpaceCard";
import { ExploreSection, SectionLink } from "./ExploreSection";

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
        <>
          {live.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2">
              {live.slice(0, 2).map((row) => (
                <LiveSpaceCard key={row.id} row={row} onOpen={open} />
              ))}
            </div>
          )}
          {upcoming.length > 0 && (
            <div className="mt-2.5 flex flex-col gap-2.5">
              {upcoming.slice(0, 2).map((row) => (
                <UpcomingSpaceRow
                  key={row.id}
                  row={row}
                  onRemind={onRemind}
                  onStart={open}
                />
              ))}
            </div>
          )}
        </>
      )}
    </ExploreSection>
  );
}
