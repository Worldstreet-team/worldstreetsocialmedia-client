"use client";

import { useCallback, useEffect, useState } from "react";
import { followUserDirect, unfollowUserDirect } from "@/lib/upload-direct";
import { createPortal } from "react-dom";
import Link from "next/link";
import { AnimatePresence } from "framer-motion";
import { Bell } from "@phosphor-icons/react";
import { useAtom, useAtomValue } from "jotai";

import { Badge } from "@/components/ui/Badge";
import {
	OverlayHeader,
	OverlayPanel,
	OverlayScrim,
	useOverlayDismiss,
} from "@/components/ui/Overlay";
import { unreadNotificationsCountAtom } from "@/store/ui.atom";
import {
	notificationsAtom,
	notificationsLoadedAtom,
} from "@/store/notifications.atom";
import { groupNotifications } from "@/components/notifications/notification-groups";
import { NotificationRow } from "@/components/notifications/NotificationRow";
import type { NotificationGroup } from "@/components/notifications/types";
import { markNotificationsReadAction } from "@/lib/notification.actions";
import { followingIdsAtom } from "@/store/ui.atom";
import { useToast } from "@/components/ui/Toast/ToastContext";
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
 *
 * The grammar's `anchored` panel: a bottom sheet on a phone, a floating card
 * on anything wider. It replaces the hand-rolled anchor maths this used to do
 * — measuring the bell and portalling to fixed coordinates so the feed's
 * sticky tab bar could not draw through it. The panel is still portalled and
 * now sits at `z-modal`, so there is nothing left to draw through it.
 */
export function NotificationsPopover() {
	const t = useT();
	const [open, setOpen] = useState(false);
	// Read, never fetched. NotificationCountSync already pulls this list once
	// per app load and the realtime channel keeps it current, so opening the
	// panel costs nothing and shows content immediately.
	const [followingIds, setFollowingIds] = useAtom(followingIdsAtom);
	const { toast } = useToast();

	// Same handlers as the page, so a row behaves identically wherever it is
	// rendered — opening marks the group read, follow-back is optimistic.
	const openGroup = useCallback((group: NotificationGroup) => {
		void markNotificationsReadAction(group.ids);
		setOpen(false);
	}, []);

	const followBack = useCallback(
		async (profileId: string) => {
			if (!profileId) return;
			setFollowingIds((prev) =>
				prev.includes(profileId) ? prev : [...prev, profileId],
			);
			const res = await followUserDirect(profileId);
			if (!res.success) {
				setFollowingIds((prev) => prev.filter((x) => x !== profileId));
				toast(res.message || "Could not follow", { type: "error" });
			}
		},
		[setFollowingIds, toast],
	);

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
	/**
	 * Still PORTALLED to the body rather than nested under the bell, because
	 * the header is `z-sticky` and therefore its own stacking context — a
	 * child at `z-dropdown` cannot rise above a sibling of the HEADER at the
	 * same z, and the feed's sticky tab bar was drawing straight through the
	 * middle of the panel.
	 */
	const [mounted, setMounted] = useState(false);
	useEffect(() => setMounted(true), []);

	// Outside click is the scrim's job now; Escape and the scroll lock are the
	// hook's. Nothing is listening while the panel is shut.
	const close = useCallback(() => setOpen(false), []);
	useOverlayDismiss(open, close);

	const toggle = () => {
		const next = !open;
		setOpen(next);
		if (next) {
			// Opening is seeing. The count clears here rather than waiting for
			// the full page, which is what "already read that" should mean.
			setUnread(0);
		}
	};

	return (
		<div className="relative">
			<button
				type="button"
				onClick={toggle}
				aria-haspopup="dialog"
				aria-expanded={open}
				aria-label={t("nav.notifications")}
				className="relative flex h-12 w-12 items-center justify-center rounded-pill text-muted transition-colors active:bg-raised"
			>
				<Bell size={23} weight={open ? "fill" : "duotone"} />
				{unread > 0 && (
					<span className="absolute right-1.5 top-1.5">
						<Badge count={unread} />
					</span>
				)}
			</button>

			{mounted &&
				createPortal(
					<AnimatePresence>
						{open && (
							// A popover is not a modal: the feed behind it stays
							// lit on desktop, and dims only where the panel owns
							// the screen.
							<OverlayScrim
								key="notif-scrim"
								onClose={close}
								dim={false}
								label={t("nav.notifications")}
							/>
						)}
						{open && (
							<OverlayPanel
								key="notif-panel"
								dragClose={close} variant="anchored"
								label={t("nav.notifications")}
							>
								<OverlayHeader onClose={close}>
									<span className="flex-1 font-sans text-[11px] font-semibold uppercase tracking-[0.14em] text-subtle">
										{t("nav.notifications")}
									</span>
									<Link
										href="/notifications"
										onClick={close}
										className="font-sans text-[12px] font-semibold text-gold hover:underline"
									>
										{t("rail.seeAll")}
									</Link>
								</OverlayHeader>

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
										groups.map((g, i) => (
											<NotificationRow
												key={g.key}
												group={g}
												unread={!g.read}
												onOpen={openGroup}
												onFollowBack={followBack}
												followed={followingIds.includes(g.senders[0]?._id)}
												delay={Math.min(i * 30, 180)}
											/>
										))
									)}
								</div>
							</OverlayPanel>
						)}
					</AnimatePresence>,
					document.body,
				)}
		</div>
	);
}
