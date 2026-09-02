"use client";

import { formatCompact } from "@/lib/utils";
import Link from "next/link";
import { Heart, Play } from "@phosphor-icons/react";
import { useT } from "@/i18n/client";
import { ExploreSection, SectionLink } from "./ExploreSection";

export interface StreetPost {
  _id: string;
  videos?: string[];
  stats?: { likes?: number };
}

/**
 * Six vertical video tiles into The Space.
 *
 * The feed returns no poster frame, so each tile seeks its own video to 0.1s
 * with preload="metadata" to get one. Never autoplay: six decoding videos on
 * a discovery page is not worth the frame.
 */
export function StreetGrid({
  posts,
  loading,
  delay,
}: {
  posts: StreetPost[];
  loading: boolean;
  delay: number;
}) {
  const t = useT();
  const withVideo = posts.filter((p) => p.videos?.[0]).slice(0, 6);

  if (!loading && withVideo.length === 0) return null;

  return (
    <ExploreSection
      label={t("explore.section.street")}
      delay={delay}
      trailing={<SectionLink href="/live">{t("rail.seeAll")}</SectionLink>}
    >
      <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
        {loading
          ? [0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="skeleton aspect-[9/16] rounded-lg" />
            ))
          : withVideo.map((p) => (
              <Link
                key={p._id}
                href={`/live?v=${p._id}`}
                className="group relative block aspect-[9/16] overflow-hidden rounded-lg bg-raised"
              >
                <video
                  src={`${p.videos?.[0]}#t=0.1`}
                  muted
                  playsInline
                  preload="metadata"
                  className="h-full w-full object-cover"
                />
                <span className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
                  <Play size={22} weight="fill" className="text-[#fafaf9] drop-shadow" />
                </span>
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#0c0a09]/85 to-transparent px-2 pb-1.5 pt-6">
                  <span className="flex items-center gap-1 font-sans text-[11px] font-semibold tabular-nums text-[#fafaf9]">
                    <Heart size={11} weight="fill" />
                    {formatCompact(p.stats?.likes ?? 0)}
                  </span>
                </span>
              </Link>
            ))}
      </div>
    </ExploreSection>
  );
}
