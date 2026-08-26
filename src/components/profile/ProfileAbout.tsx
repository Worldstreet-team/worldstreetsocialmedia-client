"use client";

import Link from "next/link";
import Image from "next/image";
import { Calendar, Link as LinkIcon, MapPin } from "lucide-react";
import { renderRichText } from "@/components/ui/RichText";
import {
  UserBadges,
  type ProfileBadge,
} from "@/components/ui/UserBadges";
import { resolveCategories } from "@/lib/categories";
import { useT } from "@/i18n/client";

export interface CommunityChip {
  id: string;
  name: string;
  slug: string;
  avatar?: string;
}

/**
 * Identity, bio, metadata, and the two things that were fetched but never
 * shown: the topics this person follows and the communities they are in.
 * Both are what the ranking algorithm personalizes on, so a profile that
 * hides them hides the most useful thing on the page.
 */
export function ProfileAbout({
  fullName,
  username,
  isVerified,
  badges,
  bio,
  location,
  website,
  createdAt,
  interests,
  communities,
  followsYou,
  followingCount,
  followersCount,
  onOpenFollows,
  onEditTopics,
  isMe,
}: {
  fullName: string;
  username: string;
  isVerified?: boolean;
  badges?: ProfileBadge[];
  bio?: string;
  location?: string;
  website?: string;
  createdAt?: string;
  interests?: string[];
  communities: CommunityChip[];
  followsYou?: boolean;
  followingCount: number;
  followersCount: number;
  onOpenFollows: (tab: "followers" | "following") => void;
  onEditTopics: () => void;
  isMe: boolean;
}) {
  const t = useT();
  const topics = resolveCategories(interests, 8);

  const joined = new Date(createdAt || Date.now()).toLocaleDateString(t.locale, {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="mt-6 flex flex-col gap-3 px-4">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="flex min-w-0 items-center gap-1.5 font-display text-xl font-semibold leading-6 text-primary">
            <span className="truncate">{fullName}</span>
            {/* This was declared as a prop and never rendered, so the one
                place a person's marks matter most showed none of them. */}
            <UserBadges isVerified={isVerified} badges={badges} size={16} />
          </h2>
          {followsYou && (
            <span className="shrink-0 rounded-[4px] bg-raised px-1.5 py-px font-sans text-[10px] font-semibold uppercase tracking-wide text-muted">
              {t("profile.followsYou")}
            </span>
          )}
        </div>
        <div className="truncate font-sans text-sm text-muted">@{username}</div>
      </div>

      {/* break-words: one long unbroken token (a URL, a wallet address) used to
          push the whole column past the viewport. */}
      <div className="break-words font-sans text-[15px] leading-relaxed text-primary">
        {bio ? renderRichText(bio) : <span className="text-subtle">{t("profile.noBio")}</span>}
      </div>

      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-2 font-sans text-[14px] text-muted">
        {location && (
          <span className="flex items-center gap-1">
            <MapPin className="h-4 w-4" />
            {location}
          </span>
        )}
        {website && (
          <span className="flex items-center gap-1">
            <LinkIcon className="h-4 w-4" />
            <a
              href={website.startsWith("http") ? website : `https://${website}`}
              target="_blank"
              rel="noopener noreferrer"
              className="break-all text-gold hover:underline"
            >
              {website.replace(/^https?:\/\//, "")}
            </a>
          </span>
        )}
        <span className="flex items-center gap-1">
          <Calendar className="h-4 w-4" />
          {t("profile.joined")} {joined}
        </span>
      </div>

      <div className="mt-1 flex gap-5 font-sans text-[15px]">
        <button
          type="button"
          onClick={() => onOpenFollows("following")}
          className="flex cursor-pointer items-baseline gap-1 border-none bg-transparent p-0 hover:underline"
        >
          <span className="font-semibold tabular-nums text-primary">
            {followingCount.toLocaleString()}
          </span>
          <span className="text-muted">{t("profile.following")}</span>
        </button>
        <button
          type="button"
          onClick={() => onOpenFollows("followers")}
          className="flex cursor-pointer items-baseline gap-1 border-none bg-transparent p-0 hover:underline"
        >
          <span className="font-semibold tabular-nums text-primary">
            {followersCount.toLocaleString()}
          </span>
          <span className="text-muted">{t("profile.followers")}</span>
        </button>
      </div>

      {(topics.length > 0 || isMe) && (
        <div className="mt-2">
          <div className="mb-2 flex items-center gap-2">
            <h3 className="flex-1 font-sans text-[11px] font-semibold uppercase tracking-[0.14em] text-subtle">
              {t("profile.topics")}
            </h3>
            {isMe && (
              <button
                type="button"
                onClick={onEditTopics}
                className="shrink-0 cursor-pointer font-sans text-[11px] font-semibold text-gold hover:underline"
              >
                {t("profile.editTopics")}
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {topics.map((c) => (
              <Link
                key={c.id}
                href={`/explore?q=${encodeURIComponent(c.label)}`}
                className="flex h-8 items-center rounded-pill bg-raised px-3 font-sans text-[12.5px] font-medium text-muted transition-colors hover:bg-chip hover:text-primary"
              >
                {c.label}
              </Link>
            ))}
          </div>
        </div>
      )}

      {communities.length > 0 && (
        <div className="mt-2">
          <h3 className="mb-2 font-sans text-[11px] font-semibold uppercase tracking-[0.14em] text-subtle">
            {t("profile.communities")}
          </h3>
          <div className="flex flex-wrap gap-2">
            {communities.slice(0, 6).map((c) => (
              <Link
                key={c.id}
                href={`/communities/${c.slug}`}
                className="flex h-8 items-center gap-1.5 rounded-pill bg-raised pl-1 pr-3 font-sans text-[12.5px] font-medium text-muted transition-colors hover:bg-chip hover:text-primary"
              >
                <span className="relative h-6 w-6 shrink-0 overflow-hidden rounded-pill bg-page">
                  {c.avatar ? (
                    <Image src={c.avatar} alt="" fill sizes="24px" className="object-cover" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center font-display text-[11px] font-semibold text-gold">
                      {c.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                </span>
                {c.name}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
