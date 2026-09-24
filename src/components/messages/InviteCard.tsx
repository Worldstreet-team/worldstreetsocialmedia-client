"use client";

import { Loader2, Users } from "lucide-react";
import { SafeAvatar } from "@/components/ui/SafeAvatar";
import { displayNameOf } from "@/lib/conversation-identity";

/** "in 2 days", "in 5 hours", "soon". */
export function invitesEndsIn(expiresAt?: string): string {
	if (!expiresAt) return "";
	const ms = new Date(expiresAt).getTime() - Date.now();
	if (ms <= 0) return "This invite has lapsed";
	const h = Math.round(ms / 3600_000);
	if (h >= 36) return `Invite ends in ${Math.round(h / 24)} days`;
	if (h >= 2) return `Invite ends in ${h} hours`;
	return "Invite ends soon";
}

/**
 * A group invite, opened from the Requests shelf (audit G34): the group's
 * name and photo, who invited you, how many are in it, and the two
 * answers. Nothing from the room shows until you join; the gateway sends
 * an empty thread to an invitee on purpose.
 */
export function InviteCard({
	name,
	avatar,
	memberCount,
	invitedBy,
	expiresAt,
	busy,
	onJoin,
	onDecline,
}: {
	name: string;
	avatar?: string;
	memberCount?: number;
	invitedBy?: { firstName?: string; lastName?: string; username?: string; avatar?: string } | string;
	expiresAt?: string;
	busy: boolean;
	onJoin: () => void;
	onDecline: () => void;
}) {
	const who = typeof invitedBy === "object" && invitedBy ? displayNameOf(invitedBy) : "Someone";
	return (
		<div className="flex flex-1 flex-col items-center justify-center px-6 py-10 text-center">
			<span className="relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-pill bg-raised">
				{avatar ? <SafeAvatar src={avatar} eager /> : <Users className="h-8 w-8 text-muted" />}
			</span>
			<h3 className="mt-4 font-display text-[calc(20px*var(--ws-fs))] font-semibold text-primary">
				{name}
			</h3>
			<p className="mt-1 font-sans text-[calc(14px*var(--ws-fs))] text-muted">
				{who} invited you
				{typeof memberCount === "number" && memberCount > 0
					? ` · ${memberCount} ${memberCount === 1 ? "member" : "members"}`
					: ""}
			</p>
			{expiresAt && (
				<p className="mt-1 font-sans text-[calc(13px*var(--ws-fs))] text-subtle">
					{invitesEndsIn(expiresAt)}
				</p>
			)}
			<div className="mt-6 flex w-full max-w-[320px] flex-col gap-2">
				<button
					type="button"
					onClick={onJoin}
					disabled={busy}
					className="flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-pill bg-brand font-sans text-[calc(14px*var(--ws-fs))] font-semibold text-brand-on transition-colors hover:bg-brand-active disabled:opacity-50"
				>
					{busy && <Loader2 className="h-4 w-4 animate-spin" />}
					Join group
				</button>
				<button
					type="button"
					onClick={onDecline}
					disabled={busy}
					className="flex h-11 w-full cursor-pointer items-center justify-center rounded-pill bg-primary/5 font-sans text-[calc(14px*var(--ws-fs))] font-semibold text-primary transition-colors hover:bg-primary/10 disabled:opacity-50"
				>
					Decline
				</button>
			</div>
			<p className="mt-4 max-w-[320px] font-sans text-[calc(12px*var(--ws-fs))] text-subtle">
				Declining is quiet. Nobody is told.
			</p>
		</div>
	);
}
