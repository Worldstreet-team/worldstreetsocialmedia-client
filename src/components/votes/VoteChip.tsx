"use client";

import clsx from "clsx";
import { useCallback, useState } from "react";
import { VoteBox } from "@/components/votes/VoteBox";
import { useToast } from "@/components/ui/Toast/ToastContext";
import { formatCompact } from "@/lib/utils";
import { castVote, getVoteCycle, markFreeVoteUsed } from "@/lib/votes";

/**
 * The Weekly Vote chip — its own right-aligned row directly ABOVE the post
 * media (owner ruling: same corner, but above the image, never on it). The
 * ballot box swings open when a vote lands.
 *
 * Tap flow: while the voter still holds their free weekly vote, one tap
 * casts it instantly. After that a tap opens the tiny paid strip — +1 (5¢)
 * or +10 (50¢) — so money is always a second, explicit tap, never a
 * surprise. Server is authoritative on free-vs-paid; the client cache only
 * decides which UI to show first.
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
	const [paidOpen, setPaidOpen] = useState(false);
	// Momentary: flips true when a vote lands, falls shut ~900ms later.
	const [boxOpen, setBoxOpen] = useState(false);

	const cast = useCallback(
		async (quantity: number) => {
			if (busy) return;
			setBusy(true);
			setPaidOpen(false);
			const res: any = await castVote(postId, quantity);
			setBusy(false);
			if (res.success) {
				const d: any = res.data;
				setCount(d?.votes ?? count + quantity);
				setBoxOpen(true);
				setTimeout(() => setBoxOpen(false), 900);
				if (d?.freeUsed) {
					markFreeVoteUsed();
					toast("Your free vote this week is in");
				} else {
					toast(`${quantity} vote${quantity === 1 ? "" : "s"} counted`);
				}
			} else {
				toast(res.message ?? "That vote didn't count", { type: "error" });
			}
		},
		[busy, postId, count, toast],
	);

	const onTap = useCallback(
		async (e: React.MouseEvent) => {
			e.stopPropagation();
			e.preventDefault();
			if (isMine) {
				toast("You can't vote for your own post", { type: "error" });
				return;
			}
			if (paidOpen) {
				setPaidOpen(false);
				return;
			}
			const cycle = await getVoteCycle();
			if (cycle?.freeAvailable) {
				void cast(1);
			} else {
				setPaidOpen(true);
			}
		},
		[isMine, paidOpen, cast, toast],
	);

	return (
		<div
			className="pointer-events-auto relative z-10 mb-1.5 flex items-center justify-end gap-1.5"
			onClick={(e) => e.stopPropagation()}
		>
			{paidOpen && (
				<>
					<button
						type="button"
						onClick={() => void cast(1)}
						className="cursor-pointer rounded-pill bg-raised px-2.5 py-1.5 font-sans text-[12px] font-semibold text-primary transition-colors hover:bg-chip"
					>
						+1 · 5¢
					</button>
					<button
						type="button"
						onClick={() => void cast(10)}
						className="cursor-pointer rounded-pill bg-raised px-2.5 py-1.5 font-sans text-[12px] font-semibold text-primary transition-colors hover:bg-chip"
					>
						+10 · 50¢
					</button>
				</>
			)}
			<button
				type="button"
				aria-label="Vote for this post"
				onClick={onTap}
				disabled={busy}
				className="flex cursor-pointer items-center gap-1.5 rounded-pill bg-raised px-3 py-1.5 font-sans text-[13px] font-semibold text-primary transition-colors hover:bg-chip disabled:opacity-60"
			>
				<VoteBox open={boxOpen} size={17} className="text-gold" />
				{count > 0 && (
					<span className="tabular-nums">{formatCompact(count)}</span>
				)}
				<span>Vote</span>
			</button>
		</div>
	);
}
