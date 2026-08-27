"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Bell } from "@phosphor-icons/react";
import { useAtom, useAtomValue } from "jotai";
import clsx from "clsx";

import { Badge } from "@/components/ui/Badge";
import { SafeAvatar } from "@/components/ui/SafeAvatar";
import { UserBadges } from "@/components/ui/UserBadges";
import { unreadNotificationsCountAtom } from "@/store/ui.atom";
import {
	notificationsAtom,
	notificationsLoadedAtom,
} from "@/store/notifications.atom";
import { groupNotifications } from "@/components/notifications/notification-groups";
import { senderName } from "@/components/notifications/types";
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
	// Read, never fetched. NotificationCountSync already pulls this list once
	// per app load and the realtime channel keeps it current, so opening the
	// panel costs nothing and shows content immediately.
	const all = useAtomValue(notificationsAtom);
	const loaded = useAtomValue(notificationsLoadedAtom);
	const [unread, setUnread] = useAtom(unreadNotificationsCountAtom);

	/**
	 * GROUPED, the same way the full page groups them: "Ada and 4 others liked
	 * your post" rather than five rows that each say "liked your post". Without
	 * this the panel is six near-identical lines and the one thing that is not
	 * a like scrolls out of sight.
	 */
	const groups = groupNotifications(all).slice(0, PREVIEW_COUNT);
	const rootRef = useRef<HTMLDivElement>(null);
	/** The portalled panel is NOT inside rootRef, so "outside" has to mean
	 *  outside BOTH — without this, clicking a notification closed the panel
	 *  before its own link could fire. */
	const panelRef = useRef<HTMLDivElement>(null);
	/**
	 * Where to draw the panel. It is PORTALLED to the body rather than nested
	 * under the bell, because the header is `z-sticky` and therefore its own
	 * stacking context — a child at `z-dropdown` still cannot rise above a
	 * sibling of the HEADER at the same z. The feed's sticky tab bar was
	 * drawing straight through the middle of the panel. A portal escapes the
	 * context; the anchor maths is the price.
	 */
	const [anchor, setAnchor] = useState<{ top: number; right: number } | null>(
		null,
	);
	const [mounted, setMounted] = useState(false);
	useEffect(() => setMounted(true), []);

	const placePanel = useCallback(() => {
		const el = rootRef.current;
		if (!el) return;
		const r = el.getBoundingClientRect();
		setAnchor({ top: r.bottom + 4, right: window.innerWidth - r.right });
	}, []);

	// Outside click and Escape both close. Bound only while open, so the
	// listeners are not sitting on every page for a panel that is shut.
	useEffect(() => {
		if (!open) return;
		const onDown = (e: MouseEvent) => {
			const target = e.target as Node;
			if (rootRef.current?.contains(target)) return;
			if (panelRef.current?.contains(target)) return;
			setOpen(false);
		};
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") setOpen(false);
		};
		document.addEventListener("mousedown", onDown);
		document.addEventListener("keydown", onKey);
		window.addEventListener("resize", placePanel);
		return () => {
			document.removeEventListener("mousedown", onDown);
			document.removeEventListener("keydown", onKey);
			window.removeEventListener("resize", placePanel);
		};
	}, [open]);

	const toggle = () => {
		const next = !open;
		setOpen(next);
		if (next) {
			placePanel();
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

			{mounted &&
				createPortal(
					<AnimatePresence>
						{open && anchor && (
							<motion.div
								ref={panelRef}
								role="dialog"
						aria-label={t("nav.notifications")}
						initial={{ opacity: 0, y: -6 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -6, transition: { duration: 0.12 } }}
						transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
						// Anchored to the RIGHT edge and width-capped against the
						// viewport: anchoring left would push a 320px panel off a
						// small screen, since the bell sits near the right edge.
						style={{ top: anchor.top, right: anchor.right }}
								className="fixed z-dropdown w-[min(20rem,calc(100vw-1.5rem))] overflow-hidden rounded-xl bg-surface/85 shadow-nav backdrop-blur-xl backdrop-saturate-150"
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

						{/* Capped in ROWS, not viewport height: a dvh cap lands
						    wherever it lands and slices whichever row is there,
						    which is what the panel was doing — two half-rows
						    visible at once. Each row is 56px, so five rows end on
						    a boundary and the sixth peeking is a scroll hint. */}
						<div className="max-h-[280px] overflow-y-auto overscroll-contain">
							{!loaded ? (
								[0, 1, 2].map((i) => (
									<div key={i} className="flex h-14 items-center gap-2.5 px-3">
										<div className="skeleton h-8 w-8 shrink-0 rounded-pill" />
										<div className="min-w-0 flex-1">
											<div className="skeleton mb-1.5 h-3 w-2/3 rounded-sm" />
											<div className="skeleton h-3 w-1/3 rounded-sm" />
										</div>
									</div>
								))
							) : groups.length === 0 ? (
								<p className="px-3 py-6 text-center font-sans text-[13px] text-subtle">
									{t("notif.empty.all.title")}
								</p>
							) : (
								groups.map((g) => {
									const lead = g.senders[0];
									const others = g.senders.length - 1;
									return (
										<Link
											key={g.key}
											href="/notifications"
											onClick={() => setOpen(false)}
											className={clsx(
												"flex h-14 items-center gap-2.5 px-3 transition-colors hover:bg-raised",
												!g.read && "bg-brand/[0.06]",
											)}
										>
											<span className="relative h-8 w-8 shrink-0 overflow-hidden rounded-pill bg-raised">
												<SafeAvatar src={lead?.avatar} eager />
											</span>
											<span className="min-w-0 flex-1">
												<span className="flex items-center gap-1">
													<span className="truncate font-sans text-[13.5px] font-semibold text-primary">
														{senderName(lead)}
													</span>
													<UserBadges
														isVerified={lead?.isVerified}
														badges={lead?.badges}
														size={12}
													/>
													{others > 0 && (
														<span className="shrink-0 font-sans text-[12.5px] text-muted">
															{others === 1
																? t("notif.others.one")
																: t("notif.others.many").replace(
																		"{n}",
																		String(others),
																	)}
														</span>
													)}
												</span>
												<span className="block truncate font-sans text-[12.5px] text-muted">
													{t(`notif.verb.${g.type}`)}
												</span>
											</span>
											<span className="shrink-0 font-sans text-[11px] tabular-nums text-subtle">
												{formatTimeAgo(g.createdAt)}
											</span>
										</Link>
									);
								})
							)}
							</div>
						</motion.div>
						)}
					</AnimatePresence>,
					document.body,
				)}
		</div>
	);
}
