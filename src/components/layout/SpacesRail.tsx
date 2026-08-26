"use client";

import clsx from "clsx";
import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { useEffect, useState } from "react";
import VerifiedIcon from "@/assets/icons/VerifiedIcon";
import { SectionHead } from "@/components/layout/SectionHead";
import { SafeAvatar } from "@/components/ui/SafeAvatar";
import { useT } from "@/i18n/client";
import { getSpacesAction } from "@/lib/space.actions";

interface SpaceHost {
	_id?: string;
	username?: string;
	avatar?: string;
	isVerified?: boolean;
	firstName?: string;
	lastName?: string;
}

interface Space {
	id: string;
	title: string;
	status: "scheduled" | "live" | "ended";
	scheduledFor?: string;
	host?: SpaceHost;
	community?: { name?: string; slug?: string } | null;
	membersCount?: number;
}

/* How many of each tier the rail shows before deferring to /voice. Live
   rooms earn more slots than scheduled ones — a room you can join now is
   worth more rail than one you can only diarise. */
const MAX_LIVE = 3;
const MAX_UPCOMING = 2;

/**
 * Three-bar equaliser — the "this is audio, and it is happening" signal that
 * a static dot can't carry. Transform-only (scaleY on a bottom origin), and
 * it flattens to a static meter under prefers-reduced-motion.
 *
 * The loop runs longer than the three UI durations on purpose: those govern
 * state transitions, while ambient loops already sit outside them (the
 * skeleton shimmer is 1.6s, the sidebar shine 5s).
 */
function LiveBars() {
	const reduced = useReducedMotion();
	return (
		<span
			className="flex h-3.5 shrink-0 items-end gap-[2px]"
			aria-hidden="true"
		>
			{[0, 1, 2].map((i) => (
				<motion.span
					key={i}
					className="h-full w-[3px] origin-bottom rounded-pill bg-danger"
					initial={{ scaleY: 0.4 }}
					animate={
						reduced ? { scaleY: 0.5 } : { scaleY: [0.35, 1, 0.5, 0.85, 0.35] }
					}
					transition={
						reduced
							? undefined
							: {
									duration: 1.2,
									repeat: Number.POSITIVE_INFINITY,
									ease: "easeInOut",
									delay: i * 0.16,
								}
					}
				/>
			))}
		</span>
	);
}

/** "in 12m" / "in 3h" / "Tue" — short enough for the rail's right edge. */
function startsIn(iso?: string): string | null {
	if (!iso) return null;
	const ms = new Date(iso).getTime() - Date.now();
	if (!Number.isFinite(ms)) return null;
	if (ms <= 0) return "now";
	const mins = Math.round(ms / 60000);
	if (mins < 60) return `in ${mins}m`;
	const hours = Math.round(mins / 60);
	if (hours < 24) return `in ${hours}h`;
	return new Date(iso).toLocaleDateString(undefined, { weekday: "short" });
}

function hostName(host?: SpaceHost) {
	if (host?.username) return `@${host.username}`;
	const full = [host?.firstName, host?.lastName].filter(Boolean).join(" ");
	return full || "";
}

function SpaceRow({ space, live }: { space: Space; live: boolean }) {
	const t = useT();
	const name = hostName(space.host);
	const count = space.membersCount ?? 0;
	const when = startsIn(space.scheduledFor);

	return (
		<Link
			href="/voice"
			className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-surface"
		>
			{/* Ring colour carries the state, exactly like the stories/live rails
			    above — red means joinable now. */}
			<span
				className={clsx(
					"relative h-9 w-9 shrink-0 rounded-pill p-[1.5px]",
					live ? "bg-danger" : "bg-raised",
				)}
			>
				<span className="relative block h-full w-full overflow-hidden rounded-pill border-2 border-page bg-raised">
					<SafeAvatar src={space.host?.avatar} />
				</span>
			</span>

			<span className="flex min-w-0 flex-1 flex-col leading-tight">
				<span className="truncate font-sans text-[13.5px] font-semibold text-primary">
					{space.title}
				</span>
				<span className="flex min-w-0 items-center gap-1 font-sans text-[11.5px] text-muted">
					<span className="truncate">{name}</span>
					{space.host?.isVerified && (
						<VerifiedIcon size={{ width: "11", height: "11" }} />
					)}
					<span className="text-subtle">·</span>
					<span className="shrink-0 tabular-nums">
						{live
							? `${count} ${t("rail.spaces.listening")}`
							: `${count} ${t("rail.spaces.going")}`}
					</span>
				</span>
			</span>

			{live ? (
				<LiveBars />
			) : (
				when && (
					<span className="shrink-0 rounded-pill bg-raised px-2 py-0.5 font-sans text-[11px] text-muted tabular-nums">
						{when}
					</span>
				)
			)}
		</Link>
	);
}

/**
 * Street Voice in the right rail: live audio rooms first, then what's
 * scheduled next. Sits directly under Live now so everything happening
 * right now is one block of the column, and borrows that section's
 * grammar — same eyebrow, same ringed avatar, same row hover — so it reads
 * as part of the rail rather than a widget bolted on.
 *
 * Absent entirely when there is nothing live and nothing scheduled; an
 * empty section is worse than no section.
 */
export function SpacesRail({ delay = 210 }: { delay?: number }) {
	const t = useT();
	const [live, setLive] = useState<Space[]>([]);
	const [upcoming, setUpcoming] = useState<Space[]>([]);

	useEffect(() => {
		let cancelled = false;
		(async () => {
			const res = await getSpacesAction();
			if (cancelled || !res.success) return;
			setLive((res.live ?? []).slice(0, MAX_LIVE));
			setUpcoming((res.upcoming ?? []).slice(0, MAX_UPCOMING));
		})();
		return () => {
			cancelled = true;
		};
	}, []);

	if (live.length === 0 && upcoming.length === 0) return null;

	return (
		<section className="animate-rise" style={{ animationDelay: `${delay}ms` }}>
			<SectionHead
				label={t("rail.spaces")}
				live={live.length > 0}
				trailing={
					<Link
						href="/voice"
						className="font-sans text-[11px] font-semibold text-gold hover:underline"
					>
						{t("rail.seeAll")}
					</Link>
				}
			/>
			<div className="flex flex-col">
				{live.map((space) => (
					<SpaceRow key={space.id} space={space} live />
				))}
				{upcoming.map((space) => (
					<SpaceRow key={space.id} space={space} live={false} />
				))}
			</div>
		</section>
	);
}
