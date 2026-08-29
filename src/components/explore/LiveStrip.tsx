"use client";

import Link from "next/link";
import { useLiveNow } from "@/hooks/useLiveNow";
import { useT } from "@/i18n/client";
import { SafeAvatar } from "@/components/ui/SafeAvatar";
import { StageAvatar } from "@/components/live/StageAvatar";
import { ExploreSection, Rail } from "./ExploreSection";

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
          : entries.map((row) => (
              <Link
                key={row.id}
                href={`/live?tab=live&s=${row.id}`}
                className="flex w-[68px] shrink-0 flex-col items-center gap-1.5"
                title={row.title}
              >
                <span className="relative block h-16 w-16 rounded-pill p-[3px] ring-2 ring-danger">
                  <span className="relative block h-full w-full overflow-hidden rounded-pill bg-sunken">
                    <StageAvatar avatar={row.avatar} stage={(row as any).stage} />
                  </span>
                  {/* The badge doubles as the live dot — a red ring alone
                      reads as "unseen" on a surface that also has story
                      rings, so the word stays. */}
                  <span className="absolute -bottom-1 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-[4px] bg-danger px-1.5 py-px font-sans text-[9px] font-bold tracking-wide text-white">
                    <span className="h-1 w-1 animate-pulse rounded-pill bg-white" />
                    {t("live.badge")}
                  </span>
                </span>
                <span className="block w-full truncate text-center font-sans text-[12px] font-medium text-muted">
                  @{row.username}
                </span>
              </Link>
            ))}
      </Rail>
    </ExploreSection>
  );
}
