"use client";

import type { ProfileBadge } from "@/components/ui/UserBadges";

import Image from "next/image";
import clsx from "clsx";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Mail, MoreHorizontal } from "lucide-react";
import { SafeAvatar } from "@/components/ui/SafeAvatar";
import { useT } from "@/i18n/client";

/**
 * Banner, avatar and the action row.
 *
 * The avatar carries a state ring: danger when they are broadcasting, brand
 * when they have an unseen story, a flat raised ring when the story is seen,
 * nothing otherwise. It is the same language the stories rail uses, so the
 * ring means one thing across the app.
 */
export function ProfileHeader({
  fullName,
  username,
  isVerified,
  badges,
  postsCount,
  banner,
  avatar,
  isLive,
  storyState,
  isMe,
  isFollowing,
  followLoading,
  blockedByYou,
  blockedByThem,
  onBack,
  onEdit,
  onFollowToggle,
  onMessage,
  canMessage,
  onBlock,
  onUnblock,
  onReport,
  onAvatarClick,
}: {
  fullName: string;
  username: string;
  isVerified?: boolean;
  badges?: ProfileBadge[];
  postsCount: number;
  banner?: string;
  avatar?: string;
  isLive?: boolean;
  storyState?: "unseen" | "seen" | "none";
  isMe: boolean;
  isFollowing: boolean;
  followLoading: boolean;
  blockedByYou?: boolean;
  blockedByThem?: boolean;
  onBack: () => void;
  onEdit: () => void;
  onFollowToggle: () => void;
  onMessage: () => void;
  canMessage?: boolean;
  onBlock: () => void;
  onUnblock: () => void;
  onReport: () => void;
  onAvatarClick?: () => void;
}) {
  const t = useT();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // The overflow menu had no dismissal at all — once open it stayed open
  // through scrolling and navigation until you clicked the trigger again.
  useEffect(() => {
    if (!menuOpen) return;
    const onPointer = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);
  // Hover label lives in state. Writing into the button's textContent, which
  // is what this used to do, edits a node React owns and desynchronises on the
  // next render.
  const [hoveringFollow, setHoveringFollow] = useState(false);

  const ring = isLive
    ? "ring-2 ring-danger"
    : storyState === "unseen"
      ? "ring-2 ring-brand"
      : storyState === "seen"
        ? "ring-2 ring-raised"
        : "";

  const iconButton =
    "h-10 w-10 shrink-0 rounded-pill border border-hairline flex items-center justify-center transition-colors hover:bg-raised cursor-pointer text-muted hover:text-primary";
  const pill =
    "rounded-pill px-5 h-10 shrink-0 font-semibold transition-colors text-sm font-sans min-w-[104px]";

  return (
    <>
      <header className="sticky top-0 z-sticky flex items-center gap-3 border-b border-hairline bg-page px-2 py-2 sm:px-4 md:top-0">
        <button
          type="button"
          aria-label={t("common.back")}
          onClick={onBack}
          className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-pill text-primary transition-colors hover:bg-raised"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex min-w-0 flex-col">
          {/* No badges here. This bar is ALWAYS on screen, and ProfileAbout
              renders the same marks a couple of hundred pixels below it — so
              the tick appeared twice at once on every profile. The bar is
              navigation (back, whose profile, how many posts); the marks
              belong with the identity block that carries the handle, bio and
              counts. */}
          <h1 className="min-w-0 truncate font-sans text-lg font-bold leading-5 text-primary">
            {fullName}
          </h1>
          <span className="font-sans text-xs tabular-nums text-muted">
            {postsCount.toLocaleString()} {t("profile.posts")}
          </span>
        </div>
      </header>

      <div className="relative">
        {/* 3:1, so a banner uploaded at the usual aspect isn't cropped to a strip. */}
        <div className="relative aspect-[3/1] max-h-[210px] w-full overflow-hidden bg-sunken">
          {banner ? (
            <Image src={banner} alt="" fill sizes="620px" className="object-cover" />
          ) : (
            <img
              src="/images/logo.png"
              alt=""
              aria-hidden="true"
              className="pointer-events-none absolute left-1/2 top-1/2 w-12 -translate-x-1/2 -translate-y-1/2 select-none opacity-[0.08]"
            />
          )}
        </div>

        <div className="absolute -bottom-[46px] left-4 rounded-pill border-4 border-page bg-page sm:-bottom-[58px]">
          <button
            type="button"
            onClick={onAvatarClick}
            disabled={!onAvatarClick}
            className={clsx(
              "relative block h-[96px] w-[96px] overflow-hidden rounded-pill bg-raised sm:h-[124px] sm:w-[124px]",
              ring,
              onAvatarClick && "cursor-pointer",
            )}
          >
            <SafeAvatar src={avatar} />
          </button>
          {isLive && (
            <span className="absolute -bottom-1 left-1/2 flex h-5 -translate-x-1/2 items-center gap-1 rounded-pill bg-danger px-2 font-sans text-[9px] font-bold tracking-wide text-white">
              <span className="h-1 w-1 animate-pulse rounded-pill bg-white" />
              {t("live.badge")}
            </span>
          )}
        </div>
      </div>

      <div className="mt-2 flex min-h-[52px] justify-end gap-2 px-4 py-3">
        {!isMe && !blockedByThem && !blockedByYou && (
          <>
            {canMessage && (
              <button
                type="button"
                aria-label={t("profile.message")}
                onClick={onMessage}
                className={iconButton}
              >
                <Mail className="h-[18px] w-[18px]" />
              </button>
            )}
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                aria-label={t("profile.more")}
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((v) => !v)}
                className={iconButton}
              >
                <MoreHorizontal className="h-[18px] w-[18px]" />
              </button>
              {menuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 top-full z-dropdown mt-2 flex w-[220px] flex-col overflow-hidden rounded-lg border border-hairline bg-surface py-1.5 shadow-nav"
                >
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      onReport();
                    }}
                    className="cursor-pointer px-3.5 py-2.5 text-left font-sans text-sm font-medium text-primary transition-colors hover:bg-raised"
                  >
                    {t("safety.report")} @{username}
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      blockedByYou ? onUnblock() : onBlock();
                    }}
                    className={clsx(
                      "cursor-pointer px-3.5 py-2.5 text-left font-sans text-sm font-medium transition-colors hover:bg-raised",
                      blockedByYou ? "text-primary" : "text-danger",
                    )}
                  >
                    {blockedByYou ? t("safety.unblock") : t("safety.block")} @
                    {username}
                  </button>
                </div>
              )}
            </div>
          </>
        )}

        {isMe ? (
          <button
            type="button"
            onClick={onEdit}
            className={clsx(
              pill,
              "border border-hairline text-primary hover:bg-raised cursor-pointer",
            )}
          >
            {t("profile.edit")}
          </button>
        ) : blockedByYou ? (
          <button
            type="button"
            onClick={onUnblock}
            className={clsx(pill, "cursor-pointer bg-danger text-page hover:opacity-90")}
          >
            {t("safety.unblock")}
          </button>
        ) : blockedByThem ? (
          <button
            type="button"
            disabled
            className={clsx(
              pill,
              "cursor-not-allowed border border-hairline bg-raised text-subtle",
            )}
          >
            Blocked
          </button>
        ) : (
          <button
            type="button"
            onClick={onFollowToggle}
            disabled={followLoading}
            onMouseEnter={() => setHoveringFollow(true)}
            onMouseLeave={() => setHoveringFollow(false)}
            onFocus={() => setHoveringFollow(true)}
            onBlur={() => setHoveringFollow(false)}
            className={clsx(
              pill,
              "cursor-pointer",
              isFollowing
                ? "border border-hairline bg-transparent text-primary hover:border-danger hover:text-danger"
                : "bg-primary text-page hover:bg-muted",
            )}
          >
            {/* "Following", not "Joined": you follow a person, you join a
                community — this was borrowing the community string. And its
                own key, not the stats-row one: that noun reads as
                "Abonnements"/"Subscriptions" in French, which is a list
                heading, not a button state. */}
            {isFollowing
              ? hoveringFollow
                ? t("profile.unfollow")
                : t("profile.followingState")
              : t("profile.follow")}
          </button>
        )}
      </div>
    </>
  );
}
