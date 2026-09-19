"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useAtomValue } from "jotai";
import {
	RiPhoneLine,
	RiUserLine,
	RiVidiconLine,
} from "@remixicon/react";
import { SafeAvatar } from "@/components/ui/SafeAvatar";
import { UserBadges } from "@/components/ui/UserBadges";
import { useT } from "@/i18n/client";
import { onlineIdsAtom } from "@/store/ui.atom";
import type {
	ConversationRow,
	ConversationRowUser,
} from "@/components/messages/ConversationList";
import { conversationIdentity } from "@/lib/conversation-identity";

interface RailMedia {
	url: string;
	type: "image" | "video";
	id: string;
}

/**
 * The third column on a wide desktop (owner 2026-09-19).
 *
 * It answers "who am I talking to, and what have we sent each other" without
 * opening anything: the face and handle, call and profile in reach, and the
 * pictures and clips of this thread as a grid that opens the same lightbox
 * the bubbles do. With no thread open it is the people rail instead, so an
 * empty inbox pane is not a blank half-screen.
 *
 * Everything here is already in memory — the thread's own messages, the
 * presence set, the allies/aligned list the inbox loads — so the rail costs
 * no request of its own. Below xl the column is not rendered at all; at that
 * width the thread needs the room more than the rail does.
 */
export function ThreadRail({
	conversation,
	media,
	people,
	onOpenMedia,
	onOpenPerson,
	onCall,
}: {
	conversation: ConversationRow | null;
	media: RailMedia[];
	/** Allies and the people you are aligned to, for the no-thread state. */
	people: ConversationRowUser[];
	onOpenMedia: (messageId: string) => void;
	onOpenPerson: (profileId: string) => void;
	onCall: (kind: "audio" | "video") => void;
}) {
	const t = useT();
	const online = useAtomValue(onlineIdsAtom);

	const identity = conversationIdentity(conversation as any);
	const peer = identity.peer;
	const isGroup = identity.kind === "group";
	const isOnline = !!peer?._id && online.has(peer._id);

	// Newest first: the thing you just sent is the thing you look for.
	const recent = useMemo(() => [...media].reverse().slice(0, 9), [media]);

	const onlineNow = useMemo(
		() => people.filter((u) => u?._id && online.has(u._id)).slice(0, 12),
		[people, online],
	);

	const label =
		"px-1 font-sans text-[calc(13px*var(--ws-fs))] font-semibold text-primary";

	if (!conversation) {
		return (
			<aside
				aria-label={t("messages.onlineNow")}
				className="hidden w-[300px] shrink-0 flex-col gap-3 overflow-y-auto border-l border-hairline bg-page px-4 py-5 xl:flex"
			>
				<p className={label}>{t("messages.onlineNow")}</p>
				{onlineNow.length === 0 ? (
					<p className="px-1 font-sans text-[calc(13px*var(--ws-fs))] text-subtle">
						{t("messages.nobodyOnline")}
					</p>
				) : (
					<div className="flex flex-col">
						{onlineNow.map((u) => (
							<button
								key={u._id}
								type="button"
								onClick={() => onOpenPerson(u._id)}
								className="flex w-full cursor-pointer items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-primary/5"
							>
								<span className="relative shrink-0">
									<span className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-pill bg-raised">
										<SafeAvatar src={u.avatar} />
									</span>
									<span
										aria-hidden
										className="ws-cue-online absolute bottom-0 right-0 h-3 w-3 rounded-pill bg-success ring-2 ring-page"
									/>
								</span>
								<span className="min-w-0 flex-1 truncate font-sans text-[calc(14px*var(--ws-fs))] font-medium text-primary">
									{[u.firstName, u.lastName].filter(Boolean).join(" ") ||
										(u.username ? `@${u.username}` : "")}
								</span>
							</button>
						))}
					</div>
				)}
			</aside>
		);
	}

	return (
		<aside
			aria-label={t("messages.details")}
			className="hidden w-[300px] shrink-0 flex-col overflow-y-auto border-l border-hairline bg-page px-4 py-6 xl:flex"
		>
			{/* Who. */}
			<div className="flex flex-col items-center text-center">
				<span className="relative">
					<span className="relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-pill bg-raised">
						<SafeAvatar src={identity.avatar} />
					</span>
					{!isGroup && isOnline && (
						<span
							aria-hidden
							className="ws-cue-online absolute bottom-1 right-1 h-4 w-4 rounded-pill bg-success ring-2 ring-page"
						/>
					)}
				</span>
				<span className="mt-3 flex items-center gap-1.5">
					<span className="truncate font-sans text-[calc(16px*var(--ws-fs))] font-semibold text-primary">
						{identity.title}
					</span>
					{!isGroup && peer && (
						<UserBadges
							isVerified={peer.isVerified}
							verification={peer.verification as any}
							badges={peer.badges as any}
							size={15}
						/>
					)}
				</span>
				<span className="mt-0.5 font-sans text-[calc(13px*var(--ws-fs))] text-muted">
					{isGroup
						? `${identity.memberCount ?? 0} ${t("messages.members")}`
						: peer?.username
							? `@${peer.username}`
							: ""}
				</span>
			</div>

			{/* Reach. A group has no one profile to open, and calls follow the
			    thread, so both are DM-only here. */}
			{!isGroup && peer && (
				<div className="mt-5 grid grid-cols-3 gap-2">
					<button
						type="button"
						onClick={() => onCall("audio")}
						className="flex h-16 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl bg-primary/5 text-primary transition-colors hover:bg-primary/10"
					>
						<RiPhoneLine size={18} />
						<span className="font-sans text-[calc(12px*var(--ws-fs))] font-medium">
							{t("messages.call")}
						</span>
					</button>
					<button
						type="button"
						onClick={() => onCall("video")}
						className="flex h-16 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl bg-primary/5 text-primary transition-colors hover:bg-primary/10"
					>
						<RiVidiconLine size={18} />
						<span className="font-sans text-[calc(12px*var(--ws-fs))] font-medium">
							{t("messages.video")}
						</span>
					</button>
					<Link
						href={`/profile/${peer.username ?? ""}`}
						className="flex h-16 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl bg-primary/5 text-primary transition-colors hover:bg-primary/10"
					>
						<RiUserLine size={18} />
						<span className="font-sans text-[calc(12px*var(--ws-fs))] font-medium">
							{t("messages.profile")}
						</span>
					</Link>
				</div>
			)}

			{/* What you have sent each other. */}
			<div className="mt-7">
				<p className={label}>{t("messages.sharedMedia")}</p>
				{recent.length === 0 ? (
					<p className="mt-2 px-1 font-sans text-[calc(13px*var(--ws-fs))] text-subtle">
						{t("messages.noSharedMedia")}
					</p>
				) : (
					<div className="mt-3 grid grid-cols-3 gap-1.5">
						{recent.map((m) => (
							<button
								key={m.id}
								type="button"
								onClick={() => onOpenMedia(m.id)}
								aria-label={t("messages.openMedia")}
								className="relative aspect-square cursor-pointer overflow-hidden rounded-[10px] bg-raised"
							>
								{m.type === "video" ? (
									// eslint-disable-next-line jsx-a11y/media-has-caption
									<video
										src={`${m.url}#t=0.1`}
										muted
										playsInline
										preload="metadata"
										className="h-full w-full object-cover"
									/>
								) : (
									// eslint-disable-next-line @next/next/no-img-element
									<img
										src={m.url}
										alt=""
										loading="lazy"
										className="h-full w-full object-cover"
									/>
								)}
							</button>
						))}
					</div>
				)}
			</div>
		</aside>
	);
}
