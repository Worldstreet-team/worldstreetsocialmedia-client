"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Package, PackageOpen } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { useToast } from "@/components/ui/Toast/ToastContext";
import { formatCompact } from "@/lib/utils";
import { castVote, getVoteCycle, markFreeVoteUsed } from "@/lib/votes";

/**
 * The Weekly Vote chip — its own right-aligned row directly ABOVE the post
 * media (owner ruling: same corner, off the artwork).
 *
 * The box is Lucide's Package / PackageOpen pair (a properly drawn icon,
 * not a hand-rolled path): it springs open when a vote lands and falls
 * shut a beat later. While the voter still holds their free weekly vote,
 * one tap casts it. After that, a tap slides out the paid strip where they
 * TYPE how many votes they want — the price updates live at 5¢ each — and
 * cast in one go.
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
	const [qty, setQty] = useState("1");
	const [boxOpen, setBoxOpen] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);
	const shutTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

	const quantity = Math.min(1000, Math.max(0, Math.round(Number(qty) || 0)));
	const priceLabel = `$${((quantity * 5) / 100).toFixed(2)}`;

	const cast = useCallback(
		async (n: number) => {
			if (busy || n < 1) return;
			setBusy(true);
			const res: any = await castVote(postId, n);
			setBusy(false);
			if (res.success) {
				const d: any = res.data;
				setPaidOpen(false);
				setCount(d?.votes ?? count + n);
				setBoxOpen(true);
				if (shutTimer.current) clearTimeout(shutTimer.current);
				shutTimer.current = setTimeout(() => setBoxOpen(false), 1100);
				if (d?.freeUsed) {
					markFreeVoteUsed();
					toast("Your free vote this week is in");
				} else {
					toast(`${n} vote${n === 1 ? "" : "s"} counted`);
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
				setQty("1");
				setPaidOpen(true);
				setTimeout(() => inputRef.current?.select(), 60);
			}
		},
		[isMine, paidOpen, cast, toast],
	);

	return (
		<div
			className="pointer-events-auto relative z-10 mb-1.5 flex items-center justify-end gap-1.5"
			onClick={(e) => e.stopPropagation()}
		>
			<AnimatePresence>
				{paidOpen && (
					<motion.div
						initial={{ opacity: 0, x: 14 }}
						animate={{ opacity: 1, x: 0 }}
						exit={{ opacity: 0, x: 14, transition: { duration: 0.12 } }}
						transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
						className="flex items-center gap-1.5"
					>
						<label className="flex h-9 items-center gap-1 rounded-pill bg-raised px-3 font-sans text-[13px] text-primary focus-within:bg-chip transition-colors">
							<input
								ref={inputRef}
								type="text"
								inputMode="numeric"
								value={qty}
								onChange={(e) =>
									setQty(e.target.value.replace(/[^0-9]/g, "").slice(0, 4))
								}
								onKeyDown={(e) => {
									if (e.key === "Enter" && quantity > 0)
										void cast(quantity);
								}}
								aria-label="Number of votes"
								className="w-12 bg-transparent text-center tabular-nums outline-none placeholder:text-subtle"
								placeholder="10"
							/>
							<span className="text-subtle">votes</span>
						</label>
						<button
							type="button"
							disabled={busy || quantity < 1}
							onClick={() => void cast(quantity)}
							className="h-9 cursor-pointer rounded-pill bg-credit px-3.5 font-sans text-[12.5px] font-semibold tabular-nums text-page transition-colors hover:opacity-90 disabled:opacity-50"
						>
							{busy ? "Casting…" : `Cast · ${priceLabel}`}
						</button>
					</motion.div>
				)}
			</AnimatePresence>

			<motion.button
				type="button"
				aria-label="Vote for this post"
				onClick={onTap}
				disabled={busy}
				animate={boxOpen ? { scale: [1, 1.12, 1] } : { scale: 1 }}
				transition={{ duration: 0.32, ease: [0.2, 0, 0, 1] }}
				className="flex cursor-pointer items-center gap-1.5 rounded-pill bg-raised px-3 py-1.5 font-sans text-[13px] font-semibold text-primary transition-colors hover:bg-chip disabled:opacity-60"
			>
				<span className="relative flex h-[17px] w-[17px] items-center justify-center text-gold">
					<AnimatePresence mode="wait" initial={false}>
						{boxOpen ? (
							<motion.span
								key="open"
								initial={{ opacity: 0, scale: 0.7, rotate: -8 }}
								animate={{ opacity: 1, scale: 1, rotate: 0 }}
								exit={{ opacity: 0, scale: 0.8 }}
								transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
								className="flex"
							>
								<PackageOpen size={17} strokeWidth={2.2} />
							</motion.span>
						) : (
							<motion.span
								key="closed"
								initial={{ opacity: 0, scale: 0.8 }}
								animate={{ opacity: 1, scale: 1 }}
								exit={{ opacity: 0, scale: 0.8 }}
								transition={{ duration: 0.15 }}
								className="flex"
							>
								<Package size={17} strokeWidth={2.2} />
							</motion.span>
						)}
					</AnimatePresence>
				</span>
				{count > 0 && (
					<span className="relative overflow-hidden tabular-nums">
						<AnimatePresence mode="wait" initial={false}>
							{/* The count rolls the way the like counter does. */}
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
				<span>Vote</span>
			</motion.button>
		</div>
	);
}
