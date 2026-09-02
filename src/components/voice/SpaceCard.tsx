"use client";

import { formatCompact } from "@/lib/utils";
import { BellRinging, CalendarBlank, Users } from "@phosphor-icons/react";
import clsx from "clsx";
import { UserBadges } from "@/components/ui/UserBadges";
import { SafeAvatar } from "@/components/ui/SafeAvatar";
import Countdown, { CountdownInline } from "@/components/voice/Countdown";
import HostSpaceMenu from "@/components/voice/HostSpaceMenu";
import { useT } from "@/i18n/client";
import {
  STORY_BACKGROUNDS,
  storyCanvasCss,
} from "@/lib/editor/storyBackgrounds";

export interface SpaceRow {
  id: string;
  title: string;
  description?: string;
  /** Canvas id chosen by the host; falls back to a hash of the room id. */
  cover?: string;
  /** A custom uploaded image, which wins over the preset canvas. */
  coverImage?: string;
  status: "scheduled" | "live" | "ended" | "cancelled";
  scheduledFor?: string;
  startedAt?: string;
  /**
   * Taxonomy id (a category or vertical from `src/data/categories.ts`).
   * The gateway doesn't store one yet — the hub filters on it the moment
   * it does; until then only demo rows carry it.
   */
  category?: string;
  host: {
    /** Profile id — doubles as the LiveKit identity and Ably clientId. */
    _id?: string;
    username: string;
    avatar?: string;
    firstName?: string;
    lastName?: string;
    isVerified?: boolean;
    verification?: { tier?: "bronze" | "silver" | "gold" } | null;
    badges?: import("@/components/ui/UserBadges").ProfileBadge[];
  };
  community?: { name: string; slug: string } | null;
  membersCount: number;
  joined: boolean;
  isHost: boolean;
  isSpeaker?: boolean;
  requestedToSpeak?: boolean;
  /** Hands up, waiting on the host. Only meaningful to the host. */
  speakRequestCount?: number;
}

/** The room's art: the host's chosen canvas, or a stable hash of the id for
 *  rooms created before covers existed. */
export function spaceCanvas(idOrRow: string | SpaceRow) {
  const row = typeof idOrRow === "string" ? null : idOrRow;
  const id = typeof idOrRow === "string" ? idOrRow : idOrRow.id;
  if (row?.cover) {
    const chosen = STORY_BACKGROUNDS.find((b) => b.id === row.cover);
    if (chosen) return chosen;
  }
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  // First six are the dark meshes; paper/linen would fight the light ink.
  return STORY_BACKGROUNDS[Math.abs(hash) % 6];
}

/**
 * The CSS background for a room's art.
 *
 * A host's uploaded image wins over the preset canvas, matching the gateway's
 * precedence, so what you picked in the sheet is what you see on the card.
 */
export function spaceBackground(row: SpaceRow) {
  if (row.coverImage) return `url(${row.coverImage}) center / cover no-repeat`;
  return storyCanvasCss(spaceCanvas(row));
}

export function hostName(host: SpaceRow["host"]) {
  return host.firstName || host.lastName
    ? `${host.firstName ?? ""} ${host.lastName ?? ""}`.trim()
    : host.username;
}

/** Three animated bars — the universal "this room is talking" glyph. */
export function EqBars({ className }: { className?: string }) {
  return (
    <span className={clsx("flex items-end gap-[2.5px] h-3.5", className)}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-full w-[3px] origin-bottom rounded-pill bg-current motion-safe:animate-[ws-eq_1s_ease-in-out_infinite]"
          style={{ animationDelay: `${i * 0.18}s` }}
        />
      ))}
    </span>
  );
}

/**
 * A live room: full-bleed mesh art under a legibility scrim, LIVE + bars up
 * top, the title in display type, host + count on the baseline. The whole
 * card opens the room; the pill is just the invitation.
 */
export function LiveSpaceCard({
  row,
  onOpen,
}: {
  row: SpaceRow;
  onOpen: (row: SpaceRow) => void;
}) {
  const t = useT();
  return (
    <button
      type="button"
      onClick={() => onOpen(row)}
      className="group relative flex min-h-[168px] w-full flex-col justify-between overflow-hidden rounded-xl p-4 text-left transition-opacity cursor-pointer"
    >
      {/* The art is its own layer so it can be blurred without taking the
          type with it. At this size a cover photo is unreadable AS a photo
          anyway — all it does is fight the title — so it becomes colour and
          shape, and the words sit clean on top. Scaled past the edges
          because a blur samples past its own box and would otherwise show a
          soft border. */}
      <span
        aria-hidden
        className="absolute -inset-4 scale-110 blur-[6px]"
        style={{ background: spaceBackground(row) }}
      />
      {/* Scrim so type never fights the art. */}
      <span className="absolute inset-0 bg-gradient-to-t from-[#0c0a09]/85 via-[#0c0a09]/25 to-[#0c0a09]/30 transition-colors group-hover:via-[#0c0a09]/15" />

      <span className="relative flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 rounded-[4px] bg-danger px-1.5 py-px text-[9px] font-bold tracking-wide text-white font-sans">
          <span className="h-1 w-1 rounded-pill bg-white animate-pulse" />
          {t("live.badge")}
        </span>
        <span className="flex items-center gap-1.5 text-[#fafaf9]/85">
          <EqBars className="text-gold" />
          <span className="flex items-center gap-1 font-sans text-[12px] font-semibold tabular-nums">
            <Users size={13} weight="bold" />
            {formatCompact(row.membersCount)}
          </span>
        </span>
      </span>

      <span className="relative mt-6 block">
        <span className="block font-display text-[17px] font-semibold leading-snug text-[#fafaf9] [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] overflow-hidden">
          {row.title}
        </span>
        {row.description && (
          <span className="mt-1 block font-sans text-[12px] leading-snug text-[#fafaf9]/65 [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] overflow-hidden">
            {row.description}
          </span>
        )}
        <span className="mt-2.5 flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-2">
            <span className="relative h-7 w-7 shrink-0 overflow-hidden rounded-pill bg-[#1c1917]">
              <SafeAvatar src={row.host.avatar} />
            </span>
            <span className="flex min-w-0 items-center gap-1">
              <span className="truncate font-sans text-[12.5px] font-semibold text-[#fafaf9]/90">
                {hostName(row.host)}
              </span>
              <UserBadges
                isVerified={row.host.isVerified}
                verification={(row.host as any).verification}
                badges={(row.host as any).badges}
                size={12}
              />
              {row.community && (
                <span className="ml-1 hidden truncate rounded-pill bg-[#fafaf9]/12 px-2 py-px font-sans text-[10.5px] font-medium text-[#fafaf9]/75 sm:block">
                  {row.community.name}
                </span>
              )}
            </span>
          </span>
          <span
            className={clsx(
              "shrink-0 rounded-pill px-3.5 py-1.5 font-sans text-[12px] font-semibold transition-colors",
              row.joined || row.isHost
                ? "bg-[#fafaf9]/14 text-[#fafaf9]"
                : "bg-[#fafaf9] text-[#0c0a09] group-hover:bg-white",
            )}
          >
            {row.isHost
              ? t("voice.host")
              : row.joined
                ? t("voice.rejoin")
                : t("voice.join")}
          </span>
        </span>
      </span>
    </button>
  );
}

/**
 * The soonest scheduled room, staged like a marquee: mesh art, the full
 * pitch, and a clock counting down every second. One per page — drama
 * dilutes fast.
 */
export function NextUpCard({
  row,
  onRemind,
  onStart,
  onEdit,
  onCancel,
}: {
  row: SpaceRow;
  onRemind: (row: SpaceRow) => void;
  onStart: (row: SpaceRow) => void;
  /** Omitted on read-only surfaces (explore), which show no host controls. */
  onEdit?: (row: SpaceRow) => void;
  onCancel?: (row: SpaceRow) => void;
}) {
  const t = useT();
  return (
    <div
      className="relative overflow-hidden rounded-xl p-5"
    >
      <span
        aria-hidden
        className="absolute -inset-4 scale-110 blur-[6px]"
        style={{ background: spaceBackground(row) }}
      />
      <span className="absolute inset-0 bg-gradient-to-t from-[#0c0a09]/88 via-[#0c0a09]/40 to-[#0c0a09]/30" />
      <div className="relative">
        <span className="font-sans text-[10px] font-bold uppercase tracking-[0.16em] text-gold">
          {t("voice.nextUp")}
        </span>
        <h3 className="mt-2 max-w-[26rem] font-display text-[20px] font-semibold leading-snug text-[#fafaf9]">
          {row.title}
        </h3>
        {row.description && (
          <p className="mt-1.5 max-w-[28rem] font-sans text-[12.5px] leading-relaxed text-[#fafaf9]/70 [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] overflow-hidden">
            {row.description}
          </p>
        )}
        <div className="mt-3 flex items-center gap-2">
          <span className="relative h-6 w-6 overflow-hidden rounded-pill bg-[#1c1917]">
            <SafeAvatar src={row.host.avatar} />
          </span>
          <span className="font-sans text-[12px] font-semibold text-[#fafaf9]/85">
            {hostName(row.host)}
          </span>
          <UserBadges
            isVerified={row.host.isVerified}
            verification={(row.host as any).verification}
            badges={(row.host as any).badges}
            size={12}
          />
          {row.community && (
            <span className="rounded-pill bg-[#fafaf9]/12 px-2 py-px font-sans text-[10.5px] font-medium text-[#fafaf9]/75">
              {row.community.name}
            </span>
          )}
        </div>
        <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
          {row.scheduledFor && <Countdown target={row.scheduledFor} />}
          {row.isHost ? (
            <div className="flex items-center gap-2">
              {onEdit && onCancel && (
                <HostSpaceMenu row={row} onEdit={onEdit} onCancel={onCancel} />
              )}
              <button
                type="button"
                onClick={() => onStart(row)}
                className="rounded-pill bg-danger px-4 h-10 font-sans text-[13px] font-semibold text-white hover:opacity-90 transition-opacity cursor-pointer"
              >
                {t("voice.start")}
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={row.joined}
              onClick={() => onRemind(row)}
              className={clsx(
                "flex items-center gap-1.5 rounded-pill px-4 h-10 font-sans text-[13px] font-semibold transition-colors",
                row.joined
                  ? "bg-[#fafaf9]/14 text-[#fafaf9]/70 cursor-default"
                  : "bg-[#fafaf9] text-[#0c0a09] hover:bg-white cursor-pointer",
              )}
            >
              <BellRinging size={14} weight="bold" />
              {row.joined ? t("voice.going") : t("voice.remind")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * A scheduled room: calendar tile + title + host, and one action. Quieter on
 * purpose — the live grid above carries the colour.
 */
export function UpcomingSpaceRow({
  row,
  onRemind,
  onStart,
  onEdit,
  onCancel,
}: {
  row: SpaceRow;
  onRemind: (row: SpaceRow) => void;
  onStart: (row: SpaceRow) => void;
  /** Omitted on read-only surfaces (explore), which show no host controls. */
  onEdit?: (row: SpaceRow) => void;
  onCancel?: (row: SpaceRow) => void;
}) {
  const t = useT();
  const when = row.scheduledFor ? new Date(row.scheduledFor) : null;
  return (
    <div className="card-depth flex items-center gap-3.5 p-3.5">
      <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-lg bg-raised">
        {when ? (
          <>
            <span className="font-sans text-[9px] font-bold uppercase tracking-[0.1em] text-gold">
              {when.toLocaleString([], { month: "short" })}
            </span>
            <span className="font-display text-[17px] font-semibold leading-none text-primary tabular-nums">
              {when.getDate()}
            </span>
          </>
        ) : (
          <CalendarBlank size={18} className="text-muted" />
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-sans text-[14.5px] font-semibold text-primary">
          {row.title}
        </span>
        <span className="flex min-w-0 items-center gap-1 truncate font-sans text-[12px] text-subtle">
          {hostName(row.host)}
          <UserBadges
            isVerified={row.host.isVerified}
            verification={(row.host as any).verification}
            badges={(row.host as any).badges}
            size={11}
          />
          {when
            ? ` · ${when.toLocaleString([], { hour: "2-digit", minute: "2-digit" })}`
            : ""}
          {row.community ? ` · ${row.community.name}` : ""}
          {row.scheduledFor && (
            <span className="text-gold">
              {" · "}
              <CountdownInline target={row.scheduledFor} />
            </span>
          )}
        </span>
      </div>
      {row.isHost ? (
        <div className="flex shrink-0 items-center gap-1">
          {onEdit && onCancel && (
            <HostSpaceMenu
              row={row}
              onEdit={onEdit}
              onCancel={onCancel}
              tone="dark"
            />
          )}
          <button
            type="button"
            onClick={() => onStart(row)}
            className="shrink-0 rounded-pill bg-danger px-3.5 h-8 font-sans text-[12px] font-semibold text-white hover:opacity-90 transition-opacity cursor-pointer"
          >
            {t("voice.start")}
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={row.joined}
          onClick={() => onRemind(row)}
          className={clsx(
            "shrink-0 rounded-pill px-3.5 h-8 font-sans text-[12px] font-semibold transition-colors",
            row.joined
              ? "bg-raised text-muted cursor-default"
              : "bg-primary text-page hover:bg-muted cursor-pointer",
          )}
        >
          {row.joined ? t("voice.going") : t("voice.remind")}
        </button>
      )}
    </div>
  );
}
