"use client";

import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
	OverlayHeader,
	OverlayPanel,
	OverlayScrim,
	useOverlayDismiss,
} from "@/components/ui/Overlay";
import { useToast } from "@/components/ui/Toast/ToastContext";
import { VoteBox } from "@/components/votes/VoteBox";
import { haptic } from "@/lib/haptics";
import { press, swap } from "@/lib/motion-presets";
import { formatCompact } from "@/lib/utils";
import {
	castVote,
	getVoteCycle,
	getVoteLeaderboard,
	markFreeVoteUsed,
	type VoteCycleInfo,
} from "@/lib/votes";

/**
 * The Weekly Vote on a post: a pill beside the time, and the sheet it opens
 * (owner pick V2, 2026-09-28, from
 * https://claude.ai/artifact/R5uguMNcQHA2t3gQo3E6QE).
 *
 * It replaced the ballot chip that sat on its own row above the media. The
 * pill only says how the post stands; voting happens in the sheet, behind
 * the standing, the close time and the price, so a stray tap in the feed
 * never spends a vote. The ballot box keeps its swing when a vote lands.
 */
export function VotePill({
	postId,
	votes,
	isMine,
}: {
	postId: string;
	votes: number;
	isMine: boolean;
}) {
	const [count, setCount] = useState(votes);
	const [open, setOpen] = useState(false);
	// Voted from this card in this visit. The feed does not say whether the
	// reader has voted for a post before, so the pill claims only what it saw.
	const [votedHere, setVotedHere] = useState(false);

	useEffect(() => setCount(votes), [votes]);

	const label =
		count === 0 ? "Vote" : `${formatCompact(count)} ${count === 1 ? "vote" : "votes"}`;

	return (
		<>
			<button
				type="button"
				data-no-open
				aria-haspopup="dialog"
				aria-label={`${label}. The Weekly Vote`}
				onClick={(e) => {
					e.stopPropagation();
					e.preventDefault();
					setOpen(true);
				}}
				// A 40px target around a 22px pill: the header row already
				// holds the 40px menu button, so the row does not grow.
				className="group pointer-events-auto relative -my-2 flex h-10 shrink-0 cursor-pointer items-center"
			>
				<span
					className={clsx(
						"flex h-[22px] items-center gap-1 rounded-pill pl-1.5 pr-2 font-sans text-[calc(12.5px*var(--ws-fs))] font-semibold tabular-nums transition-colors",
						votedHere
							? "bg-brand/10 text-gold"
							: "bg-primary/5 text-muted group-hover:bg-primary/10 group-hover:text-primary",
					)}
				>
					<VoteBox open={false} size={14} />
					<span className="relative overflow-hidden">
						<AnimatePresence mode="wait" initial={false}>
							<motion.span key={label} {...swap} className="block whitespace-nowrap">
								{label}
							</motion.span>
						</AnimatePresence>
					</span>
				</span>
			</button>
			{open && (
				<VoteSheet
					postId={postId}
					count={count}
					isMine={isMine}
					onClose={() => setOpen(false)}
					onVoted={(next) => {
						setCount(next);
						setVotedHere(true);
					}}
				/>
			)}
		</>
	);
}

function closesIn(endsAt: number, now: number) {
	const ms = Math.max(0, endsAt - now);
	const d = Math.floor(ms / 86_400_000);
	const h = Math.floor((ms % 86_400_000) / 3_600_000);
	const m = Math.floor((ms % 3_600_000) / 60_000);
	if (d > 0) return `${d}d ${String(h).padStart(2, "0")}h`;
	if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
	return `${m}m`;
}

function VoteSheet({
	postId,
	count,
	isMine,
	onClose,
	onVoted,
}: {
	postId: string;
	count: number;
	isMine: boolean;
	onClose: () => void;
	onVoted: (next: number) => void;
}) {
	const { toast } = useToast();
	useOverlayDismiss(true, onClose);
	const [cycle, setCycle] = useState<VoteCycleInfo | null>(null);
	const [rank, setRank] = useState<number | null>(null);
	const [busy, setBusy] = useState(false);
	const [boxOpen, setBoxOpen] = useState(false);
	const [ballotKey, setBallotKey] = useState(0);
	const shutTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const now = Date.now();

	useEffect(() => {
		let alive = true;
		void getVoteCycle().then((c) => alive && setCycle(c));
		void getVoteLeaderboard().then((res: any) => {
			if (!alive) return;
			const i = (res?.board ?? []).findIndex(
				(r: any) => String(r?.post?.id ?? r?.post?._id) === postId,
			);
			setRank(i >= 0 ? i + 1 : null);
		});
		return () => {
			alive = false;
			if (shutTimer.current) clearTimeout(shutTimer.current);
		};
	}, [postId]);

	const cast = useCallback(async () => {
		if (busy || isMine) return;
		setBusy(true);
		haptic(8);
		const res: any = await castVote(postId, 1);
		setBusy(false);
		if (res.success) {
			const d: any = res.data;
			onVoted(d?.votes ?? count + 1);
			setBoxOpen(true);
			setBallotKey((k) => k + 1);
			if (shutTimer.current) clearTimeout(shutTimer.current);
			shutTimer.current = setTimeout(() => setBoxOpen(false), 1100);
			if (d?.freeUsed) {
				markFreeVoteUsed();
				setCycle((c) => (c ? { ...c, freeAvailable: false } : c));
				toast("Your free vote this week is in");
			} else {
				toast("Vote counted");
			}
		} else {
			toast(res.message ?? "That vote didn't count", { type: "error" });
		}
	}, [busy, isMine, postId, count, onVoted, toast]);

	const price = cycle ? `$${(cycle.priceMinor / 100).toFixed(2)}` : null;
	const ends = cycle ? new Date(cycle.endsAt) : null;

	if (typeof document === "undefined") return null;
	return createPortal(
		// The shield keeps taps inside the sheet from reaching the card's
		// own handlers (open the post, double-tap to like).
		<div onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
			<AnimatePresence>
				<OverlayScrim key="s" onClose={onClose} />
				<OverlayPanel key="p" variant="anchored" dragClose={onClose} label="The Weekly Vote">
					<OverlayHeader onClose={onClose}>
						<h2 className="flex flex-1 items-center gap-2 truncate font-display text-[calc(16px*var(--ws-fs))] font-semibold text-primary">
							<VoteBox open={boxOpen} ballotKey={ballotKey} size={20} className="text-gold" />
							The Weekly Vote
						</h2>
					</OverlayHeader>
					<div className="flex flex-col gap-4 px-4 pb-5 pt-1">
						<div className="flex gap-6">
							<div className="flex flex-col gap-0.5">
								<span className="relative overflow-hidden font-display text-[calc(20px*var(--ws-fs))] font-semibold tabular-nums text-primary">
									<AnimatePresence mode="wait" initial={false}>
										<motion.span key={count} {...swap} className="block">
											{formatCompact(count)}
										</motion.span>
									</AnimatePresence>
								</span>
								<span className="font-sans text-[calc(12.5px*var(--ws-fs))] text-muted">
									{count === 1 ? "vote" : "votes"}
								</span>
							</div>
							{rank !== null && (
								<div className="flex flex-col gap-0.5">
									<span className="font-display text-[calc(20px*var(--ws-fs))] font-semibold tabular-nums text-primary">
										#{rank}
									</span>
									<span className="font-sans text-[calc(12.5px*var(--ws-fs))] text-muted">
										this week
									</span>
								</div>
							)}
							{ends && (
								<div className="flex min-w-0 flex-col gap-0.5">
									<span className="font-display text-[calc(20px*var(--ws-fs))] font-semibold tabular-nums text-primary">
										{closesIn(ends.getTime(), now)}
									</span>
									<span className="truncate font-sans text-[calc(12.5px*var(--ws-fs))] text-muted">
										closes{" "}
										{ends.toLocaleString(undefined, {
											weekday: "long",
											hour: "numeric",
											minute: "2-digit",
										})}
									</span>
								</div>
							)}
						</div>
						<motion.button
							{...press}
							type="button"
							onClick={cast}
							disabled={busy || isMine}
							className="flex h-11 w-full cursor-pointer items-center justify-center rounded-pill bg-brand font-sans text-[calc(14px*var(--ws-fs))] font-semibold text-brand-on transition-opacity disabled:cursor-default disabled:opacity-50"
						>
							{isMine ? "You can't vote for your own post" : "Vote for this post"}
						</motion.button>
						<p className="-mt-1 font-sans text-[calc(13px*var(--ws-fs))] leading-relaxed text-muted">
							{cycle?.freeAvailable
								? `Your free vote this week is unused. After it, each vote is ${price}.`
								: price
									? `Each vote is ${price}.`
									: null}{" "}
							The most-voted post wins up to $200 on Friday night.{" "}
							<Link
								href="/votes"
								onClick={onClose}
								className="font-semibold text-primary hover:underline"
							>
								See the standings
							</Link>
						</p>
					</div>
				</OverlayPanel>
			</AnimatePresence>
		</div>,
		document.body,
	);
}
