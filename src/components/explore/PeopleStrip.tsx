"use client";

import type { ProfileBadge } from "@/components/ui/UserBadges";

import Link from "next/link";
import { useT } from "@/i18n/client";
import { SafeAvatar } from "@/components/ui/SafeAvatar";
import { UserBadges } from "@/components/ui/UserBadges";
import type { UserSuggestion } from "@/store/suggestions.atom";
import { ExploreSection } from "./ExploreSection";

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

  if (!loading && shown.length === 0) return null;

  return (
    <ExploreSection label={t("explore.section.people")} delay={delay}>
      <div className="-mx-2 flex flex-col">
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
          : shown.map((u) => {
              const name =
                u.firstName || u.lastName
                  ? `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim()
                  : u.username;
              return (
                <div
                  key={u._id}
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
                      <span className="truncate font-sans text-[14px] font-semibold text-primary hover:underline">
                        {name}
                      </span>
                      {u.isVerified && (
                        <UserBadges isVerified badges={u.badges} size={13} />
                      )}
                    </span>
                    <span className="block truncate font-sans text-[12.5px] text-subtle">
                      @{u.username}
                    </span>
                  </Link>
                  <button
                    type="button"
                    onClick={() => onFollow(u._id)}
                    className="h-8 shrink-0 cursor-pointer rounded-pill bg-primary px-4 font-sans text-[13px] font-semibold text-page transition-colors hover:bg-muted"
                  >
                    {t("rail.follow")}
                  </button>
                </div>
              );
            })}
      </div>
    </ExploreSection>
  );
}
