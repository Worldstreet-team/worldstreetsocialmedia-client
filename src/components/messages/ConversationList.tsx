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
	people,
	onOpenPerson,
	heading,
}: {
	conversations: ConversationRow[];
	loading: boolean;
	query: string;
	activeId?: string | null;
	myProfileId?: string | null;
	onOpen: (conv: ConversationRow) => void;
	/** Swipe a row left (touch) to reveal it, or use the requests chips. */
	onDelete?: (conv: ConversationRow) => void;
	/** Everyone who may appear in the online rail beyond your threads: your
	 *  Allies and the people you are Aligned to. */
	people?: ConversationRowUser[];
	/** Tap on someone in the rail you have no thread with yet. */
	onOpenPerson?: (u: ConversationRowUser) => void;
	/** Names the list of rows ("Chats"), styled like "Online now". */
	heading?: string;
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
		return (
			<p className="px-6 py-10 text-center font-sans text-[calc(15px*var(--ws-fs))] text-subtle">
				{query.trim() ? t("messages.noMatches") : t("messages.empty")}
			</p>
		);
	}

	return (
		<div className="flex flex-col px-2">
			{onlineNow.length > 0 && (
				<section aria-label={t("messages.onlineNow")} className="mb-2 rounded-2xl px-1 pb-2 pt-3 md:bg-brand/[0.06]">
					<p className="mb-1.5 px-1 font-sans text-[calc(13px*var(--ws-fs))] font-semibold text-primary">
						{t("messages.onlineNow")}
					</p>
					<div className="flex gap-1 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
						{onlineNow.map(({ key, user: peer, conv }) => {
							const first = (peer.firstName || peer.username || "").split(" ")[0];
							return (
								<button
									key={key}
									type="button"
									onClick={() => (conv ? onOpen(conv) : onOpenPerson?.(peer))}
									className="flex w-[72px] shrink-0 cursor-pointer flex-col items-center gap-1.5 rounded-[10px] py-1 text-center transition-colors hover:bg-primary/5"
								>
									<span className="relative">
										<span className="relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-pill bg-raised">
											<SafeAvatar src={peer.avatar} />
										</span>
										<span
											aria-hidden
											className="ws-cue-online absolute bottom-0.5 right-0.5 h-3.5 w-3.5 rounded-pill bg-success ring-2 ring-page"
										/>
									</span>
									<span className="w-full truncate font-sans text-[calc(12px*var(--ws-fs))] font-medium text-primary">
										{first}
									</span>
								</button>
							);
						})}
					</div>
				</section>
			)}
			{onlineNow.length > 0 && rows.length > 0 && <InboxThumb />}
			<div className="flex flex-col rounded-2xl pb-2 md:bg-brand/[0.06]">
			{heading && rows.length > 0 && !query.trim() && (
				<p className="mb-1.5 mt-1 px-2 font-sans text-[calc(13px*var(--ws-fs))] font-semibold text-primary">
					{heading}
				</p>
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
									className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-pill bg-success ring-2 ring-page ws-cue-online"
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
}: {
	children: React.ReactNode;
	onDelete?: () => void;
}) {
	const [dx, setDx] = useState(0);
	const startX = useRef<number | null>(null);
	const startY = useRef<number | null>(null);

	if (!onDelete) return <>{children}</>;

	return (
		<div className="relative overflow-hidden rounded-xl">
			<div
				aria-hidden
				className={clsx(
					"absolute inset-y-0 right-0 flex w-24 items-center justify-center bg-danger transition-opacity",
					dx < -10 ? "opacity-100" : "opacity-0",
				)}
			>
				<span className="font-sans text-[calc(12.5px*var(--ws-fs))] font-semibold text-white">
					Delete
				</span>
			</div>
			<div
				style={{
					transform: `translateX(${dx}px)`,
					transition: startX.current === null ? "transform 200ms var(--ws-ease)" : "none",
				}}
				onTouchStart={(e) => {
					startX.current = e.touches[0].clientX;
					startY.current = e.touches[0].clientY;
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
					if (ddx < 0) setDx(Math.max(ddx, -110));
				}}
				onTouchEnd={() => {
					if (dx < -80) onDelete();
					startX.current = null;
					startY.current = null;
					setDx(0);
				}}
			>
				{children}
			</div>
		</div>
	);
}
