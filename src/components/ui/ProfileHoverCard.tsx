"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { DEFAULT_AVATAR } from "@/const";
import {
	followUserAction,
	getProfileByUsernameAction,
} from "@/lib/user.actions";
import { UserBadges } from "@/components/ui/UserBadges";

/**
 * Glass profile preview on hovering an @handle.
 *
 * Deliberately the same chrome as MentionAutocomplete: both are surfaces that
 * float over the feed off the back of an @, so they read as one family —
 * translucent dark glass, white ink, white CTA. Per the glass contract in
 * globals.css the `glass-*` classes carry colour only; the blur must come from
 * Tailwind's own backdrop utilities at the usage site or the compiled CSS
 * silently drops it.
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
	badges?: { type: "wolf"; tier?: string }[];
	followersCount: number;
	followingCount: number;
	isFollowing?: boolean;
}

const cache = new Map<string, Promise<HoverProfile | null>>();

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
	const [following, setFollowing] = useState(false);
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
		if (!res.success) setFollowing(false);
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
						className="glass-panel fixed z-dropdown overflow-hidden shadow-[0_24px_60px_-20px_rgb(0_0_0/0.75)] ring-1 ring-white/10 backdrop-blur-2xl backdrop-saturate-150 animate-rise"
					>
						{/* Top sheen — the light-from-above cue that makes glass read
						    as a pane rather than a flat translucent box. */}
						<span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/20" />

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
									className="relative block h-16 w-16 overflow-hidden rounded-pill bg-black/40 ring-2 ring-white/20"
								>
									<Image
										src={profile.avatar || DEFAULT_AVATAR}
										alt=""
										fill
										className="object-cover"
									/>
								</Link>
								{!following ? (
									<button
										type="button"
										onClick={handleFollow}
										disabled={busy}
										className="glass-cta h-9 shrink-0 cursor-pointer rounded-pill px-4 font-sans text-[13px] font-semibold transition-colors disabled:opacity-60"
									>
										Follow
									</button>
								) : (
									<span className="glass-chip h-9 shrink-0 rounded-pill px-4 font-sans text-[13px] font-semibold leading-9">
										Following
									</span>
								)}
							</div>

							<Link
								href={`/profile/${profile.username}`}
								className="mt-2.5 block min-w-0"
							>
								<span className="flex min-w-0 items-center gap-1">
									<span className="glass-ink truncate font-sans text-[15px] font-bold hover:underline">
										{name}
									</span>
									<UserBadges
										isVerified={profile.isVerified}
										badges={profile.badges as never}
										size={14}
									/>
								</span>
								<span className="glass-ink-dim block truncate font-sans text-[13px]">
									@{profile.username}
								</span>
							</Link>

							{profile.bio && (
								<p className="glass-ink mt-2 line-clamp-2 font-sans text-[13px] leading-snug opacity-90">
									{profile.bio}
								</p>
							)}

							<div className="glass-divider mt-3 flex gap-4 border-t pt-2.5 font-sans text-[13px]">
								<span className="glass-ink-dim tabular-nums">
									<strong className="glass-ink font-semibold">
										{profile.followingCount ?? 0}
									</strong>{" "}
									Following
								</span>
								<span className="glass-ink-dim tabular-nums">
									<strong className="glass-ink font-semibold">
										{profile.followersCount ?? 0}
									</strong>{" "}
									Followers
								</span>
							</div>
						</div>
					</div>,
					document.body,
				)}
		</span>
	);
}
