"use client";

import { useAuth } from "@clerk/nextjs";
import axios from "axios";
import clsx from "clsx";
import { useAtomValue } from "jotai";
import { useCallback, useEffect, useRef, useState } from "react";
import { PaperPlaneRight, Plus, X } from "@phosphor-icons/react";
import { Briefcase } from "lucide-react";
import { BACKEND_URL } from "@/const";
import { userAtom } from "@/store/user.atom";
import { SafeAvatar } from "@/components/ui/SafeAvatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast/ToastContext";
import { formatTimeAgo } from "@/lib/utils";

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
		<div className="flex h-full min-h-0">
			{/* ── thread list ─────────────────────────────────────────── */}
			<aside
				className={clsx(
					"flex w-full flex-col border-r border-hairline md:w-[320px] md:shrink-0",
					activeId && "hidden md:flex",
				)}
			>
				<header className="flex h-14 shrink-0 items-center justify-between border-b border-hairline px-4">
					<h1 className="font-display text-[16px] font-semibold">Business</h1>
					<button
						type="button"
						onClick={() => setComposerOpen(true)}
						className="flex h-9 items-center gap-1.5 rounded-pill bg-primary px-3.5 font-sans text-[13px] font-semibold text-page transition-colors hover:opacity-90 cursor-pointer"
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
							return (
								<button
									key={t._id}
									type="button"
									onClick={() => setActiveId(t._id)}
									className={clsx(
										"flex w-full items-center gap-3 px-4 py-3 text-left transition-colors cursor-pointer",
										activeId === t._id ? "bg-raised" : "hover:bg-raised/60",
									)}
								>
									<span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-pill">
										<SafeAvatar src={other?.avatar} />
									</span>
									<span className="min-w-0 flex-1">
										<span className="flex items-center justify-between gap-2">
											<span className="truncate font-sans text-[14px] font-semibold text-primary">
												{other?.firstName || other?.username}
											</span>
											<span className="shrink-0 font-sans text-[11.5px] text-subtle">
												{formatTimeAgo(t.lastMessageAt)}
											</span>
										</span>
										<span className="mt-0.5 flex items-center gap-1.5">
											{b && (
												<span
													className={clsx(
														"shrink-0 rounded-[4px] px-1.5 py-px font-sans text-[10px] font-semibold uppercase tracking-wide",
														myMove
															? "bg-gold/15 text-gold"
															: STATUS_CHIP[b.status],
													)}
												>
													{myMove ? "your move" : b.status}
												</span>
											)}
											<span className="truncate font-sans text-[12.5px] text-muted">
												{t.lastMessagePreview}
											</span>
										</span>
									</span>
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
			{/* deal card: the contract, always in view above the talk */}
			<div className="shrink-0 border-b border-hairline bg-surface px-4 py-3">
				<div className="flex items-center gap-3">
					<button
						type="button"
						onClick={onBack}
						className="md:hidden -ml-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-pill text-muted hover:bg-raised cursor-pointer"
						aria-label="Back to deals"
					>
						<X size={16} weight="bold" />
					</button>
					<span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-pill">
						<SafeAvatar src={other?.avatar} />
					</span>
					<div className="min-w-0 flex-1">
						<p className="truncate font-sans text-[14.5px] font-semibold text-primary">
							{other?.firstName || other?.username}
							<span className="ml-1.5 font-normal text-subtle">
								@{other?.username}
							</span>
						</p>
						<p className="font-sans text-[12.5px] text-muted">
							{b.format} · {b.durationDays}d ·{" "}
							<span className="tabular-nums">{usd(b.agreedUsdMinor)}</span> ·
							starts {new Date(b.startAt).toISOString().slice(0, 10)}
						</p>
					</div>
					<span
						className={clsx(
							"shrink-0 rounded-pill px-2.5 py-1 font-sans text-[11px] font-semibold uppercase tracking-wide",
							STATUS_CHIP[b.status],
						)}
					>
						{b.status}
					</span>
				</div>

				{/* money state: where the dollars are, at a glance */}
				{(b.settledUsdMinor > 0 || cancellable) && (
					<p className="mt-2 font-sans text-[12px] text-muted tabular-nums">
						{b.daysServed}/{b.durationDays} days served · {usd(b.settledUsdMinor)}{" "}
						settled
						{(b.impressions ?? 0) > 0 &&
							` · ${(b.impressions ?? 0).toLocaleString()} views · ${(b.clicks ?? 0).toLocaleString()} clicks`}
						{role === "creator" &&
							` · ${usd(b.creatorPaidUsdMinor)} earned`}
						{b.statusReason ? ` · ${b.statusReason}` : ""}
					</p>
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
							<span className="flex h-10 items-center rounded-lg bg-page/60 pl-3 font-sans text-[14px] text-subtle">
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
								className="h-10 w-full rounded-lg bg-page/60 px-3 font-sans text-[14px] text-primary outline-none tabular-nums"
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

			{/* messages */}
			<div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
				{messages.map((m) => {
					if (m.kind !== "text") {
						// The machine's voice: centred, quiet, part of the record.
						return (
							<div key={m._id} className="my-2 flex justify-center">
								<span className="max-w-[85%] rounded-lg bg-raised px-3 py-1.5 text-center font-sans text-[12px] text-muted">
									{m.content}
								</span>
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
						<div
							key={m._id}
							className={clsx(
								"my-1 flex",
								mine ? "justify-end" : "justify-start",
							)}
						>
							<span
								className={clsx(
									"max-w-[78%] rounded-xl px-3.5 py-2 font-sans text-[14px]",
									mine
										? "bg-brand text-brand-on"
										: "bg-raised text-primary",
								)}
							>
								{m.content}
							</span>
						</div>
					);
				})}
				<div ref={endRef} />
			</div>

			{/* composer */}
			<div className="shrink-0 border-t border-hairline p-3">
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
						className="h-11 min-w-0 flex-1 rounded-pill bg-sunken px-4 font-sans text-[14px] text-primary outline-none placeholder:text-subtle"
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

/* ── new booking (v1 entry point; phase 4 moves this onto profiles) ── */

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
	const [username, setUsername] = useState(initialUsername);
	const [format, setFormat] = useState<"image" | "video" | "audio">("image");
	const [days, setDays] = useState("7");
	const [startAt, setStartAt] = useState(
		new Date(Date.now() + 24 * 3600_000).toISOString().slice(0, 10),
	);
	const [note, setNote] = useState("");
	const [mediaUrl, setMediaUrl] = useState("");
	const [linkUrl, setLinkUrl] = useState("");
	const [coverUrl, setCoverUrl] = useState("");
	const [rate, setRate] = useState<number | null>(null);
	const [sending, setSending] = useState(false);

	// People type handles WITH the @ — that is how handles are written
	// everywhere else in the app. The lookup key is the bare name.
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

	const submit = async () => {
		if (sending) return;
		setSending(true);
		try {
			const runDays = Math.min(30, Math.max(1, Number(days || 0)));
			await authed("post", "/api/ads/bookings", {
				creatorUsername: handle,
				format,
				days: runDays,
				startAt: new Date(`${startAt}T00:00:00Z`).toISOString(),
				note: note.trim() || undefined,
				// The exact creative rides the request, so what the creator
				// approves is what will serve — never a swap after acceptance.
				creative: mediaUrl.trim()
					? {
							url: mediaUrl.trim(),
							linkUrl: linkUrl.trim() || undefined,
							coverUrl:
								format === "audio" && coverUrl.trim()
									? coverUrl.trim()
									: undefined,
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

	const field =
		"h-11 w-full rounded-lg bg-sunken px-3.5 font-sans text-[14px] text-primary outline-none placeholder:text-subtle";

	return (
		<div
			className="fixed inset-0 z-modal flex items-end justify-center bg-scrim sm:items-center"
			onClick={onClose}
			onKeyDown={(e) => e.key === "Escape" && onClose()}
			role="presentation"
		>
			<div
				className="w-full max-w-md rounded-t-xl border border-hairline bg-surface p-5 shadow-nav sm:rounded-xl"
				onClick={(e) => e.stopPropagation()}
				role="dialog"
				aria-label="New booking request"
			>
				<div className="mb-4 flex items-center justify-between">
					<h2 className="font-display text-[16px] font-semibold">
						Book ad space
					</h2>
					<button
						type="button"
						onClick={onClose}
						aria-label="Close"
						className="flex h-9 w-9 items-center justify-center rounded-pill text-muted hover:bg-raised cursor-pointer"
					>
						<X size={16} weight="bold" />
					</button>
				</div>

				<div className="flex flex-col gap-3">
					<input
						value={username}
						onChange={(e) => setUsername(e.target.value)}
						placeholder="Creator's @username"
						className={field}
					/>
					<div className="flex gap-2">
						{(["image", "video", "audio"] as const).map((f) => (
							<button
								key={f}
								type="button"
								onClick={() => setFormat(f)}
								className={clsx(
									"h-9 flex-1 rounded-pill font-sans text-[13px] font-medium transition-colors cursor-pointer",
									format === f
										? "bg-primary text-page"
										: "bg-raised text-muted hover:text-primary",
								)}
							>
								{f}
							</button>
						))}
					</div>
					<div className="flex gap-2">
						<label className="flex-1">
							<span className="mb-1 block font-sans text-[11.5px] font-semibold uppercase tracking-wide text-subtle">
								Days
							</span>
							<input
								type="text"
								inputMode="numeric"
								value={days}
								onChange={(e) =>
									setDays(e.target.value.replace(/[^0-9]/g, ""))
								}
								className={field}
							/>
						</label>
						<label className="flex-1">
							<span className="mb-1 block font-sans text-[11.5px] font-semibold uppercase tracking-wide text-subtle">
								Starts
							</span>
							<input
								type="date"
								value={startAt}
								onChange={(e) => setStartAt(e.target.value)}
								className={field}
							/>
						</label>
					</div>
					<input
						value={mediaUrl}
						onChange={(e) => setMediaUrl(e.target.value)}
						placeholder={
							format === "audio"
								? "Audio file URL (mp3)"
								: format === "video"
									? "Video file URL (mp4)"
									: "Banner image URL"
						}
						className={field}
					/>
					{format === "audio" && (
						<input
							value={coverUrl}
							onChange={(e) => setCoverUrl(e.target.value)}
							placeholder="Cover image URL (shown behind the play button)"
							className={field}
						/>
					)}
					<input
						value={linkUrl}
						onChange={(e) => setLinkUrl(e.target.value)}
						placeholder="Click-through link (https://…)"
						className={field}
					/>
					<textarea
						value={note}
						onChange={(e) => setNote(e.target.value)}
						placeholder="Anything the creator should know (optional)"
						rows={2}
						className="w-full resize-none rounded-lg bg-sunken px-3.5 py-2.5 font-sans text-[14px] text-primary outline-none placeholder:text-subtle"
					/>
					<button
						type="button"
						disabled={!handle || sending || !(Number(days) >= 1)}
						onClick={submit}
						className="h-11 rounded-pill bg-brand font-sans text-[14px] font-semibold text-brand-on transition-colors hover:opacity-90 disabled:opacity-50 cursor-pointer"
					>
						{rate !== null && Number(days) > 0
							? `Request · ${usd(rate * Number(days))} for ${days} day${days === "1" ? "" : "s"}`
							: "Send request"}
					</button>
					{rate === null && handle && (
						<p className="text-center font-sans text-[12px] text-subtle">
							No {format} rate published for @{handle} — the request
							may be refused.
						</p>
					)}
				</div>
			</div>
		</div>
	);
}
