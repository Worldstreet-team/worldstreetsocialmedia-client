"use client";

import { Headphones, Notepad, Timer, UsersThree } from "@phosphor-icons/react";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { EmptyState } from "@/components/ui/EmptyState";
import { AlertTriangle, Clock, Lock } from "@/components/ui/icons";
import {
  OverlayHeader,
  OverlayPanel,
  OverlayScrim,
  useOverlayDismiss,
} from "@/components/ui/Overlay";
import { SafeAvatar } from "@/components/ui/SafeAvatar";
import { UserBadges } from "@/components/ui/UserBadges";
import { swap } from "@/lib/motion-presets";
import {
  getSpaceRecapAction,
  type SpaceRecap,
  type SpaceRecapPerson,
} from "@/lib/space.actions";
import { RECAP_PARAM, recapIdFrom } from "./space-recap-link";

export { RECAP_PARAM, recapIdFrom, spaceRecapHref } from "./space-recap-link";

/**
 * The recap of a space, after it ended (owner 2026-10-14, after WorldMeet's
 * after-call recap): what it was, who hosted, when and for how long, who
 * spoke, how many listened, and the notes.
 *
 * A sheet, not a page: a drilldown is a modal. Portalled to the body, so it
 * opens the same from a notification row (inside a transformed list), the
 * notifications popover or the voice page.
 *
 * Notes are a later phase (live AI notes, written from a transcript the way
 * WorldMeet's worker does). Until a room has them, the sheet says plainly
 * that none were taken, never an empty heading.
 */

type Load =
  | { id: string; state: "loading" }
  | { id: string; state: "ready"; recap: SpaceRecap }
  | { id: string; state: "error"; code: string; message?: string };

/** Recaps are frozen once written, so a second open paints at once and
 *  refreshes quietly behind it. Session memory only. */
const recapCache = new Map<string, SpaceRecap>();

export function SpaceRecapSheet({
  spaceId,
  onClose,
}: {
  spaceId: string | null;
  onClose: () => void;
}) {
  const open = spaceId != null;
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useOverlayDismiss(open, onClose);

  const [load, setLoad] = useState<Load | null>(null);
  const reqRef = useRef(0);

  const fetchRecap = useCallback((id: string) => {
    const req = ++reqRef.current;
    const cached = recapCache.get(id);
    setLoad(
      cached ? { id, state: "ready", recap: cached } : { id, state: "loading" },
    );
    getSpaceRecapAction(id)
      .then((res) => {
        if (req !== reqRef.current) return;
        if (res.success) {
          recapCache.set(id, res.recap);
          setLoad({ id, state: "ready", recap: res.recap });
        } else if (!cached) {
          setLoad({ id, state: "error", code: res.code, message: res.message });
        }
      })
      .catch(() => {
        if (req !== reqRef.current || cached) return;
        setLoad({ id, state: "error", code: "FAILED" });
      });
  }, []);

  useEffect(() => {
    if (spaceId) fetchRecap(spaceId);
  }, [spaceId, fetchRecap]);

  const retry = useCallback(() => {
    if (spaceId) fetchRecap(spaceId);
  }, [spaceId, fetchRecap]);

  // A load for another space (the previous open) never paints: until this
  // one's answer is in, the sheet shows its shape.
  const cachedNow = spaceId ? recapCache.get(spaceId) : undefined;
  const view: Load | null = spaceId
    ? load?.id === spaceId
      ? load
      : cachedNow
        ? { id: spaceId, state: "ready", recap: cachedNow }
        : { id: spaceId, state: "loading" }
    : null;

  if (!mounted) return null;
  return createPortal(
    <AnimatePresence>
      {open && view && (
        <>
          <OverlayScrim
            key="space-recap-scrim"
            onClose={onClose}
            label="Close recap"
          />
          <OverlayPanel
            key="space-recap-panel"
            variant="sheet"
            ground="solid"
            className="sm:w-[min(560px,94vw)] sm:max-h-[84vh]"
            label="Space recap"
            dragClose={onClose}
          >
            <OverlayHeader title="Space recap" onClose={onClose} />
            <div className="flex flex-col overflow-y-auto px-5 pb-[calc(24px+var(--ws-safe-bottom))]">
              <AnimatePresence mode="wait" initial={false}>
                {view.state === "loading" ? (
                  <motion.div key="loading" {...swap}>
                    <RecapSkeleton />
                  </motion.div>
                ) : view.state === "error" ? (
                  <motion.div key="error" {...swap}>
                    <RecapError
                      code={view.code}
                      message={view.message}
                      onRetry={retry}
                    />
                  </motion.div>
                ) : (
                  <motion.div key={`ready-${view.id}`} {...swap}>
                    <RecapBody recap={view.recap} onNavigate={onClose} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </OverlayPanel>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/**
 * Opens the recap named by `?recap=<id>` on whatever page mounts it, and
 * takes the parameter back off the URL on close. The notifications page
 * mounts it (a recap notification links to `/notifications?recap=<id>`,
 * see `spaceRecapHref`); the voice page can mount it the same way and link
 * with `spaceRecapHref(id, "/voice")`. Wrapped in Suspense because it reads
 * the search params.
 */
export function SpaceRecapDeepLink() {
  return (
    <Suspense fallback={null}>
      <RecapFromUrl />
    </Suspense>
  );
}

function RecapFromUrl() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const spaceId = recapIdFrom(params.get(RECAP_PARAM));
  const close = useCallback(() => {
    const next = new URLSearchParams(params.toString());
    next.delete(RECAP_PARAM);
    const q = next.toString();
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
  }, [params, pathname, router]);
  return <SpaceRecapSheet spaceId={spaceId} onClose={close} />;
}

/* ------------------------------------------------------------------ */

const nameOf = (p: SpaceRecapPerson) =>
  [p.firstName, p.lastName].filter(Boolean).join(" ").trim() || p.username;

const ROLE: Record<NonNullable<SpaceRecapPerson["role"]>, string> = {
  host: "Host",
  cohost: "Co-host",
  speaker: "Speaker",
};

/** "42 min", "1 h", "2 h 5 min". */
function durationShort(minutes: number) {
  const m = Math.max(1, Math.round(minutes));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `${h} h ${rest} min` : `${h} h`;
}

/** "Tue 14 Oct, 6:12 pm to 6:54 pm", in the reader's own time zone. */
function whenLine(startIso: string, endIso: string) {
  const start = new Date(startIso);
  const end = new Date(endIso);
  if (Number.isNaN(start.getTime())) return "";
  const thisYear = start.getFullYear() === new Date().getFullYear();
  const day = (d: Date) =>
    new Intl.DateTimeFormat("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
      ...(thisYear ? {} : { year: "numeric" }),
    }).format(d);
  const time = (d: Date) =>
    new Intl.DateTimeFormat("en-GB", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(d);
  if (Number.isNaN(end.getTime())) return `${day(start)}, ${time(start)}`;
  return start.toDateString() === end.toDateString()
    ? `${day(start)}, ${time(start)} to ${time(end)}`
    : `${day(start)}, ${time(start)} to ${day(end)}, ${time(end)}`;
}

/** Seconds from the start as a clock: 4:05, 1:02:30. */
function clock(at: number) {
  const s = Math.max(0, Math.floor(at));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

const LABEL =
  "font-sans text-[calc(13px*var(--ws-fs))] font-semibold text-primary";

function RecapBody({
  recap,
  onNavigate,
}: {
  recap: SpaceRecap;
  onNavigate: () => void;
}) {
  const host = recap.host;
  const hasNotes =
    Boolean(recap.notes.summary) || recap.notes.moments.length > 0;
  const stats: { icon: typeof Timer; label: string; value: string }[] = [
    { icon: Timer, label: "Ran for", value: durationShort(recap.minutes) },
    {
      icon: Headphones,
      label: "Listened",
      value: recap.attendedCount.toLocaleString("en-US"),
    },
    // Only when the room was actually counted. No count, no tile.
    ...(recap.peakListeners != null
      ? [
          {
            icon: UsersThree,
            label: "Most at once",
            value: recap.peakListeners.toLocaleString("en-US"),
          },
        ]
      : []),
  ];

  return (
    <div className="flex flex-col gap-6 pt-1">
      <header className="flex flex-col gap-2">
        <h3 className="font-display text-[calc(20px*var(--ws-fs))] font-semibold leading-tight tracking-tight text-primary [overflow-wrap:anywhere]">
          {recap.title}
        </h3>
        <div className="flex min-w-0 items-center gap-2 font-sans text-[calc(13.5px*var(--ws-fs))] text-muted">
          {host && (
            <span className="relative block h-6 w-6 shrink-0 overflow-hidden rounded-pill bg-raised">
              <SafeAvatar src={host.avatar} sizes="24px" eager />
            </span>
          )}
          <span className="min-w-0 truncate">
            Hosted by{" "}
            {recap.isHost ? (
              <span className="font-semibold text-primary">you</span>
            ) : host ? (
              <Link
                href={`/profile/${host.username}`}
                onClick={onNavigate}
                className="font-semibold text-primary hover:underline"
              >
                {nameOf(host)}
              </Link>
            ) : (
              <span className="font-semibold text-primary">
                a former member
              </span>
            )}
          </span>
          {host && !recap.isHost && (
            <span className="inline-flex shrink-0">
              <UserBadges
                isVerified={host.isVerified}
                verification={host.verification}
                size={12}
              />
            </span>
          )}
        </div>
        <p className="font-sans text-[calc(13.5px*var(--ws-fs))] tabular-nums text-muted">
          {whenLine(recap.startedAt, recap.endedAt)}
        </p>
      </header>

      <div
        className={
          stats.length === 3
            ? "grid grid-cols-3 gap-2"
            : "grid grid-cols-2 gap-2"
        }
      >
        {stats.map(({ icon: Icon, label, value }) => (
          <div
            key={label}
            className="flex min-w-0 flex-col gap-1.5 rounded-xl bg-primary/5 px-3 py-3"
          >
            <Icon size={17} className="text-muted" aria-hidden />
            <span className="truncate font-display text-[calc(19px*var(--ws-fs))] font-semibold leading-none tabular-nums text-primary">
              {value}
            </span>
            <span className="truncate font-sans text-[calc(13px*var(--ws-fs))] text-muted">
              {label}
            </span>
          </div>
        ))}
      </div>

      <section className="flex flex-col gap-3">
        <h4 className={LABEL}>
          Who spoke{" "}
          {recap.stage.length > 0 && (
            <span className="font-normal tabular-nums text-muted">
              {recap.stage.length}
            </span>
          )}
        </h4>
        {recap.stage.length > 0 ? (
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(84px,1fr))] gap-x-2 gap-y-4">
            {recap.stage.map((p) => (
              <li key={p.id} className="min-w-0">
                <Link
                  href={`/profile/${p.username}`}
                  onClick={onNavigate}
                  className="group flex min-w-0 flex-col items-center gap-1.5 text-center"
                >
                  <span className="relative block h-12 w-12 overflow-hidden rounded-pill bg-raised">
                    <SafeAvatar src={p.avatar} sizes="48px" eager />
                  </span>
                  <span className="flex w-full min-w-0 items-center justify-center gap-0.5">
                    <span className="truncate font-sans text-[calc(13px*var(--ws-fs))] font-medium text-primary group-hover:underline">
                      {nameOf(p).split(" ")[0]}
                    </span>
                    <UserBadges
                      isVerified={p.isVerified}
                      verification={p.verification}
                      size={11}
                    />
                  </span>
                  {p.role && (
                    <span className="font-sans text-[calc(12.5px*var(--ws-fs))] leading-none text-muted">
                      {ROLE[p.role]}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="font-sans text-[calc(13.5px*var(--ws-fs))] text-muted">
            Nobody from this stage is on WorldSpace any more.
          </p>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h4 className={LABEL}>Notes</h4>
        {hasNotes ? (
          <div className="flex flex-col gap-4">
            {recap.notes.summary && (
              <p className="whitespace-pre-line font-sans text-[calc(14px*var(--ws-fs))] leading-relaxed text-primary">
                {recap.notes.summary}
              </p>
            )}
            {recap.notes.moments.length > 0 && (
              <ol className="flex flex-col">
                {recap.notes.moments.map((m, i) => (
                  <li
                    key={`${m.at}-${i}`}
                    className="grid grid-cols-[3.5rem_minmax(0,1fr)] gap-x-2 border-b border-hairline py-2.5 last:border-b-0"
                  >
                    <span className="font-sans text-[calc(13px*var(--ws-fs))] tabular-nums text-subtle">
                      {clock(m.at)}
                    </span>
                    <span className="font-sans text-[calc(13.5px*var(--ws-fs))] leading-snug text-primary">
                      <span className="font-semibold">{m.speaker}</span>{" "}
                      <span className="text-muted">{m.text}</span>
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        ) : (
          <div className="flex gap-3 rounded-xl bg-primary/5 px-4 py-3.5">
            <Notepad
              size={18}
              className="mt-0.5 shrink-0 text-muted"
              aria-hidden
            />
            <div className="flex min-w-0 flex-col gap-0.5">
              <p className="font-sans text-[calc(14px*var(--ws-fs))] font-medium text-primary">
                Notes weren&apos;t taken for this room.
              </p>
              <p className="font-sans text-[calc(13px*var(--ws-fs))] leading-snug text-muted">
                When a room has notes, its summary and key moments show up here.
              </p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

/** The recap's own shape while it loads, so the real one lands in place. */
function RecapSkeleton() {
  return (
    <div className="flex flex-col gap-6 pt-1" aria-busy="true">
      <span className="sr-only">Loading the recap</span>
      <div className="flex flex-col gap-2.5">
        <div className="skeleton h-6 w-3/4 rounded-sm" />
        <div className="flex items-center gap-2">
          <div className="skeleton h-6 w-6 rounded-pill" />
          <div className="skeleton h-3.5 w-40 rounded-sm" />
        </div>
        <div className="skeleton h-3.5 w-52 rounded-sm" />
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="skeleton h-[86px] rounded-xl" />
        ))}
      </div>
      <div className="flex flex-col gap-3">
        <div className="skeleton h-3.5 w-20 rounded-sm" />
        <div className="grid grid-cols-[repeat(auto-fill,minmax(84px,1fr))] gap-x-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex flex-col items-center gap-1.5">
              <div className="skeleton h-12 w-12 rounded-pill" />
              <div className="skeleton h-3 w-14 rounded-sm" />
              <div className="skeleton h-2.5 w-10 rounded-sm" />
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-3">
        <div className="skeleton h-3.5 w-14 rounded-sm" />
        <div className="skeleton h-[68px] rounded-xl" />
      </div>
    </div>
  );
}

function RecapError({
  code,
  message,
  onRetry,
}: {
  code: string;
  message?: string;
  onRetry: () => void;
}) {
  if (code === "NOT_ATTENDED") {
    return (
      <EmptyState
        icon={Lock}
        title="This recap is for people who were there"
        caption="Only the host and people who were in this space can see its recap."
      />
    );
  }
  if (code === "NOT_ENDED") {
    return (
      <EmptyState
        icon={Clock}
        title="No recap yet"
        caption={message || "The recap is ready once the space ends."}
        action={{ label: "Check again", onClick: onRetry }}
      />
    );
  }
  if (code === "NO_RECAP") {
    return (
      <EmptyState
        icon={Clock}
        title="No recap for this space"
        caption="It never went live, so there's nothing to recap."
      />
    );
  }
  if (code === "NOT_FOUND") {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="This space is gone"
        caption="It may have been removed, so its recap is gone with it."
      />
    );
  }
  return (
    <EmptyState
      icon={AlertTriangle}
      title="Couldn't load this recap"
      caption="Something went wrong on our side. Try again in a moment."
      action={{ label: "Try again", onClick: onRetry }}
    />
  );
}
