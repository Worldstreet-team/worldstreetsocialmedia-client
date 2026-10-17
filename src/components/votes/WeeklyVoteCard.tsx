"use client";

import Link from "next/link";
import { useAtomValue } from "jotai";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { SafeAvatar } from "@/components/ui/SafeAvatar";
import { UserBadges } from "@/components/ui/UserBadges";
import { VoteBox } from "@/components/votes/VoteBox";
import { getVoteCycle, getVoteLeaderboard, type VoteCycleInfo } from "@/lib/votes";
import { motionReduced } from "@/lib/motion";
import { press } from "@/lib/motion-presets";
import { userAtom } from "@/store/user.atom";

interface BoardRow {
	post: { id: string; content: string };
	author: { id: string; username: string; name: string; avatar?: string; isVerified?: boolean; verification?: any };
	votes: number;
}

/** "2d 14h", "6h 12m", "14m": the two largest units. */
function leftText(ms: number) {
	const m = Math.floor(ms / 60_000);
	const d = Math.floor(m / 1440);
	const h = Math.floor((m % 1440) / 60);
	if (d > 0) return `${d}d ${h}h`;
	if (h > 0) return `${h}h ${m % 60}m`;
	return `${Math.max(1, m)}m`;
}

const n = (v: number) => v.toLocaleString();

/**
 * The Weekly Vote on the right rail, Concept B "Leader preview" (owner pick
 * 2026-10-16, the light check board bM5KB): who is leading and with what,
 * then where YOUR post sits and one button to vote. It trades the ticking
 * clock for what people act on. The ballot box keeps its small drop every
 * few seconds (owner 2026-10-15), never in a hidden tab or reduced motion.
 */
export function WeeklyVoteCard() {
	const me = useAtomValue(userAtom);
	const [cycle, setCycle] = useState<VoteCycleInfo | null>(null);
	const [board, setBoard] = useState<BoardRow[] | null>(null);
	const [now, setNow] = useState(() => Date.now());
	const [open, setOpen] = useState(false);
	const [ballot, setBallot] = useState(0);

	useEffect(() => {
		let alive = true;
		void getVoteCycle().then((c) => alive && setCycle(c));
		void getVoteLeaderboard().then((r: any) => alive && setBoard((r?.board ?? []) as BoardRow[]));
		const id = setInterval(() => {
			if (document.visibilityState !== "hidden") setNow(Date.now());
		}, 60_000);
		return () => {
			alive = false;
			clearInterval(id);
		};
	}, []);

	useEffect(() => {
		let shut = 0;
		const drop = () => {
			if (document.visibilityState === "hidden" || motionReduced()) return;
			setOpen(true);
			setBallot((b) => b + 1);
			shut = window.setTimeout(() => setOpen(false), 1100);
		};
		const first = window.setTimeout(drop, 1500);
		const id = window.setInterval(drop, 7000);
		return () => {
			window.clearTimeout(first);
			window.clearTimeout(shut);
			window.clearInterval(id);
		};
	}, []);

	const left = cycle ? new Date(cycle.endsAt).getTime() - now : null;
	const leader = board?.[0];
	const second = board?.[1];
	const mineAt = board && me?._id ? board.findIndex((r) => r.author.id === me._id) : -1;
	const mine = mineAt >= 0 ? board?.[mineAt] : undefined;
	const tenth = board?.[9];

	let standing: { title: string; line: string };
	if (mine && mineAt < 10) standing = { title: `Your post is #${mineAt + 1}`, line: mineAt === 0 ? "You're leading" : "In the top 10" };
	else if (mine && tenth) standing = { title: `Your post is #${mineAt + 1}`, line: `${n(tenth.votes - mine.votes + 1)} votes from the top 10` };
	else standing = { title: "Not on the board yet", line: "Votes this week put a post here" };

	return (
		<section className="px-1">
			<Link href="/votes" className="flex items-center gap-2 px-2">
				<span className="flex size-5 shrink-0 items-center justify-center text-brand">
					<VoteBox open={open} ballotKey={ballot} size={17} />
				</span>
				<span className="font-sans text-[calc(14px*var(--ws-fs))] font-semibold text-primary">Weekly vote</span>
				<span className="ml-auto truncate font-sans text-[calc(12px*var(--ws-fs))] tabular-nums text-muted">
					{left === null ? "" : left > 0 ? `${leftText(left)} left · up to $200` : "Closed · winner incoming"}
				</span>
			</Link>

			{board === null ? (
				<div className="mt-2.5 flex flex-col gap-3 rounded-[18px] bg-primary/[0.05] p-3.5">
					<span className="skeleton h-9 w-40 rounded-pill" />
					<span className="skeleton h-3.5 w-full rounded-[4px]" />
					<span className="skeleton h-3.5 w-3/4 rounded-[4px]" />
				</div>
			) : leader ? (
				<Link
					href={`/post/${leader.post.id}`}
					className="mt-2.5 flex flex-col gap-2.5 rounded-[18px] bg-primary/[0.05] p-3.5 transition-colors hover:bg-primary/[0.08]"
				>
					<span className="flex min-w-0 items-center gap-2.5">
						<span className="relative h-9 w-9 shrink-0 overflow-hidden rounded-pill bg-raised">
							<SafeAvatar src={leader.author.avatar} />
						</span>
						<span className="flex min-w-0 flex-1 flex-col">
							<span className="flex min-w-0 items-center gap-1">
								<span className="truncate font-sans text-[calc(14px*var(--ws-fs))] font-semibold text-primary">
									{leader.author.name}
								</span>
								<UserBadges isVerified={leader.author.isVerified} verification={leader.author.verification} size={12} />
							</span>
							<span className="truncate font-sans text-[calc(12px*var(--ws-fs))] text-muted">
								Leading · @{leader.author.username}
							</span>
						</span>
						<span className="shrink-0 rounded-pill bg-primary/[0.08] px-2 py-0.5 font-sans text-[calc(11.5px*var(--ws-fs))] font-bold tabular-nums text-primary">
							#1
						</span>
					</span>
					{leader.post.content && (
						<span className="line-clamp-2 font-sans text-[calc(14px*var(--ws-fs))] leading-snug text-primary">
							{leader.post.content}
						</span>
					)}
					<span className="flex items-baseline justify-between gap-2">
						<span className="flex items-baseline gap-1.5">
							<span className="font-display text-[calc(20px*var(--ws-fs))] font-semibold tabular-nums text-primary">
								{n(leader.votes)}
							</span>
							<span className="font-sans text-[calc(12px*var(--ws-fs))] text-muted">votes</span>
						</span>
						{second && (
							<span className="font-sans text-[calc(12px*var(--ws-fs))] tabular-nums text-muted">
								{n(leader.votes - second.votes)} ahead of #2
							</span>
						)}
					</span>
				</Link>
			) : (
				<p className="mt-2.5 rounded-[18px] bg-primary/[0.05] p-3.5 font-sans text-[calc(13.5px*var(--ws-fs))] text-muted">
					No votes yet this week. The first one leads.
				</p>
			)}

			<div className="mt-3 flex items-center gap-3 px-2">
				<span className="flex min-w-0 flex-1 flex-col">
					<span className="truncate font-sans text-[calc(14px*var(--ws-fs))] font-semibold text-primary">{standing.title}</span>
					<span className="truncate font-sans text-[calc(12px*var(--ws-fs))] tabular-nums text-muted">{standing.line}</span>
				</span>
				<motion.span {...press} className="shrink-0">
					<Link
						href="/votes"
						className="flex h-9 items-center rounded-pill bg-brand px-4 font-sans text-[calc(13px*var(--ws-fs))] font-semibold text-brand-on transition-colors hover:bg-brand-active"
					>
						{cycle?.freeAvailable === false ? "Vote" : "Vote free"}
					</Link>
				</motion.span>
			</div>
		</section>
	);
}
