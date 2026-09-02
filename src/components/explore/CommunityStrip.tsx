"use client";

import { formatCompact } from "@/lib/utils";
import Link from "next/link";
import { useT } from "@/i18n/client";
import { ExploreSection, SectionLink } from "./ExploreSection";
import { SafeAvatar } from "@/components/ui/SafeAvatar";

export interface CommunityRow {
  id: string;
  name: string;
  slug: string;
  description?: string;
  category: string;
  avatar?: string;
  membersCount: number;
  joined: boolean;
}

/**
 * Up to four communities the viewer has not joined.
 *
 * There is no "suggested" endpoint yet, so this filters the full list client
 * side. Fine at current scale; past a few hundred rows it wants ?suggested=1.
 */
export function CommunityStrip({
  communities,
  loading,
  onJoin,
  delay,
}: {
  communities: CommunityRow[];
  loading: boolean;
  onJoin: (row: CommunityRow) => void;
  delay: number;
}) {
  const t = useT();
  const open = communities.filter((c) => !c.joined).slice(0, 4);

  if (!loading && open.length === 0) return null;

  return (
    <ExploreSection
      label={t("explore.section.communities")}
      delay={delay}
      trailing={<SectionLink href="/communities">{t("rail.seeAll")}</SectionLink>}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {loading
          ? [0, 1].map((i) => <div key={i} className="card-depth skeleton h-28" />)
          : open.map((row) => (
              <div key={row.id} className="card-depth flex gap-3 p-4">
                <Link
                  href={`/communities/${row.slug}`}
                  className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl bg-raised"
                >
                  {row.avatar ? (
                    <SafeAvatar src={row.avatar} className="object-cover" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center font-display text-[17px] font-semibold text-gold">
                      {row.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                </Link>

                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <Link
                    href={`/communities/${row.slug}`}
                    className="truncate font-sans text-[15px] font-semibold text-primary hover:underline"
                  >
                    {row.name}
                  </Link>
                  <span className="font-sans text-[11px] font-semibold uppercase tracking-wider text-subtle">
                    <span className="tabular-nums">{formatCompact(row.membersCount)}</span>{" "}
                    {t("community.members")}
                  </span>
                  {row.description && (
                    <p className="line-clamp-2 font-sans text-[13px] leading-snug text-muted">
                      {row.description}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => onJoin(row)}
                    className="mt-1 h-8 cursor-pointer self-start rounded-pill bg-primary px-3.5 font-sans text-[12px] font-semibold text-page transition-colors hover:bg-muted"
                  >
                    {t("community.join")}
                  </button>
                </div>
              </div>
            ))}
      </div>
    </ExploreSection>
  );
}
