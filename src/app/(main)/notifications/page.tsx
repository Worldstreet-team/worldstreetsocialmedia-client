"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { followUserDirect, unfollowUserDirect } from "@/lib/upload-direct";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, AtSign, BadgeCheck, Bell, UserPlus } from "lucide-react";
import { Check } from "@phosphor-icons/react";
import { useAtom, useSetAtom } from "jotai";
import { EmptyState } from "@/components/ui/EmptyState";
import { Tabs } from "@/components/ui/Tabs";
import { useToast } from "@/components/ui/Toast/ToastContext";
import { markNotificationsReadAction } from "@/lib/notification.actions";
import { useGatewayRead } from "@/hooks/useGateway";
import { cacheKeys, fetchCached, invalidate } from "@/lib/cache";

const NOTIFICATIONS_TTL = 60_000;
import { useUserEvents } from "@/hooks/useUserEvents";
import { useLiveEvents } from "@/hooks/useLiveNow";
import {
  followingIdsAtom,
  notificationFilterAtom,
  unreadNotificationsCountAtom,
} from "@/store/ui.atom";
import { useT } from "@/i18n/client";
import { mainScroller } from "@/lib/utils";
import { groupNotifications } from "@/components/notifications/notification-groups";
import {
  NotificationRow,
  NotificationRowSkeleton,
} from "@/components/notifications/NotificationRow";
import type {
  AppNotification,
  NotificationGroup,
} from "@/components/notifications/types";

type Filter = "all" | "mentions" | "follows" | "verified";

const FILTERS: { key: Filter; labelKey: string }[] = [
  { key: "all", labelKey: "notif.tab.all" },
  // Broader than type === "mention": anything asking for a response.
  { key: "mentions", labelKey: "notif.tab.mentions" },
  { key: "follows", labelKey: "notif.tab.follows" },
  { key: "verified", labelKey: "notif.tab.verified" },
];

const EMPTY: Record<Filter, { icon: typeof Bell; title: string; caption: string }> = {
  all: { icon: Bell, title: "notif.empty.all.title", caption: "notif.empty.all.caption" },
  mentions: {
    icon: AtSign,
    title: "notif.empty.mentions.title",
    caption: "notif.empty.mentions.caption",
  },
  follows: {
    icon: UserPlus,
    title: "notif.empty.follows.title",
    caption: "notif.empty.follows.caption",
  },
  verified: {
    icon: BadgeCheck,
    title: "notif.empty.verified.title",
    caption: "notif.empty.verified.caption",
  },
};

function matches(n: AppNotification, filter: Filter) {
  if (filter === "all") return true;
  if (filter === "mentions") return n.type === "mention" || n.type === "reply";
  if (filter === "follows") return n.type === "follow";
  return Boolean(n.sender.isVerified);
}

export default function NotificationsPage() {
  const read = useGatewayRead();
  const t = useT();
  const { toast } = useToast();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [filter, setFilter] = useAtom(notificationFilterAtom);
  const [followingIds, setFollowingIds] = useAtom(followingIdsAtom);
  const setUnreadCount = useSetAtom(unreadNotificationsCountAtom);
  const [pending, setPending] = useState(0);
  const [liveStreams, setLiveStreams] = useState<Set<string>>(new Set());

  /**
   * Unread is rendered from a snapshot taken on first load, not from row.read.
   * The server rows flip to read the moment we mark them, so reading straight
   * off them makes the highlight vanish on the next render and destroys the
   * whole point of an unread state.
   */
  const unreadIds = useRef<Set<string>>(new Set());

  const load = useCallback(
    async (opts: { merge?: boolean } = {}) => {
      setLoading(true);
      setFailed(false);
      // Shares the list NotificationCountSync already fetched on app load —
      // arriving here used to fire a second identical request. A pull-to-
      // refresh or a realtime arrival invalidates the key, so this is reuse,
      // not staleness.
      const res = await fetchCached(
        cacheKeys.notifications(),
        (() => read("/api/notifications")),
        NOTIFICATIONS_TTL,
      );
      if (res.success && Array.isArray(res.data)) {
        const rows = res.data as AppNotification[];
        const fresh = rows.filter((r) => !r.read).map((r) => r._id);
        if (opts.merge) {
          for (const id of fresh) unreadIds.current.add(id);
        } else {
          unreadIds.current = new Set(fresh);
        }
        setNotifications(rows);
        setUnreadCount(0);
        // After first paint, so the list is on screen before the round-trip.
        setTimeout(() => {
          void markNotificationsReadAction().then((r) => {
            if (!r.success) toast(t("notif.error.title"), { type: "error" });
          });
        }, 0);
      } else {
        setFailed(true);
      }
      setLoading(false);
    },
    [setUnreadCount, toast, t],
  );

  const ran = useRef(false);
  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    void load();
  }, [load]);

  // New activity while the page is open: offer it, don't splice it in. The
  // realtime payload has no id, avatar or name, so an optimistic row would be
  // a grey circle that visibly rewrites itself on the next fetch.
  useUserEvents(() => setPending((n) => n + 1));

  // A live row should stop claiming LIVE the moment the stream ends.
  useLiveEvents((event, data) => {
    setLiveStreams((prev) => {
      const next = new Set(prev);
      if (event === "started" && data?.postId) next.add(String(data.postId));
      if (event === "ended" && data?.postId) next.delete(String(data.postId));
      return next;
    });
  });

  const showPending = useCallback(() => {
    setPending(0);
    mainScroller().scrollTo({ top: 0, behavior: "smooth" });
    // Explicit refresh: drop the shared entry first, or fetchCached hands back
    // exactly the list this button exists to replace.
    invalidate(cacheKeys.notifications());
    void load({ merge: true });
  }, [load]);

  const markAllRead = useCallback(async () => {
    unreadIds.current = new Set();
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
    const res = await markNotificationsReadAction();
    if (!res.success) toast(t("notif.error.title"), { type: "error" });
  }, [setUnreadCount, toast, t]);

  const openGroup = useCallback((group: NotificationGroup) => {
    for (const id of group.ids) unreadIds.current.delete(id);
    void markNotificationsReadAction(group.ids);
  }, []);

  const followBack = useCallback(
    async (profileId: string) => {
      // Without this guard a sender whose profile has since been deleted
      // sent `undefined` down the wire, the gateway answered 404, and the
      // user saw "Failed to align" for a row they could never act on.
      if (!profileId) return;
      setFollowingIds((prev) =>
        prev.includes(profileId) ? prev : [...prev, profileId],
      );
      const res = await followUserDirect(profileId);
      if (!res.success) {
        setFollowingIds((prev) => prev.filter((x) => x !== profileId));
        toast(res.message || t("rail.followFailed"), { type: "error" });
      }
    },
    [setFollowingIds, toast, t],
  );

  const counts = useMemo(() => {
    const out = {} as Record<Filter, number>;
    for (const f of FILTERS) {
      out[f.key] = notifications.filter(
        (n) => matches(n, f.key) && unreadIds.current.has(n._id),
      ).length;
    }
    return out;
  }, [notifications]);

  const groups = useMemo(
    () => groupNotifications(notifications.filter((n) => matches(n, filter))),
    [notifications, filter],
  );

  const totalUnread = unreadIds.current.size;
  const empty = EMPTY[filter];

  return (
    <div className="flex min-h-dvh flex-col pb-nav md:pb-20">
      <header className="sticky top-0 z-sticky border-b border-hairline bg-page md:top-0">
        <div className="flex items-end justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <span className="block font-sans text-[11px] font-bold uppercase tracking-[0.16em] text-gold">
              {t("notif.eyebrow")}
            </span>
            <h1 className="mt-1 font-display text-[24px] font-semibold leading-none text-primary">
              {t("nav.notifications")}
            </h1>
          </div>
          {totalUnread > 0 && (
            <button
              type="button"
              onClick={markAllRead}
              className="flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-pill border border-hairline bg-raised px-3.5 font-sans text-[12.5px] font-medium text-muted transition-colors hover:text-primary"
            >
              <Check size={13} weight="bold" />
              {t("notif.markAllRead")}
            </button>
          )}
        </div>

        <Tabs
          items={FILTERS.map(({ key, labelKey }) => ({
            key,
            label: t(labelKey),
            badge: counts[key],
          }))}
          value={filter}
          onChange={setFilter}
          ariaLabel={t("nav.notifications")}
        />
      </header>

      <AnimatePresence>
        {pending > 0 && (
          <motion.button
            type="button"
            onClick={showPending}
            initial={{ opacity: 0, y: -8, x: "-50%" }}
            animate={{ opacity: 1, y: 0, x: "-50%" }}
            exit={{ opacity: 0, x: "-50%", transition: { duration: 0.12 } }}
            transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
            className="fixed left-1/2 top-[72px] z-sticky flex h-9 cursor-pointer items-center gap-1.5 rounded-pill bg-brand pl-3.5 pr-4 font-sans text-[13px] font-semibold text-brand-on shadow-nav transition-colors hover:bg-brand-active md:top-16"
          >
            <span className="tabular-nums">{pending}</span> {t("notif.new")}
          </motion.button>
        )}
      </AnimatePresence>

      <div className="flex flex-col">
        {loading ? (
          [0, 1, 2, 3, 4, 5].map((i) => <NotificationRowSkeleton key={i} />)
        ) : failed ? (
          <EmptyState
            icon={AlertTriangle}
            title={t("notif.error.title")}
            caption={t("notif.error.caption")}
            action={{
              label: t("common.retry"),
              onClick: () => {
                invalidate(cacheKeys.notifications());
                void load();
              },
            }}
          />
        ) : groups.length === 0 ? (
          <EmptyState
            icon={empty.icon}
            title={t(empty.title)}
            caption={t(empty.caption)}
          />
        ) : (
          groups.map((group, i) => (
            <NotificationRow
              key={group.key}
              group={group}
              unread={group.ids.some((id) => unreadIds.current.has(id))}
              isLive={group.post?._id ? liveStreams.has(group.post._id) : false}
              onOpen={openGroup}
              onFollowBack={followBack}
              followed={followingIds.includes(group.senders[0]?._id)}
              delay={Math.min(i * 30, 300)}
            />
          ))
        )}
      </div>
    </div>
  );
}
