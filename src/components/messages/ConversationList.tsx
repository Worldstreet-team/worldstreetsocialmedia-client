"use client";

import clsx from "clsx";
import { useMemo } from "react";
import {
	Camera,
	MicrophoneStage,
	PaperclipHorizontal,
	PhoneCall,
	VideoCamera,
} from "@phosphor-icons/react";

import { Badge } from "@/components/ui/Badge";
import { SafeAvatar } from "@/components/ui/SafeAvatar";
import { UserBadges } from "@/components/ui/UserBadges";
import { useT } from "@/i18n/client";
import { formatTimeAgo } from "@/lib/utils";

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
		sender?: string | { _id?: string };
	};
	/** Not sent by the gateway today — see `rowTime`. Kept for callers. */
	lastMessageAt?: string;
	updatedAt?: string;
	unreadCount: number;
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
};

export function ConversationList({
	conversations,
	loading,
	query,
	activeId,
	myProfileId,
	onOpen,
}: {
	conversations: ConversationRow[];
	loading: boolean;
	query: string;
	activeId?: string | null;
	myProfileId?: string | null;
	onOpen: (conv: ConversationRow) => void;
}) {
	const t = useT();

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
						<span className="skeleton h-12 w-12 shrink-0 rounded-pill" />
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
					<button
						key={conv._id}
						type="button"
						onClick={() => onOpen(conv)}
						aria-current={active ? "true" : undefined}
						className={clsx(
							"group relative flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left transition-colors",
							active ? "bg-raised" : "hover:bg-surface",
						)}
					>
						{/* The active marker is a rail, not a full border: a border on
						    every row turned the list into a ledger. */}
						<span
							aria-hidden
							className={clsx(
								"absolute left-0 top-1/2 h-8 w-[3px] -translate-y-1/2 rounded-r-pill bg-brand transition-opacity",
								active ? "opacity-100" : "opacity-0",
							)}
						/>

						<span className="relative shrink-0">
							<span className="relative block h-12 w-12 overflow-hidden rounded-pill bg-raised">
								<SafeAvatar src={u.avatar} />
							</span>
							<Badge
								count={conv.unreadCount}
								ring
								className="absolute -right-1 -top-1"
							/>
						</span>

						<span className="min-w-0 flex-1">
							<span className="flex items-center gap-1.5">
								<span
									className={clsx(
										"truncate font-sans text-[14.5px]",
										unread
											? "font-bold text-primary"
											: "font-semibold text-primary",
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
								<span className="ml-auto shrink-0 font-sans text-[11.5px] tabular-nums text-subtle">
									{rowTime(conv) ? formatTimeAgo(rowTime(conv) as string) : ""}
								</span>
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
										? t(kind.key)
										: conv.lastMessage?.content || t("messages.noMessages")}
								</span>
							</span>
						</span>
					</button>
				);
			})}
		</div>
	);
}
