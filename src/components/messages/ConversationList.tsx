"use client";

import clsx from "clsx";
import { useMemo, useState, useRef } from "react";
import { useAtomValue } from "jotai";
import {
	Camera,
	MicrophoneStage,
	PaperclipHorizontal,
	CurrencyDollarSimple,
	PhoneCall,
	VideoCamera,
} from "@phosphor-icons/react";

import { Badge } from "@/components/ui/Badge";
import { SafeAvatar } from "@/components/ui/SafeAvatar";
import { UserBadges } from "@/components/ui/UserBadges";
import { useT } from "@/i18n/client";
import { formatTimeAgo } from "@/lib/utils";
import { onlineIdsAtom } from "@/store/ui.atom";

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
	otherParticipant: ConversationRowUser;
	lastMessage?: {
		content?: string;
		type?: string;
		createdAt?: string;
		durationSec?: number;
		sender?: string | { _id?: string };
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
	audio: { glyph: MicrophoneStage, key: "messages.kind.voice" },
	image: { glyph: Camera, key: "messages.kind.photo" },
	video: { glyph: VideoCamera, key: "messages.kind.video" },
	file: { glyph: PaperclipHorizontal, key: "messages.kind.file" },
	call: { glyph: PhoneCall, key: "messages.kind.call" },
	// A transfer carries no content either when there is no note.
	payment: { glyph: CurrencyDollarSimple, key: "messages.kind.payment" },
};

export function ConversationList({
	conversations,
	loading,
	query,
	activeId,
	myProfileId,
	onOpen,
	onDelete,
}: {
	conversations: ConversationRow[];
	loading: boolean;
	query: string;
	activeId?: string | null;
	myProfileId?: string | null;
	onOpen: (conv: ConversationRow) => void;
	/** Swipe a row left (touch) to reveal it, or use the requests chips. */
	onDelete?: (conv: ConversationRow) => void;
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
			const u = c.otherParticipant;
			return (
				displayName(u).toLowerCase().includes(q) ||
				(u.username ?? "").toLowerCase().includes(q) ||
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
			const n = displayName(c.otherParticipant).toLowerCase();
			seen.set(n, (seen.get(n) ?? 0) + 1);
		}
		return seen;
	}, [rows]);

	if (loading) {
		return (
			<div className="flex flex-col">
				{[0, 1, 2, 3, 4].map((i) => (
					<div key={i} className="flex items-center gap-3 px-4 py-3.5">
						<span className="skeleton h-14 w-14 shrink-0 rounded-pill" />
						<span className="flex min-w-0 flex-1 flex-col gap-2">
							<span className="skeleton h-3.5 w-1/3 rounded-[4px]" />
							<span className="skeleton h-3 w-2/3 rounded-[4px]" />
						</span>
					</div>
				))}
			</div>
		);
	}

	if (rows.length === 0) {
		return (
			<p className="px-6 py-10 text-center font-sans text-[13px] text-subtle">
				{query.trim() ? t("messages.noMatches") : t("messages.empty")}
			</p>
		);
	}

	return (
		<div className="flex flex-col">
			{rows.map((conv) => {
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
							"group relative flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left transition-colors",
							active ? "bg-raised" : "hover:bg-surface",
						)}
					>
						<span className="relative shrink-0">
							<span className="relative block h-14 w-14 overflow-hidden rounded-pill bg-raised">
								<SafeAvatar src={u.avatar} />
							</span>
							{/* Ringed in the page colour so the dot reads as ON the
							    avatar rather than floating beside it. */}
							{online.has(u._id) && (
								<span
									aria-label="Online"
									className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-pill bg-success ring-2 ring-page"
								/>
							)}
						</span>

						<span className="min-w-0 flex-1">
							<span className="flex items-center gap-1.5">
								<span
									className={clsx(
										"truncate font-sans text-[15px]",
										unread
											? "font-semibold text-primary"
											: "font-medium text-primary",
									)}
								>
									{displayName(u)}
								</span>
								<UserBadges
									isVerified={u.isVerified}
									verification={u.verification}
									badges={u.badges}
									size={13}
								/>
								{(ambiguous.get(displayName(u).toLowerCase()) ?? 0) > 1 &&
									u.username && (
										<span className="min-w-0 shrink truncate font-sans text-[12px] text-subtle">
											@{u.username}
										</span>
									)}
							</span>

							<span
								className={clsx(
									"mt-0.5 flex items-center gap-1 font-sans text-[13px]",
									unread ? "font-medium text-primary" : "text-muted",
								)}
							>
								{mine && (
									<span className="shrink-0 text-subtle">
										{t("messages.you")}
									</span>
								)}
								{Glyph && (
									<Glyph size={13} weight="fill" className="shrink-0 text-subtle" />
								)}
								<span className="truncate">
									{kind
										? conv.lastMessage?.type === "audio" &&
											conv.lastMessage?.durationSec
											? `${Math.floor(conv.lastMessage.durationSec / 60)}:${String(conv.lastMessage.durationSec % 60).padStart(2, "0")}`
											: t(kind.key)
										: conv.lastMessage?.content || t("messages.noMessages")}
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
								{unread && (
									<span className="h-2 w-2 rounded-pill bg-brand" />
								)}
								<Badge count={conv.unreadCount} />
							</span>
						)}
					</button>
					</SwipeRow>
				);
			})}
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
		<div className="relative overflow-hidden">
			<div
				aria-hidden
				className={clsx(
					"absolute inset-y-0 right-0 flex w-24 items-center justify-center bg-danger transition-opacity",
					dx < -10 ? "opacity-100" : "opacity-0",
				)}
			>
				<span className="font-sans text-[12.5px] font-semibold text-white">
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
