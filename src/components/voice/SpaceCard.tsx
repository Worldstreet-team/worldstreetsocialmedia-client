"use client";

// The house background's custom property. Imported here, beside the
// function that hands out `var(--ws-space-house)`, so every surface that
// paints a room's art has the stylesheet that defines it.
import "@/styles/spaces.css";

import { formatCompact } from "@/lib/utils";
import { CalendarBlank, Headphones, Waveform } from "@phosphor-icons/react";
import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { UserBadges } from "@/components/ui/UserBadges";
import { SafeAvatar } from "@/components/ui/SafeAvatar";
import { CountdownInline } from "@/components/voice/Countdown";
import HostSpaceMenu from "@/components/voice/HostSpaceMenu";
import { formatElapsed, useNow } from "@/components/voice/useNow";
import { useT } from "@/i18n/client";
import { getCategory, VERTICAL_BY_ID } from "@/lib/categories";
import type { VerticalId } from "@/data/categories";
import { press, swap } from "@/lib/motion-presets";
import {
  STORY_BACKGROUNDS,
  type StoryBackground,
  storyCanvasCss,
} from "@/lib/editor/storyBackgrounds";

/** A face on a live room's stage, as the directory listing sends it. */
export interface SpaceStageMember {
  id: string;
  username: string;
  firstName?: string;
  lastName?: string;
  avatar?: string;
  isVerified?: boolean;
  verification?: { tier?: "bronze" | "silver" | "gold" } | null;
  role: "host" | "cohost" | "speaker";
}

/** One of the few people going to a scheduled room. */
export interface SpaceGoingFace {
  id: string;
  username: string;
  avatar?: string;
}

export interface SpaceRow {
  id: string;
  title: string;
  description?: string;
  /**
   * A legacy swatch id from before 2026-10-14, when rooms picked a colour
   * theme. Rooms that have one keep their colour; new rooms never set it.
   */
  cover?: string;
  /** A custom uploaded image, which wins over everything else. */
  coverImage?: string;
  status: "scheduled" | "live" | "ended" | "cancelled";
  scheduledFor?: string;
  startedAt?: string;
  /**
   * Taxonomy id (a category or vertical from `src/data/categories.ts`).
   * The directory's topic chips filter on it and the Now card names it in
   * words; a row without one only shows under "All".
   */
  category?: string;
  host: {
    /** Profile id, which doubles as the LiveKit identity and Ably clientId. */
    _id?: string;
    username: string;
    avatar?: string;
    firstName?: string;
    lastName?: string;
    isVerified?: boolean;
    verification?: { tier?: "bronze" | "silver" | "gold" } | null;
    badges?: import("@/components/ui/UserBadges").ProfileBadge[];
  };
  /** The first of `communities`, kept for older readers. */
  community?: { id?: string; name: string; slug: string } | null;
  /**
   * Every community the room goes to (up to three since 2026-10-14). Absent
   * from an older gateway, where `community` is the whole answer.
   */
  communities?: { id: string; name: string; slug: string }[];
  membersCount: number;
  /** Webhook-maintained live occupancy; 0 = not wired, fall back to
   *  membersCount. */
  liveCount?: number;
  /**
   * Live rooms only: the faces on stage (host, co-hosts, speakers), a few at
   * most, and how many are up there in all. Absent from an older gateway,
   * where the host is the only face we can honestly show.
   */
  stage?: SpaceStageMember[];
  stageCount?: number;
  /** Scheduled rooms only: a few of the people going, newest first. */
  goingSample?: SpaceGoingFace[];
  joined: boolean;
  isHost: boolean;
  isCohost?: boolean;
  /** Profile ids of the host's deputies, for the stage chips. */
  cohosts?: string[];
  isSpeaker?: boolean;
  requestedToSpeak?: boolean;
  /** Hands up, waiting on the host. Only meaningful to the host. */
  speakRequestCount?: number;
}

/** Honest headcount for a live room: webhook occupancy when wired,
 *  cumulative membership otherwise. */
export function spaceListenerCount(row: SpaceRow) {
  return row.liveCount && row.liveCount > 0 ? row.liveCount : row.membersCount;
}

/**
 * People going to a scheduled room. The host is a member of their own room
 * from the moment it is booked, so membership alone would tell every room
 * with no sign-ups that one person is going.
 */
export function spaceGoingCount(row: SpaceRow) {
  return Math.max(0, row.membersCount - 1);
}

/* ── the room's art ───────────────────────────────────────────────────── */

/**
 * What a room wears (owner 2026-10-14): its uploaded photo, else the legacy
 * swatch it was made with ("keep their color"), else the WorldSpace house
 * background. Rooms no longer pick colours, so `house` is where every new
 * room without a photo lands.
 */
export type SpaceArtKind = "photo" | "swatch" | "house";

/** All the art needs from a row, so the rail's looser shape can use it. */
export type SpaceArtSource = Pick<SpaceRow, "cover" | "coverImage">;

export function spaceArt(row: SpaceArtSource): SpaceArtKind {
  if (row.coverImage) return "photo";
  return spaceCanvas(row) ? "swatch" : "house";
}

/** The legacy swatch a room was made with, or null for a room that has
 *  none (it wears the house background). An id the shelf no longer knows
 *  falls to the house too, rather than to a colour nobody chose. */
export function spaceCanvas(
  row: Pick<SpaceRow, "cover">,
): StoryBackground | null {
  if (!row.cover) return null;
  return STORY_BACKGROUNDS.find((b) => b.id === row.cover) ?? null;
}

/** The house background: the custom property in `styles/spaces.css`, which
 *  swaps the night and day versions of the picture with the theme. */
export const SPACE_HOUSE_BACKGROUND = "var(--ws-space-house)";

/**
 * The CSS `background` for a room's art, in the gateway's precedence: the
 * uploaded photo, then the legacy swatch, then the house picture.
 */
export function spaceBackground(row: SpaceArtSource) {
  if (row.coverImage) return `url(${row.coverImage}) center / cover no-repeat`;
  const swatch = spaceCanvas(row);
  return swatch ? storyCanvasCss(swatch) : SPACE_HOUSE_BACKGROUND;
}

/**
 * How much of the theme's own surface lies over the art. The ink on top is
 * the theme's ink, so the veil is what keeps it readable on any picture:
 * a photo can be anything, so it gets the most; a legacy swatch is a dark
 * mesh; the house picture is already lit for the mode, so it shows through.
 */
const VEIL: Record<SpaceArtKind, { card: string; hero: string }> = {
  photo: { card: "bg-surface/84", hero: "bg-surface/78" },
  swatch: { card: "bg-surface/74", hero: "bg-surface/66" },
  house: { card: "bg-surface/30", hero: "bg-surface/20" },
};

/**
 * A room's art as a card ground: blurred, under a veil of the theme's own
 * surface (owner 2026-10-14: the photo gets "the same blur + mode veil" as
 * the house look). At card size a photo is unreadable as a photo anyway,
 * and fighting the title is all it would do, so it becomes colour and
 * light. Spread inside a positioned, rounded parent.
 */
export function SpaceArt({
  row,
  hero = false,
}: {
  row: SpaceArtSource;
  /** The lead card shows a little more of its art. */
  hero?: boolean;
}) {
  const kind = spaceArt(row);
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit] bg-surface"
    >
      {/* Past the edges, because a blur samples beyond its own box and
          would otherwise leave a soft dark border. The house picture is
          soft already, so it takes a lighter blur and keeps its waves. */}
      <span
        className={clsx(
          "absolute -inset-12",
          kind === "house" ? "blur-[8px]" : "blur-[22px]",
        )}
        style={{ background: spaceBackground(row) }}
      />
      <span className={clsx("absolute inset-0", VEIL[kind][hero ? "hero" : "card"])} />
    </span>
  );
}

/**
 * A room's art as a small square or circle with the waveform on it: the
 * feed's live bar, the ended sheet, the Your room bar. A photo or a swatch
 * is dark under a wash, so the glyph is light; the house picture follows
 * the theme, so its glyph takes the brand ink, which reads on both.
 */
export function SpaceThumb({
  row,
  className,
  glyph = true,
  glyphSize = 15,
}: {
  row: SpaceArtSource;
  /** Size and rounding come from the caller. */
  className?: string;
  glyph?: boolean;
  glyphSize?: number;
}) {
  const house = spaceArt(row) === "house";
  return (
    <span
      aria-hidden
      className={clsx(
        "relative flex shrink-0 items-center justify-center overflow-hidden",
        className,
      )}
      style={{ background: spaceBackground(row) }}
    >
      {glyph && !house && <span className="absolute inset-0 bg-[#0c0a09]/35" />}
      {glyph && (
        <Waveform
          size={glyphSize}
          weight="fill"
          className={clsx("relative", house ? "text-gold" : "text-[#fafaf9]")}
        />
      )}
    </span>
  );
}

/* ── words about a room ───────────────────────────────────────────────── */

export function hostName(host: SpaceRow["host"]) {
  return host.firstName || host.lastName
    ? `${host.firstName ?? ""} ${host.lastName ?? ""}`.trim()
    : host.username;
}

/** What a face is called under itself: a first name, else the handle. */
export function firstNameOf(person: {
  firstName?: string;
  username?: string;
}) {
  return person.firstName?.trim().split(/\s+/)[0] || person.username || "";
}

/** The communities a room goes to, from either shape of the listing. */
export function spaceCommunities(row: SpaceRow): { name: string; slug: string }[] {
  if (row.communities && row.communities.length > 0) return row.communities;
  return row.community ? [row.community] : [];
}

/** The room's topic in words, or nothing for an id the taxonomy doesn't
 *  know (a raw id on a card would read as a bug). */
export function spaceCategoryLabel(row: SpaceRow): string | undefined {
  if (!row.category) return undefined;
  const vertical = VERTICAL_BY_ID.get(row.category as VerticalId);
  if (vertical) return vertical.label;
  return getCategory(row.category)?.label;
}

/**
 * The faces to draw on a live room's stage, and how many more are up there.
 * Without the listing's `stage` the host is the only person we know is on
 * it, so the host stands alone and there is no "+N" to guess at.
 */
export function spaceStage(row: SpaceRow, max: number) {
  const listed: SpaceStageMember[] =
    row.stage && row.stage.length > 0
      ? row.stage
      : [
          {
            id: row.host._id ? String(row.host._id) : row.host.username,
            username: row.host.username,
            firstName: row.host.firstName,
            lastName: row.host.lastName,
            avatar: row.host.avatar,
            isVerified: row.host.isVerified,
            role: "host",
          },
        ];
  const faces = listed.slice(0, max);
  const total =
    typeof row.stageCount === "number"
      ? Math.max(row.stageCount, listed.length)
      : listed.length;
  return { faces, extra: Math.max(0, total - faces.length) };
}

/** Three animated bars: the universal "this room is talking" glyph. */
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

/* ── small parts ──────────────────────────────────────────────────────── */

/** The red LIVE badge. Uppercase is allowed here and only here: it is a
 *  badge, not a label someone reads. */
export function LiveBadge() {
  const t = useT();
  return (
    <span className="flex shrink-0 items-center gap-1 rounded-[4px] bg-danger px-1.5 py-px font-sans text-[calc(10px*var(--ws-fs))] font-bold tracking-wide text-[#fafaf9]">
      <span className="h-1 w-1 animate-pulse rounded-pill bg-[#fafaf9]" />
      {t("live.badge")}
    </span>
  );
}

/** "Host" beside a name, in the brand's ink. */
export function HostBadge() {
  const t = useT();
  return (
    <span className="shrink-0 rounded-[4px] bg-brand/15 px-1.5 py-px font-sans text-[calc(10.5px*var(--ws-fs))] font-semibold text-gold">
      {t("voice.hostBadge")}
    </span>
  );
}

/** Time on air since `since`, ticking on the shared clock. A leaf on
 *  purpose, so the tick re-renders these characters and not the card. */
export function ElapsedTimer({
  since,
  className,
}: {
  since?: string;
  className?: string;
}) {
  const now = useNow();
  if (!since || !now) return null;
  const start = new Date(since).getTime();
  if (!Number.isFinite(start)) return null;
  return (
    <span className={clsx("tabular-nums", className)}>
      {formatElapsed(now - start)}
    </span>
  );
}

/** The host's face, name, ticks and Host badge, with the handle when the
 *  card has room for it. Needs an `@container` ancestor. */
export function SpaceHostLine({ host }: { host: SpaceRow["host"] }) {
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <span className="relative h-5 w-5 shrink-0 overflow-hidden rounded-pill bg-raised">
        <SafeAvatar src={host.avatar} sizes="20px" />
      </span>
      <span className="ml-0.5 truncate font-sans text-[calc(13px*var(--ws-fs))] font-semibold text-primary">
        {hostName(host)}
      </span>
      <UserBadges
        isVerified={host.isVerified}
        verification={host.verification}
        badges={host.badges}
        size={12}
      />
      <HostBadge />
      <span className="hidden min-w-0 truncate font-sans text-[calc(12.5px*var(--ws-fs))] text-muted @sm:inline">
        @{host.username}
      </span>
    </div>
  );
}

/** The headphones and the room's headcount. Other people arriving is not
 *  the viewer's doing, so the number rolls rather than pops. */
function ListenerCount({ count }: { count: number }) {
  const t = useT();
  const label = formatCompact(count);
  return (
    <span className="flex items-center gap-1.5 font-sans text-[calc(13px*var(--ws-fs))] font-semibold text-primary tabular-nums">
      <Headphones size={16} className="text-muted" />
      <span className="relative inline-flex overflow-hidden">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span key={label} {...swap} className="inline-block">
            {label}
          </motion.span>
        </AnimatePresence>
      </span>
      <span className="sr-only">{t("voice.listeners")}</span>
    </span>
  );
}

/** The stage as a row of faces with first names, then "+N more". */
function StageFaces({
  faces,
  extra,
  large,
}: {
  faces: SpaceStageMember[];
  extra: number;
  large: boolean;
}) {
  const t = useT();
  const face = large ? "h-12 w-12" : "h-10 w-10";
  const cell = large ? "w-14" : "w-12";
  return (
    <ul
      aria-label={t("voice.onStageLabel")}
      className="flex min-w-0 flex-wrap gap-x-1.5 gap-y-2"
    >
      {faces.map((person) => (
        <li
          key={String(person.id)}
          className={clsx("flex flex-col items-center gap-1", cell)}
        >
          <span
            className={clsx(
              "relative block overflow-hidden rounded-pill bg-raised",
              face,
            )}
          >
            <SafeAvatar src={person.avatar} sizes={large ? "48px" : "40px"} />
          </span>
          <span
            className={clsx(
              "w-full truncate text-center font-sans text-[calc(11.5px*var(--ws-fs))]",
              person.role === "host" ? "font-semibold text-primary" : "text-muted",
            )}
          >
            {firstNameOf(person)}
          </span>
        </li>
      ))}
      {extra > 0 && (
        <li className={clsx("flex flex-col items-center gap-1", cell)}>
          <span
            className={clsx(
              "flex items-center justify-center rounded-pill bg-primary/[0.08] font-sans text-[calc(12px*var(--ws-fs))] font-semibold text-muted tabular-nums",
              face,
            )}
          >
            +{formatCompact(extra)}
          </span>
          <span className="w-full truncate text-center font-sans text-[calc(11.5px*var(--ws-fs))] text-muted">
            more
          </span>
        </li>
      )}
    </ul>
  );
}

/* ── the Now column ───────────────────────────────────────────────────── */

/**
 * A live room in the Now column (Layout B, owner pick 2026-10-14): LIVE and
 * its time on air, the topic in words, the title, the host, the stage as
 * faces, the headcount and Join. The lead card (the busiest room) is larger
 * and shows more of its art.
 *
 * The whole card opens the room through one overlay button, so a keyboard
 * stops once per room and the visible Join pill is the button's face.
 */
export function NowSpaceCard({
  row,
  onOpen,
  featured = false,
}: {
  row: SpaceRow;
  onOpen: (row: SpaceRow) => void;
  featured?: boolean;
}) {
  const t = useT();
  const category = spaceCategoryLabel(row);
  const communities = spaceCommunities(row);
  const { faces, extra } = spaceStage(row, featured ? 5 : 4);
  const action = row.isHost
    ? t("voice.host")
    : row.joined
      ? t("voice.rejoin")
      : t("voice.join");
  // The lead room's Join is the column's one brand action; the rest are
  // repeated actions and stay neutral, so the brand keeps its meaning.
  const loud = featured && !row.isHost && !row.joined;

  return (
    <article className="@container group relative rounded-xl">
      <SpaceArt row={row} hero={featured} />
      {/* Hover lightens one step, never scales. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[inherit] transition-colors group-hover:bg-primary/[0.04]"
      />
      <div
        className={clsx(
          "relative flex flex-col",
          featured ? "gap-3 p-4 @md:p-5" : "gap-2.5 p-4",
        )}
      >
        <div className="flex min-w-0 items-center gap-1.5 font-sans text-[calc(12px*var(--ws-fs))] text-muted">
          <LiveBadge />
          <ElapsedTimer
            since={row.startedAt}
            className="font-semibold text-primary"
          />
          {category && (
            <>
              <span aria-hidden className="text-subtle">
                ·
              </span>
              <span className="shrink-0">{category}</span>
            </>
          )}
          {communities.length > 0 && (
            <>
              <span aria-hidden className="text-subtle">
                ·
              </span>
              <span className="min-w-0 truncate">
                {communities[0].name}
                {communities.length > 1 && ` +${communities.length - 1}`}
              </span>
            </>
          )}
        </div>

        <h3
          className={clsx(
            "line-clamp-2 font-display font-semibold leading-snug text-primary",
            featured
              ? "text-[calc(19px*var(--ws-fs))] @md:text-[calc(22px*var(--ws-fs))]"
              : "text-[calc(16px*var(--ws-fs))]",
          )}
        >
          {row.title}
        </h3>
        {featured && row.description && (
          <p className="-mt-1 line-clamp-2 font-sans text-[calc(13px*var(--ws-fs))] leading-relaxed text-muted">
            {row.description}
          </p>
        )}

        <SpaceHostLine host={row.host} />

        {/* Wraps instead of squeezing: on a narrow card the headcount and
            Join drop under the faces rather than crushing them. */}
        <div className="mt-1 flex flex-wrap items-end gap-x-4 gap-y-3">
          <StageFaces faces={faces} extra={extra} large={featured} />
          <div className="ml-auto flex items-center gap-3">
            <ListenerCount count={spaceListenerCount(row)} />
            <span
              aria-hidden
              className={clsx(
                "flex h-10 items-center rounded-pill px-4 font-sans text-[calc(13px*var(--ws-fs))] font-semibold transition-colors",
                loud
                  ? "bg-brand text-brand-on group-hover:bg-brand-active"
                  : "bg-primary/10 text-primary group-hover:bg-primary/15",
              )}
            >
              {action}
            </span>
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={() => onOpen(row)}
        aria-label={`${action}: ${row.title}`}
        className="absolute inset-0 cursor-pointer rounded-[inherit]"
      />
    </article>
  );
}

/** A live card's shape while the directory loads: the same badge line,
 *  title, host row and stage, so the real card lands where this was. */
export function NowSpaceCardSkeleton({ featured = false }: { featured?: boolean }) {
  return (
    <div
      aria-hidden
      className={clsx(
        "flex flex-col rounded-xl bg-primary/[0.04]",
        featured ? "gap-3 p-5" : "gap-2.5 p-4",
      )}
    >
      <div className="flex items-center gap-2">
        <span className="skeleton h-4 w-10 rounded-[4px]" />
        <span className="skeleton h-3 w-24 rounded-pill" />
      </div>
      <span
        className={clsx(
          "skeleton rounded-[7px]",
          featured ? "h-6 w-4/5" : "h-5 w-3/4",
        )}
      />
      {featured && <span className="skeleton h-6 w-1/2 rounded-[7px]" />}
      <div className="flex items-center gap-2">
        <span className="skeleton h-5 w-5 rounded-pill" />
        <span className="skeleton h-3 w-28 rounded-pill" />
      </div>
      <div className="mt-1 flex items-end gap-1.5">
        {Array.from({ length: featured ? 5 : 3 }, (_, i) => (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: placeholder faces
            key={i}
            className={clsx(
              "flex flex-col items-center gap-1",
              featured ? "w-14" : "w-12",
            )}
          >
            <span
              className={clsx(
                "skeleton rounded-pill",
                featured ? "h-12 w-12" : "h-10 w-10",
              )}
            />
            <span className="skeleton h-2.5 w-8 rounded-pill" />
          </span>
        ))}
        <span className="ml-auto skeleton h-10 w-[76px] rounded-pill" />
      </div>
    </div>
  );
}

/**
 * Explore's live card. It is the Now card, so a room looks the same in the
 * strip as in the directory it links to.
 */
export function LiveSpaceCard({
  row,
  onOpen,
}: {
  row: SpaceRow;
  onOpen: (row: SpaceRow) => void;
}) {
  return <NowSpaceCard row={row} onOpen={onOpen} />;
}

/**
 * A scheduled room as one row: calendar tile + title + host, and one
 * action. Explore's strip uses it; the directory's Later column is the
 * timeline in SpaceTimeline.tsx.
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
    <div className="flex items-center gap-3.5 rounded-[24px] bg-primary/[0.04] p-3.5 transition-colors hover:bg-primary/[0.07]">
      <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-[16px] bg-primary/[0.07]">
        {when ? (
          <>
            <span className="font-sans text-[calc(9px*var(--ws-fs))] font-bold uppercase tracking-[0.1em] text-gold">
              {when.toLocaleString([], { month: "short" })}
            </span>
            <span className="font-display text-[calc(17px*var(--ws-fs))] font-semibold leading-none text-primary tabular-nums">
              {when.getDate()}
            </span>
          </>
        ) : (
          <CalendarBlank size={18} className="text-muted" />
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-sans text-[calc(14.5px*var(--ws-fs))] font-semibold text-primary">
          {row.title}
        </span>
        <span className="flex min-w-0 items-center gap-1 truncate font-sans text-[calc(12px*var(--ws-fs))] text-subtle">
          {hostName(row.host)}
          <UserBadges
            isVerified={row.host.isVerified}
            verification={row.host.verification}
            badges={row.host.badges}
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
          <motion.button
            {...press}
            type="button"
            onClick={() => onStart(row)}
            className="shrink-0 rounded-pill bg-danger px-3.5 h-8 font-sans text-[calc(12px*var(--ws-fs))] font-semibold text-white hover:opacity-90 transition-opacity cursor-pointer"
          >
            {t("voice.start")}
          </motion.button>
        </div>
      ) : (
        <motion.button
          {...press}
          type="button"
          disabled={row.joined}
          onClick={() => onRemind(row)}
          className={clsx(
            "shrink-0 rounded-pill px-3.5 h-8 font-sans text-[calc(12px*var(--ws-fs))] font-semibold transition-colors",
            row.joined
              ? "bg-raised text-muted cursor-default"
              : "bg-primary text-page hover:bg-muted cursor-pointer",
          )}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={row.joined ? "going" : "remind"}
              {...swap}
              className="inline-block"
            >
              {row.joined ? t("voice.going") : t("voice.remind")}
            </motion.span>
          </AnimatePresence>
        </motion.button>
      )}
    </div>
  );
}
