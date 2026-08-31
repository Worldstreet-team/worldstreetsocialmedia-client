"use client";

import clsx from "clsx";
import { useCallback, useState } from "react";
import { Lightning } from "@phosphor-icons/react";
import { useToast } from "@/components/ui/Toast/ToastContext";
import { formatCompact } from "@/lib/utils";
import { castVote, getVoteCycle, markFreeVoteUsed } from "@/lib/votes";

/**
 * The Weekly Vote chip — rides the top-right corner of post media (the spot
 * the owner circled), fixed-white glass like every control that sits on
 * artwork. `overlay={false}` renders the same chip inline for text posts.
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
	overlay = true,
}: {
	postId: string;
	votes: number;
	isMine: boolean;
	overlay?: boolean;
}) {
	const { toast } = useToast();
	const [count, setCount] = useState(votes);
	const [busy, setBusy] = useState(false);
	const [paidOpen, setPaidOpen] = useState(false);

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
			className={clsx(
				"pointer-events-auto z-20 flex items-center gap-1.5",
				overlay && "absolute right-2.5 top-2.5",
			)}
			onClick={(e) => e.stopPropagation()}
		>
			{paidOpen && (
				<>
					<button
						type="button"
						onClick={() => void cast(1)}
						className={clsx(
							"cursor-pointer rounded-pill px-2.5 py-1.5 font-sans text-[12px] font-semibold transition-colors",
							overlay
								? "bg-black/60 text-white hover:bg-black/75"
								: "bg-raised text-primary hover:bg-chip",
						)}
					>
						+1 · 5¢
					</button>
					<button
						type="button"
						onClick={() => void cast(10)}
						className={clsx(
							"cursor-pointer rounded-pill px-2.5 py-1.5 font-sans text-[12px] font-semibold transition-colors",
							overlay
								? "bg-black/60 text-white hover:bg-black/75"
								: "bg-raised text-primary hover:bg-chip",
						)}
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
				className={clsx(
					"flex cursor-pointer items-center gap-1.5 rounded-pill px-3 py-1.5 font-sans text-[13px] font-semibold transition-colors disabled:opacity-60",
					overlay
						? "bg-black/55 text-white backdrop-blur-md hover:bg-black/70"
						: "bg-raised text-primary hover:bg-chip",
				)}
			>
				<Lightning size={14} weight="fill" className="text-gold" />
				{count > 0 && (
					<span className="tabular-nums">{formatCompact(count)}</span>
				)}
				<span>Vote</span>
			</button>
		</div>
	);
}
