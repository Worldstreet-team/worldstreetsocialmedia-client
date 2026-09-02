"use client";

import Link from "next/link";
import Image from "next/image";
import clsx from "clsx";
import {
  At,
  Bell,
  Broadcast,
  ChatCircle,
  Coins,
  Gift,
  Heart,
  Quotes,
  Repeat,
  ShieldWarning,
  UserPlus,
  type Icon,
  Megaphone,
} from "@phosphor-icons/react";
import { SafeAvatar } from "@/components/ui/SafeAvatar";
import { UserBadges } from "@/components/ui/UserBadges";
import { renderRichText } from "@/components/ui/RichText";
import { formatTimeAgo, formatCompact } from "@/lib/utils";
import { useT } from "@/i18n/client";
import { senderName, type NotificationGroup, type NotificationType } from "./types";

/**
 * The type chip: a coloured wash behind a filled glyph, pinned to the avatar.
 * Colours follow the app-wide notification map (like = danger, follow =
 * primary, reply = muted, repost = success, mention = gold, live = danger).
 */
const FALLBACK_CHIP = {
  classes: "bg-raised text-muted",
  glyph: Bell,
  weight: "fill" as const,
};

const CHIP: Record<NotificationType, { classes: string; glyph: Icon; weight: "fill" | "bold" }> = {
  like: { classes: "bg-danger/15 text-danger", glyph: Heart, weight: "fill" },
  repost: { classes: "bg-success/15 text-success", glyph: Repeat, weight: "bold" },
  quote: { classes: "bg-success/15 text-success", glyph: Quotes, weight: "fill" },
  reply: { classes: "bg-raised text-muted", glyph: ChatCircle, weight: "fill" },
  follow: { classes: "bg-primary/12 text-primary", glyph: UserPlus, weight: "fill" },
  mention: { classes: "bg-brand/15 text-gold", glyph: At, weight: "bold" },
  live: { classes: "bg-danger/15 text-danger", glyph: Broadcast, weight: "fill" },
  // Money reads as money: the one chip in the success tone with a coin.
  sale: { classes: "bg-success/15 text-success", glyph: Coins, weight: "fill" },
  gift: { classes: "bg-success/15 text-success", glyph: Gift, weight: "fill" },
  // A platform notice, in the warning tone. Not a social event: it is the
  // platform telling you something happened to your content.
  moderation: {
    classes: "bg-warning/15 text-warning",
    glyph: ShieldWarning,
    weight: "fill",
  },
  message: { classes: "bg-raised text-primary", glyph: ChatCircle, weight: "fill" },
  // The platform speaking to everyone at once: brand gold, a megaphone.
  announcement: {
    classes: "bg-brand/15 text-gold",
    glyph: Megaphone,
    weight: "fill",
  },
};

/** Minor units to a readable figure. Money is never "1.2". */
const money = (minor?: number) =>
  minor == null ? null : `$${(minor / 100).toFixed(2)}`;

/** Two lines of an excerpt, without relying on a line-clamp plugin. */
const CLAMP_2 =
  "[display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] overflow-hidden";
const CLAMP_1 =
  "[display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:1] overflow-hidden";

export function NotificationRow({
  group,
  unread,
  isLive,
  onOpen,
  onFollowBack,
  followed,
  delay,
}: {
  group: NotificationGroup;
  unread: boolean;
  /** Only true while the stream is actually running. */
  isLive?: boolean;
  onOpen: (group: NotificationGroup) => void;
  onFollowBack: (userId: string) => void;
  followed: boolean;
  delay: number;
}) {
  const t = useT();
  const { type, senders, post } = group;
  // Never index this map blind. The gateway's enum is the source of truth and
  // it already had a type this client did not know ("quote"): CHIP[type] came
  // back undefined and reading .glyph threw, which the error boundary turned
  // into a dead Notifications page for everyone with one quote in their feed.
  // A type we cannot name is worth showing as generic activity, not a crash.
  const chip = CHIP[type] ?? FALLBACK_CHIP;
  const Glyph = chip.glyph;
  const lead = senders[0];
  // Server truth first; `followed` is the optimistic session override, so the
  // button still disappears the instant you press it, before any refetch.
  const alreadyFollowing = followed || Boolean(lead?.isFollowing);

  const href =
    type === "message"
      ? group.conversation
        ? `/messages/${group.conversation}`
        : "/messages"
      : type === "announcement"
        ? group.href || "#"
        : // A chat @mention carries a conversation, never a post — it lands in
          // the thread it happened in (group mentions, register 136).
          type === "mention" && !post?._id && group.conversation
          ? `/messages/${group.conversation}`
        : type === "follow"
          ? lead.username
            ? `/profile/${lead.username}`
            : "#"
          : post?._id
            ? `/post/${post._id}`
            : "#";

  const others = senders.length - 1;
  const excerpt = post?.content;
  const thumb = post?.images?.[0];

  return (
    <Link
      href={href}
      onClick={() => onOpen(group)}
      style={{ animationDelay: `${delay}ms` }}
      className={clsx(
        "animate-rise relative flex gap-3 border-b border-hairline px-4 py-3.5 transition-colors hover:bg-surface/60",
        unread && "bg-surface/40",
      )}
    >
      {unread && (
        <span
          aria-hidden
          className="absolute bottom-0 left-0 top-0 w-[3px] rounded-pill bg-brand"
        />
      )}

      {/* 40x40 cluster: avatar (or a pile, when grouped) plus the type chip. */}
      <span className="relative h-10 w-10 shrink-0">
        {senders.length > 1 ? (
          senders
            .slice(0, 3)
            .reverse()
            .map((s, i) => (
              <span
                key={s.userId}
                className="absolute h-8 w-8 overflow-hidden rounded-pill bg-raised ring-2 ring-page"
                // Intra-row stacking only, far below the z-sticky floor.
                style={{ left: i * 6, top: i * 3, zIndex: i }}
              >
                <SafeAvatar src={s.avatar} />
              </span>
            ))
        ) : (
          <span className="relative block h-10 w-10 overflow-hidden rounded-pill bg-raised">
            <SafeAvatar src={lead.avatar} />
          </span>
        )}
        <span
          className={clsx(
            "absolute -bottom-0.5 -right-0.5 z-[3] flex h-[18px] w-[18px] items-center justify-center rounded-pill ring-2 ring-page",
            chip.classes,
          )}
        >
          <Glyph size={10} weight={chip.weight} />
        </span>
      </span>

      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="font-sans text-[14.5px] leading-snug text-primary">
          <span className="font-semibold">{senderName(lead)}</span>
          {/* No isVerified guard: UserBadges already returns null when there
              is nothing to show, so the guard only ever hid Wolf and
              developer marks from people who had not also bought a tick. */}
          <span className="mx-0.5 inline-flex translate-y-[1px]">
            <UserBadges
              isVerified={lead.isVerified}
              verification={(lead as any).verification}
              badges={lead.badges}
              size={12}
            />
          </span>
          {others > 0 && (
            <span className="text-primary">
              {" "}
              {others === 1
                ? t("notif.others.one")
                : t("notif.others.many").replace("{n}", formatCompact(others))}
            </span>
          )}
          <span className="text-muted"> {t(`notif.verb.${type}`)}</span>
          {/* The figure IS the notification for a money event; a sale that
              does not say how much is a riddle. */}
          {(type === "sale" || type === "gift") && money(group.amountMinor) && (
            <span className="font-semibold text-success">
              {" "}
              {money(group.amountMinor)}
            </span>
          )}
          <span className="text-subtle"> · {formatTimeAgo(group.createdAt)}</span>
        </span>

        {type === "announcement" && group.title && (
          <span className="font-sans text-[14px] font-semibold leading-snug text-primary">
            {group.title}
          </span>
        )}
        {(type === "moderation" ||
          type === "message" ||
          type === "announcement") &&
          group.body && (
          <span className="font-sans text-[13.5px] leading-snug text-primary whitespace-pre-line">
            {group.body}
          </span>
        )}

        {excerpt && (
          <span
            className={clsx(
              "font-sans leading-snug text-muted",
              type === "like" || type === "repost"
                ? `text-[13px] ${CLAMP_1}`
                : `text-[13.5px] ${CLAMP_2}`,
            )}
          >
            {type === "mention" ? renderRichText(excerpt) : excerpt}
          </span>
        )}

        {type === "live" && isLive && (
          <span className="mt-1 flex h-5 w-fit items-center gap-1 rounded-pill bg-danger px-2 font-sans text-[10px] font-bold tracking-wide text-white">
            <span className="h-1 w-1 animate-pulse rounded-pill bg-white" />
            {t("live.badge")}
          </span>
        )}

        {type === "follow" && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              // Profile id, not the Clerk id: this is the key
              // `followingIdsAtom` is built from everywhere else, and a
              // mismatch here is why the button never turned to "Aligned".
              if (lead?._id) onFollowBack(lead._id);
            }}
            disabled={alreadyFollowing}
            className={clsx(
              "mt-1.5 h-8 w-fit shrink-0 rounded-pill px-3.5 font-sans text-[12px] font-semibold transition-colors",
              alreadyFollowing
                ? "cursor-default bg-raised text-muted"
                : "cursor-pointer bg-primary text-page hover:bg-muted",
            )}
          >
            {/* You align with a person; you JOIN a community. Borrowing the
                community string made an alignment read "Joined". */}
            {alreadyFollowing
              ? t("profile.followingState")
              : t("notif.followBack")}
          </button>
        )}
      </span>

      {thumb && (
        <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-raised">
          <Image src={thumb} alt="" fill sizes="44px" className="object-cover" />
        </span>
      )}
    </Link>
  );
}

export function NotificationRowSkeleton() {
  return (
    <div className="flex gap-3 border-b border-hairline px-4 py-3.5">
      <div className="skeleton h-10 w-10 shrink-0 rounded-pill" />
      <div className="flex-1">
        <div className="skeleton mb-1.5 h-3.5 w-2/3 rounded-sm" />
        <div className="skeleton h-3 w-2/5 rounded-sm" />
      </div>
    </div>
  );
}
