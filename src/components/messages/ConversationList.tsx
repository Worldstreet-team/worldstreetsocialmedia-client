"use client";

import clsx from "clsx";
import { useEffect, useMemo, useState, useRef } from "react";
import { useAtomValue } from "jotai";
import {
	RiImageFill,
	RiVoiceprintFill,
	RiFile2Fill,
	RiMoneyDollarCircleFill,
	RiUserSharedFill,
	RiPhoneFill,
	RiVideoOnFill,
} from "@remixicon/react";

import { Badge } from "@/components/ui/Badge";
import { SafeAvatar } from "@/components/ui/SafeAvatar";
import { UserBadges } from "@/components/ui/UserBadges";
import { useT } from "@/i18n/client";
import { formatTimeAgo } from "@/lib/utils";
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

export function InboxThumb() {
	return (
		<div aria-hidden className="flex justify-center pb-1 pt-2">
			<span className="h-1 w-10 rounded-pill bg-primary/15" />
		</div>
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
	filter,
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
	/** The Primary / Requests pills, rendered inside the chats block under
	 *  its title (owner 2026-09-19) rather than as a block of their own. */
	filter?: React.ReactNode;
	/** Sits on the header's own row, hard right: the People / Groups chips. */
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

	// Every hook lives ABOVE the early returns below. `onlineNow` used to sit
	// under them, so the first search with no match rendered fewer hooks than
	// the render before it and took the whole Messages page down (found
	// 2026-09-19, shipped 09-15).
	if (loading) {
		return (
			<div className="flex flex-col">
				{[0, 1, 2, 3, 4].map((i) => (
					<div key={i} className="flex items-center gap-3 px-4 py-1.5">
						<span className="skeleton h-[52px] w-[52px] shrink-0 rounded-pill" />
						<span className="flex min-w-0 flex-1 flex-col gap-2">
							<span className="skeleton h-[18px] w-1/3 rounded-[4px]" />
							<span className="skeleton h-[15px] w-2/3 rounded-[4px]" />
						</span>
					</div>
				))}
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
					{heading && !query.trim() && (
						<div className="mb-3 flex items-center justify-between gap-2 px-4">
							<h2 className={sectionTitleBare}>{heading}</h2>
							{headerAside}
						</div>
					)}
					{filter && !query.trim() && (
						<div className="mb-1 px-1">{filter}</div>
					)}
					<p className="px-6 py-8 text-center font-sans text-[calc(15px*var(--ws-fs))] text-subtle">
						{query.trim() ? t("messages.noMatches") : t("messages.empty")}
					</p>
				</div>
			</div>
		);
	}

	return (
		<div className="flex flex-col px-2">
			<div className="flex flex-col rounded-2xl px-2 pb-2 pt-4 glass-frost backdrop-blur-xl">
			{heading && !query.trim() && (
				<div className="mb-3 flex items-center justify-between gap-2 px-4">
					<h2 className={sectionTitleBare}>{heading}</h2>
					{headerAside}
				</div>
			)}
			{/* Always, in every view: the pills are the only way back from
			    Requests or the Archived shelf. */}
			{filter && !query.trim() && (
				// Five chips do not fit a 340px column: the row scrolls
				// sideways rather than clipping Requests and Archived off the
				// edge (owner 2026-09-20).
				// A rail around the CHIPS, not the column (owner 2026-09-20),
				// with the live pill a lighter shade so the thumb reads, and a
				// thumb under the row to close it off.
				<>
					<div className="mx-2 mb-2 flex">
						<div className="max-w-full overflow-x-auto rounded-pill bg-primary/5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [&>*]:!px-1 [&>*]:!py-1 [&>*]:min-w-max [&_[aria-selected=true]]:bg-primary/15">
							{filter}
						</div>
					</div>
					<InboxThumb />
				</>
			)}
			{/* Who is on, right inside the chats block: faces only, no header
			    of its own (owner 2026-09-20). */}
			{onlineNow.length > 0 && !query.trim() && (
				<div
					aria-label={t("messages.onlineNow")}
					className="mb-1 flex gap-1 overflow-x-auto px-2 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
				>
					{onlineNow.map(({ key, user: peer, conv }) => {
						const first = (peer.firstName || peer.username || "").split(" ")[0];
						return (
							<button
								key={key}
								type="button"
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
							</button>
						);
					})}
				</div>
			)}

			{rows.map((conv) => {
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
					<SwipeRow
						key={conv._id}
						onDelete={onDelete ? () => onDelete(conv) : undefined}
						onArchive={onArchive ? () => onArchive(conv) : undefined}
						archiveLabel={
							conv.archived ? t("messages.unarchive") : t("messages.archive")
						}
					>
					<button
						type="button"
						onClick={() => onOpen(conv)}
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
							{!isGroup && u && online.has(u._id) && (
								<span
									aria-label="Online"
									className="absolute bottom-0 right-0 h-2 w-2 rounded-pill bg-success ring-2 ring-sunken ws-cue-online"
								/>
							)}
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
								<span className="truncate">
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
								</span>
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
						{unread && (
							<span className="ml-2 flex shrink-0 items-center gap-1.5">
								{/* One signal (owner pick): a dot, the row already bolds. */}
								<span aria-label={`${conv.unreadCount} unread`} className="h-2 w-2 rounded-pill bg-brand" />
							</span>
						)}
					</button>
					</SwipeRow>
				);
			})}
			</div>
		</div>
	);
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
function SwipeRow({
	children,
	onDelete,
	onArchive,
	archiveLabel,
}: {
	children: React.ReactNode;
	onDelete?: () => void;
	/** Archive, or unarchive when the row is already on the shelf. */
	onArchive?: () => void;
	archiveLabel?: string;
}) {
	const [dx, setDx] = useState(0);
	const startX = useRef<number | null>(null);
	const startY = useRef<number | null>(null);
	const committed = useRef(false);

	if (!onDelete && !onArchive) return <>{children}</>;

	// The iOS shape (owner 2026-09-19): the actions sit under the row and are
	// uncovered as it slides; a short pull parks the row open so either can be
	// tapped, a long pull commits the nearest one outright.
	const actions = [
		onArchive && {
			key: "archive",
			label: archiveLabel ?? "Archive",
			cls: "bg-raised text-primary",
			run: onArchive,
		},
		onDelete && { key: "delete", label: "Delete", cls: "bg-danger text-white", run: onDelete },
	].filter(Boolean) as { key: string; label: string; cls: string; run: () => void }[];
	const OPEN = actions.length * 88;
	const COMMIT = OPEN + 56;

	const close = () => setDx(0);

	return (
		<div className="relative overflow-hidden rounded-xl">
			<div aria-hidden className="absolute inset-y-0 right-0 flex">
				{actions.map((a) => (
					<button
						key={a.key}
						type="button"
						tabIndex={-1}
						onClick={() => {
							close();
							a.run();
						}}
						className={clsx(
							"flex w-[88px] cursor-pointer items-center justify-center font-sans text-[calc(12.5px*var(--ws-fs))] font-semibold transition-opacity",
							a.cls,
							dx < -10 ? "opacity-100" : "opacity-0",
						)}
					>
						{a.label}
					</button>
				))}
			</div>
			<div
				style={{
					transform: `translateX(${dx}px)`,
					transition:
						startX.current === null ? "transform 200ms var(--ws-ease)" : "none",
				}}
				onTouchStart={(e) => {
					startX.current = e.touches[0].clientX - dx;
					startY.current = e.touches[0].clientY;
					committed.current = false;
				}}
				onTouchMove={(e) => {
					if (startX.current === null) return;
					const ddx = e.touches[0].clientX - startX.current;
					const ddy = Math.abs(e.touches[0].clientY - (startY.current ?? 0));
					// Vertical intent scrolls the list; only a clearly
					// horizontal drag becomes the gesture.
					if (ddy > 30) {
						startX.current = null;
						setDx(0);
						return;
					}
					// Rubber band past the open width so the commit has a feel.
					setDx(Math.min(0, ddx > 0 ? 0 : Math.max(ddx, -COMMIT - 24)));
				}}
				onTouchEnd={() => {
					startX.current = null;
					startY.current = null;
					if (dx <= -COMMIT) {
						committed.current = true;
						setDx(0);
						actions[0].run();
						return;
					}
					// Park open past half, otherwise spring shut.
					setDx(dx <= -OPEN / 2 ? -OPEN : 0);
				}}
			>
				{children}
			</div>
		</div>
	);
}
