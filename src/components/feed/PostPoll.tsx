"use client";

import clsx from "clsx";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { RiCheckLine } from "@remixicon/react";

import { postJsonDirect } from "@/lib/upload-direct";
import { formatCompact } from "@/lib/utils";
import { useT } from "@/i18n/client";
import { DUR, EASE_OUT_EXPO, pop, press, swap } from "@/lib/motion-presets";

export interface PollData {
	options: { text: string; count: number }[];
	endsAt: string;
	totalVotes: number;
	myVote: number | null;
	ended: boolean;
}

/** "22h left" / "3d left" — coarse on purpose; a poll is not a stopwatch. */
function timeLeft(endsAt: string): string {
	const ms = new Date(endsAt).getTime() - Date.now();
	if (ms <= 0) return "";
	const h = Math.ceil(ms / 3600_000);
	if (h < 24) return `${h}h`;
	return `${Math.ceil(h / 24)}d`;
}

/**
 * The feed poll (owner-ratified style, 2026-09-02): outline-pill options
 * before you vote; gold-wash result bars once you have voted or the poll has
 * closed. Votes go straight to the gateway (`postJsonDirect`) so a vote
 * still lands from a tab that predates the last deploy.
 *
 * Results are hidden until you vote — the same rule every major client uses,
 * because a visible majority changes how people vote.
 */
export function PostPoll({
	postId,
	poll: initial,
}: {
	postId: string;
	poll: PollData;
}) {
	const t = useT();
	const [poll, setPoll] = useState<PollData>(initial);
	const [busy, setBusy] = useState(false);
	// Results animate in only for the vote cast here. A poll that arrives
	// already voted or closed is a feed row scrolling past: it gets nothing.
	const [justVoted, setJustVoted] = useState(false);

	const showResults = poll.myVote !== null || poll.ended;
	const max = Math.max(...poll.options.map((o) => o.count), 1);
	const left = timeLeft(poll.endsAt);

	const vote = async (index: number) => {
		if (busy || poll.ended || poll.myVote === index) return;
		setBusy(true);
		setJustVoted(true);
		// Optimistic: move my vote instantly; the response is the server's
		// truth and replaces it.
		const prev = poll;
		setPoll((p) => {
			const options = p.options.map((o, i) => ({
				...o,
				count:
					o.count +
					(i === index ? 1 : 0) -
					(p.myVote === i ? 1 : 0),
			}));
			return {
				...p,
				options,
				myVote: index,
				totalVotes: p.totalVotes + (p.myVote === null ? 1 : 0),
			};
		});
		const res = await postJsonDirect(`/api/posts/${postId}/poll/vote`, {
			option: index,
		});
		if (res.success && (res.data as any)?.poll) {
			setPoll((res.data as any).poll);
		} else if (!res.success) {
			setPoll(prev);
		}
		setBusy(false);
	};

	return (
		<div
			className="relative z-10 mt-3 flex flex-col gap-2 pointer-events-auto"
			onClick={(e) => e.stopPropagation()}
		>
			{poll.options.map((o, i) => {
				const pct =
					poll.totalVotes > 0
						? Math.round((o.count / poll.totalVotes) * 100)
						: 0;
				const mine = poll.myVote === i;
				const winning = showResults && o.count === max && o.count > 0;

				if (!showResults) {
					// Pre-vote: the outline pill. The whole row is the target.
					return (
						<motion.button
							{...press}
							// biome-ignore lint/suspicious/noArrayIndexKey: options are positional
							key={i}
							type="button"
							disabled={busy}
							onClick={() => void vote(i)}
							className="flex h-10 w-full cursor-pointer items-center justify-center rounded-pill border border-gold/60 px-4 font-sans text-[calc(14px*var(--ws-fs))] font-semibold text-gold transition-colors hover:bg-gold/10"
						>
							<span className="truncate">{o.text}</span>
						</motion.button>
					);
				}

				// Voted / ended: the gold-wash result bar. A motion.button like
				// the pill above, so React keeps the node (and keyboard focus)
				// when a vote turns one into the other.
				return (
					<motion.button
						// biome-ignore lint/suspicious/noArrayIndexKey: options are positional
						key={i}
						type="button"
						disabled={busy || poll.ended}
						onClick={() => void vote(i)}
						className={clsx(
							"relative h-10 w-full overflow-hidden rounded-[10px] text-left",
							!poll.ended && "cursor-pointer",
						)}
					>
						{/* Grows from the left edge on the vote just cast. There is
						    no preset for a bar filling, so this is scaleX on the
						    file's own slow beat and expo curve; later changes of
						    width ride the CSS transition as before. */}
						<motion.span
							aria-hidden
							initial={justVoted ? { scaleX: 0 } : false}
							animate={{ scaleX: 1 }}
							transition={{ duration: DUR.slow, ease: EASE_OUT_EXPO }}
							className={clsx(
								"absolute inset-y-0 left-0 rounded-[10px] transition-[width]",
								winning ? "bg-brand/25" : "bg-raised",
							)}
							style={{ width: `${Math.max(pct, 3)}%`, originX: 0 }}
						/>
						<span className="relative z-10 flex h-full items-center justify-between gap-2 px-3.5">
							<span
								className={clsx(
									"flex min-w-0 items-center gap-1.5 font-sans text-[calc(14px*var(--ws-fs))]",
									winning
										? "font-semibold text-primary"
										: "text-primary",
								)}
							>
								<span className="truncate">{o.text}</span>
								{mine && (
									// The person's own tick may pop; one that was already
									// there when the row mounted does not.
									<motion.span
										{...pop}
										initial={justVoted ? pop.initial : false}
										className="flex shrink-0"
									>
										<RiCheckLine size={15} className="text-gold" />
									</motion.span>
								)}
							</span>
							<span className="relative inline-flex shrink-0 font-sans text-[calc(13px*var(--ws-fs))] font-medium tabular-nums text-muted">
								{/* A share that moves rolls; its first appearance does not. */}
								<AnimatePresence mode="popLayout" initial={false}>
									<motion.span key={pct} {...swap} className="inline-block">
										{pct}%
									</motion.span>
								</AnimatePresence>
							</span>
						</span>
					</motion.button>
				);
			})}
			<span className="font-sans text-[calc(12.5px*var(--ws-fs))] text-subtle">
				<span className="relative inline-flex tabular-nums">
					<AnimatePresence mode="popLayout" initial={false}>
						<motion.span
							key={poll.totalVotes}
							{...swap}
							className="inline-block"
						>
							{formatCompact(poll.totalVotes)}
						</motion.span>
					</AnimatePresence>
				</span>{" "}
				{poll.totalVotes === 1 ? t("poll.vote") : t("poll.votes")}
				{poll.ended
					? ` · ${t("poll.finalResults")}`
					: left
						? ` · ${left} ${t("poll.left")}`
						: ""}
			</span>
		</div>
	);
}
