"use client";

import { useAuth } from "@clerk/nextjs";
import { syncUrlIfStillOn } from "@/lib/url-sync";
import axios from "axios";
import clsx from "clsx";
import { compressImage } from "@/lib/image-compress";
import { useAtomValue, useSetAtom } from "jotai";
import { useCallback, useEffect, useRef, useState } from "react";
import {
	CaretLeft,
	ChartBar,
	ImageSquare,
	PaperPlaneRight,
	Plus,
	SpeakerHigh,
	UploadSimple,
	VideoCamera,
	X,
} from "@phosphor-icons/react";
import Link from "next/link";
import { Briefcase } from "lucide-react";
import { BACKEND_URL } from "@/const";
import { userAtom } from "@/store/user.atom";
import { unreadBmCountAtom } from "@/store/ui.atom";
import { useUserEvents } from "@/hooks/useUserEvents";
import { SafeAvatar } from "@/components/ui/SafeAvatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast/ToastContext";
import { formatTimeAgo } from "@/lib/utils";
import { Tabs } from "@/components/ui/Tabs";
import ConfirmModal from "@/components/ui/ConfirmModal";
import {
	OverlayHeader,
	OverlayPanel,
	OverlayScrim,
	useOverlayDismiss,
} from "@/components/ui/Overlay";
import CalendarField from "@/components/ui/CalendarField";
import { AdSlotPreview } from "@/components/profile/AdSlot";

/**
 * Business Messages — the deal room for ad bookings.
 *
 * Deliberately its own surface, not a Messages tab: a deal thread is a
 * structured negotiation with money state, not a chat. The booking card at
 * the top carries the terms and the actions that change them; free text
 * lives underneath for the actual back-and-forth; the machine's system
 * messages record every transition, because this thread is the audit trail.
 *
 * All reads and writes here go browser → gateway directly with the Clerk
 * token — the pattern the fetch audit picked as the fix for server-action
 * serialization. New surfaces start on it; old ones migrate.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || BACKEND_URL;

const usd = (minor: number | undefined) =>
	`$${(((minor ?? 0) as number) / 100).toFixed(2)}`;

interface BmParty {
	_id: string;
	username: string;
	firstName?: string;
	lastName?: string;
	avatar?: string;
}

interface BmBooking {
	_id: string;
	format: "image" | "video" | "audio";
	creative?: { url?: string; linkUrl?: string; coverUrl?: string };
	status:
		| "requested"
		| "declined"
		| "expired"
		| "accepted"
		| "live"
		| "paused"
		| "completed"
		| "cancelled";
	startAt: string;
	endAt: string;
	durationDays: number;
	agreedUsdMinor: number;
	daysServed: number;
	settledUsdMinor: number;
	creatorPaidUsdMinor: number;
	awaitingActionFrom: "creator" | "advertiser";
	statusReason?: string;
	impressions?: number;
	clicks?: number;
}

interface BmThread {
	_id: string;
	unread?: boolean;
	booking: BmBooking;
	creator: BmParty;
	advertiser: BmParty;
	lastMessageAt: string;
	lastMessagePreview: string;
}

interface BmPeriod {
	index: number;
	startAt: string;
	endAt: string;
	amountUsdMinor: number;
	status: "pending" | "held" | "captured" | "released" | "failed";
	capturedUsdMinor?: number;
	creatorShareUsdMinor?: number;
}

interface BmMessage {
	_id: string;
	sender?: BmParty | null;
	kind: "text" | "system" | "counter";
	content: string;
	createdAt: string;
}

/** "Today" / "Yesterday" / a date — the Messages day-divider grammar. */
function dayLabel(iso: string): string {
	const d = new Date(iso);
	const today = new Date();
	const strip = (x: Date) =>
		new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
	const diff = (strip(today) - strip(d)) / 86_400_000;
	if (diff === 0) return "Today";
	if (diff === 1) return "Yesterday";
	return d.toLocaleDateString(undefined, {
		month: "short",
		day: "numeric",
		...(d.getFullYear() !== today.getFullYear() ? { year: "numeric" } : {}),
	});
}

/** Status → chip treatment. Semantic tokens only; gold marks "your move". */
const STATUS_CHIP: Record<BmBooking["status"], string> = {
	requested: "bg-gold/10 text-gold",
	accepted: "bg-raised text-primary",
	live: "bg-success/10 text-success",
	paused: "bg-danger/10 text-danger",
	completed: "bg-raised text-muted",
	declined: "bg-raised text-subtle",
	expired: "bg-raised text-subtle",
	cancelled: "bg-raised text-subtle",
};

export default function BmPage() {
	const { getToken } = useAuth();
	const me = useAtomValue(userAtom);
	const setUnreadBm = useSetAtom(unreadBmCountAtom);
	const { toast } = useToast();

	const [threads, setThreads] = useState<BmThread[]>([]);
	const [loaded, setLoaded] = useState(false);
	const [activeId, setActiveId] = useState<string | null>(null);
	const [messages, setMessages] = useState<BmMessage[]>([]);
	/** Full booking for the open thread — the receipt needs the periods,
	 *  which the thread list deliberately does not carry. */
	const [periods, setPeriods] = useState<BmPeriod[]>([]);
	const [draft, setDraft] = useState("");
	const [busy, setBusy] = useState(false);
	const [composerOpen, setComposerOpen] = useState(false);
	const endRef = useRef<HTMLDivElement>(null);

	const authed = useCallback(
		async (method: "get" | "post", path: string, body?: unknown) => {
			const token = await getToken();
			const res = await axios.request({
				method,
				url: `${API_URL}${path}`,
				data: body,
				headers: { Authorization: `Bearer ${token}` },
			});
			return res.data;
		},
		[getToken],
	);

	const loadThreads = useCallback(async () => {
		try {
			const data = await authed("get", "/api/bm/threads");
			setThreads(data.threads ?? []);
		} catch {
			// The poll retries; a transient failure paints nothing scary.
		} finally {
			setLoaded(true);
		}
	}, [authed]);

	const loadMessages = useCallback(
		async (threadId: string) => {
			try {
				const data = await authed(
					"get",
					`/api/bm/threads/${threadId}/messages`,
				);
				setMessages(data.messages ?? []);
			} catch {
				/* poll retries */
			}
		},
		[authed],
	);

	useEffect(() => {
		void loadThreads();
		// Fallback cadence only — bm events refresh instantly below.
		const t = setInterval(() => void loadThreads(), 60_000);
		return () => clearInterval(t);
	}, [loadThreads]);

	// Realtime: a bm event means a thread of mine changed. Refresh the list,
	// and the open room if there is one — the deal room reacts the moment
	// the other side speaks or the machine settles a tranche.
	const activeIdRef = useRef<string | null>(null);
	activeIdRef.current = activeId;
	useUserEvents((event) => {
		if (event.type !== "bm") return;
		void loadThreads();
		void loadRequests();
		if (activeIdRef.current) void loadMessages(activeIdRef.current);
	});

	/**
	 * The requests QUEUE — a different animal from the thread list. A creator
	 * with real reach fields hundreds of pending offers; those are rows to
	 * triage by money, not conversations to scroll. Server-sorted by offer,
	 * fetched only when the tab is open.
	 */
	const [pane, setPane] = useState<"deals" | "requests">("deals");
	const [requests, setRequests] = useState<any[]>([]);
	const loadRequests = useCallback(async () => {
		try {
			const data = await authed(
				"get",
				"/api/ads/bookings?role=creator&status=requested&sort=offer&limit=200",
			);
			setRequests(data.bookings ?? []);
		} catch {
			/* poll retries */
		}
	}, [authed]);
	useEffect(() => {
		if (pane !== "requests") return;
		void loadRequests();
		const t = setInterval(() => void loadRequests(), 30_000);
		return () => clearInterval(t);
	}, [pane, loadRequests]);
	// The tab badge must be honest before the tab is ever opened.
	useEffect(() => {
		void loadRequests();
	}, [loadRequests]);

	const [confirmDeclineAll, setConfirmDeclineAll] = useState(false);
	const declineAll = async () => {
		if (busy) return;
		setBusy(true);
		try {
			const d = await authed("post", "/api/ads/bookings/decline-all");
			toast(`Declined ${d.declined} request${d.declined === 1 ? "" : "s"}`, {
				type: "success",
			});
			await Promise.all([loadThreads(), loadRequests()]);
		} catch (err: any) {
			toast(err?.response?.data?.message ?? "Could not clear the queue", {
				type: "error",
			});
		} finally {
			setBusy(false);
		}
	};

	const openBooking = (bookingId: string) => {
		const t = threads.find((th) => th.booking?._id === bookingId);
		if (t) {
			setPane("deals");
			setActiveId(t._id);
		}
	};

	// /bm?book=<handle> — the profile's "Book" affordance lands here with the
	// sheet already open on that creator. Read once, then cleaned from the
	// URL so a refresh does not reopen it.
	const [prefillUsername, setPrefillUsername] = useState("");
	useEffect(() => {
		// The param STAYS in the URL while the sheet is up. The old version
		// stripped it immediately — so any remount (dev double-mount, template
		// churn) landed after the strip with fresh closed state and nothing
		// left to reopen from, and the Book affordance silently did nothing.
		// Cleaning happens when the sheet closes, where it belongs.
		const book = new URLSearchParams(window.location.search).get("book");
		if (book) {
			setPrefillUsername(book);
			setComposerOpen(true);
		}
	}, []);
	// /bm?deal=<bookingId> — one click from the profile's metrics chip to
	// the deal room with analytics already open. Held until threads arrive
	// (the list loads async), consumed once, then cleaned from the URL.
	const [dealParam, setDealParam] = useState<string | null>(null);
	const [autoStatsFor, setAutoStatsFor] = useState<string | null>(null);
	useEffect(() => {
		const deal = new URLSearchParams(window.location.search).get("deal");
		if (deal) setDealParam(deal);
	}, []);
	useEffect(() => {
		if (!dealParam || threads.length === 0) return;
		const t = threads.find((th) => th.booking?._id === dealParam);
		if (t) {
			setActiveId(t._id);
			setAutoStatsFor(t._id);
			setDealParam(null);
			// Guard + state pass-through, both load-bearing (see explore's
			// syncUrl and live's slide sync for the history of each):
			// - threads arrive seconds after mount, so this can fire AFTER
			//   the person has already navigated elsewhere; rewriting the URL
			//   then yanks them back to /bm — "enter a page, enter another,
			//   it takes you back".
			// - null state strips the App Router's tree from the entry, and
			//   the next back/forward restores the wrong page.
			syncUrlIfStillOn("/bm", "/bm");
		}
	}, [dealParam, threads]);

	const closeComposer = () => {
		setComposerOpen(false);
		if (window.location.search.includes("book=")) {
			syncUrlIfStillOn("/bm", "/bm");
		}
	};

	useEffect(() => {
		if (!activeId) return;
		void loadMessages(activeId);
		// Fallback only; the bm event above is the fast path.
		const t = setInterval(() => void loadMessages(activeId), 20_000);
		return () => clearInterval(t);
	}, [activeId, loadMessages]);

	// Opening a room IS reading it — the same instant Messages zeroes a
	// conversation. Server watermark first, then the row and the nav badge,
	// so every surface tells the same story.
	useEffect(() => {
		if (!activeId) return;
		const t = threads.find((th) => th._id === activeId);
		if (!t?.unread) return;
		void authed("post", `/api/bm/threads/${activeId}/read`).catch(() => {});
		setThreads((prev) =>
			prev.map((th) =>
				th._id === activeId ? { ...th, unread: false } : th,
			),
		);
		setUnreadBm((c) => Math.max(0, c - 1));
	}, [activeId, threads, authed, setUnreadBm]);

	// The receipt rides the full booking document.
	useEffect(() => {
		setPeriods([]);
		const bookingId = threads.find((t) => t._id === activeId)?.booking?._id;
		if (!bookingId) return;
		let cancelled = false;
		void authed("get", `/api/ads/bookings/${bookingId}`)
			.then((d) => {
				if (!cancelled) setPeriods(d.booking?.periods ?? []);
			})
			.catch(() => {});
		return () => {
			cancelled = true;
		};
	}, [activeId, threads, authed]);

	useEffect(() => {
		endRef.current?.scrollIntoView({ block: "end" });
	}, [messages.length]);

	const active = threads.find((t) => t._id === activeId) ?? null;
	const myId = me?._id ? String(me._id) : "";
	const roleIn = (t: BmThread) =>
		String(t.creator?._id) === myId ? "creator" : "advertiser";
	const counterpartOf = (t: BmThread) =>
		roleIn(t) === "creator" ? t.advertiser : t.creator;

	const act = async (
		bookingId: string,
		verb: "accept" | "decline" | "cancel",
	) => {
		if (busy) return;
		setBusy(true);
		try {
			await authed("post", `/api/ads/bookings/${bookingId}/${verb}`);
			await Promise.all([
				loadThreads(),
				loadRequests(),
				activeId && loadMessages(activeId),
			]);
		} catch (err: any) {
			toast(err?.response?.data?.message ?? "That didn't go through", {
				type: "error",
			});
		} finally {
			setBusy(false);
		}
	};

	const counter = async (
		bookingId: string,
		terms: { priceUsdMinor: number; days: number },
	) => {
		if (busy) return;
		setBusy(true);
		try {
			await authed("post", `/api/ads/bookings/${bookingId}/counter`, terms);
			await Promise.all([loadThreads(), activeId && loadMessages(activeId)]);
		} catch (err: any) {
			toast(err?.response?.data?.message ?? "Counter failed", {
				type: "error",
			});
		} finally {
			setBusy(false);
		}
	};

	const send = async () => {
		const content = draft.trim();
		if (!content || !activeId || busy) return;
		setDraft("");
		try {
			await authed("post", `/api/bm/threads/${activeId}/messages`, {
				content,
			});
			await loadMessages(activeId);
		} catch (err: any) {
			setDraft(content); // give the words back, never eat them
			toast(err?.response?.data?.message ?? "Message failed to send", {
				type: "error",
			});
		}
	};

	return (
		<div className="flex h-dvh min-h-0">
			{/* ── thread list ─────────────────────────────────────────── */}
			<aside
				className={clsx(
					"flex w-full flex-col md:w-[380px] md:shrink-0 md:border-r md:border-hairline",
					activeId && "hidden md:flex",
				)}
			>
				<header className="flex h-16 shrink-0 items-center justify-between px-5">
					<h1 className="font-display text-[20px] font-semibold tracking-[-0.01em]">
						Business
					</h1>
					<button
						type="button"
						onClick={() => setComposerOpen(true)}
						className="flex h-9 items-center gap-1.5 rounded-pill bg-brand px-3.5 font-sans text-[13px] font-semibold text-brand-on transition-colors hover:opacity-90 cursor-pointer"
					>
						<Plus size={14} weight="bold" />
						New booking
					</button>
				</header>

				<div className="px-4 pb-2">
					<Tabs
						ariaLabel="Business sections"
						value={pane}
						onChange={setPane}
						items={[
							{ key: "deals", label: "Deals" },
							{
								key: "requests",
								label: "Requests",
								badge: requests.length || undefined,
							},
						]}
					/>
				</div>

				<div className="min-h-0 flex-1 overflow-y-auto">
					{pane === "requests" ? (
						<>
							<RequestQueue
								requests={requests}
								busy={busy}
								onAct={act}
								onOpen={openBooking}
								onDeclineAll={() => setConfirmDeclineAll(true)}
							/>
							<ConfirmModal
								isOpen={confirmDeclineAll}
								onClose={() => setConfirmDeclineAll(false)}
								onConfirm={() => {
									setConfirmDeclineAll(false);
									void declineAll();
								}}
								title={`Decline all ${requests.length} requests?`}
								message="Every pending request is declined and each advertiser sees it in their thread. Deals already accepted are untouched."
								confirmText="Decline all"
								isDestructive
							/>
						</>
					) : !loaded ? (
						<div className="flex flex-col gap-3 p-4">
							{[0, 1, 2].map((i) => (
								<div key={i} className="flex items-center gap-3">
									<div className="skeleton h-11 w-11 shrink-0 rounded-pill" />
									<div className="flex-1 space-y-2">
										<div className="skeleton h-3 w-2/5 rounded" />
										<div className="skeleton h-3 w-4/5 rounded" />
									</div>
								</div>
							))}
						</div>
					) : threads.length === 0 ? (
						<EmptyState
							icon={Briefcase}
							title="No deals yet"
							caption="Booking requests for ad space arrive here — yours and ones sent to you."
						/>
					) : (
						threads.map((t) => {
							const other = counterpartOf(t);
							const b = t.booking;
							const myMove =
								b?.status === "requested" &&
								b.awaitingActionFrom === roleIn(t);
							const active = activeId === t._id;
							return (
								<button
									key={t._id}
									type="button"
									onClick={() => setActiveId(t._id)}
									aria-current={active ? "true" : undefined}
									className={clsx(
										"group relative flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left transition-colors",
										active ? "bg-raised" : "hover:bg-surface",
									)}
								>
									{/* Active marker is a rail, same as Messages — a
									    border on every row turns a list into a ledger. */}
									<span
										aria-hidden
										className={clsx(
											"absolute left-0 top-1/2 h-8 w-[3px] -translate-y-1/2 rounded-r-pill bg-brand transition-opacity",
											active ? "opacity-100" : "opacity-0",
										)}
									/>
									<span className="relative block h-12 w-12 shrink-0 overflow-hidden rounded-pill bg-raised">
										<SafeAvatar src={other?.avatar} />
									</span>
									<span className="min-w-0 flex-1">
										<span className="flex items-baseline justify-between gap-2">
											<span
												className={clsx(
													"truncate font-sans text-[14.5px] text-primary",
													t.unread ? "font-bold" : "font-semibold",
												)}
											>
												{other?.firstName || other?.username}
											</span>
											<span className="shrink-0 font-sans text-[11.5px] text-subtle tabular-nums">
												{formatTimeAgo(t.lastMessageAt)}
											</span>
										</span>
										<span className="mt-0.5 flex items-center gap-1.5">
											{myMove || t.unread ? (
												<span
													aria-hidden
													className={clsx(
														"h-1.5 w-1.5 shrink-0 rounded-pill",
														myMove ? "bg-gold" : "bg-brand",
													)}
												/>
											) : null}
											<span
												className={clsx(
													"truncate font-sans text-[13px]",
													myMove || t.unread
														? "font-medium text-primary"
														: "text-muted",
												)}
											>
												{myMove
													? "Your move — respond to the offer"
													: t.lastMessagePreview}
											</span>
										</span>
									</span>
									{b && (
										<span
											className={clsx(
												"shrink-0 rounded-pill px-2 py-0.5 font-sans text-[10.5px] font-semibold uppercase tracking-wide",
												STATUS_CHIP[b.status],
											)}
										>
											{b.status}
										</span>
									)}
								</button>
							);
						})
					)}
				</div>
			</aside>

			{/* ── thread view ─────────────────────────────────────────── */}
			<section
				className={clsx(
					"min-w-0 flex-1 flex-col",
					active ? "flex" : "hidden md:flex",
				)}
			>
				{!active ? (
					<div className="flex flex-1 items-center justify-center">
						<EmptyState
							icon={Briefcase}
							title="Select a deal"
							caption="Terms, escrow state and the conversation live together in one room."
						/>
					</div>
				) : (
					<ThreadView
						thread={active}
						role={roleIn(active)}
						messages={messages}
						periods={periods}
						onCounter={counter}
						draft={draft}
						setDraft={setDraft}
						onSend={send}
						onBack={() => setActiveId(null)}
						onAct={act}
						busy={busy}
						endRef={endRef}
						autoStats={autoStatsFor === active._id}
						onAutoStatsDone={() => setAutoStatsFor(null)}
					/>
				)}
			</section>

			{composerOpen && (
				<NewBookingSheet
					onClose={closeComposer}
					authed={authed}
					initialUsername={prefillUsername}
					onCreated={async () => {
						closeComposer();
						await loadThreads();
					}}
				/>
			)}
		</div>
	);
}

/* ── the requests queue ─────────────────────────────────────────── */

/**
 * Triage, not chat. At celebrity volume the inbox is hundreds of offers
 * competing for one calendar, so the presentation answers the only three
 * questions that decide a triage pass: how much, for what, when — sorted by
 * money server-side, with accept/decline ON the row. Opening the thread is
 * for the ones worth talking to.
 */
function RequestQueue({
	requests,
	busy,
	onAct,
	onOpen,
	onDeclineAll,
}: {
	requests: any[];
	busy: boolean;
	onAct: (bookingId: string, verb: "accept" | "decline" | "cancel") => void;
	onOpen: (bookingId: string) => void;
	onDeclineAll: () => void;
}) {
	const [visible, setVisible] = useState(60);
	if (requests.length === 0) {
		return (
			<div className="px-6 py-10 text-center font-sans text-[13px] text-subtle">
				No pending requests — offers land here, biggest first.
			</div>
		);
	}
	const totalOffered = requests.reduce(
		(a, r) => a + (r.agreedUsdMinor ?? 0),
		0,
	);
	// Overlapping campaigns rotate in the slot's carousel (admin ruling), so
	// the overlap count is now capacity information — how crowded these dates
	// already are — rather than an auction. O(n²) over ≤200 rows is nothing.
	const overlaps = new Map<string, number>();
	for (const a of requests) {
		let n = 0;
		const aS = new Date(a.startAt).getTime();
		const aE = new Date(a.endAt).getTime();
		for (const b of requests) {
			if (a._id === b._id) continue;
			if (
				new Date(b.startAt).getTime() < aE &&
				new Date(b.endAt).getTime() > aS
			) {
				n++;
			}
		}
		overlaps.set(a._id, n);
	}
	return (
		<div>
			{/* The aggregate is the celebrity's signal: what is this queue
			    WORTH, before reading a single row. */}
			<div className="flex items-center justify-between px-4 pb-2 pt-1">
				<span className="font-sans text-[12px] text-subtle tabular-nums">
					{requests.length} request{requests.length === 1 ? "" : "s"} ·{" "}
					<span className="font-semibold text-gold">
						{usd(totalOffered)} offered
					</span>
				</span>
				{requests.length > 1 && (
					<button
						type="button"
						disabled={busy}
						onClick={onDeclineAll}
						className="cursor-pointer font-sans text-[12px] font-medium text-muted transition-colors hover:text-danger disabled:opacity-50"
					>
						Decline all
					</button>
				)}
			</div>
			{requests.slice(0, visible).map((r) => {
				const adv = r.advertiser ?? {};
				return (
					<div
						key={r._id}
						className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface"
					>
						<button
							type="button"
							onClick={() => onOpen(r._id)}
							className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left"
						>
							<span className="relative block h-11 w-11 shrink-0 overflow-hidden rounded-pill bg-raised">
								<SafeAvatar src={adv.avatar} />
							</span>
							<span className="min-w-0 flex-1">
								<span className="flex items-baseline justify-between gap-2">
									<span className="truncate font-sans text-[14px] font-semibold text-primary">
										{adv.firstName || adv.username}
									</span>
									<span className="shrink-0 font-display text-[15px] font-semibold text-primary tabular-nums">
										{usd(r.agreedUsdMinor)}
									</span>
								</span>
								<span className="mt-0.5 block truncate font-sans text-[12.5px] text-muted tabular-nums">
									{r.format} · {r.durationDays}d ·{" "}
									{new Date(r.startAt).toLocaleDateString(undefined, {
										month: "short",
										day: "numeric",
									})}
									{r.creative?.url ? " · creative attached" : ""}
									{(overlaps.get(r._id) ?? 0) > 0 && (
										<span className="text-gold">
											{" "}
											· rotates with {overlaps.get(r._id)} other
											{overlaps.get(r._id) === 1 ? "" : "s"} on these
											dates
										</span>
									)}
								</span>
							</span>
						</button>
						{/* Accept / decline live ON the row: triage must not cost a
						    navigation per decision. */}
						<div className="flex shrink-0 items-center gap-1.5">
							<button
								type="button"
								disabled={busy}
								onClick={() => onAct(r._id, "accept")}
								className="h-8 cursor-pointer rounded-pill bg-brand px-3 font-sans text-[12px] font-semibold text-brand-on transition-colors hover:bg-brand-active disabled:opacity-50"
							>
								Accept
							</button>
							<button
								type="button"
								disabled={busy}
								onClick={() => onAct(r._id, "decline")}
								aria-label="Decline"
								className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-pill bg-raised text-muted transition-colors hover:bg-chip hover:text-danger disabled:opacity-50"
							>
								<X size={13} weight="bold" />
							</button>
						</div>
					</div>
				);
			})}
			{requests.length > visible && (
				<button
					type="button"
					onClick={() => setVisible((v) => v + 60)}
					className="mx-4 my-3 h-10 w-[calc(100%-2rem)] cursor-pointer rounded-pill bg-raised font-sans text-[13px] font-medium text-muted transition-colors hover:bg-chip hover:text-primary"
				>
					Show {Math.min(60, requests.length - visible)} more of{" "}
					{requests.length - visible}
				</button>
			)}
		</div>
	);
}

/* ── the deal room ──────────────────────────────────────────────── */

/**
 * The numbers behind one campaign, for whichever side is asking. Everything
 * here already rides the thread payload — the sheet is presentation, not a
 * new fetch: serving (views/clicks/CTR), delivery (days, progress), and
 * where the dollars stand, framed per role.
 */
function CampaignStatsSheet({
	booking: b,
	periods,
	role,
	onClose,
}: {
	booking: BmBooking;
	periods: BmPeriod[];
	role: "creator" | "advertiser";
	onClose: () => void;
}) {
	useOverlayDismiss(true, onClose);
	const views = b.impressions ?? 0;
	const clicks = b.clicks ?? 0;
	const ctr = views > 0 ? ((clicks / views) * 100).toFixed(1) : null;
	const pct = Math.min(
		100,
		Math.round((b.daysServed / Math.max(1, b.durationDays)) * 100),
	);
	const held = periods
		.filter((p) => p.status === "held")
		.reduce((n, p) => n + p.amountUsdMinor, 0);
	const returned = periods
		.filter((p) => p.status === "released")
		.reduce((n, p) => n + p.amountUsdMinor, 0);
	const fmtDay = (iso: string) =>
		new Date(iso).toLocaleDateString(undefined, {
			month: "short",
			day: "numeric",
		});
	return (
		<>
			<OverlayScrim onClose={onClose} />
			<OverlayPanel variant="anchored" label="Campaign analytics">
				<OverlayHeader title="Campaign analytics" onClose={onClose} />
				<div className="px-4 pb-4 md:px-5 md:pb-5">
					<div className="grid grid-cols-3 gap-1.5">
						{[
							["Views", views.toLocaleString()],
							["Clicks", clicks.toLocaleString()],
							["CTR", ctr ? `${ctr}%` : "—"],
						].map(([label, value]) => (
							<div
								key={label}
								className="rounded-[10px] bg-sunken px-3 py-2.5"
							>
								<p className="font-display text-[18px] font-semibold text-primary tabular-nums">
									{value}
								</p>
								<p className="font-sans text-[11px] text-subtle">{label}</p>
							</div>
						))}
					</div>

					<div className="mt-3 rounded-[10px] bg-sunken px-3 py-2.5">
						<div className="flex items-baseline justify-between font-sans text-[12px]">
							<span className="text-muted tabular-nums">
								{b.daysServed}/{b.durationDays} days served
							</span>
							<span className="text-subtle tabular-nums">
								{fmtDay(b.startAt)} – {fmtDay(b.endAt)}
							</span>
						</div>
						<div className="mt-2 h-1 overflow-hidden rounded-pill bg-raised">
							<div
								className="h-full rounded-pill bg-gold transition-[width]"
								style={{ width: `${pct}%` }}
							/>
						</div>
					</div>

					<div className="mt-3 overflow-hidden rounded-[10px] bg-sunken">
						<StatRow label="Deal value" value={usd(b.agreedUsdMinor)} />
						<StatRow label="Settled" value={usd(b.settledUsdMinor)} />
						{role === "creator" ? (
							<StatRow
								label="You earned"
								value={usd(b.creatorPaidUsdMinor)}
								tone="success"
							/>
						) : (
							<>
								{held > 0 && (
									<StatRow label="Held in escrow" value={usd(held)} />
								)}
								{returned > 0 && (
									<StatRow
										label="Returned to you"
										value={usd(returned)}
										tone="success"
									/>
								)}
							</>
						)}
					</div>
				</div>
			</OverlayPanel>
		</>
	);
}

function StatRow({
	label,
	value,
	tone,
}: {
	label: string;
	value: string;
	tone?: "success";
}) {
	return (
		<div className="flex items-center justify-between border-b border-hairline/60 px-3.5 py-2 font-sans text-[12.5px] last:border-b-0">
			<span className="text-muted">{label}</span>
			<span
				className={clsx(
					"tabular-nums font-medium",
					tone === "success" ? "text-success" : "text-primary",
				)}
			>
				{value}
			</span>
		</div>
	);
}

function ThreadView({
	thread,
	role,
	messages,
	periods,
	onCounter,
	draft,
	setDraft,
	onSend,
	onBack,
	onAct,
	busy,
	endRef,
	autoStats,
	onAutoStatsDone,
}: {
	thread: BmThread;
	role: "creator" | "advertiser";
	messages: BmMessage[];
	periods: BmPeriod[];
	onCounter: (
		bookingId: string,
		terms: { priceUsdMinor: number; days: number },
	) => void;
	draft: string;
	setDraft: (v: string) => void;
	onSend: () => void;
	onBack: () => void;
	onAct: (bookingId: string, verb: "accept" | "decline" | "cancel") => void;
	busy: boolean;
	endRef: React.RefObject<HTMLDivElement | null>;
	/** Arrived via /bm?deal= — open the analytics sheet on mount. */
	autoStats?: boolean;
	onAutoStatsDone?: () => void;
}) {
	const b = thread.booking;
	const other = role === "creator" ? thread.advertiser : thread.creator;
	const myTurn = b.status === "requested" && b.awaitingActionFrom === role;
	const cancellable = ["accepted", "live", "paused"].includes(b.status);
	const [counterOpen, setCounterOpen] = useState(false);
	// Analytics live behind an info button for BOTH parties — the deal card
	// stays a contract, the numbers get their own room.
	const [statsOpen, setStatsOpen] = useState(false);
	useEffect(() => {
		if (autoStats) {
			setStatsOpen(true);
			onAutoStatsDone?.();
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [autoStats]);
	const hasStats = !["requested", "declined", "expired"].includes(b.status);
	// Text while editing — clamping keystrokes is how fields get stuck.
	const [cPrice, setCPrice] = useState(
		(b.agreedUsdMinor / 100).toString(),
	);
	const [cDays, setCDays] = useState(String(b.durationDays));
	const settledPeriods = periods.filter((p) =>
		["captured", "released"].includes(p.status),
	);
	const heldPeriod = periods.find((p) => p.status === "held");

	return (
		<>
			{/* header: who you are dealing with — same bar Messages wears */}
			<div className="flex h-16 shrink-0 items-center justify-between gap-2 border-b border-hairline bg-page px-2 md:px-6">
				<div className="flex min-w-0 items-center gap-2 md:gap-3">
					<button
						type="button"
						onClick={onBack}
						className="md:hidden flex h-11 w-11 shrink-0 items-center justify-center rounded-pill text-muted transition-colors hover:bg-raised hover:text-primary cursor-pointer"
						aria-label="Back to deals"
					>
						<CaretLeft size={20} />
					</button>
					<Link
						href={`/profile/${other?.username}`}
						className="flex min-w-0 items-center gap-2 rounded-xl px-1 py-1 transition-colors hover:bg-raised md:gap-3"
					>
						<span className="relative block h-10 w-10 shrink-0 overflow-hidden rounded-pill bg-raised">
							<SafeAvatar src={other?.avatar} />
						</span>
						<span className="min-w-0">
							<span className="block truncate font-sans text-sm font-semibold text-primary">
								{other?.firstName || other?.username}
							</span>
							<span className="block truncate font-sans text-xs text-muted">
								@{other?.username}
							</span>
						</span>
					</Link>
				</div>
				<span
					className={clsx(
						"mr-1 shrink-0 rounded-pill px-2.5 py-1 font-sans text-[11px] font-semibold uppercase tracking-wide",
						STATUS_CHIP[b.status],
					)}
				>
					{b.status}
				</span>
			</div>

			{/* the deal card: the contract floats above the talk as its own
			    object, instead of a wall of grey rows welded to the header */}
			<div className="shrink-0 px-3 pt-3 md:px-6 md:pt-4">
				<div className="rounded-xl bg-surface px-4 py-3.5">
				<div className="flex items-center gap-3">
					<span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gold/10 text-gold">
						{b.format === "video" ? (
							<VideoCamera size={18} weight="fill" />
						) : b.format === "audio" ? (
							<SpeakerHigh size={18} weight="fill" />
						) : (
							<ImageSquare size={18} weight="fill" />
						)}
					</span>
					<div className="min-w-0 flex-1">
						<p className="font-sans text-[14px] font-semibold capitalize text-primary">
							{b.format} campaign
						</p>
						<p className="font-sans text-[12.5px] text-muted tabular-nums">
							{b.durationDays} day{b.durationDays === 1 ? "" : "s"} · starts{" "}
							{new Date(b.startAt).toLocaleDateString(undefined, {
								month: "short",
								day: "numeric",
							})}
						</p>
					</div>
					<span className="shrink-0 font-display text-[20px] font-semibold text-primary tabular-nums">
						{usd(b.agreedUsdMinor)}
					</span>
					{hasStats && (
						<button
							type="button"
							aria-label="Campaign analytics"
							title="Campaign analytics"
							onClick={() => setStatsOpen(true)}
							className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg bg-raised text-muted transition-colors hover:bg-chip hover:text-primary"
						>
							<ChartBar size={15} weight="fill" />
						</button>
					)}
				</div>

				{/* THE AD ITSELF. The creator is approving a creative — showing
				    them terms without the thing those terms buy was the missing
				    half of the story. Same renderer the profile serves. */}
				{b.creative?.url && (
					<div className="mt-3">
						<AdSlotPreview
							format={b.format}
							creative={b.creative}
							advertiserUsername={thread.advertiser?.username}
						/>
					</div>
				)}

				{/* money state: where the dollars are, as quiet chips */}
				{(b.settledUsdMinor > 0 || cancellable) && (
					<div className="mt-2.5 flex flex-wrap items-center gap-1.5 font-sans text-[11.5px] tabular-nums">
						<span className="rounded-pill bg-raised px-2 py-0.5 text-muted">
							{b.daysServed}/{b.durationDays} days
						</span>
						<span className="rounded-pill bg-raised px-2 py-0.5 text-muted">
							{usd(b.settledUsdMinor)} settled
						</span>
						{role === "creator" && (
							<span className="rounded-pill bg-success/10 px-2 py-0.5 text-success">
								{usd(b.creatorPaidUsdMinor)} earned
							</span>
						)}
						{(b.impressions ?? 0) > 0 && (
							<span className="rounded-pill bg-raised px-2 py-0.5 text-muted">
								{(b.impressions ?? 0).toLocaleString()} views ·{" "}
								{(b.clicks ?? 0).toLocaleString()} clicks
							</span>
						)}
						{b.statusReason && (
							<span className="text-subtle">{b.statusReason}</span>
						)}
					</div>
				)}

				{(myTurn || cancellable || b.status === "requested") && (
					<div className="mt-2.5 flex items-center gap-2">
						{myTurn && (
							<>
								<button
									type="button"
									disabled={busy}
									onClick={() => onAct(b._id, "accept")}
									className="h-9 rounded-pill bg-brand px-4 font-sans text-[13px] font-semibold text-brand-on transition-colors hover:opacity-90 disabled:opacity-50 cursor-pointer"
								>
									Accept · {usd(b.agreedUsdMinor)}
								</button>
								<button
									type="button"
									disabled={busy}
									onClick={() => onAct(b._id, "decline")}
									className="h-9 rounded-pill bg-raised px-4 font-sans text-[13px] font-medium text-primary transition-colors hover:bg-chip disabled:opacity-50 cursor-pointer"
								>
									Decline
								</button>
							</>
						)}
						{b.status === "requested" && (
							<button
								type="button"
								disabled={busy}
								onClick={() => setCounterOpen((v) => !v)}
								className="h-9 rounded-pill bg-raised px-4 font-sans text-[13px] font-medium text-primary transition-colors hover:bg-chip disabled:opacity-50 cursor-pointer"
							>
								Counter
							</button>
						)}
						{!myTurn && b.status === "requested" && (
							<span className="font-sans text-[12.5px] text-subtle">
								Waiting on the {b.awaitingActionFrom} to respond
							</span>
						)}
						{cancellable && (
							<button
								type="button"
								disabled={busy}
								onClick={() => onAct(b._id, "cancel")}
								className="ml-auto h-9 rounded-pill px-3.5 font-sans text-[12.5px] font-medium text-danger transition-colors hover:bg-danger/10 disabled:opacity-50 cursor-pointer"
							>
								End campaign
							</button>
						)}
					</div>
				)}

				{statsOpen && (
					<CampaignStatsSheet
						booking={b}
						periods={periods}
						role={role}
						onClose={() => setStatsOpen(false)}
					/>
				)}
				{counterOpen && b.status === "requested" && (
					<div className="mt-2.5 flex items-end gap-2 rounded-xl bg-sunken p-3">
						<label className="flex-1">
							<span className="mb-1 block font-sans text-[10.5px] font-semibold uppercase tracking-wide text-subtle">
								Total price
							</span>
							<span className="flex h-10 items-center rounded-lg bg-page/60 pl-3 font-sans text-[14px] text-subtle transition-colors focus-within:bg-page">
								$
								<input
									type="text"
									inputMode="decimal"
									value={cPrice}
									onChange={(e) =>
										setCPrice(
											e.target.value
												.replace(/[^0-9.]/g, "")
												.replace(/(\..*)\./g, "$1"),
										)
									}
									className="h-10 w-full bg-transparent px-2 font-sans text-[14px] text-primary outline-none tabular-nums"
								/>
							</span>
						</label>
						<label className="w-24">
							<span className="mb-1 block font-sans text-[10.5px] font-semibold uppercase tracking-wide text-subtle">
								Days
							</span>
							<input
								type="text"
								inputMode="numeric"
								value={cDays}
								onChange={(e) =>
									setCDays(e.target.value.replace(/[^0-9]/g, ""))
								}
								className="h-10 w-full rounded-lg bg-page/60 px-3 font-sans text-[14px] text-primary outline-none tabular-nums transition-colors focus:bg-page"
							/>
						</label>
						<button
							type="button"
							disabled={busy}
							onClick={() => {
								const price = Math.round(Number(cPrice || 0) * 100);
								const days = Number(cDays || 0);
								if (price < 100 || days < 1 || days > 30) return;
								setCounterOpen(false);
								onCounter(b._id, { priceUsdMinor: price, days });
							}}
							className="h-10 shrink-0 rounded-pill bg-primary px-4 font-sans text-[13px] font-semibold text-page transition-colors hover:opacity-90 disabled:opacity-50 cursor-pointer"
						>
							Send offer
						</button>
					</div>
				)}

				{/* The receipt: what actually happened to the money, tranche by
				    tranche. Both sides read the same rows — the creator sees
				    their cut, the advertiser sees what came back. */}
				{settledPeriods.length > 0 && (
					<div className="mt-2.5 overflow-hidden rounded-lg bg-sunken/60">
						{settledPeriods.map((per) => (
							<div
								key={per.index}
								className="flex items-center justify-between gap-3 border-b border-hairline/60 px-3.5 py-2 font-sans text-[12.5px] last:border-b-0"
							>
								<span className="text-muted">
									{new Date(per.startAt).toISOString().slice(5, 10)} –{" "}
									{new Date(per.endAt).toISOString().slice(5, 10)}
								</span>
								<span className="tabular-nums text-subtle">
									{usd(per.amountUsdMinor)}
								</span>
								{per.status === "captured" ? (
									<span className="tabular-nums text-success">
										{role === "creator"
											? `+${usd(per.creatorShareUsdMinor)} earned`
											: `${usd(per.capturedUsdMinor)} settled`}
									</span>
								) : (
									<span className="text-subtle">returned</span>
								)}
							</div>
						))}
					</div>
				)}
				{heldPeriod && (
					<p className="mt-2 font-sans text-[12px] text-subtle tabular-nums">
						{usd(heldPeriod.amountUsdMinor)} held in escrow for the current
						period
					</p>
				)}
				</div>
			</div>

			{/* messages */}
			<div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 md:px-6">
				{messages.map((m, i) => {
					const prev = messages[i - 1];
					const newDay =
						!prev ||
						new Date(prev.createdAt).toDateString() !==
							new Date(m.createdAt).toDateString();
					const divider = newDay ? (
						<div className="flex justify-center py-2">
							<span className="rounded-pill bg-raised px-3 py-1 font-sans text-[11px] font-semibold text-muted">
								{dayLabel(m.createdAt)}
							</span>
						</div>
					) : null;
					if (m.kind !== "text") {
						// The machine's voice: centred, quiet, part of the record.
						return (
							<div key={m._id}>
								{divider}
								<div className="my-2 flex justify-center">
									<span className="max-w-[85%] rounded-lg bg-raised px-3.5 py-2 text-center font-sans text-[12px] leading-relaxed text-muted">
										{m.content}
									</span>
								</div>
							</div>
						);
					}
					const mine =
						m.sender &&
						((role === "creator" &&
							m.sender._id === thread.creator?._id) ||
							(role === "advertiser" &&
								m.sender._id === thread.advertiser?._id));
					return (
						<div key={m._id}>
							{divider}
							<div
								className={clsx(
									"my-1 flex",
									mine ? "justify-end" : "justify-start",
								)}
							>
								<span
									className={clsx(
										"max-w-[78%] rounded-xl px-3.5 py-2 font-sans text-[14px] leading-relaxed",
										mine
											? "bg-brand text-brand-on"
											: "bg-raised text-primary",
									)}
								>
									{m.content}
								</span>
							</div>
						</div>
					);
				})}
				<div ref={endRef} />
			</div>

			{/* composer: ONE pill with the send inside — a row of loose parts
			    reads as a toolbar; a composer is one object (Messages rule). */}
			<div className="shrink-0 p-3 md:px-6">
				<div className="flex min-w-0 items-end gap-1 rounded-2xl bg-sunken py-1.5 pl-4 pr-1.5 transition-colors focus-within:bg-raised">
					<textarea
						value={draft}
						onChange={(e) => setDraft(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter" && !e.shiftKey) {
								e.preventDefault();
								onSend();
							}
						}}
						placeholder="Write to the other party…"
						rows={1}
						// text-base: sub-16px is the iOS zoom-on-focus trigger.
						className="max-h-[100px] min-w-0 flex-1 resize-none border-none bg-transparent py-2 text-base text-primary outline-none placeholder:text-subtle"
						style={{ minHeight: "24px" }}
					/>
					<button
						type="button"
						onClick={onSend}
						disabled={!draft.trim()}
						aria-label="Send"
						className="mb-0.5 flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-pill bg-brand text-brand-on transition-colors hover:bg-brand-active disabled:opacity-40"
					>
						<PaperPlaneRight size={16} weight="fill" />
					</button>
				</div>
			</div>
		</>
	);
}

/* ── new booking ─────────────────────────────────────────────────── */

/** The house text input, verbatim from the design system's other modals —
 *  sunken fill, hairline border, brand-washed focus. An input with no border
 *  and no focus state reads as disabled, which is exactly what got reported. */
/** The composer rule, applied to fields: a fill that lifts on focus. The
 *  bordered version read as a form in an app whose own composer says it has
 *  no bordered cards anywhere. */
const FIELD =
	"h-11 w-full rounded-lg bg-sunken px-3.5 font-sans text-[14px] text-primary placeholder:text-subtle outline-none transition-colors focus:bg-raised";

const ACCEPT: Record<"image" | "video" | "audio", string> = {
	image: "image/*",
	video: "video/*",
	audio: "audio/*",
};

function NewBookingSheet({
	onClose,
	authed,
	onCreated,
	initialUsername = "",
}: {
	onClose: () => void;
	authed: (m: "get" | "post", p: string, b?: unknown) => Promise<any>;
	onCreated: () => Promise<void>;
	initialUsername?: string;
}) {
	const { toast } = useToast();
	useOverlayDismiss(true, onClose);

	const [username, setUsername] = useState(initialUsername);
	const [format, setFormat] = useState<"image" | "video" | "audio">("image");
	const [days, setDays] = useState("7");
	// CalendarField speaks local "YYYY-MM-DDTHH:mm"; default tomorrow 9am.
	const [when, setWhen] = useState(() => {
		const d = new Date(Date.now() + 24 * 3600_000);
		return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T09:00`;
	});
	/** Two-step: fill the form, then SEE the ad before sending it. */
	const [step, setStep] = useState<"form" | "preview">("form");
	const [note, setNote] = useState("");
	const [mediaUrl, setMediaUrl] = useState("");
	const [coverUrl, setCoverUrl] = useState("");
	const [linkUrl, setLinkUrl] = useState("");
	// "yourbrand.com" is what people actually type; https is the default the
	// web assumes. Applied where the value is consumed, never per keystroke.
	const normalizedLink = (() => {
		const v = linkUrl.trim();
		if (!v) return undefined;
		return /^https?:\/\//i.test(v) ? v : `https://${v}`;
	})();
	const [uploading, setUploading] = useState<"media" | "cover" | null>(null);
	/** 0-100 while a file is in flight — a 40MB video on hotel wifi deserves
	 *  a number, not a vibe. */
	const [uploadPct, setUploadPct] = useState(0);
	const [rate, setRate] = useState<number | null>(null);
	const [sending, setSending] = useState(false);
	const mediaInputRef = useRef<HTMLInputElement>(null);
	const coverInputRef = useRef<HTMLInputElement>(null);

	const handle = username.trim().replace(/^@+/, "");

	// Quote as they type, so the ask is priced before it is sent.
	useEffect(() => {
		if (!handle) {
			setRate(null);
			return;
		}
		const t = setTimeout(async () => {
			try {
				const data = await authed(
					"get",
					`/api/ads/rates/${encodeURIComponent(handle)}`,
				);
				const row = (data.rates ?? []).find((r: any) => r.format === format);
				setRate(row ? row.priceUsdMinor : null);
			} catch {
				setRate(null);
			}
		}, 400);
		return () => clearTimeout(t);
	}, [handle, format, authed]);

	// Switching format retires a creative of the wrong kind — an image booked
	// as a video slot serves nothing.
	useEffect(() => {
		setMediaUrl("");
		setCoverUrl("");
	}, [format]);

	const { getToken } = useAuth();
	/** Straight to R2, with real progress — axios is called directly here
	 *  because the shared helper cannot carry onUploadProgress. */
	const upload = async (rawFile: File, kind: "media" | "cover") => {
		// Advertisers hand over full-size brand art; the slot renders ~600px
		// wide. Compress before the bytes travel (no-op for video/audio).
		const file = await compressImage(rawFile);
		setUploading(kind);
		setUploadPct(0);
		try {
			const form = new FormData();
			form.append("file", file);
			const token = await getToken();
			const res = await axios.post(`${API_URL}/api/uploads`, form, {
				headers: { Authorization: `Bearer ${token}` },
				onUploadProgress: (e) => {
					if (e.total) {
						setUploadPct(Math.round((e.loaded / e.total) * 100));
					}
				},
			});
			if (kind === "media") setMediaUrl(res.data.url);
			else setCoverUrl(res.data.url);
		} catch (err: any) {
			toast(err?.response?.data?.message ?? "Upload failed", {
				type: "error",
			});
		} finally {
			setUploading(null);
		}
	};

	const submit = async () => {
		if (sending) return;
		setSending(true);
		try {
			const runDays = Math.min(30, Math.max(1, Number(days || 0)));
			await authed("post", "/api/ads/bookings", {
				creatorUsername: handle,
				format,
				days: runDays,
				startAt: new Date(when).toISOString(),
				note: note.trim() || undefined,
				// The exact creative rides the request, so what the creator
				// approves is what will serve — never a swap after acceptance.
				creative: mediaUrl
					? {
							url: mediaUrl,
							linkUrl: normalizedLink,
							coverUrl:
								format === "audio" && coverUrl ? coverUrl : undefined,
						}
					: undefined,
			});
			toast("Booking request sent", { type: "success" });
			await onCreated();
		} catch (err: any) {
			toast(err?.response?.data?.message ?? "Could not send the request", {
				type: "error",
			});
		} finally {
			setSending(false);
		}
	};

	const label = (text: string) => (
		<span className="mb-1.5 block font-sans text-[11px] font-semibold uppercase tracking-[0.1em] text-subtle">
			{text}
		</span>
	);

	return (
		<>
			<OverlayScrim onClose={onClose} />
			<OverlayPanel variant="sheet" label="Book ad space">
				<OverlayHeader
					title={step === "preview" ? "Preview" : "Book ad space"}
					onClose={onClose}
				/>
				{step === "preview" ? (
					<div className="flex flex-col gap-4 overflow-y-auto px-5 pb-5">
						{/* Exactly what @handle's profile will render — same
						    component, same chrome. What you preview is what the
						    creator approves and the slot serves. */}
						<AdSlotPreview
							format={format}
							creative={{
								url: mediaUrl || undefined,
								linkUrl: normalizedLink,
								coverUrl:
									format === "audio" && coverUrl ? coverUrl : undefined,
							}}
						/>
						{!mediaUrl && (
							<p className="rounded-lg bg-sunken px-3.5 py-2.5 font-sans text-[12.5px] text-muted">
								No creative attached — the creator will see the request
								without a preview and the slot will say "creative
								pending" until one is agreed in the thread.
							</p>
						)}
						<div className="overflow-hidden rounded-xl bg-sunken/60">
							{[
								["Creator", `@${handle}`],
								["Format", format],
								[
									"Run",
									`${days} day${days === "1" ? "" : "s"} from ${new Date(when).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`,
								],
								...(rate !== null
									? [["Total", usd(rate * Number(days || 0))]]
									: []),
							].map(([k, v]) => (
								<div
									key={k}
									className="flex items-center justify-between border-b border-hairline/60 px-3.5 py-2.5 font-sans text-[13px] last:border-b-0"
								>
									<span className="text-subtle">{k}</span>
									<span className="font-medium capitalize text-primary tabular-nums">
										{v}
									</span>
								</div>
							))}
						</div>
						<div className="flex gap-2">
							<button
								type="button"
								onClick={() => setStep("form")}
								className="h-12 flex-1 cursor-pointer rounded-pill bg-raised font-sans text-[14px] font-medium text-primary transition-colors hover:bg-chip"
							>
								Back
							</button>
							<button
								type="button"
								disabled={sending}
								onClick={submit}
								className="h-12 flex-[2] cursor-pointer rounded-pill bg-brand font-sans text-[14.5px] font-semibold text-brand-on transition-colors hover:opacity-90 disabled:opacity-50"
							>
								{sending
									? "Sending…"
									: rate !== null && Number(days) > 0
										? `Send request · ${usd(rate * Number(days))}`
										: "Send request"}
							</button>
						</div>
					</div>
				) : (
				<div className="flex flex-col gap-4 overflow-y-auto px-5 pb-5">
					<div>
						{label("Creator")}
						<input
							value={username}
							onChange={(e) => setUsername(e.target.value)}
							placeholder="@username"
							className={FIELD}
						/>
					</div>

					<div>
						{label("Format")}
						<div className="flex gap-2">
							{(["image", "audio", "video"] as const).map((f) => (
								<button
									key={f}
									type="button"
									onClick={() => setFormat(f)}
									className={clsx(
										"h-10 flex-1 rounded-pill font-sans text-[13px] font-medium capitalize transition-colors cursor-pointer",
										format === f
											? "bg-primary text-page"
											: "bg-sunken text-muted hover:bg-raised hover:text-primary",
									)}
								>
									{f}
								</button>
							))}
						</div>
					</div>

					<div>
						{label(format === "audio" ? "Audio file" : `${format} creative`)}
						{/* The creative is UPLOADED, not linked: a dropzone that
						    becomes its own preview. The picked file goes to R2
						    immediately, so send needs nothing else in flight. */}
						{mediaUrl ? (
							<div className="relative overflow-hidden rounded-xl bg-sunken">
								{format === "image" && (
									// eslint-disable-next-line @next/next/no-img-element
									<img
										src={mediaUrl}
										alt="Creative preview"
										className="max-h-[200px] w-full object-cover"
									/>
								)}
								{format === "video" && (
									// biome-ignore lint/a11y/useMediaCaption: preview of own upload
									<video
										src={mediaUrl}
										controls
										muted
										playsInline
										className="max-h-[200px] w-full bg-black object-contain"
									/>
								)}
								{format === "audio" && (
									// biome-ignore lint/a11y/useMediaCaption: preview of own upload
									<audio src={mediaUrl} controls className="w-full p-3" />
								)}
								<button
									type="button"
									onClick={() => setMediaUrl("")}
									aria-label="Remove creative"
									className="absolute right-2 top-2 flex h-8 w-8 cursor-pointer items-center justify-center rounded-pill bg-page/85 text-primary transition-colors hover:bg-page"
								>
									<X size={14} weight="bold" />
								</button>
							</div>
						) : (
							<button
								type="button"
								onClick={() => mediaInputRef.current?.click()}
								disabled={uploading === "media"}
								className="flex h-28 w-full cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl bg-sunken transition-colors hover:bg-raised disabled:opacity-60"
							>
								<UploadSimple size={20} className="text-muted" />
								<span className="font-sans text-[13px] font-medium text-muted tabular-nums">
									{uploading === "media"
										? `Uploading… ${uploadPct}%`
										: `Upload ${format === "audio" ? "audio" : format}`}
								</span>
								<span className="font-sans text-[11px] text-subtle">
									up to 50MB
								</span>
							</button>
						)}
						<input
							ref={mediaInputRef}
							type="file"
							accept={ACCEPT[format]}
							className="hidden"
							onChange={(e) => {
								const f = e.target.files?.[0];
								if (f) void upload(f, "media");
								e.target.value = "";
							}}
						/>
					</div>

					{format === "audio" && (
						<div>
							{label("Cover image")}
							{coverUrl ? (
								<div className="relative h-24 w-40 overflow-hidden rounded-xl bg-sunken">
									{/* eslint-disable-next-line @next/next/no-img-element */}
									<img
										src={coverUrl}
										alt="Cover preview"
										className="h-full w-full object-cover"
									/>
									<button
										type="button"
										onClick={() => setCoverUrl("")}
										aria-label="Remove cover"
										className="absolute right-1.5 top-1.5 flex h-7 w-7 cursor-pointer items-center justify-center rounded-pill bg-page/85 text-primary"
									>
										<X size={12} weight="bold" />
									</button>
								</div>
							) : (
								<button
									type="button"
									onClick={() => coverInputRef.current?.click()}
									disabled={uploading === "cover"}
									className="flex h-16 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-sunken font-sans text-[13px] font-medium text-muted transition-colors hover:bg-raised disabled:opacity-60"
								>
									<UploadSimple size={16} />
									{uploading === "cover"
										? `Uploading… ${uploadPct}%`
										: "Upload the banner behind the play button"}
								</button>
							)}
							<input
								ref={coverInputRef}
								type="file"
								accept="image/*"
								className="hidden"
								onChange={(e) => {
									const f = e.target.files?.[0];
									if (f) void upload(f, "cover");
									e.target.value = "";
								}}
							/>
						</div>
					)}

					<div>
						{label("Click-through link")}
						<div className="flex items-center overflow-hidden rounded-lg bg-sunken transition-colors focus-within:bg-raised">
							<span className="shrink-0 select-none pl-3.5 font-sans text-[14px] text-subtle">
								https://
							</span>
							<input
								value={linkUrl.replace(/^https?:\/\//i, "")}
								onChange={(e) =>
									setLinkUrl(e.target.value.replace(/^https?:\/\//i, ""))
								}
								placeholder="your-site.com"
								inputMode="url"
								className="h-11 w-full bg-transparent pr-3.5 pl-0.5 font-sans text-[14px] text-primary outline-none placeholder:text-subtle"
							/>
						</div>
					</div>

					<div>
						{label("Days")}
						<input
							type="text"
							inputMode="numeric"
							value={days}
							onChange={(e) =>
								setDays(e.target.value.replace(/[^0-9]/g, ""))
							}
							className={clsx(FIELD, "tabular-nums")}
						/>
					</div>
					<div>
						{label("Starts")}
						{/* The house calendar, not the OS widget — same control
						    Spaces schedule with. */}
						<CalendarField value={when} onChange={setWhen} />
					</div>

					<div>
						{label("Note to the creator")}
						<textarea
							value={note}
							onChange={(e) => setNote(e.target.value)}
							placeholder="Anything they should know (optional)"
							rows={2}
							className={clsx(
								FIELD,
								"h-auto resize-none py-2.5 leading-relaxed",
							)}
						/>
					</div>

					<button
						type="button"
						disabled={
							!handle || uploading !== null || !(Number(days) >= 1)
						}
						onClick={() => setStep("preview")}
						className="h-12 shrink-0 cursor-pointer rounded-pill bg-brand font-sans text-[14.5px] font-semibold text-brand-on transition-colors hover:opacity-90 disabled:opacity-50"
					>
						Preview request
					</button>
					{rate === null && handle && (
						<p className="text-center font-sans text-[12px] text-subtle">
							No {format} rate published for @{handle} — the request may be
							refused.
						</p>
					)}
				</div>
				)}
			</OverlayPanel>
		</>
	);
}
