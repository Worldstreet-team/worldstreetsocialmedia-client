"use client";

import { useEffect, useSyncExternalStore } from "react";
import Link from "next/link";
import { SafeAvatar } from "@/components/ui/SafeAvatar";
import VerifiedIcon from "@/assets/icons/VerifiedIcon";
import { ProfileHoverCard } from "@/components/ui/ProfileHoverCard";
import {
	peekHandle,
	requestHandle,
	subscribeMentions,
} from "@/lib/mentionCache";

const stop = (e: React.MouseEvent) => e.stopPropagation();

/**
 * One @handle in a body of text.
 *
 * A mention is typed free-hand, so "@notauser" looks exactly like a real
 * handle until something checks. Until this existed every @word was rendered
 * as a live brand chip, which promised a profile that did not exist and
 * navigated to a 404.
 *
 * Three states:
 *  - unresolved: plain muted text, so nothing flashes as a link and then
 *    demotes itself a moment later
 *  - no such account: plain text, permanently. Not a link, not branded.
 *  - real account: avatar + handle + whatever marks they hold
 */
export function Mention({ handle }: { handle: string }) {
	const profile = useSyncExternalStore(
		subscribeMentions,
		() => peekHandle(handle),
		() => undefined,
	);

	useEffect(() => {
		requestHandle(handle);
	}, [handle]);

	// Unknown or confirmed missing: it is just words.
	if (!profile) {
		return <span className="text-primary/70">@{handle}</span>;
	}

	return (
		<ProfileHoverCard username={profile.username}>
			<Link
				href={`/profile/${profile.username}`}
				onClick={stop}
				className="relative z-10 pointer-events-auto inline-flex items-center gap-1 rounded-pill bg-brand/[0.10] py-px pl-0.5 pr-1.5 align-baseline text-[13px] font-semibold tracking-tight text-gold transition-colors hover:bg-brand/20"
			>
				<span className="relative inline-block h-[15px] w-[15px] shrink-0 overflow-hidden rounded-pill bg-raised align-text-bottom">
					<SafeAvatar src={profile.avatar} />
				</span>
				@{profile.username}
				{profile.isVerified && (
					<VerifiedIcon size={{ width: "12", height: "12" }} tier={profile.tier} />
				)}
			</Link>
		</ProfileHoverCard>
	);
}
