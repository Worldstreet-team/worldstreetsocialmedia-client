"use client";

import { useState } from "react";
import { formatCompact } from "@/lib/utils";
import Link from "next/link";
import { Calendar, Link as LinkIcon, MapPin } from "lucide-react";
import { renderRichText } from "@/components/ui/RichText";
import {
  UserBadges,
  type ProfileBadge,
} from "@/components/ui/UserBadges";
import { AdSlot } from "@/components/profile/AdSlot";
import { useT } from "@/i18n/client";
import { SafeAvatar } from "@/components/ui/SafeAvatar";

export interface CommunityChip {
  id: string;
  name: string;
  slug: string;
  avatar?: string;
}

const BIO_TRUNCATE_LENGTH = 160;

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
  profileId,
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
  /** Mongo id of the profile being viewed — the ad slot is keyed on it. */
  profileId?: string;
}) {
  const t = useT();
  const [isBioExpanded, setIsBioExpanded] = useState(false);
  const bioTruncated = (bio?.length ?? 0) > BIO_TRUNCATE_LENGTH;

  const joined = new Date(createdAt || Date.now()).toLocaleDateString(t.locale, {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="mt-6 flex flex-col gap-3 px-4">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="flex min-w-0 items-center gap-1.5 font-display text-[26px] font-semibold leading-8 text-primary">
            <span className="truncate">{fullName}</span>
            {/* This was declared as a prop and never rendered, so the one
                place a person's marks matter most showed none of them. */}
            <UserBadges isVerified={isVerified} badges={badges} size={20} />
          </h2>
          {followsYou && (
            <span className="shrink-0 rounded-[4px] bg-raised px-1.5 py-px font-sans text-[10px] font-semibold uppercase tracking-wide text-muted">
              {t("profile.followsYou")}
            </span>
          )}
        </div>
        <div className="truncate font-sans text-[17px] text-muted">@{username}</div>
      </div>

      {/* break-words: one long unbroken token (a URL, a wallet address) used to
          push the whole column past the viewport. */}
      <div className="break-words font-sans text-[19px] leading-relaxed text-primary">
        {bio ? (
          <>
            {renderRichText(
              isBioExpanded || !bioTruncated
                ? bio
                : `${bio.slice(0, BIO_TRUNCATE_LENGTH)}...`,
            )}
            {bioTruncated && (
              <button
                type="button"
                onClick={() => setIsBioExpanded((prev) => !prev)}
                className="block font-medium text-gold hover:underline"
              >
                {isBioExpanded ? t("profile.bioSeeLess") : t("profile.bioSeeMore")}
              </button>
            )}
          </>
        ) : (
          <span className="text-subtle">{t("profile.noBio")}</span>
        )}
      </div>

      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-2 font-sans text-[17px] text-muted">
        {location && (
          <span className="flex items-center gap-1">
            <MapPin className="h-[18px] w-[18px]" />
            {location}
          </span>
        )}
        {website && (
          <span className="flex items-center gap-1">
            <LinkIcon className="h-[18px] w-[18px]" />
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
          <Calendar className="h-[18px] w-[18px]" />
          {t("profile.joined")} {joined}
        </span>
      </div>

      {/* Allies first. It is the count people look for, and the follows modal
          opens its tabs in this same order — a profile that reads
          Allies-then-Aligned while the modal reads the reverse makes the
          reader re-find their place every time. */}
      <div className="mt-1 flex gap-6 font-sans text-[16px]">
        <button
          type="button"
          onClick={() => onOpenFollows("followers")}
          className="flex cursor-pointer items-baseline gap-1 border-none bg-transparent p-0 hover:underline"
        >
          <span className="text-[18px] font-bold tabular-nums text-primary">
            {formatCompact(followersCount)}
          </span>
          <span className="text-muted">{t("profile.followers")}</span>
        </button>
        <button
          type="button"
          onClick={() => onOpenFollows("following")}
          className="flex cursor-pointer items-baseline gap-1 border-none bg-transparent p-0 hover:underline"
        >
          <span className="text-[18px] font-bold tabular-nums text-primary">
            {formatCompact(followingCount)}
          </span>
          <span className="text-muted">{t("profile.following")}</span>
        </button>
      </div>

      {/* The ad slot lives where Topics does: a live campaign takes the
          space over, the Gold owner sees the sell affordance, and everyone
          else sees exactly what they always saw. */}
      {profileId && (
        <AdSlot profileId={profileId} username={username} isMe={isMe} />
      )}

      {/* Topics no longer render here (owner ruling 2026-08-29): the ad
          slot owns this position. Interests still feed the algorithm and stay
          editable in Edit profile → Topics — only the public chip list went. */}
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
                    <SafeAvatar src={c.avatar} className="object-cover" sizes="24px" />
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
