"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useSetAtom } from "jotai";

import {
	followUserAction,
	getProfileByUsernameAction,
} from "@/lib/user.actions";
import { UserBadges } from "@/components/ui/UserBadges";
import { followingIdsAtom } from "@/store/ui.atom";
import { useT } from "@/i18n/client";
import { formatCompact } from "@/lib/utils";
import { SafeAvatar } from "@/components/ui/SafeAvatar";
import { overlayPanelClass } from "@/components/ui/Overlay";

/**
 * Glass profile preview on hovering an @handle.
 *
 * Wears the overlay grammar's panel — `overlayPanelClass`, so it is the same
 * theme-following frost at the same radius as every other floating surface —
 * but deliberately takes NOTHING else from it. A hover card is not a modal:
 * a dismissing scrim would swallow the pointer the instant the card appeared,
 * and a body scroll lock would freeze the page under a preview you never
 * asked to open. `useOverlayDismiss` and `OverlayScrim` are therefore absent
 * on purpose; the hover-intent timers below are the whole dismissal story.
 *
 * Ink and fills come from theme tokens rather than the fixed-white `glass-*`
 * family: `glass-frost` follows the theme, so white ink vanishes on the light
 * panel. The only fixed-white left is the banner scrim, which sits on artwork.
 *
 * Wraps its children (the mention chip); after a short hover intent delay it
 * fetches the profile once (module cache — every later hover anywhere in the
 * session is instant) and floats a card near the chip: banner, avatar, name +
 * badges, bio, follower counts, Follow. Fixed-position portal so it can never
 * be clipped by a card's overflow, flipping above the chip when the viewport
 * bottom is close. Hover-only by nature — touch devices never fire it, and
 * tapping the chip still navigates.
 */

interface HoverProfile {
	_id: string;
	userId: string;
	username: string;
	firstName?: string;
	lastName?: string;
	avatar?: string;
	banner?: string;
	bio?: string;
	isVerified?: boolean;
	verification?: { tier?: "bronze" | "silver" | "gold" } | null;
	badges?: { type: "wolf"; tier?: string }[];
	followersCount: number;
	followingCount: number;
	isFollowing?: boolean;
}

const cache = new Map<string, Promise<HoverProfile | null>>();

/**
 * Correct the session cache in place after an action changed the truth.
 *
 * The cache is what makes the second hover instant; it is also what made an
 * align look like it had failed, because it kept handing back the profile as
 * it was BEFORE you aligned.
 */
function patchCachedProfile(username: string, patch: Partial<HoverProfile>) {
	const key = username.toLowerCase();
	const entry = cache.get(key);
	if (!entry) return;
	cache.set(
		key,
		entry.then((p) => (p ? { ...p, ...patch } : p)),
	);
}

function fetchProfile(username: string): Promise<HoverProfile | null> {
	const key = username.toLowerCase();
	const hit = cache.get(key);
	if (hit) return hit;
	const pending = getProfileByUsernameAction(username)
		.then((res) => (res.success ? (res.data as HoverProfile) : null))
		.catch(() => null);
	cache.set(key, pending);
	return pending;
}

const OPEN_DELAY = 420;
const CLOSE_DELAY = 200;
const CARD_W = 300;
const CARD_EST_H = 260;

export function ProfileHoverCard({
	username,
	children,
}: {
	username: string;
	children: React.ReactNode;
}) {
	const [open, setOpen] = useState(false);
	const [profile, setProfile] = useState<HoverProfile | null>(null);
	const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
	const t = useT();
	const [following, setFollowing] = useState(false);
	const setFollowedIds = useSetAtom(followingIdsAtom);
	const [busy, setBusy] = useState(false);
	const anchorRef = useRef<HTMLSpanElement>(null);
	const timers = useRef<{ open?: number; close?: number }>({});

	const place = () => {
		const rect = anchorRef.current?.getBoundingClientRect();
		if (!rect) return;
		const left = Math.min(
			Math.max(8, rect.left),
			window.innerWidth - CARD_W - 8,
		);
		const below = rect.bottom + 8;
		const top =
			below + CARD_EST_H > window.innerHeight
				? Math.max(8, rect.top - CARD_EST_H - 8)
				: below;
		setPos({ top, left });
	};

	const scheduleOpen = () => {
		window.clearTimeout(timers.current.close);
		timers.current.open = window.setTimeout(async () => {
			const data = await fetchProfile(username);
			if (!data) return;
			setProfile(data);
			setFollowing(Boolean(data.isFollowing));
			place();
			setOpen(true);
		}, OPEN_DELAY);
	};

	const scheduleClose = () => {
		window.clearTimeout(timers.current.open);
		timers.current.close = window.setTimeout(() => setOpen(false), CLOSE_DELAY);
	};

	useEffect(
		() => () => {
			window.clearTimeout(timers.current.open);
			window.clearTimeout(timers.current.close);
		},
		[],
	);

	const handleFollow = async (e: React.MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
		if (!profile || busy) return;
		setBusy(true);
		setFollowing(true);
		const res = await followUserAction(profile._id);
		if (res.success) {
			// The profile fetch is module-cached for the whole session, so
			// without this the NEXT hover re-read a stale `isFollowing:false`
			// and the button flipped back to "Align" — the align looked like
			// it had failed when it had not. Patch the cache we just made
			// wrong, and remember it in the shared atom the rest of the app
			// reads.
			patchCachedProfile(profile.username, { isFollowing: true });
			setFollowedIds((prev: string[]) =>
				prev.includes(profile._id) ? prev : [...prev, profile._id],
			);
		} else {
			setFollowing(false);
		}
		setBusy(false);
	};

	const name = profile
		? [profile.firstName, profile.lastName].filter(Boolean).join(" ") ||
			`@${profile.username}`
		: "";

	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: hover-intent wrapper around a real link; it adds a pointer-only preview and removes no keyboard or screen-reader path
		<span
			ref={anchorRef}
			onMouseEnter={scheduleOpen}
			onMouseLeave={scheduleClose}
			className="inline-flex"
		>
			{children}
			{open &&
				profile &&
				pos &&
				createPortal(
					// biome-ignore lint/a11y/noStaticElementInteractions: hover grace zone for a pointer-only affordance; all actions inside are real buttons/links
					<div
						onMouseEnter={() => window.clearTimeout(timers.current.close)}
						onMouseLeave={scheduleClose}
						style={{ top: pos.top, left: pos.left, width: CARD_W }}
						/* z-dropdown, not z-modal: nothing dismisses this, so it must
						   never outrank a real overlay that does. */
						className={`${overlayPanelClass} fixed z-dropdown rounded-xl animate-rise`}
					>
						{/* Banner well. Without a banner this is a gold wash rather
						    than dead space — a brand moment, never a gold fill. */}
						<div className="relative h-16 w-full overflow-hidden">
							{profile.banner ? (
								<>
									<Image
										src={profile.banner}
										alt=""
										fill
										className="object-cover opacity-80"
									/>
									<span className="absolute inset-0 bg-gradient-to-b from-transparent to-black/45" />
								</>
							) : (
								<span className="absolute inset-0 bg-gradient-to-br from-brand/25 via-brand/[0.06] to-transparent" />
							)}
						</div>

						<div className="px-4 pb-4">
							<div className="-mt-8 flex items-end justify-between">
								<Link
									href={`/profile/${profile.username}`}
									className="relative block h-16 w-16 overflow-hidden rounded-pill bg-raised ring-2 ring-page"
								>
									<SafeAvatar src={profile.avatar} className="object-cover" />
								</Link>
								{!following ? (
									<button
										type="button"
										onClick={handleFollow}
										disabled={busy}
										/* Follow is a REPEATED action, so it takes the
										   bg-primary/text-page pattern the rest of the app
										   uses for it — gold stays reserved for the one
										   primary CTA on a surface. */
										className="h-9 shrink-0 cursor-pointer rounded-pill bg-primary px-4 font-sans text-[13px] font-semibold text-page transition-colors hover:bg-muted disabled:opacity-60"
									>
										{t("profile.follow")}
									</button>
								) : (
									<span className="h-9 shrink-0 rounded-pill bg-chip px-4 font-sans text-[13px] font-semibold leading-9 text-primary">
										{t("profile.followingState")}
									</span>
								)}
							</div>

							<Link
								href={`/profile/${profile.username}`}
								className="mt-2.5 block min-w-0"
							>
								<span className="flex min-w-0 items-center gap-1">
									<span className="truncate font-sans text-[15px] font-bold text-primary hover:underline">
										{name}
									</span>
									<UserBadges
										isVerified={profile.isVerified}
										verification={profile.verification}
										badges={profile.badges as never}
										size={14}
									/>
								</span>
								<span className="block truncate font-sans text-[13px] text-muted">
									@{profile.username}
								</span>
							</Link>

							{profile.bio && (
								<p className="mt-2 line-clamp-2 font-sans text-[13px] leading-snug text-primary opacity-90">
									{profile.bio}
								</p>
							)}

							<div className="mt-3 flex gap-4 border-t border-hairline pt-2.5 font-sans text-[13px]">
								<span className="tabular-nums text-muted">
									<strong className="font-semibold text-primary">
										{formatCompact(profile.followersCount ?? 0)}
									</strong>{" "}
									{t("profile.followers")}
								</span>
								<span className="tabular-nums text-muted">
									<strong className="font-semibold text-primary">
										{formatCompact(profile.followingCount ?? 0)}
									</strong>{" "}
									{t("profile.following")}
								</span>
							</div>
						</div>
					</div>,
					document.body,
				)}
		</span>
	);
}
