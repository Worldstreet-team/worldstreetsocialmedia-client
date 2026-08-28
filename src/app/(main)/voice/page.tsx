"use client";

import { MagnifyingGlass, Plus } from "@phosphor-icons/react";
import clsx from "clsx";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { Mic } from "lucide-react";
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
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast/ToastContext";
import CreateSpaceSheet, {
  type SpacePatch,
} from "@/components/voice/CreateSpaceSheet";
import ConfirmModal from "@/components/ui/ConfirmModal";
import {
  hostName,
  LiveSpaceCard,
  NextUpCard,
  type SpaceRow,
  UpcomingSpaceRow,
} from "@/components/voice/SpaceCard";
import { VERTICALS, type VerticalId } from "@/data/categories";
import { useT } from "@/i18n/client";
import { getCategory, VERTICAL_BY_ID } from "@/lib/categories";
import { getCommunitiesAction } from "@/lib/community.actions";
import { demoLiveSpaces, demoUpcomingSpaces, isDemoId } from "@/lib/demoSeed";
import {
  cancelSpaceAction,
  createSpaceAction,
  getSpaceAction,
  getSpacesAction,
  joinSpaceAction,
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

const POLL_MS = 20_000;

/** One easing for the directory breathing when a refresh lands. */
const LIST_TRANSITION = { duration: 0.26, ease: [0.2, 0, 0, 1] as const };

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

/**
 * Space Voice — the rooms directory. Live rooms carry their mesh art in a
 * responsive grid; scheduled rooms queue underneath. Opening a live room
 * drops into the Spaces-style stage (SpaceRoom); creating one goes through
 * the frosted sheet. A poll plus the gateway's `spaces` Ably events (once
 * deployed) keep the directory honest.
 */
function VoiceDirectory() {
  const t = useT();
  const { toast } = useToast();
  const { client } = useRealtime();
  const params = useSearchParams();
  const reduced = useReducedMotion();
  // The directory is cached app-wide (stale-while-revalidate): a revisit
  // paints the last result immediately and the poll/refetch converges it.
  const [cachedLive, setCachedLive] = useAtom(spacesLiveAtom);
  const [cachedUpcoming, setCachedUpcoming] = useAtom(spacesUpcomingAtom);
  const [spacesLoaded, setSpacesLoaded] = useAtom(spacesLoadedAtom);
  const setSpacesFetchedAt = useSetAtom(spacesFetchedAtAtom);
  const [communities, setCommunities] = useState<
    { id: string; name: string }[]
  >([]);
  // Skeletons only on the genuinely first visit of a session.
  const [loading, setLoading] = useState(!spacesLoaded);
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
  const setSession = useSetAtom(voiceSessionAtom);
  const refreshTick = useAtomValue(voiceRefreshAtom);
  const deepLinkRef = useRef<string | null>(params.get("s"));
  // The hub is a platform, not a list: client-side search over title + host,
  // and a topic rail over the taxonomy's 14 verticals.
  const [query, setQuery] = useState("");
  const [vertical, setVertical] = useState<"all" | VerticalId>("all");

  const load = useCallback(async () => {
    const res = await getSpacesAction();
    if (res.success) {
      setCachedLive(res.live);
      setCachedUpcoming(res.upcoming);
      setSpacesLoaded(true);
      setSpacesFetchedAt(Date.now());
      // Keep the open room's header numbers fresh.
      setSession((prev) => {
        if (!prev) return prev;
        const fresh = res.live.find((r: SpaceRow) => r.id === prev.row.id);
        return fresh ? { ...prev, row: fresh } : prev;
      });
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

  // biome-ignore lint/correctness/useExhaustiveDependencies: refreshTick is the signal; its value is unused.
  useEffect(() => {
    void load();
  }, [refreshTick, load]);

  useEffect(() => {
    // Demo rows paint immediately — the review shouldn't wait out a cold
    // gateway; real rows merge in whenever the fetch lands.
    if (demo) setLoading(false);
    void load();
    const poll = setInterval(() => void load(), POLL_MS);
    return () => clearInterval(poll);
  }, [load, demo]);

  // The gateway publishes created/started/ended on the `spaces` channel;
  // until that deploy, the attach simply fails quietly and the poll rules.
  useEffect(() => {
    if (!client) return;
    const channel = client.channels.get("spaces");
    const onEvent = () => void load();
    void channel.subscribe(onEvent);
    return () => channel.unsubscribe(onEvent);
  }, [client, load]);

  useEffect(() => {
    void getCommunitiesAction().then((res) => {
      if (res.success) {
        setCommunities(
          (res.communities as { joined?: boolean; id: string; name: string }[])
            .filter((c) => c.joined)
            .map((c) => ({ id: c.id, name: c.name })),
        );
      }
    });
  }, []);

  const create = async (
    title: string,
    when?: string,
    communityId?: string,
    description?: string,
    cover?: string,
    coverImage?: string,
    category?: string,
  ) => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await createSpaceAction(
        title,
        when,
        communityId,
        description,
        cover,
        coverImage,
        category,
      );
      if (res.success) {
        setCreating(false);
        const fresh = await load();
        toast(t(when ? "voice.scheduled" : "voice.created"), {
          type: "success",
        });
        // Starting now drops you straight into your room — creating one and
        // being left staring at the directory was the broken half of this.
        if (!when && res.spaceId) {
          const mine = fresh?.live.find(
            (r: SpaceRow) => r.id === String(res.spaceId),
          );
          if (mine) setSession({ row: mine, minimized: false });
        }
      } else if (res.message) {
        toast(res.message, { type: "error" });
      }
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
  // directly; anything else resolves by id and gets an honest answer —
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
        // It's in the upcoming list below; the toast points there.
        toast(t("voice.linkScheduled"), { type: "success" });
      } else {
        toast(t("voice.linkOver"), { type: "error" });
      }
    });
  });

  const remind = async (row: SpaceRow) => {
    if (isDemoId(row.id)) {
      toast(t("voice.demoRow"), { type: "success" });
      return;
    }
    await joinSpaceAction(row.id);
    await load();
    toast(t("voice.reminded"), { type: "success" });
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

  // Search matches title and host (display name or @username); the chip
  // narrows to one vertical. Both are pure client-side filters.
  const filtering = query.trim().length > 0 || vertical !== "all";
  const matches = useCallback(
    (row: SpaceRow) => {
      const q = query.trim().toLowerCase();
      const okQuery =
        !q ||
        row.title.toLowerCase().includes(q) ||
        hostName(row.host).toLowerCase().includes(q) ||
        row.host.username.toLowerCase().includes(q);
      const okVertical = vertical === "all" || spaceVertical(row) === vertical;
      return okQuery && okVertical;
    },
    [query, vertical],
  );
  const liveShown = useMemo(() => live.filter(matches), [live, matches]);
  const upcomingShown = useMemo(
    () => upcoming.filter(matches),
    [upcoming, matches],
  );
  const hasAny = live.length > 0 || upcoming.length > 0;

  // Newer copy than the dictionaries: t() echoes the key when missing.
  const tf = (key: string, fallback: string) => {
    const v = t(key);
    return v === key ? fallback : v;
  };

  return (
    <div className="w-full min-w-0 px-4 py-6 pb-nav md:pb-10">
      {/* Header */}
      <div className="mb-6 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <span className="block font-sans text-[11px] font-bold uppercase tracking-[0.16em] text-gold">
            {t("voice.eyebrow")}
          </span>
          <h1 className="mt-1 flex items-center gap-2.5 font-display text-[24px] font-semibold leading-none text-primary">
            {t("nav.voice")}
            {demo && (
              <span className="rounded-pill bg-warning-chip px-2 py-0.5 font-sans text-[10px] font-bold uppercase tracking-[0.1em] text-warning">
                {t("voice.demoChip")}
              </span>
            )}
          </h1>
        </div>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="flex h-10 shrink-0 items-center gap-1.5 rounded-pill bg-brand px-4 font-sans text-[13px] font-semibold text-brand-on transition-colors hover:bg-brand-active cursor-pointer"
        >
          <Plus size={14} weight="bold" />
          {t("voice.create")}
        </button>
      </div>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-[168px] rounded-xl skeleton" />
          ))}
        </div>
      ) : (
        <>
          {hasAny && (
            <div className="mb-6 flex flex-col gap-3">
              {/* Search — title and host, live + upcoming alike. */}
              <label className="relative block">
                <MagnifyingGlass
                  size={15}
                  weight="bold"
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-subtle"
                />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={tf("voice.searchPlaceholder", "Search spaces")}
                  aria-label={tf("voice.searchPlaceholder", "Search spaces")}
                  className="h-10 w-full rounded-pill bg-sunken pl-10 pr-4 font-sans text-[13.5px] text-primary placeholder:text-subtle outline-none"
                />
              </label>
              {/* Topic rail — the 14 verticals, "All" first. */}
              <div
                aria-label={tf("voice.topics", "Topics")}
                className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-4 px-4"
              >
                {[
                  { id: "all" as const, label: tf("voice.all", "All") },
                  ...VERTICALS.map((v) => ({ id: v.id, label: v.label })),
                ].map((chip) => {
                  const selected = vertical === chip.id;
                  return (
                    <button
                      key={chip.id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setVertical(chip.id)}
                      className={clsx(
                        "h-10 shrink-0 rounded-pill px-3.5 font-sans text-[12.5px] font-semibold transition-colors cursor-pointer",
                        selected
                          ? "bg-primary text-page"
                          : "bg-chip text-muted hover:text-primary",
                      )}
                    >
                      {chip.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {liveShown.length > 0 && (
            <section className="mb-8">
              <h2 className="mb-3 font-sans text-[11px] font-semibold uppercase tracking-[0.14em] text-subtle">
                {t("voice.liveNow")}
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <AnimatePresence initial={false}>
                  {liveShown.map((row) => (
                    <motion.div
                      key={row.id}
                      layout={!reduced}
                      initial={reduced ? false : { opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={reduced ? undefined : { opacity: 0 }}
                      transition={LIST_TRANSITION}
                    >
                      <LiveSpaceCard row={row} onOpen={openRoom} />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </section>
          )}

          {upcomingShown.length > 0 && (
            <section>
              <h2 className="mb-3 font-sans text-[11px] font-semibold uppercase tracking-[0.14em] text-subtle">
                {t("voice.upcoming")}
              </h2>
              <div className="flex flex-col gap-2.5">
                <AnimatePresence initial={false}>
                  {upcomingShown.map((row, i) => (
                    <motion.div
                      key={row.id}
                      layout={!reduced}
                      initial={reduced ? false : { opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={reduced ? undefined : { opacity: 0 }}
                      transition={LIST_TRANSITION}
                    >
                      {i === 0 ? (
                        <NextUpCard
                          row={row}
                          onRemind={remind}
                          onStart={start}
                          onEdit={setEditing}
                          onCancel={setCancelTarget}
                        />
                      ) : (
                        <UpcomingSpaceRow
                          row={row}
                          onRemind={remind}
                          onStart={start}
                          onEdit={setEditing}
                          onCancel={setCancelTarget}
                        />
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </section>
          )}

          {/* Filters found nothing — a quiet line, not a full empty state. */}
          {hasAny &&
            filtering &&
            liveShown.length === 0 &&
            upcomingShown.length === 0 && (
              <p className="py-8 text-center font-sans text-[13px] text-muted">
                {tf(
                  "voice.noMatches",
                  "Nothing matches — try another search or topic.",
                )}
              </p>
            )}

          {!hasAny && (
            <EmptyState
              icon={Mic}
              title={t("voice.emptyTitle")}
              caption={t("voice.emptyCaption")}
              action={{
                label: t("voice.create"),
                onClick: () => setCreating(true),
              }}
            />
          )}
        </>
      )}

      {creating && (
        <CreateSpaceSheet
          communities={communities}
          busy={busy}
          onClose={() => setCreating(false)}
          onCreate={create}
        />
      )}

      {editing && (
        <CreateSpaceSheet
          communities={communities}
          busy={busy}
          editing={{
            id: editing.id,
            title: editing.title,
            description: editing.description,
            cover: editing.cover,
            coverImage: editing.coverImage,
            scheduledFor: editing.scheduledFor,
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
