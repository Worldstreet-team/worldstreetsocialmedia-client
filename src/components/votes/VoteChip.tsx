"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useRef, useState } from "react";
import { useToast } from "@/components/ui/Toast/ToastContext";
import { VoteBox } from "@/components/votes/VoteBox";
import { formatCompact } from "@/lib/utils";
import { castVote, getVoteCycle, markFreeVoteUsed } from "@/lib/votes";
import { haptic } from "@/lib/haptics";

/**
 * The Weekly Vote control: the hinged ballot box and the post's total —
 * nothing else.
 *
 * Owner ruling 2026-09-01: no quantity input, no Cast button, no price on
 * the card. A tap casts one vote (the free weekly one first, then the
 * per-vote charge) and the box swings open as it lands. The number beside
 * it is the post's running total, which is the only thing this control
 * exists to say on a feed card.
 */
export function VoteChip({
	postId,
	votes,
	isMine,
}: {
	postId: string;
	votes: number;
	isMine: boolean;
}) {
	const { toast } = useToast();
	const [count, setCount] = useState(votes);
	const [busy, setBusy] = useState(false);
	const [boxOpen, setBoxOpen] = useState(false);
	const [ballotKey, setBallotKey] = useState(0);
	const shutTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

	const onTap = useCallback(
		async (e: React.MouseEvent) => {
			e.stopPropagation();
			e.preventDefault();
			if (busy) return;
			if (isMine) {
				toast("You can't vote for your own post", { type: "error" });
				return;
			}
			setBusy(true);
			haptic(8);
			const res: any = await castVote(postId, 1);
			setBusy(false);
			if (res.success) {
				const d: any = res.data;
				setCount(d?.votes ?? count + 1);
				setBoxOpen(true);
				setBallotKey((k) => k + 1);
				if (shutTimer.current) clearTimeout(shutTimer.current);
				shutTimer.current = setTimeout(() => setBoxOpen(false), 1100);
				if (d?.freeUsed) {
					markFreeVoteUsed();
					toast("Your free vote this week is in");
				} else {
					toast("Vote counted");
				}
				// Keeps the cached cycle honest for the next chip that asks.
				void getVoteCycle();
			} else {
				toast(res.message ?? "That vote didn't count", { type: "error" });
			}
		},
		[busy, isMine, postId, count, toast],
	);

	return (
		<div className="pointer-events-none relative z-10 mb-0.5 flex items-center justify-end">
			<motion.button
				type="button"
				aria-label="Vote for this post"
				onClick={onTap}
				disabled={busy}
				animate={boxOpen ? { scale: [1, 1.15, 1] } : { scale: 1 }}
				transition={{ duration: 0.32, ease: [0.2, 0, 0, 1] }}
				className={
					boxOpen
						? "pointer-events-auto flex h-10 min-w-10 cursor-pointer items-center justify-center gap-1 rounded-pill px-1.5 text-gold transition-colors disabled:opacity-60"
						: "pointer-events-auto flex h-10 min-w-10 cursor-pointer items-center justify-center gap-1 rounded-pill px-1.5 text-muted transition-colors hover:bg-gold/10 hover:text-gold disabled:opacity-60"
				}
			>
				<VoteBox open={boxOpen} ballotKey={ballotKey} size={23} />
				{count > 0 && (
					<span className="relative overflow-hidden font-sans text-[13.5px] font-medium tabular-nums sm:text-[14px]">
						<AnimatePresence mode="wait" initial={false}>
							<motion.span
								key={count}
								initial={{ opacity: 0, y: 8 }}
								animate={{ opacity: 1, y: 0 }}
								exit={{ opacity: 0, y: -8, transition: { duration: 0.1 } }}
								transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
								className="block"
							>
								{formatCompact(count)}
							</motion.span>
						</AnimatePresence>
					</span>
				)}
			</motion.button>
		</div>
	);
}
