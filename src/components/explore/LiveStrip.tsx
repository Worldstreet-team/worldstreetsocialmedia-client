"use client";

import Link from "next/link";
import { Eye } from "@phosphor-icons/react";
import { useLiveNow } from "@/hooks/useLiveNow";
import { useT } from "@/i18n/client";
import { SafeAvatar } from "@/components/ui/SafeAvatar";
import { spaceCanvas } from "@/components/voice/SpaceCard";
import { storyCanvasCss } from "@/lib/editor/storyBackgrounds";
import { ExploreSection, Rail, SectionLink } from "./ExploreSection";

/**
 * Who is broadcasting, right now. Ably-backed via useLiveNow, so a stream
 * that ends leaves the rail without a refresh.
 *
 * The stream list carries no thumbnail, so cards use the same deterministic
 * mesh the voice rooms use rather than an empty grey box.
 */
export function LiveStrip({ delay }: { delay: number }) {
  const t = useT();
  const { entries, loaded } = useLiveNow();

  if (loaded && entries.length === 0) return null;

  return (
    <ExploreSection
      label={t("explore.section.live")}
      live
      delay={delay}
      trailing={<SectionLink href="/live-now">{t("rail.seeAll")}</SectionLink>}
    >
      <Rail>
        {!loaded
          ? [0, 1, 2].map((i) => (
              <div key={i} className="skeleton h-[124px] w-[188px] shrink-0 rounded-xl" />
            ))
          : entries.map((row) => (
              <Link
                key={row.id}
                href={`/live?tab=live&s=${row.id}`}
                className="group relative flex h-[124px] w-[188px] shrink-0 flex-col justify-between overflow-hidden rounded-xl p-3"
                style={{ background: storyCanvasCss(spaceCanvas(row.id)) }}
              >
                <span className="absolute inset-0 bg-gradient-to-t from-[#0c0a09]/85 via-[#0c0a09]/25 to-[#0c0a09]/30 transition-colors group-hover:via-[#0c0a09]/15" />

                <span className="relative flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1 rounded-[4px] bg-danger px-1.5 py-px font-sans text-[9px] font-bold tracking-wide text-white">
                    <span className="h-1 w-1 animate-pulse rounded-pill bg-white" />
                    {t("live.badge")}
                  </span>
                  <span className="flex items-center gap-1 font-sans text-[11px] font-semibold tabular-nums text-[#fafaf9]/85">
                    <Eye size={12} weight="bold" />
                    {row.viewers}
                  </span>
                </span>

                <span className="relative block min-w-0">
                  <span className="block truncate font-sans text-[13px] font-semibold text-[#fafaf9]">
                    {row.title}
                  </span>
                  <span className="mt-1 flex items-center gap-1.5">
                    <span className="relative h-5 w-5 shrink-0 overflow-hidden rounded-pill bg-[#1c1917]">
                      <SafeAvatar src={row.avatar} />
                    </span>
                    <span className="truncate font-sans text-[11.5px] text-[#fafaf9]/75">
                      @{row.username}
                    </span>
                  </span>
                </span>
              </Link>
            ))}
      </Rail>
    </ExploreSection>
  );
}
