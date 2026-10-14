"use client";

import { Bell, Check } from "@phosphor-icons/react";
import clsx from "clsx";
import { AnimatePresence, motion, useReducedMotionConfig } from "framer-motion";
import { SafeAvatar } from "@/components/ui/SafeAvatar";
import HostSpaceMenu from "@/components/voice/HostSpaceMenu";
import {
  type SpaceRow,
  SpaceHostLine,
  spaceGoingCount,
} from "@/components/voice/SpaceCard";
import {
  formatCountdown,
  formatStartsIn,
  useNow,
} from "@/components/voice/useNow";
import { useT } from "@/i18n/client";
import { DUR, EASE, EASE_IN, press, swap } from "@/lib/motion-presets";
import { formatCompact } from "@/lib/utils";

/**
 * When a room starts, in the viewer's own time: "Today" / "Tomorrow" /
 * "Tue 14 Oct", the time in their locale's form, and the short zone name,
 * so a room booked from Lagos reads right in London.
 */
function whenParts(date: Date) {
  const startOfDay = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  // Rounded, because a day across a clock change is 23 or 25 hours.
  const days = Math.round(
    (startOfDay(date) - startOfDay(new Date())) / 86_400_000,
  );
  const day =
    days === 0
      ? "Today"
      : days === 1
        ? "Tomorrow"
        : date.toLocaleDateString([], {
            weekday: "short",
            day: "numeric",
            month: "short",
          });
  const time = date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
  const zone =
    new Intl.DateTimeFormat([], { timeZoneName: "short" })
      .formatToParts(date)
      .find((p) => p.type === "timeZoneName")?.value ?? "";
  return { day, time, zone };
}

/** The next room's clock: HH:MM:SS on the shared second. */
function NextCountdown({ target }: { target: string }) {
  const now = useNow();
  const ms = new Date(target).getTime() - now;
  // Holds the clock's height until the first client tick, so nothing
  // under it jumps when the digits arrive.
  if (!now) return <div aria-hidden className="h-[60px]" />;
  if (ms <= 0) {
    return (
      <p className="mt-1.5 font-display text-[calc(20px*var(--ws-fs))] font-semibold text-gold">
        Starting now
      </p>
    );
  }
  return (
    <div className="mt-1.5">
      <p
        role="timer"
        className="font-mono text-[calc(30px*var(--ws-fs))] font-semibold leading-none tracking-tight text-primary tabular-nums"
      >
        {formatCountdown(ms)}
      </p>
      <p className="mt-1.5 font-sans text-[calc(12.5px*var(--ws-fs))] text-muted">
        until it starts
      </p>
    </div>
  );
}

/** "in 2d 4h" for every room after the next one. */
function StartsIn({ target }: { target: string }) {
  const now = useNow();
  if (!now) return <div aria-hidden className="h-[18px]" />;
  return (
    <p className="mt-0.5 font-sans text-[calc(12.5px*var(--ws-fs))] text-muted tabular-nums">
      {formatStartsIn(new Date(target).getTime() - now)}
    </p>
  );
}

/** A few faces of the people going, and how many in all. */
function GoingFaces({ row }: { row: SpaceRow }) {
  const faces = row.goingSample ?? [];
  const count = spaceGoingCount(row);
  // Nobody yet: say nothing rather than "0 going". The button beside this
  // is the invitation.
  if (count === 0) return null;
  return (
    <span className="flex min-w-0 items-center gap-2">
      {faces.length > 0 && (
        <span className="flex shrink-0 -space-x-2">
          {faces.slice(0, 3).map((person) => (
            <span
              key={String(person.id)}
              className="relative block h-6 w-6 overflow-hidden rounded-pill bg-raised ring-2 ring-surface"
            >
              <SafeAvatar src={person.avatar} sizes="24px" />
            </span>
          ))}
        </span>
      )}
      <span className="truncate font-sans text-[calc(12.5px*var(--ws-fs))] text-muted tabular-nums">
        {formatCompact(count)} going
      </span>
    </span>
  );
}

/**
 * Remind me / Going. Going is a real toggle: tapping it again takes the
 * reminder back, which a room you can no longer make needs.
 */
function GoingToggle({
  row,
  next,
  onToggle,
}: {
  row: SpaceRow;
  next: boolean;
  onToggle: (row: SpaceRow) => void;
}) {
  const t = useT();
  const going = row.joined;
  return (
    <motion.button
      {...press}
      type="button"
      aria-pressed={going}
      title={going ? "You'll get a reminder. Tap to take it back." : undefined}
      onClick={() => onToggle(row)}
      className={clsx(
        "flex h-10 shrink-0 cursor-pointer items-center rounded-pill px-4 font-sans text-[calc(13px*var(--ws-fs))] font-semibold transition-colors",
        going
          ? "bg-brand/10 text-gold hover:bg-brand/15"
          : next
            ? "bg-brand text-brand-on hover:bg-brand-active"
            : "bg-primary/10 text-primary hover:bg-primary/15",
      )}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={going ? "going" : "remind"}
          {...swap}
          className="flex items-center gap-1.5"
        >
          {going ? (
            <Check size={14} weight="bold" />
          ) : (
            <Bell size={15} />
          )}
          {going ? t("voice.going") : t("voice.remind")}
        </motion.span>
      </AnimatePresence>
    </motion.button>
  );
}

function LaterEntry({
  row,
  next,
  last,
  onToggleGoing,
  onStart,
  onEdit,
  onCancel,
}: {
  row: SpaceRow;
  next: boolean;
  last: boolean;
  onToggleGoing: (row: SpaceRow) => void;
  onStart: (row: SpaceRow) => void;
  onEdit?: (row: SpaceRow) => void;
  onCancel?: (row: SpaceRow) => void;
}) {
  const t = useT();
  const when = row.scheduledFor ? new Date(row.scheduledFor) : null;
  const parts = when ? whenParts(when) : null;

  return (
    <div className={clsx("relative pl-6", !last && "pb-6")}>
      {/* The wire between this room and the next. */}
      {!last && (
        <span
          aria-hidden
          className="absolute bottom-0 left-[4px] top-[18px] w-px bg-hairline"
        />
      )}
      <span
        aria-hidden
        className={clsx(
          "absolute left-0 top-[5px] h-[9px] w-[9px] rounded-pill",
          next ? "bg-brand ring-4 ring-brand/20" : "bg-primary/25",
        )}
      />

      {parts && (
        <p className="font-sans text-[calc(12px*var(--ws-fs))] text-muted">
          <span
            className={clsx(
              "font-semibold",
              next ? "text-gold" : "text-primary",
            )}
          >
            {parts.day}
          </span>{" "}
          <span className="tabular-nums">{parts.time}</span>
          {parts.zone && ` ${parts.zone}`}
        </p>
      )}
      {row.scheduledFor &&
        (next ? (
          <NextCountdown target={row.scheduledFor} />
        ) : (
          <StartsIn target={row.scheduledFor} />
        ))}

      <h3 className="mt-2 line-clamp-2 font-sans text-[calc(14.5px*var(--ws-fs))] font-semibold leading-snug text-primary">
        {row.title}
      </h3>
      <div className="mt-2">
        <SpaceHostLine host={row.host} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
        <GoingFaces row={row} />
        <div className="ml-auto flex shrink-0 items-center gap-1">
          {row.isHost ? (
            <>
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
                className="flex h-10 shrink-0 cursor-pointer items-center rounded-pill bg-danger px-4 font-sans text-[calc(13px*var(--ws-fs))] font-semibold text-[#fafaf9] transition-opacity hover:opacity-90"
              >
                {t("voice.start")}
              </motion.button>
            </>
          ) : (
            <GoingToggle row={row} next={next} onToggle={onToggleGoing} />
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * The Later column (Layout B, owner pick 2026-10-14): scheduled rooms on
 * one wire, soonest first. The next room carries the big clock; the rest
 * say how far off they are, so the order and the gaps read at a glance.
 */
export function LaterTimeline({
  rows,
  onToggleGoing,
  onStart,
  onEdit,
  onCancel,
}: {
  rows: SpaceRow[];
  onToggleGoing: (row: SpaceRow) => void;
  onStart: (row: SpaceRow) => void;
  onEdit?: (row: SpaceRow) => void;
  onCancel?: (row: SpaceRow) => void;
}) {
  const reduced = useReducedMotionConfig();
  return (
    <ol className="@container rounded-xl bg-surface p-4">
      <AnimatePresence initial={false}>
        {rows.map((row, i) => (
          <motion.li
            key={row.id}
            layout={reduced ? false : "position"}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: DUR.base, ease: EASE } }}
            exit={{ opacity: 0, transition: { duration: DUR.fast, ease: EASE_IN } }}
            transition={{ layout: { duration: DUR.base, ease: EASE } }}
          >
            <LaterEntry
              row={row}
              next={i === 0}
              last={i === rows.length - 1}
              onToggleGoing={onToggleGoing}
              onStart={onStart}
              onEdit={onEdit}
              onCancel={onCancel}
            />
          </motion.li>
        ))}
      </AnimatePresence>
    </ol>
  );
}

/** The timeline's shape while the directory loads: the same wire, the big
 *  clock on the first entry, and an action on every one. */
export function LaterTimelineSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div aria-hidden className="rounded-xl bg-surface p-4">
      {Array.from({ length: count }, (_, i) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: placeholder rows
          key={i}
          className={clsx("relative pl-6", i < count - 1 && "pb-6")}
        >
          {i < count - 1 && (
            <span className="absolute bottom-0 left-[4px] top-[18px] w-px bg-hairline" />
          )}
          <span className="absolute left-0 top-[5px] h-[9px] w-[9px] rounded-pill bg-primary/15" />
          <span className="block skeleton h-3 w-32 rounded-pill" />
          {i === 0 ? (
            <>
              <span className="mt-2.5 block skeleton h-8 w-40 rounded-[7px]" />
              <span className="mt-2 block skeleton h-3 w-24 rounded-pill" />
            </>
          ) : (
            <span className="mt-1.5 block skeleton h-3 w-16 rounded-pill" />
          )}
          <span className="mt-3 block skeleton h-4 w-4/5 rounded-[7px]" />
          <div className="mt-2.5 flex items-center gap-2">
            <span className="skeleton h-5 w-5 rounded-pill" />
            <span className="skeleton h-3 w-24 rounded-pill" />
          </div>
          <div className="mt-3 flex items-center gap-2">
            <span className="skeleton h-6 w-16 rounded-pill" />
            <span className="ml-auto skeleton h-10 w-[116px] rounded-pill" />
          </div>
        </div>
      ))}
    </div>
  );
}
