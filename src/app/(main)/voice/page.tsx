"use client";

import { Plus } from "@phosphor-icons/react";
import { useAtomValue, useSetAtom } from "jotai";
import { Mic } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRealtime } from "@/components/providers/RealtimeProvider";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast/ToastContext";
import CreateSpaceSheet, {
  type SpacePatch,
} from "@/components/voice/CreateSpaceSheet";
import ConfirmModal from "@/components/ui/ConfirmModal";
import {
  LiveSpaceCard,
  NextUpCard,
  type SpaceRow,
  UpcomingSpaceRow,
} from "@/components/voice/SpaceCard";
import { useT } from "@/i18n/client";
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
import { voiceRefreshAtom, voiceSessionAtom } from "@/store/voice.atom";

const POLL_MS = 20_000;

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
  const [live, setLive] = useState<SpaceRow[]>([]);
  const [upcoming, setUpcoming] = useState<SpaceRow[]>([]);
  const [communities, setCommunities] = useState<
    { id: string; name: string }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(() => params.get("create") === "1");
  // Design-review mode (?demo=1): seeded rows, clearly chipped, never default.
  const demo = params.get("demo") === "1";
  const [busy, setBusy] = useState(false);
  // Host escape hatches on a scheduled room: change it, or call it off.
  const [editing, setEditing] = useState<SpaceRow | null>(null);
  const [cancelTarget, setCancelTarget] = useState<SpaceRow | null>(null);
  // The room lives app-wide so it survives navigation and can minimise into
  // the floating dock; this page only opens it.
  const setSession = useSetAtom(voiceSessionAtom);
  const refreshTick = useAtomValue(voiceRefreshAtom);
  const deepLinkRef = useRef<string | null>(params.get("s"));

  const load = useCallback(async () => {
    const res = await getSpacesAction();
    if (res.success) {
      setLive(demo ? [...res.live, ...demoLiveSpaces()] : res.live);
      setUpcoming(
        demo
          ? [...res.upcoming, ...demoUpcomingSpaces()].sort(
              (a, b) =>
                new Date(a.scheduledFor ?? 0).getTime() -
                new Date(b.scheduledFor ?? 0).getTime(),
            )
          : res.upcoming,
      );
      // Keep the open room's header numbers fresh.
      setSession((prev) => {
        if (!prev) return prev;
        const fresh = res.live.find((r: SpaceRow) => r.id === prev.row.id);
        return fresh ? { ...prev, row: fresh } : prev;
      });
    }
    setLoading(false);
    return res.success ? res : null;
  }, [demo, setSession]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: refreshTick is the signal; its value is unused.
  useEffect(() => {
    void load();
  }, [refreshTick, load]);

  useEffect(() => {
    // Demo rows paint immediately — the review shouldn't wait out a cold
    // gateway; real rows merge in whenever the fetch lands.
    if (demo) {
      setLive(demoLiveSpaces());
      setUpcoming(demoUpcomingSpaces());
      setLoading(false);
    }
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
    setUpcoming((prev) => prev.filter((r) => r.id !== row.id));
    const res = await cancelSpaceAction(row.id);
    if (!res.success) {
      toast(res.message || t("voice.startFailed"), { type: "error" });
    } else {
      toast(t("voice.cancelledToast"), { type: "success" });
    }
    await load();
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
          {live.length > 0 && (
            <section className="mb-8">
              <h2 className="mb-3 font-sans text-[11px] font-semibold uppercase tracking-[0.14em] text-subtle">
                {t("voice.liveNow")}
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {live.map((row) => (
                  <LiveSpaceCard key={row.id} row={row} onOpen={openRoom} />
                ))}
              </div>
            </section>
          )}

          {upcoming.length > 0 && (
            <section>
              <h2 className="mb-3 font-sans text-[11px] font-semibold uppercase tracking-[0.14em] text-subtle">
                {t("voice.upcoming")}
              </h2>
              <div className="flex flex-col gap-2.5">
                <NextUpCard
                  row={upcoming[0]}
                  onRemind={remind}
                  onStart={start}
                  onEdit={setEditing}
                  onCancel={setCancelTarget}
                />
                {upcoming.slice(1).map((row) => (
                  <UpcomingSpaceRow
                    key={row.id}
                    row={row}
                    onRemind={remind}
                    onStart={start}
                    onEdit={setEditing}
                    onCancel={setCancelTarget}
                  />
                ))}
              </div>
            </section>
          )}

          {live.length === 0 && upcoming.length === 0 && (
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
