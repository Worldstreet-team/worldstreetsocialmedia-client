"use client";

import clsx from "clsx";
import {
	useCallback,
	useEffect,
	useMemo,
	useState,
	useRef,
	useSyncExternalStore,
} from "react";
import { useAtomValue } from "jotai";
import {
	AnimatePresence,
	animate,
	motion,
	useMotionValue,
	useMotionValueEvent,
	useTransform,
} from "framer-motion";
import {
	RiImageFill,
	RiVoiceprintFill,
	RiFile2Fill,
	RiMoneyDollarCircleFill,
	RiUserSharedFill,
	RiPhoneFill,
	RiVideoOnFill,
	RiArrowLeftSLine,
	RiChat3Line,
	RiUserLine,
	RiArchiveLine,
	RiInboxUnarchiveLine,
	RiDeleteBinLine,
} from "@remixicon/react";
import { createPortal } from "react-dom";
import Link from "next/link";

import { Badge } from "@/components/ui/Badge";
import { SafeAvatar } from "@/components/ui/SafeAvatar";
import { UserBadges } from "@/components/ui/UserBadges";
import { useT } from "@/i18n/client";
import { formatTimeAgo } from "@/lib/utils";
import {
	DUR,
	EASE,
	EASE_IN,
	menuStagger,
	pop,
	reveal,
	staggerItem,
	staggerParent,
	staggerParentFast,
	staggerPop,
	swap,
	snappySpring,
} from "@/lib/motion-presets";
import { useGatewayRead } from "@/hooks/useGateway";
import {
	conversationIdentity,
	displayNameOf,
} from "@/lib/conversation-identity";
import { onlineIdsAtom } from "@/store/ui.atom";
import { Users } from "lucide-react";
import { systemEventCopy } from "./thread/groupSystem";

export interface ConversationRowUser {
	_id: string;
	username?: string;
	firstName?: string;
	lastName?: string;
	avatar?: string;
	isVerified?: boolean;
	verification?: { tier?: "bronze" | "silver" | "gold" } | null;
	badges?: any[];
}

export interface ConversationRow {
	_id: string;
	/** DM only — a group has no single "other". */
	otherParticipant?: ConversationRowUser;
	kind?: "dm" | "group";
	name?: string;
	avatar?: string;
	memberCount?: number;
	myRole?: "owner" | "admin" | "member";
	lastMessage?: {
		content?: string;
		type?: string;
		createdAt?: string;
		durationSec?: number;
		sender?: string | { _id?: string; firstName?: string; username?: string };
		/** Group membership events; the row renders their copy, not "". */
		systemEvent?: { kind: string; params?: Record<string, unknown> };
	};
	/** Not sent by the gateway today — see `rowTime`. Kept for callers. */
	lastMessageAt?: string;
	updatedAt?: string;
	unreadCount: number;
	/** Waiting on the Requests shelf — quiet until accepted. */
	isRequestForMe?: boolean;
	/** On my Archived shelf (per member, from the gateway). */
	archived?: boolean;
}

/**
 * When the last message landed.
 *
 * The gateway does NOT send `lastMessageAt`, though the client type has always
 * claimed it does — so the inbox guarded on a field that was never there and
 * silently rendered no time at all, on every row, forever. The real stamp is
 * on the message; `updatedAt` covers a thread that has none yet.
 */
const rowTime = (c: ConversationRow) =>
	c.lastMessage?.createdAt ?? c.lastMessageAt ?? c.updatedAt ?? null;

const displayName = (u: ConversationRowUser) =>
	[u.firstName, u.lastName].filter(Boolean).join(" ") ||
	u.username ||
	"Unknown";

/**
 * What a non-text message looks like in a one-line preview.
 *
 * A voice note carries no `content`, so every one of them rendered as the
 * "no messages yet" placeholder — a thread you had just sent audio to claimed
 * it was empty. Icons rather than emoji, per the icon rules.
 */
const KIND: Record<string, { glyph: any; key: string }> = {
	// Voice = the waveform glyph, not a mic (locked style decision 2026-09-02).
	audio: { glyph: RiVoiceprintFill, key: "messages.kind.voice" },
	image: { glyph: RiImageFill, key: "messages.kind.photo" },
	video: { glyph: RiVideoOnFill, key: "messages.kind.video" },
	file: { glyph: RiFile2Fill, key: "messages.kind.file" },
	call: { glyph: RiPhoneFill, key: "messages.kind.call" },
	// A transfer carries no content either when there is no note.
	payment: { glyph: RiMoneyDollarCircleFill, key: "messages.kind.payment" },
	contact: { glyph: RiUserSharedFill, key: "messages.kind.contact" },
};

/**
 * The thumb (owner 2026-09-16): a short centred pill that divides the
 * inbox's sections (stories, Online now, Chats) without drawing a line
 * across the column. One component so every divider is the same size.
 */
/** A block's title: the same display face, size and padding the inbox's own
 *  "Messages" title uses, so every block on the column reads as a header
 *  rather than a label (owner 2026-09-19). */
const sectionTitle =
	"mb-3 px-4 font-display text-[calc(20px*var(--ws-fs))] font-semibold leading-6 tracking-[-0.01em] text-primary";
/** The same title without the row's own padding, for a header that shares
 *  its line with a control. */
const sectionTitleBare =
	"font-display text-[calc(20px*var(--ws-fs))] font-semibold leading-6 tracking-[-0.01em] text-primary";

/** A store that never changes; see `clientMount` in the list. */
const subscribeNever = () => () => {};

export function InboxThumb() {
	return (
		<div aria-hidden className="flex justify-center pb-1 pt-2">
			<span className="h-1 w-10 rounded-pill bg-primary/15" />
		</div>
	);
}

/** The way back off a shelf. A chip, not an arrow alone: it says where to. */
function BackChip({ onBack }: { onBack: () => void }) {
	return (
		<button
			type="button"
			onClick={onBack}
			aria-label="Back to all chats"
			className="-ml-1.5 flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-pill text-muted transition-colors hover:bg-primary/5 hover:text-primary"
		>
			<RiArrowLeftSLine size={22} />
		</button>
	);
}

export function ConversationList({
	conversations,
	loading,
	query,
	activeId,
	myProfileId,
	onOpen,
	onDelete,
	onArchive,
	people,
	onOpenPerson,
	heading,
	banner,
	door,
	onBack,
	headerAside,
}: {
	conversations: ConversationRow[];
	loading: boolean;
	query: string;
	activeId?: string | null;
	myProfileId?: string | null;
	onOpen: (conv: ConversationRow) => void;
	/** Swipe a row left (touch) to reveal it, or use the requests chips. */
	onDelete?: (conv: ConversationRow) => void;
	/** Archive from the inbox, unarchive from the shelf (owner 2026-09-19). */
	onArchive?: (conv: ConversationRow) => void;
	/** Everyone who may appear in the online rail beyond your threads: your
	 *  Allies and the people you are Aligned to. */
	people?: ConversationRowUser[];
	/** Tap on someone in the rail you have no thread with yet. */
	onOpenPerson?: (u: ConversationRowUser) => void;
	/** Names the list of rows ("Chats"), styled like "Online now". */
	heading?: string;
	/** A state that has announced itself, above the rows: the requests row
	 *  (owner 2026-09-20). Nothing renders here when nothing is waiting. */
	banner?: React.ReactNode;
	/** The archived shelf, at the TOP beside the banner (owner 2026-09-20).
	 *  A shelf is a place, and places belong with the other places, not
	 *  under the list they are not part of. */
	door?: React.ReactNode;
	/** On a shelf, the way back to the inbox. The shelf tabs are gone, so
	 *  this back chip is the only way out and must always render. */
	onBack?: () => void;
	/** Sits on the header's own row, hard right: a count, usually. */
	headerAside?: React.ReactNode;
}) {
	const t = useT();
	const online = useAtomValue(onlineIdsAtom);

	// Name, handle AND the last line. Searching messages by the words you
	// remember from them is the whole point of a search box in an inbox; this
	// used to match first+last name only, so a handle found nothing.
	const rows = useMemo(() => {
		const q = query.trim().toLowerCase();
		if (!q) return conversations;
		return conversations.filter((c) => {
			const id = conversationIdentity(c);
			return (
				id.title.toLowerCase().includes(q) ||
				(id.peer?.username ?? "").toLowerCase().includes(q) ||
				(c.lastMessage?.content ?? "").toLowerCase().includes(q)
			);
		});
	}, [conversations, query]);

	// Two accounts really can share a display name — this inbox has two
	// "Greg Osimiri". Showing the handle always would be noise; showing it
	// only where the name is ambiguous is the whole of the information.
	const ambiguous = useMemo(() => {
		const seen = new Map<string, number>();
		for (const c of rows) {
			if (c.kind === "group") continue;
			const n = conversationIdentity(c).title.toLowerCase();
			seen.set(n, (seen.get(n) ?? 0) + 1);
		}
		return seen;
	}, [rows]);

	// Who is online right now (owner 2026-09-15): your Allies and the people
	// you are Aligned to, plus anyone you already have a thread with, against
	// the global presence set. A thread wins when both exist, so a tap opens
	// it; a person without one starts it. Hidden while searching, and gone
	// entirely when nobody is on, so it never sits there empty.
	const onlineNow = useMemo(() => {
		if (query.trim()) return [] as { key: string; user: ConversationRowUser; conv?: ConversationRow }[];
		const out = new Map<string, { key: string; user: ConversationRowUser; conv?: ConversationRow }>();
		for (const c of conversations) {
			const u = c.otherParticipant;
			// You are always online to yourself; a self-thread put your own
			// face first in the rail.
			if (c.kind === "group" || c.isRequestForMe || !u?._id || u._id === myProfileId || !online.has(u._id)) continue;
			out.set(u._id, { key: u._id, user: u, conv: c });
		}
		for (const u of people ?? []) {
			if (!u?._id || u._id === myProfileId || out.has(u._id) || !online.has(u._id)) continue;
			out.set(u._id, { key: u._id, user: u });
		}
		return [...out.values()];
	}, [conversations, people, online, query, myProfileId]);

	// The cascades belong to the first paint only. A search, a tab switch or
	// an emptied shelf remounts the block, and those must cut, so each flag
	// flips once its cascade has been given a commit to start in.
	const rowsPlayed = useRef(false);
	const railPlayed = useRef(false);
	// False on the server and while hydrating, true for a mount that happens
	// on the client (navigating here, the dock opening). The messages page
	// server-renders its rows: hiding rows the server already painted, just
	// to cascade them once the script lands, would blank the inbox on a
	// hard load.
	const clientMount = useSyncExternalStore(
		subscribeNever,
		() => true,
		() => false,
	);
	useEffect(() => {
		if (!loading && rows.length > 0) rowsPlayed.current = true;
	}, [loading, rows.length]);
	useEffect(() => {
		if (onlineNow.length > 0) railPlayed.current = true;
	}, [onlineNow.length]);

	// The held row's menu (owner 2026-09-20: "holding a chat should have
	// options or a custom context menu ... highlights the chat properly").
	// `html` is a snapshot of the row as it was drawn, so the lifted copy is
	// exactly the chat that was pressed, not a second render of it.
	const [rowMenu, setRowMenu] = useState<{
		conv: ConversationRow;
		rect: DOMRect;
		html: string;
	} | null>(null);
	const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const holdStart = useRef<{ x: number; y: number } | null>(null);
	// A hold ends with the finger lifting, which the browser reports as a
	// click on the row: that click must not open the chat behind the menu.
	const heldRef = useRef(false);
	const openRowMenu = (el: HTMLElement, conv: ConversationRow) =>
		setRowMenu({ conv, rect: el.getBoundingClientRect(), html: el.outerHTML });
	const cancelHold = () => {
		if (holdTimer.current) clearTimeout(holdTimer.current);
		holdTimer.current = null;
		holdStart.current = null;
	};

	// Every hook lives ABOVE the early returns below. `onlineNow` used to sit
	// under them, so the first search with no match rendered fewer hooks than
	// the render before it and took the whole Messages page down (found
	// 2026-09-19, shipped 09-15).
	if (loading) {
		// The stand-in is the real thing with its data missing (owner
		// 2026-09-20: the old one did not match the layout). Same block, same
		// heading, the faces rail, the thumb, and rows at the row's own
		// geometry: 48px avatar, gap-3, px-3 py-2. Anything known is drawn
		// for real; only what the network owes is grey.
		return (
			<div className="flex flex-col px-2">
				<div className="flex flex-col rounded-2xl px-2 pb-2 pt-4 glass-frost backdrop-blur-xl">
					{heading && (
						<div className="mb-3 flex items-center gap-2 px-4">
							<h2 className={clsx(sectionTitleBare, "flex-1")}>{heading}</h2>
						</div>
					)}
					<div
						aria-hidden
						className="mb-1 flex gap-1 overflow-hidden px-2 pb-2"
					>
						{[0, 1, 2, 3, 4].map((i) => (
							<span
								key={i}
								className="flex w-[62px] shrink-0 flex-col items-center gap-1 py-1"
							>
								<span className="skeleton h-12 w-12 rounded-pill" />
								<span className="skeleton h-[11px] w-9 rounded-[4px]" />
							</span>
						))}
					</div>
					<InboxThumb />
					{[0, 1, 2, 3, 4, 5, 6].map((i) => (
						<div
							key={i}
							className="flex w-full items-center gap-3 rounded-xl px-3 py-2"
						>
							<span className="skeleton h-12 w-12 shrink-0 rounded-pill" />
							<span className="flex min-w-0 flex-1 flex-col gap-1.5">
								<span
									className="skeleton h-[15px] rounded-[4px]"
									style={{ width: `${[46, 62, 38, 54, 44, 58, 40][i]}%` }}
								/>
								<span
									className="skeleton h-[13px] rounded-[4px]"
									style={{ width: `${[70, 52, 64, 44, 74, 48, 60][i]}%` }}
								/>
							</span>
							<span className="skeleton h-[11px] w-7 shrink-0 rounded-[4px]" />
						</div>
					))}
				</div>
			</div>
		);
	}

	// A search that finds no conversation is not a dead end (owner
	// 2026-09-19): offer the people it could mean, and failing that the
	// people you already know, each one tap from a chat.
	if (rows.length === 0 && query.trim() && onOpenPerson) {
		return (
			<PeopleToChat
				query={query}
				suggested={people ?? []}
				myProfileId={myProfileId}
				onOpenPerson={onOpenPerson}
			/>
		);
	}

	if (rows.length === 0) {
		// The shelf keeps its header and its pills even with nothing on it:
		// an empty Requests or Archived view used to render the line alone,
		// and there was no way back to Primary (owner 2026-09-19).
		return (
			<div className="flex flex-col px-2">
				<div className="flex flex-col rounded-2xl pb-6 pt-4 md:bg-sunken">
					{heading && (!query.trim() || onBack) && (
						<div className="mb-3 flex items-center gap-2 px-4">
							{onBack && <BackChip onBack={onBack} />}
							<h2 className={clsx(sectionTitleBare, "flex-1")}>{heading}</h2>
							{headerAside}
						</div>
					)}
					{!query.trim() && banner}
					{!query.trim() && door}
					{/* Rises when a shelf turns out empty; a search that finds
					    nothing is typed, so that one cuts, and so does a line
					    the server already painted (it would sit invisible until
					    the script landed). Keyed per case. */}
					<motion.p
						key={query.trim() ? "search" : "shelf"}
						{...(query.trim() || !clientMount ? {} : reveal())}
						className="px-6 py-8 text-center font-sans text-[calc(15px*var(--ws-fs))] text-subtle"
					>
						{query.trim() ? t("messages.noMatches") : t("messages.empty")}
					</motion.p>
				</div>
			</div>
		);
	}

	return (
		<div className="flex flex-col px-2">
			{/* The parent only times its rows: it carries no transform or fade
			    of its own, because the block is the blurred pane. */}
			<motion.div
				variants={staggerParentFast}
				initial={clientMount && !rowsPlayed.current ? "hidden" : false}
				animate="show"
				className="flex flex-col rounded-2xl px-2 pb-2 pt-4 glass-frost backdrop-blur-xl"
			>
			{/* The back chip is the only way off a shelf now, so the header
			    survives a search there; in the inbox a search still owns the
			    block (owner 2026-09-19, caught the first version of this). */}
			{heading && (!query.trim() || onBack) && (
				<div className="mb-3 flex items-center gap-2 px-4">
					{onBack && <BackChip onBack={onBack} />}
					<h2 className={clsx(sectionTitleBare, "flex-1")}>{heading}</h2>
					{headerAside}
				</div>
			)}
			{/* A state, not a filter (owner 2026-09-20): it is here when
			    something is waiting and absent when nothing is. */}
			{!query.trim() && banner}
			{!query.trim() && door}
			{/* Who is on, right inside the chats block: faces only, no header
			    of its own (owner 2026-09-20). */}
			{onlineNow.length > 0 && !query.trim() && (
				<motion.div
					aria-label={t("messages.onlineNow")}
					// Its own root, not a child of the rows' cascade: presence
					// often lands after the chats have painted.
					variants={staggerParent}
					initial={railPlayed.current ? false : "hidden"}
					animate="show"
					className="mb-1 flex gap-1 overflow-x-auto px-2 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
				>
					{onlineNow.map(({ key, user: peer, conv }) => {
						const first = (peer.firstName || peer.username || "").split(" ")[0];
						return (
							<motion.button
								key={key}
								type="button"
								// Every face, always: the late ones are off the edge
								// of the rail, so nobody waits on them.
								variants={staggerPop}
								onClick={() => (conv ? onOpen(conv) : onOpenPerson?.(peer))}
								className="flex w-[62px] shrink-0 cursor-pointer flex-col items-center gap-1 rounded-[10px] py-1 text-center transition-colors hover:bg-primary/5"
							>
								<span className="relative">
									<span className="relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-pill bg-raised">
										<SafeAvatar src={peer.avatar} />
									</span>
									<span
										aria-hidden
										className="ws-cue-online absolute bottom-0 right-0 h-2 w-2 rounded-pill bg-success ring-2 ring-sunken"
									/>
								</span>
								<span className="w-full truncate font-sans text-[calc(11px*var(--ws-fs))] font-medium text-muted">
									{first}
								</span>
							</motion.button>
						);
					})}
				</motion.div>
			)}
			{/* A thumb between who is on and the chats themselves. */}
			{onlineNow.length > 0 && !query.trim() && rows.length > 0 && <InboxThumb />}

			{rows.map((conv, i) => {
				const identity = conversationIdentity(conv);
				const isGroup = identity.kind === "group";
				const u = conv.otherParticipant;
				const unread = conv.unreadCount > 0;
				const active = activeId === conv._id;
				const kind = conv.lastMessage?.type
					? KIND[conv.lastMessage.type]
					: undefined;
				const senderId =
					typeof conv.lastMessage?.sender === "string"
						? conv.lastMessage.sender
						: conv.lastMessage?.sender?._id;
				const mine = !!senderId && !!myProfileId && senderId === myProfileId;
				const Glyph = kind?.glyph;
				return (
					// A wrapper AROUND the swipe row, so its drag transform is
					// untouched.
					<CascadeRow key={conv._id} index={i}>
					<SwipeRow
						onDelete={onDelete ? () => onDelete(conv) : undefined}
						onArchive={onArchive ? () => onArchive(conv) : undefined}
						archiveLabel={
							conv.archived ? t("messages.unarchive") : t("messages.archive")
						}
						archived={!!conv.archived}
					>
					<button
						type="button"
						onClick={() => {
							if (heldRef.current) {
								heldRef.current = false;
								return;
							}
							onOpen(conv);
						}}
						onContextMenu={(e) => {
							e.preventDefault();
							openRowMenu(e.currentTarget, conv);
						}}
						onTouchStart={(e) => {
							const el = e.currentTarget;
							const p = e.touches[0];
							holdStart.current = { x: p.clientX, y: p.clientY };
							holdTimer.current = setTimeout(() => {
								heldRef.current = true;
								navigator.vibrate?.(8);
								openRowMenu(el, conv);
							}, 450);
						}}
						onTouchMove={(e) => {
							// Any real movement is a scroll or the swipe, not a hold.
							const s0 = holdStart.current;
							const p = e.touches[0];
							if (s0 && Math.hypot(p.clientX - s0.x, p.clientY - s0.y) > 8)
								cancelHold();
						}}
						onTouchEnd={cancelHold}
						onTouchCancel={cancelHold}
						aria-current={active ? "true" : undefined}
						className={clsx(
							// The selected chat is a contained chip, not a
							// full-bleed strip (owner 2026-09-06) — the list
							// wrapper's px-2 gives the radius air on both sides.
							// Its fill is a FADED white (owner): the ink token
							// at a wash, not raised-grey and not solid white.
							// Full width inside the list's own px-2: the selected chip
							// runs the whole row, inset from the block's edges but
							// never short of the text (owner 2026-09-20).
							"group relative flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors",
							active ? "bg-primary/10" : "hover:bg-primary/5",
						)}
					>
						<span className="relative shrink-0">
							<span className="relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-pill bg-raised">
								{isGroup && !identity.avatar ? (
									<Users className="h-6 w-6 text-muted" />
								) : (
									<SafeAvatar src={identity.avatar} />
								)}
							</span>
							{/* Presence is a 1:1 fact — a group has many. */}
							{/* initial={false}: a dot already there at mount is a
							    fact, not an event. Only a change pops. */}
							<AnimatePresence initial={false}>
								{!isGroup && u && online.has(u._id) && (
									<motion.span
										key="online"
										{...pop}
										aria-label="Online"
										className="absolute bottom-0 right-0 h-2 w-2 rounded-pill bg-success ring-2 ring-sunken ws-cue-online"
									/>
								)}
							</AnimatePresence>
						</span>

						<span className="min-w-0 flex-1">
							<span className="flex items-center gap-1.5">
								<span
									className={clsx(
										"truncate font-sans text-[calc(15px*var(--ws-fs))]",
										unread
											? "font-semibold text-primary"
											: "font-medium text-primary",
									)}
								>
									{identity.title}
								</span>
								{isGroup ? (
									<span className="flex shrink-0 items-center gap-0.5 font-sans text-[calc(13px*var(--ws-fs))] text-subtle">
										<Users className="h-3 w-3" />
										{identity.memberCount ?? ""}
									</span>
								) : (
									u && (
										<>
											<UserBadges
												isVerified={u.isVerified}
												verification={u.verification}
												badges={u.badges}
												size={15}
											/>
											{(ambiguous.get(identity.title.toLowerCase()) ??
												0) > 1 &&
												u.username && (
													<span className="min-w-0 shrink truncate font-sans text-[calc(13px*var(--ws-fs))] text-subtle">
														@{u.username}
													</span>
												)}
										</>
									)
								)}
							</span>

							<span
								className={clsx(
									"mt-0.5 flex items-center gap-1 font-sans text-[calc(13px*var(--ws-fs))]",
									unread ? "font-medium text-primary" : "text-muted",
								)}
							>
								{mine && conv.lastMessage?.type !== "system" && (
									<span className="shrink-0 text-subtle">
										{t("messages.you")}
									</span>
								)}
								{Glyph && conv.lastMessage?.type !== "system" && (
									<Glyph size={15} className="shrink-0 text-subtle" />
								)}
								<PreviewRoll
									stamp={conv.lastMessage?.createdAt ?? "none"}
									roll={!mine}
								>
									{conv.lastMessage?.type === "system"
										? conv.lastMessage.systemEvent
											? systemEventCopy(
													conv.lastMessage.systemEvent,
													typeof conv.lastMessage.sender ===
														"object"
														? (conv.lastMessage.sender
																?.firstName ??
															conv.lastMessage.sender
																?.username)
														: undefined,
												)
											: t("messages.noMessages")
										: kind
											? conv.lastMessage?.type === "audio" &&
												conv.lastMessage?.durationSec
												? `${Math.floor(conv.lastMessage.durationSec / 60)}:${String(Math.floor(conv.lastMessage.durationSec % 60)).padStart(2, "0")}`
												: t(kind.key)
											: conv.lastMessage?.content ||
												t("messages.noMessages")}
								</PreviewRoll>
								{/* The time rides the preview line ("Heyy · 3d"),
								    which frees the top line for the name alone. */}
								{rowTime(conv) && (
									<span className="shrink-0 tabular-nums text-subtle">
										{"\u00b7 "}
										{formatTimeAgo(rowTime(conv) as string)}
									</span>
								)}
							</span>
						</span>
						{/* The house numeric badge on the trailing edge — how many
						    is part of the signal, not just that. */}
						<AnimatePresence initial={false}>
							{unread && (
								<motion.span
									key="unread"
									{...pop}
									className="ml-2 flex shrink-0 items-center gap-1.5"
								>
									{/* One signal (owner pick): a dot, the row already bolds. */}
									<span aria-label={`${conv.unreadCount} unread`} className="h-2 w-2 rounded-pill bg-brand" />
								</motion.span>
							)}
						</AnimatePresence>
					</button>
					</SwipeRow>
					</CascadeRow>
				);
			})}
			</motion.div>
		<ChatRowMenu
				menu={rowMenu}
				onClose={() => setRowMenu(null)}
				onOpen={onOpen}
				onArchive={onArchive}
				onDelete={onDelete}
			/>
		</div>
	);
}

/**
 * The one-line preview. A line from the other side rises in; my own send
 * cuts, because sending is too frequent to earn motion. Keyed on the
 * message's stamp alone, NOT on whose it is: the inbox learns who "me" is a
 * beat after it paints, and a key that flipped then rolled every row at once.
 * No exit half, so a row carries no presence of its own for this.
 */
function PreviewRoll({
	stamp,
	roll,
	children,
}: {
	stamp: string;
	roll: boolean;
	children: React.ReactNode;
}) {
	// False for the row's first paint: a line already there is not news.
	const mounted = useRef(false);
	useEffect(() => {
		mounted.current = true;
	}, []);
	return (
		<motion.span
			key={stamp}
			initial={mounted.current && roll ? swap.initial : false}
			animate={swap.animate}
			className="truncate"
		>
			{children}
		</motion.span>
	);
}

/**
 * One row of a first-open cascade, under a `staggerParentFast` parent. Only
 * the first screenful takes part, so row 40 is not a second late, and whether
 * a row does is fixed at mount: a mounted motion element must never lose its
 * `variants`, because framer sends a value it can no longer see back to where
 * it started, and these rows start invisible. Exported for the message
 * sheets, whose people lists cascade the same way.
 */
export function CascadeRow({
	index,
	children,
}: {
	index: number;
	children: React.ReactNode;
}) {
	const [cascades] = useState(index < 12);
	if (!cascades) return <>{children}</>;
	return <motion.div variants={staggerItem}>{children}</motion.div>;
}

/** People to start a chat with, shown when a search matches no thread. */
function PeopleToChat({
	query,
	suggested,
	myProfileId,
	onOpenPerson,
}: {
	query: string;
	suggested: ConversationRowUser[];
	myProfileId?: string | null;
	onOpenPerson: (u: ConversationRowUser) => void;
}) {
	const t = useT();
	const read = useGatewayRead();
	const [found, setFound] = useState<ConversationRowUser[] | null>(null);

	useEffect(() => {
		const term = query.trim();
		if (term.length < 2) {
			setFound([]);
			return;
		}
		setFound(null);
		let alive = true;
		const id = window.setTimeout(async () => {
			const res = await read(
				`/api/users/search?q=${encodeURIComponent(term)}`,
				(b) => b.data,
			);
			if (!alive) return;
			setFound(
				res.success && Array.isArray(res.data)
					? (res.data as ConversationRowUser[]).filter((u) => u._id !== myProfileId)
					: [],
			);
		}, 300);
		return () => {
			alive = false;
			window.clearTimeout(id);
		};
	}, [query, read, myProfileId]);

	const searching = found === null;
	const list = found?.length ? found.slice(0, 8) : suggested.filter((u) => u._id !== myProfileId).slice(0, 6);
	const label = found?.length ? t("messages.people") : t("messages.suggested");

	return (
		<div className="flex flex-col px-2 pb-4">
			<p className="px-2 pb-3 pt-6 text-center font-sans text-[calc(13px*var(--ws-fs))] text-subtle">
				{t("messages.noMatches")}
			</p>
			{searching ? (
				<div className="flex flex-col">
					{[0, 1, 2].map((i) => (
						<div key={i} className="flex items-center gap-3 px-3 py-2">
							<span className="skeleton h-12 w-12 shrink-0 rounded-pill" />
							<span className="skeleton h-[14px] w-1/2 rounded-[4px]" />
						</div>
					))}
				</div>
			) : (
				list.length > 0 && (
					<>
						<p className="mb-1.5 px-2 font-sans text-[calc(13px*var(--ws-fs))] font-semibold text-primary">
							{label}
						</p>
						{list.map((u) => {
							const real = [u.firstName, u.lastName].filter(Boolean).join(" ");
							const name = real || (u.username ? `@${u.username}` : "");
							return (
								<button
									key={u._id}
									type="button"
									onClick={() => onOpenPerson(u)}
									className="flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-primary/5"
								>
									<span className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-pill bg-raised">
										<SafeAvatar src={u.avatar} />
									</span>
									<span className="min-w-0 flex-1">
										<span className="flex items-center gap-1.5">
											<span className="truncate font-sans text-[calc(15px*var(--ws-fs))] font-medium text-primary">
												{name}
											</span>
											<UserBadges
												isVerified={u.isVerified}
												verification={u.verification}
												badges={u.badges}
												size={15}
											/>
										</span>
										{real && u.username && (
											<span className="block truncate font-sans text-[calc(13px*var(--ws-fs))] text-muted">
												@{u.username}
											</span>
										)}
									</span>
									<span className="shrink-0 rounded-pill bg-primary/10 px-3 py-1.5 font-sans text-[calc(13px*var(--ws-fs))] font-semibold text-primary">
										{t("messages.message")}
									</span>
								</button>
							);
						})}
					</>
				)
			)}
		</div>
	);
}

/**
 * Swipe-left (touch) drags the row to reveal Delete; release past the
 * threshold commits, otherwise it springs back. A tap is untouched, so
 * pointer devices lose nothing — they get the same action from the
 * message-request chips and the thread header.
 */
/** The one row open across the whole inbox; opening another shuts it. */
let closeOpenRow: (() => void) | null = null;

const ACTION_W = 76;

/**
 * Swipe a chat row (owner 2026-09-22, after the first version: "terrible").
 * The iOS Mail grammar, done properly:
 *
 * - The row slides on a spring, direction-locked, so a diagonal scroll
 *   scrolls and only a horizontal pull swipes. Pulling right rubber-bands.
 * - Under it, one coloured well in the trailing action's colour, with the
 *   actions as icon-over-label buttons: Archive (brand) on the left,
 *   Delete (red) on the right, the owner's order. A full swipe reaches
 *   Delete, which still goes through its confirm.
 * - A short pull parks the row open with both actions tappable. Past the
 *   commit line the trailing action grows to fill the well with a tick of
 *   haptic, and letting go performs it. A fling commits too.
 * - One row open at a time: opening another, tapping anywhere else, or
 *   tapping the row itself shuts it.
 * - Touch only. A mouse has the right-click menu; dragging list rows with
 *   a mouse is not a thing anyone expects.
 */
function SwipeRow({
	children,
	onDelete,
	onArchive,
	archiveLabel,
	archived,
}: {
	children: React.ReactNode;
	onDelete?: () => void;
	/** Archive, or unarchive when the row is already on the shelf. */
	onArchive?: () => void;
	archiveLabel?: string;
	archived?: boolean;
}) {
	const x = useMotionValue(0);
	const rootRef = useRef<HTMLDivElement>(null);
	const [open, setOpen] = useState(false);
	const [expanded, setExpanded] = useState(false);
	const [coarse, setCoarse] = useState(false);
	useEffect(() => {
		setCoarse(window.matchMedia?.("(pointer: coarse)").matches ?? false);
	}, []);

	// Archive on the left, Delete on the right (owner 2026-09-22). Delete is
	// therefore the trailing action a full swipe reaches; it still opens its
	// confirm, so a fling never deletes outright.
	const actions = [
		onArchive && {
			key: "archive",
			label: archiveLabel ?? "Archive",
			run: onArchive,
		},
		onDelete && { key: "delete", label: "Delete", run: onDelete },
	].filter(Boolean) as { key: string; label: string; run: () => void }[];
	const trailing = actions[actions.length - 1];
	const OPEN = actions.length * ACTION_W;
	const COMMIT = OPEN + 72;

	// The well shows only once the row has moved: at rest the row is
	// transparent on the frosted block and the well must not read through it.
	const wellOpacity = useTransform(x, (v) => (v < -1 ? 1 : 0));
	const wellWidth = useTransform(x, (v) => Math.max(0, -v));
	const rowFill = useTransform(x, (v) =>
		v < -1 ? "var(--ws-bg-surface)" : "transparent",
	);
	useMotionValueEvent(x, "change", (v) => {
		const past = v <= -COMMIT;
		setExpanded((was) => {
			if (past && !was) navigator.vibrate?.(8);
			return past;
		});
	});

	// Stable, because the one-open registry compares it by identity.
	const close = useCallback(() => {
		animate(x, 0, snappySpring);
		setOpen(false);
		if (closeOpenRow === close) closeOpenRow = null;
	}, [x]);
	const settle = (to: number) => {
		if (to === 0) return close();
		animate(x, to, snappySpring);
		setOpen(true);
		if (closeOpenRow && closeOpenRow !== close) closeOpenRow();
		closeOpenRow = close;
	};

	// Anything tapped outside an open row shuts it.
	useEffect(() => {
		if (!open) return;
		const onDown = (e: PointerEvent) => {
			if (!rootRef.current?.contains(e.target as Node)) close();
		};
		document.addEventListener("pointerdown", onDown, true);
		return () => document.removeEventListener("pointerdown", onDown, true);
	}, [open, close]);

	if (!coarse || actions.length === 0) return <>{children}</>;

	return (
		<div ref={rootRef} className="relative overflow-hidden rounded-xl">
			<motion.div
				aria-hidden
				style={{ opacity: wellOpacity, width: wellWidth }}
				className={clsx(
					"absolute inset-y-0 right-0 flex justify-end overflow-hidden",
					trailing.key === "delete" ? "bg-danger" : "bg-brand",
				)}
			>
				{actions.map((a) => {
					const isTrailing = a === trailing;
					const hidden = expanded && !isTrailing;
					return (
						<motion.button
							key={a.key}
							type="button"
							tabIndex={-1}
							layout
							transition={snappySpring}
							onClick={() => {
								close();
								a.run();
							}}
							className={clsx(
								"flex h-full shrink-0 cursor-pointer flex-col items-center justify-center gap-1 font-sans text-[calc(11px*var(--ws-fs))] font-semibold",
								a.key === "delete" ? "bg-danger text-white" : "bg-brand text-brand-on",
								expanded && isTrailing ? "flex-1" : "",
								hidden && "w-0 overflow-hidden opacity-0",
							)}
							style={hidden ? undefined : { minWidth: ACTION_W }}
						>
							{a.key === "delete" ? (
								<RiDeleteBinLine size={22} />
							) : archived ? (
								<RiInboxUnarchiveLine size={22} />
							) : (
								<RiArchiveLine size={22} />
							)}
							{a.label}
						</motion.button>
					);
				})}
			</motion.div>
			<motion.div
				drag="x"
				dragDirectionLock
				dragConstraints={{ left: -COMMIT - 40, right: 0 }}
				dragElastic={{ left: 0.25, right: 0.06 }}
				dragMomentum={false}
				style={{ x, backgroundColor: rowFill }}
				onDragEnd={(_, info) => {
					const v = x.get();
					if (v <= -COMMIT || info.velocity.x < -900) {
						settle(0);
						trailing.run();
						return;
					}
					settle(v <= -OPEN / 2 ? -OPEN : 0);
				}}
				className="relative"
			>
				{children}
				{/* While parked open the row itself is a way to shut it, and
				    must not open the chat. */}
				{open && (
					<button
						type="button"
						aria-label="Close"
						onClick={close}
						className="absolute inset-0 cursor-default"
					/>
				)}
			</motion.div>
		</div>
	);
}

/**
 * The menu a held (or right-clicked) chat opens. The thread behind dims
 * under a scrim, the pressed row is lifted over it as a copy at the exact
 * place it was pressed, and the actions unfold from its corner. Portalled:
 * the chats block is a blurred stacking context, and a menu inside it
 * would be clipped by the list and painted under the next block.
 */
function ChatRowMenu({
	menu,
	onClose,
	onOpen,
	onArchive,
	onDelete,
}: {
	menu: { conv: ConversationRow; rect: DOMRect; html: string } | null;
	onClose: () => void;
	onOpen: (conv: ConversationRow) => void;
	onArchive?: (conv: ConversationRow) => void;
	onDelete?: (conv: ConversationRow) => void;
}) {
	const t = useT();
	const openedAt = useRef(0);
	useEffect(() => {
		if (!menu) return;
		openedAt.current = Date.now();
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose();
		};
		window.addEventListener("keydown", onKey);
		// A list that scrolls under a fixed copy of one of its rows is a lie.
		window.addEventListener("scroll", onClose, true);
		return () => {
			window.removeEventListener("keydown", onKey);
			window.removeEventListener("scroll", onClose, true);
		};
	}, [menu, onClose]);

	if (typeof document === "undefined") return null;
	const conv = menu?.conv;
	const rect = menu?.rect;
	const identity = conv ? conversationIdentity(conv) : null;
	const username = conv?.otherParticipant?.username;
	const MENU_W = 228;
	const rows =
		1 + (identity?.kind !== "group" && username ? 1 : 0) + (onArchive ? 1 : 0) + (onDelete ? 1 : 0);
	const need = rows * 44 + 20;
	const below = rect ? window.innerHeight - rect.bottom : 0;
	const flip = rect ? below < need + 12 : false;
	const menuMotion = menuStagger(flip ? "bottom-left" : "top-left");
	const item =
		"flex min-h-[44px] w-full cursor-pointer items-center gap-3 rounded-xl px-3 text-left font-sans text-[calc(14px*var(--ws-fs))] font-medium transition-colors";

	return createPortal(
		<AnimatePresence>
			{menu && conv && rect && (
				<motion.div key="chat-row-menu" className="fixed inset-0 z-modal">
					<motion.button
						type="button"
						aria-label="Close"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1, transition: { duration: DUR.base, ease: EASE } }}
						exit={{ opacity: 0, transition: { duration: DUR.fast, ease: EASE_IN } }}
						onClick={() => {
							// The finger lifting off the hold lands here as a click.
							if (Date.now() - openedAt.current < 350) return;
							onClose();
						}}
						className="absolute inset-0 cursor-default bg-scrim"
					/>
					{/* The pressed chat, lifted: the same pixels, on the raised
					    step so it stands clear of the dimmed list. */}
					<div
						aria-hidden
						className="pointer-events-none fixed overflow-hidden rounded-xl bg-raised shadow-nav [&>*]:!bg-transparent"
						style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }}
						// biome-ignore lint/security/noDangerouslySetInnerHtml: a snapshot of our own rendered row
						dangerouslySetInnerHTML={{ __html: menu.html }}
					/>
					<motion.div
						role="menu"
						aria-label={identity?.title}
						{...menuMotion}
						style={{
							...menuMotion.style,
							position: "fixed",
							left: Math.min(rect.left, window.innerWidth - MENU_W - 12),
							width: MENU_W,
							...(flip
								? { bottom: window.innerHeight - rect.top + 8 }
								: { top: rect.bottom + 8 }),
						}}
						className="rounded-2xl p-1.5 shadow-nav glass-frost backdrop-blur-2xl"
					>
						<motion.button
							type="button"
							role="menuitem"
							variants={staggerItem}
							onClick={() => {
								onClose();
								onOpen(conv);
							}}
							className={clsx(item, "text-primary hover:bg-primary/5")}
						>
							<RiChat3Line size={18} className="text-muted" />
							{t("messages.openChat")}
						</motion.button>
						{identity?.kind !== "group" && username && (
							<motion.div variants={staggerItem}>
								<Link
									href={`/profile/${username}`}
									role="menuitem"
									onClick={onClose}
									className={clsx(item, "text-primary hover:bg-primary/5")}
								>
									<RiUserLine size={18} className="text-muted" />
									{t("messages.viewProfile")}
								</Link>
							</motion.div>
						)}
						{onArchive && (
							<motion.button
								type="button"
								role="menuitem"
								variants={staggerItem}
								onClick={() => {
									onClose();
									onArchive(conv);
								}}
								className={clsx(item, "text-primary hover:bg-primary/5")}
							>
								{conv.archived ? (
									<RiInboxUnarchiveLine size={18} className="text-muted" />
								) : (
									<RiArchiveLine size={18} className="text-muted" />
								)}
								{conv.archived ? t("messages.unarchive") : t("messages.archive")}
							</motion.button>
						)}
						{onDelete && (
							<motion.button
								type="button"
								role="menuitem"
								variants={staggerItem}
								onClick={() => {
									onClose();
									onDelete(conv);
								}}
								className={clsx(item, "text-danger hover:bg-danger/10")}
							>
								<RiDeleteBinLine size={18} />
								{t("messages.deleteChat")}
							</motion.button>
						)}
					</motion.div>
				</motion.div>
			)}
		</AnimatePresence>,
		document.body,
	);
}
