"use client";

import Link from "next/link";
import { Users } from "lucide-react";

export interface GroupInviteCard {
	conversation: string;
	name?: string;
	avatar?: string;
	memberCount: number;
	code: string;
}

/**
 * A group invite in a bubble (audit G52): the group's face, name and
 * size, and one action that opens the link page, where the person sees
 * the safe preview and decides. Same grammar as the shared-contact card.
 */
export function GroupInviteBubble({
	card,
	isMe,
	accentBg,
	accentInk,
}: {
	card: GroupInviteCard;
	isMe: boolean;
	/** The bubble's action wash and ink, so the card matches its bubble. */
	accentBg: string;
	accentInk: string;
}) {
	return (
		<div className="w-[248px] max-w-full">
			<div className="flex items-center gap-3 py-0.5">
				<span
					className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-pill"
					style={{ background: accentBg }}
				>
					{card.avatar ? (
						// eslint-disable-next-line @next/next/no-img-element
						<img src={card.avatar} alt="" className="h-full w-full object-cover" />
					) : (
						<Users className="h-5 w-5" />
					)}
				</span>
				<span className="min-w-0 flex-1">
					<span className="block truncate font-sans text-[calc(14px*var(--ws-fs))] font-semibold">
						{card.name ?? "Group"}
					</span>
					<span className="block truncate font-sans text-[calc(12.5px*var(--ws-fs))] opacity-75">
						Group invite · {card.memberCount} {card.memberCount === 1 ? "member" : "members"}
					</span>
				</span>
			</div>
			<Link
				href={`/join/${card.code}`}
				onClick={(e) => e.stopPropagation()}
				className="mt-2.5 flex h-9 w-full items-center justify-center rounded-pill font-sans text-[calc(13px*var(--ws-fs))] font-semibold transition-opacity hover:opacity-85"
				style={{ background: accentBg, color: isMe ? "inherit" : accentInk }}
			>
				{isMe ? "View group" : "Join group"}
			</Link>
		</div>
	);
}
