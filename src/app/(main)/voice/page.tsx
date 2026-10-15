"use client";

import {
  CalendarBlank,
  CaretDown,
  Check,
  GearSix,
  MagnifyingGlass,
  Plus,
  SortDescending,
  Waveform,
} from "@phosphor-icons/react";
import clsx from "clsx";
import { AnimatePresence, motion, useReducedMotionConfig } from "framer-motion";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useSearchParams } from "next/navigation";
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRealtime } from "@/components/providers/RealtimeProvider";
import ConfirmModal from "@/components/ui/ConfirmModal";
import { Tabs } from "@/components/ui/Tabs";
import { useToast } from "@/components/ui/Toast/ToastContext";
import CreateSpaceSheet, {
  type SpaceCreateResult,
  type SpaceDraft,
  type SpacePatch,
} from "@/components/voice/CreateSpaceSheet";
import {
  hostName,
  NowSpaceCard,
  NowSpaceCardSkeleton,
  type SpaceRow,
  spaceCommunities,
  spaceListenerCount,
} from "@/components/voice/SpaceCard";
import {
  LaterTimeline,
  LaterTimelineSkeleton,
} from "@/components/voice/SpaceTimeline";
import { SpaceRecapDeepLink } from "@/components/voice/SpaceRecapSheet";
import { SpaceVoiceSettingsSheet } from "@/components/voice/SpaceVoiceSettingsSheet";
import { YourRoomBar } from "@/components/voice/YourRoomBar";
import {
  SpaceEmptyState,
  type SpaceEmptyStateProps,
} from "@/components/voice/signal/SpaceEmptyState";
import { VERTICALS, type VerticalId } from "@/data/categories";
import { useT } from "@/i18n/client";
import { getCategory, VERTICAL_BY_ID } from "@/lib/categories";
import { demoLiveSpaces, demoUpcomingSpaces, isDemoId } from "@/lib/demoSeed";
import {
  DUR,
  EASE,
  EASE_IN,
  menuStagger,
  press,
  staggerItem,
} from "@/lib/motion-presets";
import {
  cancelSpaceAction,
  createSpaceAction,
  getSpaceAction,
  getSpacesAction,
  joinSpaceAction,
  leaveSpaceAction,
  startSpaceAction,
  updateSpaceAction,
} from "@/lib/space.actions";
import {
  spacesFetchedAtAtom,
  spacesLiveAtom,
  spacesLoadedAtom,
  spacesUpcomingAtom,
} from "@/store/spaces.atom";
import { voiceRefreshAtom, voiceSessionAtom } from "@/store/voice.atom";

/** A week ahead, for the Later column's "This week". */
const WEEK_MS = 7 * 86_400_000;

type SortKey = "listeners" | "newest";
const SORT_LABEL: Record<SortKey, string> = {
  listeners: "Most listeners",
  newest: "Newest",
};

/**
 * The vertical a space files under. `category` may be a taxonomy category
 * id or a vertical id directly; anything else (or nothing) files nowhere,
 * so it only shows under "All".
 */
function spaceVertical(row: SpaceRow): VerticalId | undefined {
  if (!row.category) return undefined;
  if (VERTICAL_BY_ID.has(row.category as VerticalId)) {
    return row.category as VerticalId;
  }
  return getCategory(row.category)?.vertical;
}

function startedAtMs(row: SpaceRow) {
  const t = row.startedAt ? new Date(row.startedAt).getTime() : 0;
  return Number.isFinite(t) ? t : 0;
}

/** How the Now column orders its rooms. The first one is drawn larger. */
function sortLive(rows: SpaceRow[], sort: SortKey) {
  return [...rows].sort((a, b) =>
    sort === "listeners"
      ? spaceListenerCount(b) - spaceListenerCount(a) ||
        startedAtMs(b) - startedAtMs(a)
      : startedAtMs(b) - startedAtMs(a),
  );
}

/** Most listeners or Newest, as a small menu beside the Now heading. */
function SortMenu({
  value,
  onChange,
}: {
  value: SortKey;
  onChange: (key: SortKey) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Click-away and Escape, like every other menu on these surfaces.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Sort: ${SORT_LABEL[value]}`}
        onClick={() => setOpen((v) => !v)}
        className="flex h-10 cursor-pointer items-center gap-1.5 rounded-pill px-3 font-sans text-[calc(12.5px*var(--ws-fs))] font-semibold text-muted transition-colors hover:bg-primary/5 hover:text-primary"
      >
        <SortDescending size={15} />
        {SORT_LABEL[value]}
        <CaretDown size={11} weight="bold" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            key="sort-menu"
            role="menu"
            {...menuStagger("top-right")}
            className="absolute right-0 top-full z-dropdown mt-1 w-[184px] overflow-hidden rounded-xl border border-hairline bg-surface py-1 shadow-nav"
          >
            {(Object.keys(SORT_LABEL) as SortKey[]).map((key) => (
              <motion.button
                key={key}
                variants={staggerItem}
                type="button"
                role="menuitemradio"
                aria-checked={value === key}
                onClick={() => {
                  onChange(key);
                  setOpen(false);
                }}
                className="flex w-full cursor-pointer items-center justify-between gap-2 px-3.5 py-2.5 text-left font-sans text-[calc(13px*var(--ws-fs))] font-medium text-primary transition-colors hover:bg-raised"
              >
                {SORT_LABEL[key]}
                {value === key && (
                  <Check size={14} weight="bold" className="text-gold" />
                )}
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** The button an empty state offers. Starting or scheduling a room is the
 *  page's brand action; clearing a filter or retrying is not. */
function EmptyAction({
  label,
  onClick,
  brand = false,
}: {
  label: string;
  onClick: () => void;
  brand?: boolean;
}) {
  return (
    <motion.button
      {...press}
      type="button"
      onClick={onClick}
      className={clsx(
        "flex h-10 cursor-pointer items-center justify-center gap-1.5 rounded-pill px-4 font-sans text-[calc(13px*var(--ws-fs))] font-semibold transition-colors",
        brand
          ? "bg-brand text-brand-on hover:bg-brand-active"
          : "bg-primary/10 text-primary hover:bg-primary/15",
      )}
    >
      {brand && <Plus size={14} weight="bold" />}
      {label}
    </motion.button>
  );
}

/** Column heading: the word, its count, and a control on the right. */
function ColumnHead({
  id,
  title,
  count,
  children,
}: {
  id: string;
  title: string;
  count?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex min-h-10 items-center justify-between gap-3">
      <h2
        id={id}
        className="flex items-baseline gap-2 font-display text-[calc(17px*var(--ws-fs))] font-semibold text-primary"
      >
        {title}
        {count && (
          <span className="font-sans text-[calc(13px*var(--ws-fs))] font-medium text-muted tabular-nums">
            {count}
          </span>
        )}
      </h2>
      {children}
    </div>
  );
}

/**
 * Space Voice, the rooms directory: Layout B, "Now on the left, later on a
 * timeline" (owner pick 2026-10-14). The page takes the whole canvas
 * (MainShell drops the discovery rail on /voice): what you can join this
 * minute on the left, a timeline of what starts next on the right, where
 * the rail used to be. One column on a phone, Now first.
 *
 * Opening a live room drops into the stage (SpaceRoom, rendered app-wide by
 * VoiceRoomHost); creating one goes through CreateSpaceSheet. The shared
 * spaces cache, the `spaces` Ably channel and a slow poll keep it honest.
 */
function VoiceDirectory() {
  const t = useT();
  const { toast } = useToast();
  const { client } = useRealtime();
  const params = useSearchParams();
  const reduced = useReducedMotionConfig();
  // The directory is cached app-wide (stale-while-revalidate): a revisit
  // paints the last result immediately and the poll/refetch converges it.
  const [cachedLive, setCachedLive] = useAtom(spacesLiveAtom);
  const [cachedUpcoming, setCachedUpcoming] = useAtom(spacesUpcomingAtom);
  const [spacesLoaded, setSpacesLoaded] = useAtom(spacesLoadedAtom);
  const setSpacesFetchedAt = useSetAtom(spacesFetchedAtAtom);
  // Skeletons only on the genuinely first visit of a session.
  const [loading, setLoading] = useState(!spacesLoaded);
  // The last listing call failed. With nothing cached that is the whole
  // page's answer; with a cache it is a quiet line above it.
  const [loadFailed, setLoadFailed] = useState(false);
  const [creating, setCreating] = useState(() => params.get("create") === "1");
  // Design-review mode (?demo=1): seeded rows, clearly chipped, never default.
  // Demo rows are merged at display time so they never enter the cache.
  const demo = params.get("demo") === "1";
  const live = useMemo(
    () => (demo ? [...cachedLive, ...demoLiveSpaces()] : cachedLive),
    [cachedLive, demo],
  );
  const upcoming = useMemo(
    () =>
      demo
        ? [...cachedUpcoming, ...demoUpcomingSpaces()].sort(
            (a, b) =>
              new Date(a.scheduledFor ?? 0).getTime() -
              new Date(b.scheduledFor ?? 0).getTime(),
          )
        : cachedUpcoming,
    [cachedUpcoming, demo],
  );
  const [busy, setBusy] = useState(false);
  // Host escape hatches on a scheduled room: change it, or call it off.
  const [editing, setEditing] = useState<SpaceRow | null>(null);
  const [cancelTarget, setCancelTarget] = useState<SpaceRow | null>(null);
  // The room lives app-wide so it survives navigation and can minimise into
  // the floating dock; this page only opens it.
  const [session, setSession] = useAtom(voiceSessionAtom);
  const refreshTick = useAtomValue(voiceRefreshAtom);
  const deepLinkRef = useRef<string | null>(params.get("s"));
  // Search over title, host and community; a topic rail over the
  // taxonomy's 14 verticals; the order of the Now column; and whether the
  // timeline stops at a week out. All client-side.
  const [query, setQuery] = useState("");
  const [vertical, setVertical] = useState<"all" | VerticalId>("all");
  const [sort, setSort] = useState<SortKey>("listeners");
  const [thisWeek, setThisWeek] = useState(false);
  // Space Voice settings live here too, like Messages' own sheet: the same
  // prefs as Settings → Notifications → Spaces, at the place you use them.
  const [settingsOpen, setSettingsOpen] = useState(false);
  // A second tap on Remind me while the first is in flight is ignored.
  const rsvpBusy = useRef(new Set<string>());

  const load = useCallback(async () => {
    const res = await getSpacesAction();
    if (res.success) {
      setCachedLive(res.live);
      setCachedUpcoming(res.upcoming);
      setSpacesLoaded(true);
      setSpacesFetchedAt(Date.now());
      setLoadFailed(false);
      // Keep the open room's header numbers fresh.
      setSession((prev) => {
        if (!prev) return prev;
        const fresh = res.live.find((r: SpaceRow) => r.id === prev.row.id);
        return fresh ? { ...prev, row: fresh } : prev;
      });
    } else {
      setLoadFailed(true);
    }
    setLoading(false);
    return res.success ? res : null;
  }, [
    setSession,
    setCachedLive,
    setCachedUpcoming,
    setSpacesLoaded,
    setSpacesFetchedAt,
  ]);

  // Skip the first run: the mount effect below already loads, and the two
  // together used to issue the listing twice back to back on every visit.
  const refreshInitRef = useRef(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: refreshTick is the signal; its value is unused.
  useEffect(() => {
    if (!refreshInitRef.current) {
      refreshInitRef.current = true;
      return;
    }
    void load();
  }, [refreshTick, load]);

  useEffect(() => {
    // Demo rows paint immediately: the review shouldn't wait out a cold
    // gateway; real rows merge in whenever the fetch lands.
    if (demo) setLoading(false);
    void load();
    // Ably's `spaces` channel below is the fast path; this is only the
    // dropped-socket floor, so it runs slow and never while hidden
    // (audit 2026-09-01: the 20s duplicate poll is gone).
    const poll = setInterval(() => {
      if (document.visibilityState !== "hidden") void load();
    }, 5 * 60_000);
    return () => clearInterval(poll);
  }, [load, demo]);

  // The gateway publishes created/started/ended on the `spaces` channel;
  // until that deploy, the attach simply fails quietly and the poll rules.
  useEffect(() => {
    if (!client) return;
    const channel = client.channels.get("spaces");
    const onEvent = () => void load();
    void channel.subscribe(onEvent).catch(() => {});
    return () => channel.unsubscribe(onEvent);
  }, [client, load]);

  const retry = async () => {
    setLoadFailed(false);
    setLoading(true);
    await load();
  };

  /**
   * The setup sheet's last step. A refusal goes back to the sheet with the
   * gateway's own words (and, for a community it can't use, which one), so
   * it can show them where they belong instead of a toast over the line.
   * Live: the sheet closes and the room opens. Scheduled: the sheet stays
   * up, ends on its clock with the confirmation, and closes itself.
   */
  const create = async (draft: SpaceDraft): Promise<SpaceCreateResult> => {
    if (busy) return { success: false };
    setBusy(true);
    try {
      const res = await createSpaceAction(draft);
      if (!res.success) {
        return {
          success: false,
          message: res.message,
          code: "code" in res ? res.code : undefined,
          communityId: "communityId" in res ? res.communityId : undefined,
        };
      }
      const fresh = await load();
      if (draft.scheduledFor) return { success: true };
      setCreating(false);
      toast(t("voice.created"), { type: "success" });
      // Starting now drops you straight into your room. Creating one and
      // being left staring at the directory was the broken half of this.
      if (res.spaceId) {
        const mine = fresh?.live.find(
          (r: SpaceRow) => r.id === String(res.spaceId),
        );
        if (mine) setSession({ row: mine, minimized: false });
      }
      return { success: true };
    } finally {
      setBusy(false);
    }
  };

  const openRoom = async (row: SpaceRow) => {
    setSession({ row, minimized: false });
    if (!row.joined && !row.isHost && !isDemoId(row.id)) {
      await joinSpaceAction(row.id);
      void load();
    }
  };

  // A shared /voice/<id> link lands here as ?s=<id>. Live rooms open
  // directly; anything else resolves by id and gets an honest answer:
  // a link to a scheduled/ended room used to silently do nothing at all.
  useEffect(() => {
    const want = deepLinkRef.current;
    if (!want || loading) return;
    const found = live.find((r) => r.id === want);
    if (found) {
      deepLinkRef.current = null;
      void openRoom(found);
      return;
    }
    deepLinkRef.current = null;
    void getSpaceAction(want).then((res) => {
      if (!res.success || !res.space) {
        toast(t("voice.linkGone"), { type: "error" });
        return;
      }
      if (res.space.status === "live") {
        void openRoom(res.space as SpaceRow);
      } else if (res.space.status === "scheduled") {
        // It's in the Later column; the toast points there.
        toast(t("voice.linkScheduled"), { type: "success" });
      } else {
        toast(t("voice.linkOver"), { type: "error" });
      }
    });
  });

  /**
   * Remind me / Going, both ways. RSVP is the room's membership (join), and
   * taking it back is leave, which the gateway allows on a scheduled room.
   * Optimistic, because the person pressed it and should see it land; the
   * reload after puts the server's numbers back.
   */
  const toggleGoing = async (row: SpaceRow) => {
    if (isDemoId(row.id)) {
      toast(t("voice.demoRow"), { type: "success" });
      return;
    }
    if (rsvpBusy.current.has(row.id)) return;
    rsvpBusy.current.add(row.id);
    const going = !row.joined;
    const patch = (joined: boolean, delta: number) =>
      setCachedUpcoming((prev) =>
        prev.map((r) =>
          r.id === row.id
            ? {
                ...r,
                joined,
                membersCount: Math.max(0, r.membersCount + delta),
              }
            : r,
        ),
      );
    patch(going, going ? 1 : -1);
    const res = going
      ? await joinSpaceAction(row.id)
      : await leaveSpaceAction(row.id);
    rsvpBusy.current.delete(row.id);
    if (!res.success) {
      patch(!going, going ? -1 : 1);
      toast("Couldn't update your reminder. Try again.", { type: "error" });
      return;
    }
    toast(going ? t("voice.reminded") : "Reminder off", { type: "success" });
    void load();
  };

  const start = async (row: SpaceRow) => {
    if (isDemoId(row.id)) return;
    const res = await startSpaceAction(row.id);
    if (!res.success) {
      toast(res.message || t("voice.startFailed"), { type: "error" });
      return;
    }
    await load();
    setSession({
      row: { ...row, status: "live", startedAt: new Date().toISOString() },
      minimized: false,
    });
  };

  const saveEdit = async (patch: SpacePatch) => {
    if (!editing || busy) return;
    setBusy(true);
    try {
      const res = await updateSpaceAction(editing.id, patch);
      if (res.success) {
        setEditing(null);
        await load();
        toast(t("voice.saved"), { type: "success" });
      } else {
        toast(res.message || t("voice.startFailed"), { type: "error" });
        // Someone started or cancelled it while the sheet was open; the
        // sheet is now describing a space that no longer exists in that
        // state, so close it rather than let them keep editing a ghost.
        if (res.code === "WRONG_STATE") {
          setEditing(null);
          await load();
        }
      }
    } finally {
      setBusy(false);
    }
  };

  const confirmCancel = async () => {
    const row = cancelTarget;
    if (!row) return;
    setCancelTarget(null);
    if (isDemoId(row.id)) {
      toast(t("voice.demoRow"), { type: "success" });
      return;
    }
    // Drop it from the list immediately: a cancelled room lingering under a
    // "cancelled" toast is the thing that makes people press it twice.
    setCachedUpcoming((prev) => prev.filter((r) => r.id !== row.id));
    const res = await cancelSpaceAction(row.id);
    if (!res.success) {
      toast(res.message || t("voice.startFailed"), { type: "error" });
    } else {
      toast(t("voice.cancelledToast"), { type: "success" });
    }
    await load();
  };

  /**
   * The room this viewer is in, for the bar above the Now column. The
   * session is the truth when there is one (the listing's copy is fresher,
   * so it wins when both exist); without one, a live room the viewer hosts
   * or co-hosts still counts, because a reload or another device leaves it
   * running with nobody at the desk.
   */
  const yourRoom = useMemo(() => {
    if (session && session.row.status === "live") {
      const fresh = live.find((r) => r.id === session.row.id);
      return { row: fresh ?? session.row, connected: true };
    }
    const hosted = live.find((r) => r.isHost || r.isCohost);
    return hosted ? { row: hosted, connected: false } : null;
  }, [session, live]);

  const openYourRoom = () => {
    if (!yourRoom) return;
    if (session && session.row.id === yourRoom.row.id) {
      setSession({ row: yourRoom.row, minimized: false });
    } else {
      void openRoom(yourRoom.row);
    }
  };

  // Search matches the title, the host (display name or @username) and the
  // communities the room goes to; the chip narrows to one vertical.
  const q = query.trim().toLowerCase();
  const matches = useCallback(
    (row: SpaceRow) => {
      const okQuery =
        !q ||
        row.title.toLowerCase().includes(q) ||
        hostName(row.host).toLowerCase().includes(q) ||
        row.host.username.toLowerCase().includes(q) ||
        spaceCommunities(row).some((c) => c.name.toLowerCase().includes(q));
      const okVertical = vertical === "all" || spaceVertical(row) === vertical;
      return okQuery && okVertical;
    },
    [q, vertical],
  );
  const filtering = q.length > 0 || vertical !== "all";
  const clearFilters = () => {
    setQuery("");
    setVertical("all");
    setThisWeek(false);
  };

  // Your own room is in the bar, so the cards are everyone else's.
  const othersLive = useMemo(
    () => live.filter((r) => r.id !== yourRoom?.row.id),
    [live, yourRoom],
  );
  const liveShown = useMemo(
    () => sortLive(othersLive.filter(matches), sort),
    [othersLive, matches, sort],
  );
  const upcomingShown = useMemo(() => {
    const horizon = Date.now() + WEEK_MS;
    return upcoming.filter(
      (row) =>
        matches(row) &&
        (!thisWeek ||
          new Date(row.scheduledFor ?? 0).getTime() <= horizon),
    );
  }, [upcoming, matches, thisWeek]);

  const showSkeleton = loading && live.length === 0 && upcoming.length === 0;
  const offline =
    !showSkeleton &&
    loadFailed &&
    !spacesLoaded &&
    live.length === 0 &&
    upcoming.length === 0;
  const nowCount = liveShown.length + (yourRoom ? 1 : 0);

  // One empty state per column, whose props change with the reason, so its
  // art morphs from one reason to the next instead of redrawing.
  const nowEmpty: SpaceEmptyStateProps | null =
    othersLive.length === 0
      ? // Your own room being the only one live is not an empty page.
        yourRoom
        ? null
        : {
            kind: "live",
            title: "Nobody's live right now",
            body: "Start a space and the room fills in as people join.",
            action: (
              <EmptyAction
                brand
                label="Start a space"
                onClick={() => setCreating(true)}
              />
            ),
          }
      : liveShown.length === 0
        ? {
            kind: "search",
            title: "No live rooms match",
            body: "Try another word or topic.",
            action: <EmptyAction label="Clear filters" onClick={clearFilters} />,
          }
        : null;
  const laterEmpty: SpaceEmptyStateProps | null =
    upcoming.length === 0
      ? {
          kind: "upcoming",
          title: "Nothing scheduled",
          body: "Book a time and people can ask to be reminded.",
          action: (
            <EmptyAction
              brand
              label="Schedule one"
              onClick={() => setCreating(true)}
            />
          ),
        }
      : upcomingShown.length === 0
        ? {
            kind: "search",
            title: filtering ? "Nothing scheduled matches" : "Nothing this week",
            body: filtering
              ? "Try another word or topic."
              : "The next room is further out.",
            action: (
              <EmptyAction
                label={filtering ? "Clear filters" : "Show all"}
                onClick={clearFilters}
              />
            ),
          }
        : null;

  const topicItems = useMemo(
    () => [
      { key: "all" as const, label: t("voice.all") },
      ...VERTICALS.map((v) => ({ key: v.id, label: v.label })),
    ],
    [t],
  );

  const rowMotion = (i: number) => ({
    layout: reduced ? false : ("position" as const),
    initial: { opacity: 0, y: 8 },
    animate: {
      opacity: 1,
      y: 0,
      transition: { duration: DUR.base, ease: EASE, delay: Math.min(i, 4) * 0.03 },
    },
    exit: { opacity: 0, transition: { duration: DUR.fast, ease: EASE_IN } },
    transition: { layout: { duration: DUR.base, ease: EASE } },
  });

  return (
    <div className="w-full min-w-0 px-4 pb-nav pt-5 md:px-6 md:pb-10 md:pt-7 xl:px-8">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <header className="flex flex-wrap items-end gap-x-6 gap-y-4">
        <div className="min-w-0 flex-1 basis-[260px]">
          <span className="flex items-center gap-1.5 font-sans text-[calc(13px*var(--ws-fs))] font-semibold text-primary">
            <Waveform size={15} weight="bold" className="text-gold" />
            {t("voice.eyebrow")}
          </span>
          <h1 className="mt-1.5 flex flex-wrap items-center gap-2.5 font-display text-[calc(22px*var(--ws-fs))] font-semibold leading-tight text-primary md:text-[calc(26px*var(--ws-fs))]">
            Talk markets, live.
            {demo && (
              <span className="rounded-pill bg-warning-chip px-2 py-0.5 font-sans text-[calc(10px*var(--ws-fs))] font-bold uppercase tracking-[0.1em] text-warning">
                {t("voice.demoChip")}
              </span>
            )}
          </h1>
        </div>
        <div className="flex w-full items-center gap-2 md:w-auto">
          <label className="relative block min-w-0 flex-1 md:w-[280px] md:flex-none">
            <MagnifyingGlass
              size={15}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape" && query) {
                  e.stopPropagation();
                  setQuery("");
                }
              }}
              placeholder={t("voice.searchPlaceholder")}
              aria-label={t("voice.searchPlaceholder")}
              className="h-10 w-full rounded-pill bg-primary/5 pl-10 pr-4 font-sans text-[calc(13.5px*var(--ws-fs))] text-primary outline-none transition-colors placeholder:text-subtle focus:bg-primary/10"
            />
          </label>
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            aria-label="Space Voice settings"
            title="Space Voice settings"
            className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-pill bg-primary/5 text-muted transition-colors hover:bg-primary/10 hover:text-primary"
          >
            <GearSix size={18} />
          </button>
          <motion.button
            {...press}
            type="button"
            onClick={() => setCreating(true)}
            className="flex h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-pill bg-brand px-4 font-sans text-[calc(13px*var(--ws-fs))] font-semibold text-brand-on transition-colors hover:bg-brand-active"
          >
            <Plus size={14} weight="bold" />
            {t("voice.create")}
          </motion.button>
        </div>
      </header>

      <div className="mt-4 flex items-center gap-3">
        <Tabs
          items={topicItems}
          value={vertical}
          onChange={setVertical}
          ariaLabel={t("voice.topics")}
          // Fourteen verticals never fit: Tabs fades whichever edge has
          // more and puts an arrow there (it used to be a fixed fade here).
          rootClassName="-mx-2 min-w-0 flex-1"
        />
        {!showSkeleton && !offline && (
          <p className="hidden shrink-0 items-center gap-1.5 font-sans text-[calc(12.5px*var(--ws-fs))] text-muted tabular-nums sm:flex">
            <span className="h-1.5 w-1.5 rounded-pill bg-danger" />
            <span className="font-semibold text-primary">
              {live.length} live
            </span>
            <span aria-hidden className="text-subtle">
              ·
            </span>
            {upcoming.length} upcoming
          </p>
        )}
      </div>

      {/* A refresh failed but the last answer is still on screen: say so,
          quietly, instead of pretending it is current. */}
      {loadFailed && !offline && !showSkeleton && (
        <p className="mt-3 flex flex-wrap items-center gap-x-2 font-sans text-[calc(12.5px*var(--ws-fs))] text-muted">
          Couldn't refresh the rooms. This is what was on a moment ago.
          <button
            type="button"
            onClick={() => void retry()}
            className="inline-flex h-10 cursor-pointer items-center font-semibold text-gold hover:underline"
          >
            Try again
          </button>
        </p>
      )}

      {offline ? (
        <div className="mt-8">
          <SpaceEmptyState
            kind="offline"
            title="Couldn't load the rooms"
            body="Check your connection and try again. Nothing here is lost."
            action={<EmptyAction label="Try again" onClick={() => void retry()} />}
          />
        </div>
      ) : (
        <div className="mt-5 grid items-start gap-x-6 gap-y-9 lg:grid-cols-[minmax(0,1fr)_minmax(300px,340px)] xl:grid-cols-[minmax(0,1fr)_380px] xl:gap-x-8">
          {/* ── Now ─────────────────────────────────────────────────── */}
          <section aria-labelledby="voice-now" className="min-w-0">
            <ColumnHead
              id="voice-now"
              title="Now"
              count={showSkeleton ? undefined : `${nowCount} live`}
            >
              <SortMenu value={sort} onChange={setSort} />
            </ColumnHead>

            {showSkeleton ? (
              <div className="flex flex-col gap-3">
                <NowSpaceCardSkeleton featured />
                <NowSpaceCardSkeleton />
                <NowSpaceCardSkeleton />
              </div>
            ) : (
              <div className="flex flex-col gap-3 animate-content-in">
                {yourRoom && (
                  <YourRoomBar
                    row={yourRoom.row}
                    connected={yourRoom.connected}
                    onOpen={openYourRoom}
                  />
                )}
                <AnimatePresence initial={false}>
                  {liveShown.map((row, i) => (
                    <motion.div key={row.id} {...rowMotion(i)}>
                      <NowSpaceCard
                        row={row}
                        onOpen={openRoom}
                        featured={i === 0}
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>

                {othersLive.length === 0 && yourRoom && (
                  <p className="px-1 py-2 font-sans text-[calc(13px*var(--ws-fs))] text-muted">
                    Yours is the only room live right now.
                  </p>
                )}
                {nowEmpty && <SpaceEmptyState {...nowEmpty} />}
              </div>
            )}
          </section>

          {/* ── Later ───────────────────────────────────────────────── */}
          <section aria-labelledby="voice-later" className="min-w-0">
            <ColumnHead
              id="voice-later"
              title="Later"
              count={
                showSkeleton ? undefined : `${upcomingShown.length} scheduled`
              }
            >
              <button
                type="button"
                aria-pressed={thisWeek}
                onClick={() => setThisWeek((v) => !v)}
                className={clsx(
                  "flex h-10 cursor-pointer items-center gap-1.5 rounded-pill px-3 font-sans text-[calc(12.5px*var(--ws-fs))] font-semibold transition-colors",
                  thisWeek
                    ? "bg-primary/10 text-primary"
                    : "text-muted hover:bg-primary/5 hover:text-primary",
                )}
              >
                <CalendarBlank
                  size={15}
                  weight={thisWeek ? "fill" : "regular"}
                  className={thisWeek ? "text-gold" : undefined}
                />
                This week
              </button>
            </ColumnHead>

            {showSkeleton ? (
              <LaterTimelineSkeleton />
            ) : laterEmpty ? (
              <SpaceEmptyState {...laterEmpty} compact />
            ) : (
              <div className="animate-content-in">
                <LaterTimeline
                  rows={upcomingShown}
                  onToggleGoing={toggleGoing}
                  onStart={start}
                  onEdit={setEditing}
                  onCancel={setCancelTarget}
                />
              </div>
            )}
          </section>
        </div>
      )}

      {creating && (
        <CreateSpaceSheet
          busy={busy}
          onClose={() => setCreating(false)}
          onCreate={create}
        />
      )}

      {editing && (
        <CreateSpaceSheet
          busy={busy}
          editing={{
            id: editing.id,
            title: editing.title,
            description: editing.description,
            cover: editing.cover,
            coverImage: editing.coverImage,
            scheduledFor: editing.scheduledFor,
            category: editing.category,
            // Read-only in the sheet: the gateway can't change who a room
            // goes to once it exists.
            communities: (editing.communities?.length
              ? editing.communities
              : editing.community
                ? [editing.community]
                : []
            ).map((c) => ({ id: c.id ?? c.slug, name: c.name })),
          }}
          onClose={() => setEditing(null)}
          onCreate={create}
          onSave={saveEdit}
        />
      )}

      <ConfirmModal
        isOpen={Boolean(cancelTarget)}
        onClose={() => setCancelTarget(null)}
        onConfirm={confirmCancel}
        title={t("voice.cancelTitle")}
        message={t("voice.cancelBody")}
        confirmText={t("voice.cancelConfirm")}
        cancelText={t("voice.keepIt")}
        isDestructive
      />

      <SpaceVoiceSettingsSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
      {/* /voice?recap=<id> opens a past room's recap over the directory. */}
      <SpaceRecapDeepLink />
    </div>
  );
}

export default function VoicePage() {
  return (
    <Suspense fallback={null}>
      <VoiceDirectory />
    </Suspense>
  );
}
