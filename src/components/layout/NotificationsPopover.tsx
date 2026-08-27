"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Bell } from "@phosphor-icons/react";
import { useAtom } from "jotai";
import clsx from "clsx";

import { Badge } from "@/components/ui/Badge";
import { SafeAvatar } from "@/components/ui/SafeAvatar";
import { UserBadges } from "@/components/ui/UserBadges";
import { getNotificationsAction } from "@/lib/notification.actions";
import { unreadNotificationsCountAtom } from "@/store/ui.atom";
import { senderName, type AppNotification } from "@/components/notifications/types";
import { formatTimeAgo } from "@/lib/utils";
import { useT } from "@/i18n/client";

/** How many fit before the panel stops being a glance and becomes a page. */
const PREVIEW_COUNT = 6;

/**
 * Notifications as a peek, from the mobile header.
 *
 * They used to be a tab in the bottom bar, which cost a permanent slot for
 * something you check rather than navigate to — and reaching them meant
 * leaving whatever you were reading. A popover answers "anything new?" without
 * moving you off the page, and "See all" is still one tap from the real thing.
 *
 * Fetched on OPEN, not on mount: this sits in the header of every page, and a
 * request per page load to fill a panel nobody opened is a request wasted.
 */
export function NotificationsPopover() {
	const t = useT();
	const [open, setOpen] = useState(false);
	const [items, setItems] = useState<AppNotification[]>([]);
	const [loading, setLoading] = useState(false);
	const [loaded, setLoaded] = useState(false);
	const [unread, setUnread] = useAtom(unreadNotificationsCountAtom);
	const rootRef = useRef<HTMLDivElement>(null);

	const load = useCallback(async () => {
		setLoading(true);
		try {
			const res = await getNotificationsAction();
			const list = res.success
				? ((res.data?.notifications ?? res.data ?? []) as AppNotification[])
				: [];
			setItems(Array.isArray(list) ? list.slice(0, PREVIEW_COUNT) : []);
			setLoaded(true);
		} finally {
			setLoading(false);
		}
	}, []);

	// Outside click and Escape both close. Bound only while open, so the
	// listeners are not sitting on every page for a panel that is shut.
	useEffect(() => {
		if (!open) return;
		const onDown = (e: MouseEvent) => {
			if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
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

	const toggle = () => {
		const next = !open;
		setOpen(next);
		if (next) {
			void load();
			// Opening is seeing. The count clears here rather than waiting for
			// the full page, which is what "already read that" should mean.
			setUnread(0);
		}
	};

	return (
		<div ref={rootRef} className="relative">
			<button
				type="button"
				onClick={toggle}
				aria-haspopup="dialog"
				aria-expanded={open}
				aria-label={t("nav.notifications")}
				className="relative flex h-11 w-11 items-center justify-center rounded-pill text-muted transition-colors active:bg-raised"
			>
				<Bell size={20} weight={open ? "fill" : "duotone"} />
				{unread > 0 && (
					<span className="absolute right-1.5 top-1.5">
						<Badge count={unread} />
					</span>
				)}
			</button>

			<AnimatePresence>
				{open && (
					<motion.div
						role="dialog"
						aria-label={t("nav.notifications")}
						initial={{ opacity: 0, y: -6 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -6, transition: { duration: 0.12 } }}
						transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
						// Anchored to the RIGHT edge and width-capped against the
						// viewport: anchoring left would push a 320px panel off a
						// small screen, since the bell sits near the right edge.
						className="absolute right-0 top-full z-dropdown mt-1 w-[min(20rem,calc(100vw-1.5rem))] overflow-hidden rounded-xl border border-hairline bg-surface shadow-nav"
					>
						<div className="flex items-center justify-between px-3 pb-1.5 pt-3">
							<span className="font-sans text-[11px] font-semibold uppercase tracking-[0.14em] text-subtle">
								{t("nav.notifications")}
							</span>
							<Link
								href="/notifications"
								onClick={() => setOpen(false)}
								className="font-sans text-[12px] font-semibold text-gold hover:underline"
							>
								{t("rail.seeAll")}
							</Link>
						</div>

						<div className="max-h-[min(340px,50dvh)] overflow-y-auto overscroll-contain">
							{loading && !loaded ? (
								[0, 1, 2].map((i) => (
									<div key={i} className="flex items-center gap-2.5 px-3 py-2.5">
										<div className="skeleton h-8 w-8 shrink-0 rounded-pill" />
										<div className="min-w-0 flex-1">
											<div className="skeleton mb-1.5 h-3 w-2/3 rounded-sm" />
											<div className="skeleton h-3 w-1/3 rounded-sm" />
										</div>
									</div>
								))
							) : items.length === 0 ? (
								<p className="px-3 py-6 text-center font-sans text-[13px] text-subtle">
									{t("notif.empty.all.title")}
								</p>
							) : (
								items.map((n) => (
									<Link
										key={n._id}
										href="/notifications"
										onClick={() => setOpen(false)}
										className={clsx(
											"flex items-start gap-2.5 px-3 py-2.5 transition-colors hover:bg-raised",
											!n.read && "bg-brand/[0.06]",
										)}
									>
										<span className="relative h-8 w-8 shrink-0 overflow-hidden rounded-pill bg-raised">
											<SafeAvatar src={n.sender?.avatar} />
										</span>
										<span className="min-w-0 flex-1">
											<span className="flex items-center gap-1">
												<span className="truncate font-sans text-[13.5px] font-semibold text-primary">
													{senderName(n.sender)}
												</span>
												<UserBadges
													isVerified={n.sender?.isVerified}
													badges={n.sender?.badges}
													size={12}
												/>
											</span>
											<span className="block truncate font-sans text-[12.5px] text-muted">
												{t(`notif.verb.${n.type}`)}
											</span>
										</span>
										<span className="shrink-0 font-sans text-[11px] tabular-nums text-subtle">
											{formatTimeAgo(n.createdAt)}
										</span>
									</Link>
								))
							)}
						</div>
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	);
}
