"use client";

import { useAuth } from "@clerk/nextjs";
import axios from "axios";
import clsx from "clsx";
import { useAtomValue } from "jotai";
import { useCallback, useEffect, useRef, useState } from "react";
import {
	CaretLeft,
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
import { SafeAvatar } from "@/components/ui/SafeAvatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast/ToastContext";
import { formatTimeAgo } from "@/lib/utils";
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
		const t = setInterval(() => void loadThreads(), 20_000);
		return () => clearInterval(t);
	}, [loadThreads]);

	// /bm?book=<handle> — the profile's "Book" affordance lands here with the
	// sheet already open on that creator. Read once, then cleaned from the
	// URL so a refresh does not reopen it.
	const [prefillUsername, setPrefillUsername] = useState("");
	useEffect(() => {
		const book = new URLSearchParams(window.location.search).get("book");
		if (book) {
			setPrefillUsername(book);
			setComposerOpen(true);
			window.history.replaceState(null, "", "/bm");
		}
	}, []);

	useEffect(() => {
		if (!activeId) return;
		void loadMessages(activeId);
		const t = setInterval(() => void loadMessages(activeId), 5_000);
		return () => clearInterval(t);
	}, [activeId, loadMessages]);

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
			await Promise.all([loadThreads(), activeId && loadMessages(activeId)]);
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

				<div className="min-h-0 flex-1 overflow-y-auto">
					{!loaded ? (
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
											<span className="truncate font-sans text-[14.5px] font-semibold text-primary">
												{other?.firstName || other?.username}
											</span>
											<span className="shrink-0 font-sans text-[11.5px] text-subtle tabular-nums">
												{formatTimeAgo(t.lastMessageAt)}
											</span>
										</span>
										<span className="mt-0.5 flex items-center gap-1.5">
											{myMove ? (
												<span
													aria-hidden
													className="h-1.5 w-1.5 shrink-0 rounded-pill bg-gold"
												/>
											) : null}
											<span
												className={clsx(
													"truncate font-sans text-[13px]",
													myMove
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
					/>
				)}
			</section>

			{composerOpen && (
				<NewBookingSheet
					onClose={() => setComposerOpen(false)}
					authed={authed}
					initialUsername={prefillUsername}
					onCreated={async () => {
						setComposerOpen(false);
						await loadThreads();
					}}
				/>
			)}
		</div>
	);
}

/* ── the deal room ──────────────────────────────────────────────── */

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
}) {
	const b = thread.booking;
	const other = role === "creator" ? thread.advertiser : thread.creator;
	const myTurn = b.status === "requested" && b.awaitingActionFrom === role;
	const cancellable = ["accepted", "live", "paused"].includes(b.status);
	const [counterOpen, setCounterOpen] = useState(false);
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
				<div className="rounded-xl border border-hairline bg-surface px-4 py-3.5">
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
				</div>

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

				{counterOpen && b.status === "requested" && (
					<div className="mt-2.5 flex items-end gap-2 rounded-xl bg-sunken p-3">
						<label className="flex-1">
							<span className="mb-1 block font-sans text-[10.5px] font-semibold uppercase tracking-wide text-subtle">
								Total price
							</span>
							<span className="flex h-10 items-center rounded-lg bg-page/60 border border-hairline pl-3 font-sans text-[14px] text-subtle transition-colors focus-within:border-brand/60">
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
								className="h-10 w-full rounded-lg bg-page/60 border border-hairline px-3 font-sans text-[14px] text-primary outline-none tabular-nums transition-colors focus:border-brand/60"
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
					<div className="mt-2.5 overflow-hidden rounded-xl border border-hairline">
						{settledPeriods.map((per) => (
							<div
								key={per.index}
								className="flex items-center justify-between gap-3 border-b border-hairline px-3.5 py-2 font-sans text-[12.5px] last:border-b-0"
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
									<span className="max-w-[85%] rounded-lg border border-hairline bg-surface px-3.5 py-2 text-center font-sans text-[12px] leading-relaxed text-muted">
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

			{/* composer */}
			<div className="shrink-0 border-t border-hairline p-3 md:px-6">
				<div className="flex items-center gap-2">
					<input
						value={draft}
						onChange={(e) => setDraft(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter" && !e.shiftKey) {
								e.preventDefault();
								onSend();
							}
						}}
						placeholder="Write to the other party…"
						className="h-11 min-w-0 flex-1 rounded-pill bg-sunken border border-hairline px-4 font-sans text-[14px] text-primary outline-none transition-colors placeholder:text-subtle focus:border-brand/60"
					/>
					<button
						type="button"
						onClick={onSend}
						disabled={!draft.trim()}
						aria-label="Send"
						className="flex h-11 w-11 shrink-0 items-center justify-center rounded-pill bg-brand text-brand-on transition-colors hover:opacity-90 disabled:opacity-40 cursor-pointer"
					>
						<PaperPlaneRight size={17} weight="fill" />
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
const FIELD =
	"h-11 w-full rounded-lg bg-sunken border border-hairline px-3.5 font-sans text-[14px] text-primary placeholder:text-subtle outline-none transition-colors focus:border-brand/60";

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
	const [uploading, setUploading] = useState<"media" | "cover" | null>(null);
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

	/** Straight to R2 through the existing upload route; the returned URL is
	 *  what rides the booking. */
	const upload = async (file: File, kind: "media" | "cover") => {
		setUploading(kind);
		try {
			const form = new FormData();
			form.append("file", file);
			const data = await authed("post", "/api/messages/upload", form);
			if (kind === "media") setMediaUrl(data.url);
			else setCoverUrl(data.url);
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
							linkUrl: linkUrl.trim() || undefined,
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
								linkUrl: linkUrl.trim() || undefined,
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
						<div className="overflow-hidden rounded-xl border border-hairline">
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
									className="flex items-center justify-between border-b border-hairline px-3.5 py-2.5 font-sans text-[13px] last:border-b-0"
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
							{(["image", "video", "audio"] as const).map((f) => (
								<button
									key={f}
									type="button"
									onClick={() => setFormat(f)}
									className={clsx(
										"h-10 flex-1 rounded-pill font-sans text-[13px] font-medium capitalize transition-colors cursor-pointer",
										format === f
											? "bg-primary text-page"
											: "bg-sunken border border-hairline text-muted hover:text-primary",
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
							<div className="relative overflow-hidden rounded-xl border border-hairline bg-sunken">
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
								className="flex h-28 w-full cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-hairline bg-sunken/50 transition-colors hover:border-brand/50 hover:bg-sunken disabled:opacity-60"
							>
								<UploadSimple size={20} className="text-muted" />
								<span className="font-sans text-[13px] font-medium text-muted">
									{uploading === "media"
										? "Uploading…"
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
								<div className="relative h-24 w-40 overflow-hidden rounded-xl border border-hairline">
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
									className="flex h-16 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-hairline bg-sunken/50 font-sans text-[13px] font-medium text-muted transition-colors hover:border-brand/50 disabled:opacity-60"
								>
									<UploadSimple size={16} />
									{uploading === "cover"
										? "Uploading…"
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
						<input
							value={linkUrl}
							onChange={(e) => setLinkUrl(e.target.value)}
							placeholder="https://your-site.com"
							inputMode="url"
							className={FIELD}
						/>
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
