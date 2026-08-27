"use client";

import { SafeAvatar } from "@/components/ui/SafeAvatar";
import { useT } from "@/i18n/client";
import { resolveCategoryLabel } from "@/lib/categories";
import type { TrendingTopic } from "@/store/trends.atom";
import { ExploreSection } from "./ExploreSection";

/**
 * Ranked trends. Rows are buttons, not links: they drive the search box on
 * this page rather than navigating, so the rank number stays meaningful.
 */
export function TrendingList({
  trends,
  loading,
  failed,
  onRetry,
  onPick,
  delay,
}: {
  trends: TrendingTopic[];
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
  onPick: (title: string) => void;
  delay: number;
}) {
  const t = useT();

  return (
    <ExploreSection
      label={t("explore.section.trending")}
      delay={delay}
      collapsible
      sectionId="trending"
      trailing={
        <span className="shrink-0 font-sans text-[10px] font-semibold uppercase tracking-wider text-gold">
          {t("rail.scope")}
        </span>
      }
    >
      {loading ? (
        <div className="-mx-2 flex flex-col">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="px-2 py-2.5">
              <div className="skeleton mb-1.5 h-3 w-16 rounded-sm" />
              <div className="skeleton h-4 w-3/4 rounded-sm" />
            </div>
          ))}
        </div>
      ) : failed ? (
        <button
          type="button"
          onClick={onRetry}
          className="mx-2 my-2 cursor-pointer rounded-pill bg-raised px-3 py-2 font-sans text-sm text-primary transition-colors hover:bg-chip"
        >
          {t("rail.retry")}
        </button>
      ) : trends.length === 0 ? (
        <p className="px-2 py-3 font-sans text-sm text-subtle">{t("rail.noTrends")}</p>
      ) : (
        <div className="-mx-2 flex flex-col">
          {trends.slice(0, 8).map((trend, i) => {
            const title = trend.title.replace(/^#/, "");
            return (
              <button
                key={trend.title}
                type="button"
                onClick={() => onPick(title)}
                className="flex w-full cursor-pointer items-start gap-3.5 rounded-xl px-2 py-2.5 text-left transition-colors hover:bg-surface"
              >
                <span className="select-none pt-0.5 font-mono text-[13px] tabular-nums text-gold">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-sans text-[15px] font-semibold leading-snug text-primary">
                    {title}
                  </span>
                  <span className="font-sans text-[12px] tabular-nums text-subtle">
                    {trend.category ? `${resolveCategoryLabel(trend.category)} · ` : ""}
                    {trend.posts}
                  </span>
                </span>

                {/* Who is posting into this tag: five faces, then the rest as
                    a count. Same treatment as the rail. */}
                {trend.people && trend.people.length > 0 && (
                  <span className="flex shrink-0 items-center self-center pl-1">
                    {trend.people.slice(0, 5).map((person, pi) => (
                      <span
                        key={person.username}
                        title={`@${person.username}`}
                        className="relative -ml-2 h-6 w-6 shrink-0 overflow-hidden rounded-pill bg-raised ring-2 ring-page first:ml-0"
                        style={{ zIndex: 5 - pi }}
                      >
                        <SafeAvatar src={person.avatar} />
                      </span>
                    ))}
                    {(trend.peopleCount ?? 0) > 5 && (
                      <span className="relative -ml-2 flex h-6 shrink-0 items-center rounded-pill bg-raised px-1.5 font-sans text-[10px] font-bold tabular-nums text-muted ring-2 ring-page">
                        +{(trend.peopleCount ?? 0) - 5}
                      </span>
                    )}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </ExploreSection>
  );
}
