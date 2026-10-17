"use client";

import { CaretDown, CaretRight, Heart, ChatCircle, UserPlus, Repeat, At, Bell } from "@phosphor-icons/react";
import clsx from "clsx";
import { AnimatePresence, motion, useReducedMotionConfig } from "framer-motion";
import { useAtomValue } from "jotai";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import type { AppNotification } from "@/components/notifications/types";
import { displayName } from "@/components/ui/PersonName";
import { SafeAvatar } from "@/components/ui/SafeAvatar";
import { useT } from "@/i18n/client";
import { useAppPathname } from "@/i18n/useAppPathname";
import { EASE, EASE_IN } from "@/lib/motion-presets";
import { notificationsAtom, notificationsLoadedAtom } from "@/store/notifications.atom";

/**
 * The notification island (owner pick 2026-10-12, "Toasts · islands", in
 * glass). A notification that lands while you are elsewhere in the app
 * rises as one glass island pointing at the notifications door (the bell on
 * a phone, the sidebar row on a desktop) with a small notch. More that land
 * before it goes join it as an avatar stack: their faces, who and what in
 * one line, and the count. A tap opens a short list with "See all".
 *
 * It reads the shared list NotificationCountSync already keeps fresh from
 * the realtime channel, so it adds no request of its own. Only ids that
 * arrive AFTER the first load count: an old unread backlog never pops up.
 */

const HOLD_MS = 6500;
const MAX_LIST = 4;

const GLYPH: Partial<Record<AppNotification["type"], { icon: typeof Heart; tone: string; ink: string }>> = {
	like: { icon: Heart, tone: "bg-[#FF5C7A]", ink: "text-[#FF5C7A]" },
	reply: { icon: ChatCircle, tone: "bg-brand", ink: "text-brand" },
	mention: { icon: At, tone: "bg-brand", ink: "text-brand" },
	repost: { icon: Repeat, tone: "bg-success", ink: "text-success" },
	quote: { icon: Repeat, tone: "bg-success", ink: "text-success" },
	follow: { icon: UserPlus, tone: "bg-success", ink: "text-success" },
};

function hrefFor(n: AppNotification): string {
	if (n.type === "message") return n.conversation ? `/messages/${n.conversation}` : "/messages";
	if (n.type === "announcement") return n.href || "/notifications";
	if (n.type === "mention" && !n.post?._id && n.conversation) return `/messages/${n.conversation}`;
	if (n.type === "follow") return n.sender?.username ? `/profile/${n.sender.username}` : "/notifications";
	return n.post?._id ? `/post/${n.post._id}` : "/notifications";
}

/** The visible notifications door: the phone header's bell or the sidebar row. */
function findAnchor(): HTMLElement | null {
	const all = Array.from(document.querySelectorAll<HTMLElement>("[data-notif-anchor]"));
	return all.find((el) => el.getClientRects().length > 0 && el.offsetParent !== null) ?? null;
}

type Place = {
	side: "below" | "right";
	top: number;
	left: number;
	/** Where the notch sits along the panel edge, in px from its start. */
	notch: number;
};

const WIDTH = 348;

function measure(): Place | null {
	const el = findAnchor();
	if (!el) return null;
	const r = el.getBoundingClientRect();
	const vw = window.innerWidth;
	// A door on the left rail gets the island beside it; one in a top bar
	// gets it underneath.
	if (r.left < vw / 3 && r.top > 80) {
		const top = Math.max(12, r.top + r.height / 2 - 40);
		return { side: "right", top, left: r.right + 14, notch: r.top + r.height / 2 - top };
	}
	const w = Math.min(WIDTH, vw - 24);
	const left = Math.max(12, Math.min(vw - w - 12, r.left + r.width / 2 - w + 36));
	return { side: "below", top: r.bottom + 12, left, notch: r.left + r.width / 2 - left };
}

export function NotificationIsland() {
	const t = useT();
	const router = useRouter();
	const pathname = useAppPathname();
	const reduce = useReducedMotionConfig();
	const list = useAtomValue(notificationsAtom);
	const loaded = useAtomValue(notificationsLoadedAtom);

	const seen = useRef<Set<string> | null>(null);
	const [queue, setQueue] = useState<AppNotification[]>([]);
	const [open, setOpen] = useState(false);
	const [hover, setHover] = useState(false);
	const [place, setPlace] = useState<Place | null>(null);
	const timer = useRef<number | null>(null);

	const onNotifications = pathname.startsWith("/notifications");

	// New ids after the first load join the queue, newest first.
	useEffect(() => {
		if (!loaded) return;
		if (seen.current === null) {
			seen.current = new Set(list.map((n) => n._id));
			return;
		}
		const fresh = list.filter((n) => !seen.current?.has(n._id) && !n.read);
		for (const n of list) seen.current.add(n._id);
		if (fresh.length === 0 || onNotifications) return;
		setQueue((q) => [...fresh, ...q].slice(0, 12));
	}, [list, loaded, onNotifications]);

	const dismiss = useCallback(() => {
		setQueue([]);
		setOpen(false);
	}, []);

	// Leave on its own after a quiet spell; a new arrival, a hover or an
	// open stack holds it.
	useEffect(() => {
		if (timer.current) window.clearTimeout(timer.current);
		if (queue.length === 0 || hover || open) return;
		timer.current = window.setTimeout(dismiss, HOLD_MS);
		return () => {
			if (timer.current) window.clearTimeout(timer.current);
		};
	}, [queue, hover, open, dismiss]);

	useEffect(() => {
		if (onNotifications) dismiss();
	}, [onNotifications, dismiss]);

	useLayoutEffect(() => {
		if (queue.length === 0) return;
		const update = () => setPlace(measure());
		update();
		window.addEventListener("resize", update);
		return () => window.removeEventListener("resize", update);
	}, [queue.length]);

	if (typeof document === "undefined") return null;

	const go = (href: string) => {
		dismiss();
		router.push(href);
	};

	const names = Array.from(new Set(queue.map((n) => displayName(n.sender).split(" ")[0]))).filter(Boolean);
	// "Kemi", "Kemi and Tunde", "Kemi, Tunde and Ada", "Kemi, Tunde and 3 others".
	const summary =
		names.length <= 2
			? names.join(` ${t("notif.and")} `)
			: names.length === 3
				? `${names[0]}, ${names[1]} ${t("notif.and")} ${names[2]}`
				: `${names[0]}, ${names[1]} ${t("notif.others.many").replace("{n}", String(names.length - 2))}`;

	// Up to three distinct faces, newest first, for the avatar stack.
	const faces = queue
		.map((n) => n.sender)
		.filter((p, i, all) => p && all.findIndex((q) => q?._id === p._id) === i)
		.slice(0, 3);
	// What arrived, by kind, in arrival order: "♥ 2  💬 1  + 1".
	const kinds = queue.reduce<{ type: AppNotification["type"]; count: number }[]>((acc, n) => {
		const hit = acc.find((k) => k.type === n.type);
		if (hit) hit.count += 1;
		else acc.push({ type: n.type, count: 1 });
		return acc;
	}, []);

	const side = place?.side ?? "below";
	const style: React.CSSProperties = place
		? { position: "fixed", top: place.top, left: place.left, width: Math.min(WIDTH, window.innerWidth - 24) }
		: { position: "fixed", top: 72, right: 12, width: Math.min(WIDTH, window.innerWidth - 24) };

	return createPortal(
		<AnimatePresence>
			{queue.length > 0 && (
				<motion.section
					key="notif-island"
					aria-label={t("nav.notifications")}
					aria-live="polite"
					onMouseEnter={() => setHover(true)}
					onMouseLeave={() => setHover(false)}
					initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.92, y: side === "below" ? -8 : 0, x: side === "right" ? -8 : 0 }}
					animate={{ opacity: 1, scale: 1, y: 0, x: 0, transition: { type: "spring", stiffness: 520, damping: 34 } }}
					exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.16, ease: EASE_IN } }}
					style={{ ...style, transformOrigin: side === "below" ? `${place?.notch ?? 300}px 0` : `0 ${place?.notch ?? 40}px` }}
					className="z-toast"
				>
					{/* The notch: a tip of the same glass, pointing at the door. */}
					<span
						aria-hidden
						className={clsx(
							"absolute h-3.5 w-3.5 rotate-45 border-hairline bg-surface/90 backdrop-blur-2xl",
							side === "below" ? "-top-[7px] border-l border-t" : "-left-[7px] border-b border-l",
						)}
						style={side === "below" ? { left: (place?.notch ?? 300) - 7 } : { top: (place?.notch ?? 40) - 7 }}
					/>
					<div
						className={clsx(
							"relative bg-surface/80 shadow-pop backdrop-blur-2xl backdrop-saturate-150",
							open ? "rounded-[26px] p-2" : queue.length > 1 ? "rounded-pill p-1.5" : "rounded-[26px] p-1.5",
						)}
					>
						{open ? (
							<div className="flex flex-col gap-1.5">
								<div className="flex items-center gap-2 px-2 pb-1 pt-1">
									<span className="font-sans text-[calc(13.5px*var(--ws-fs))] font-bold text-primary">
										{t("notif.newCount").replace("{n}", String(queue.length))}
									</span>
									<span className="min-w-0 flex-1 truncate font-sans text-[calc(12.5px*var(--ws-fs))] text-muted">{summary}</span>
									<button
										type="button"
										onClick={() => setOpen(false)}
										aria-label={t("common.close")}
										className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-pill bg-primary/[0.07] text-muted transition-colors hover:text-primary"
									>
										<CaretDown size={12} weight="bold" className="rotate-180" />
									</button>
								</div>
								{queue.slice(0, MAX_LIST).map((n, i) => (
									<motion.div
										key={n._id}
										initial={{ opacity: 0, y: -6 }}
										animate={{ opacity: 1, y: 0, transition: { duration: 0.2, ease: EASE, delay: i * 0.03 } }}
									>
										<IslandCard n={n} onOpen={() => go(hrefFor(n))} />
									</motion.div>
								))}
								<button
									type="button"
									onClick={() => go("/notifications")}
									className="flex h-10 cursor-pointer items-center justify-center gap-1 rounded-pill bg-primary/[0.06] font-sans text-[calc(13px*var(--ws-fs))] font-semibold text-brand transition-colors hover:bg-primary/[0.1]"
								>
									{t("notif.seeAll")}
									<CaretRight size={12} weight="bold" />
								</button>
							</div>
						) : queue.length > 1 ? (
							// Several: one pill with their faces stacked (owner
							// 2026-10-12: "avatar stack, not card stack"), who and
							// what in one line, and the count. A tap opens the list.
							<button
								type="button"
								onClick={() => setOpen(true)}
								aria-expanded={false}
								className="flex w-full cursor-pointer items-center gap-3 rounded-pill pr-1.5 text-left"
							>
								<span className="flex shrink-0 -space-x-3 pl-0.5">
									<AnimatePresence initial={false}>
										{faces.map((p) => (
											<motion.span
												key={p._id}
												layout
												initial={{ opacity: 0, scale: 0.6 }}
												animate={{ opacity: 1, scale: 1, transition: { type: "spring", stiffness: 520, damping: 30 } }}
												className="relative block h-10 w-10 overflow-hidden rounded-pill bg-raised ring-[2.5px] ring-surface"
											>
												<SafeAvatar src={p.avatar} className="object-cover" sizes="40px" />
											</motion.span>
										))}
									</AnimatePresence>
								</span>
								<span className="min-w-0 flex-1">
									<span className="block truncate font-sans text-[calc(14px*var(--ws-fs))] font-semibold text-primary">
										{summary}
									</span>
									<span className="mt-0.5 flex items-center gap-2.5">
										{kinds.map(({ type, count }) => {
											const g = GLYPH[type] ?? { icon: Bell, ink: "text-brand" };
											const Glyph = g.icon;
											return (
												<span key={type} className={clsx("flex items-center gap-1 font-sans text-[calc(12px*var(--ws-fs))] font-semibold tabular-nums", g.ink)}>
													<Glyph size={12} weight="fill" />
													<span className="text-muted">{count}</span>
												</span>
											);
										})}
									</span>
								</span>
								<span className="flex h-8 min-w-8 shrink-0 items-center justify-center rounded-pill bg-brand px-2 font-sans text-[calc(13px*var(--ws-fs))] font-bold tabular-nums text-brand-on">
									{queue.length}
								</span>
							</button>
						) : (
							<AnimatePresence mode="popLayout" initial={false}>
								<motion.div
									key={queue[0]._id}
									initial={{ opacity: 0, y: -10, scale: 0.97 }}
									animate={{ opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 520, damping: 34 } }}
									exit={{ opacity: 0, y: 8, scale: 0.97, transition: { duration: 0.14, ease: EASE_IN } }}
								>
									<IslandCard n={queue[0]} onOpen={() => go(hrefFor(queue[0]))} />
								</motion.div>
							</AnimatePresence>
						)}
					</div>
				</motion.section>
			)}
		</AnimatePresence>,
		document.body,
	);
}

function IslandCard({ n, onOpen }: { n: AppNotification; onOpen: () => void }) {
	const t = useT();
	const g = GLYPH[n.type] ?? { icon: Bell, tone: "bg-brand", ink: "text-brand" };
	const Glyph = g.icon;
	return (
		<button
			type="button"
			onClick={onOpen}
			className="flex w-full cursor-pointer items-center gap-3 rounded-[20px] bg-primary/[0.06] px-3 py-2.5 text-left transition-colors hover:bg-primary/[0.1]"
		>
			<span className="relative h-10 w-10 shrink-0">
				<span className="relative block h-10 w-10 overflow-hidden rounded-pill bg-raised">
					<SafeAvatar src={n.sender?.avatar} className="object-cover" sizes="40px" />
				</span>
				<span className={clsx("absolute -bottom-0.5 -right-0.5 flex h-[18px] w-[18px] items-center justify-center rounded-pill border-2 border-surface text-white", g.tone)}>
					<Glyph size={9} weight="fill" />
				</span>
			</span>
			<span className="min-w-0 flex-1">
				<span className="block truncate font-sans text-[calc(13.5px*var(--ws-fs))] text-primary">
					<span className="font-semibold">{displayName(n.sender)}</span>{" "}
					{n.type === "announcement" && n.title ? n.title : t(`notif.verb.${n.type}`)}
				</span>
				{(n.post?.content || n.body) && (
					<span className="block truncate font-sans text-[calc(12px*var(--ws-fs))] text-muted">
						{n.post?.content || n.body}
					</span>
				)}
			</span>
			<span className="shrink-0 font-sans text-[calc(11.5px*var(--ws-fs))] text-subtle">{t("time.justnow")}</span>
		</button>
	);
}
