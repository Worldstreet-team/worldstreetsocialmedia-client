"use client";

import { useAuth } from "@clerk/nextjs";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

import {
	OverlayHeader,
	OverlayPanel,
	OverlayScrim,
	useOverlayDismiss,
} from "@/components/ui/Overlay";
import { SafeAvatar } from "@/components/ui/SafeAvatar";
import { useToast } from "@/components/ui/Toast/ToastContext";
import { BACKEND_URL } from "@/const";
import {
	press,
	staggerParent,
	staggerParentFast,
	staggerPop,
	swap,
} from "@/lib/motion-presets";
import { CascadeRow } from "./ConversationList";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? BACKEND_URL;

/** Matches the gateway's own bounds, so the button disables instead of the
 *  request coming back 400. */
const MIN_MINOR = 100;
const MAX_MINOR = 50_000;
const QUICK = [100, 500, 1000, 2000];

const fmt = (minor: number) =>
	`$${(minor / 100).toFixed(2).replace(/\.00$/, "")}`;

/**
 * Send money to the person you are talking to.
 *
 * Deliberately a two-step: type the amount, then confirm a sentence that
 * names the amount AND the person. Every other paid action in the app now
 * does this, and a transfer is the one that cannot be undone at all — there
 * is no unlock to re-read, no subscription to cancel, just money that is now
 * somewhere else.
 *
 * The amount is held in MINOR UNITS the whole way down. Parsing "12.30" to a
 * float and multiplying by 100 is how you ship a transfer that sends $12.29:
 * 12.3 * 100 is 1229.9999999999998.
 */
export interface MoneyMember {
	id: string;
	name: string;
	username?: string;
	avatar?: string;
}

export function SendMoneySheet({
	open,
	onClose,
	conversationId,
	peerName,
	peerHandle,
	balanceMinor,
	members,
	onSent,
}: {
	open: boolean;
	onClose: () => void;
	conversationId: string;
	peerName: string;
	peerHandle?: string;
	/** Shown so the sender can see what they have without leaving the thread. */
	balanceMinor?: number | null;
	/** GROUP mode: the active roster minus yourself. Present -> the sheet
	 *  opens on a "who's it for" step and the transfer names its target. */
	members?: MoneyMember[];
	onSent?: (message: any) => void;
}) {
	const { getToken } = useAuth();
	const { toast } = useToast();
	const [raw, setRaw] = useState("");
	const [note, setNote] = useState("");
	const [confirming, setConfirming] = useState(false);
	const [sending, setSending] = useState(false);
	const [recipient, setRecipient] = useState<MoneyMember | null>(null);
	const groupMode = Array.isArray(members) && members.length > 0;
	const targetName = groupMode ? (recipient?.name ?? "") : peerName;
	const targetHandle = groupMode ? recipient?.username : peerHandle;

	useOverlayDismiss(open, onClose);

	useEffect(() => {
		if (!open) {
			setRaw("");
			setNote("");
			setConfirming(false);
			setRecipient(null);
		}
	}, [open]);

	// Digits only, read as cents — the field fills right-to-left like an ATM,
	// so there is no way to type a malformed amount and no decimal point to
	// misplace.
	const amountMinor = Number(raw.replace(/\D/g, "").slice(0, 7) || 0);
	const tooSmall = amountMinor > 0 && amountMinor < MIN_MINOR;
	const tooBig = amountMinor > MAX_MINOR;
	const overBalance =
		typeof balanceMinor === "number" && amountMinor > balanceMinor;
	const valid = amountMinor >= MIN_MINOR && !tooBig && !overBalance;

	const step =
		groupMode && !recipient ? "who" : confirming ? "confirm" : "amount";
	// The quick amounts cascade the first time the amount step shows in an
	// open, not again on the way Back from Confirm.
	const chipsPlayed = useRef(false);
	useEffect(() => {
		if (!open) chipsPlayed.current = false;
		else if (step === "amount") chipsPlayed.current = true;
	}, [open, step]);

	const send = async () => {
		if (!valid || sending) return;
		setSending(true);
		try {
			const token = await getToken();
			const res = await fetch(
				`${API_URL}/api/messages/${conversationId}/transfer`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${token}`,
					},
					body: JSON.stringify({
						amountMinor,
						note: note.trim(),
						// Groups name their target; the gateway validates the
						// roster either way.
						recipientId: groupMode ? recipient?.id : undefined,
					}),
				},
			);
			const body = await res.json().catch(() => null);
			if (!res.ok) {
				toast(body?.message ?? "That didn't go through.", { type: "error" });
				setConfirming(false);
				return;
			}
			toast(`${fmt(amountMinor)} sent to ${targetName}`, { type: "success" });
			onSent?.(body);
			onClose();
		} catch {
			toast("That didn't go through.", { type: "error" });
			setConfirming(false);
		} finally {
			setSending(false);
		}
	};

	return (
		<AnimatePresence>
			{open && (
				<>
					<OverlayScrim onClose={onClose} />
					<OverlayPanel variant="center" label="Send money">
						<OverlayHeader onClose={onClose}>
							<span className="font-sans text-[calc(15px*var(--ws-fs))] font-semibold text-primary">
								<AnimatePresence mode="wait" initial={false}>
									<motion.span key={step} {...swap} className="inline-block">
										{confirming
											? "Confirm"
											: groupMode && !recipient
												? "Who's it for?"
												: `Send to ${targetName}`}
									</motion.span>
								</AnimatePresence>
							</span>
						</OverlayHeader>

						{/* One step leaves before the next arrives. No
						    initial={false} here: it would also silence the
						    cascades inside the first step. */}
						<AnimatePresence mode="wait">
						{groupMode && !recipient ? (
							/* Step 0, groups only: money needs a name before an
							   amount: a room is not a recipient. Only ever the
							   opening step, so it has an exit and no entrance: its
							   rows are the entrance. */
							<motion.div
								key="who"
								exit={swap.exit}
								className="max-h-[50vh] overflow-y-auto overscroll-contain pb-2"
							>
								<motion.div
									variants={staggerParentFast}
									initial="hidden"
									animate="show"
								>
								{members?.map((m, i) => (
									<CascadeRow key={m.id} index={i}>
									<button
										type="button"
										onClick={() => setRecipient(m)}
										className="flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-primary/5"
									>
										<span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-pill bg-raised">
											<SafeAvatar src={m.avatar} eager />
										</span>
										<span className="min-w-0 flex-1">
											<span className="block truncate font-sans text-[calc(14px*var(--ws-fs))] font-medium text-primary">
												{m.name}
											</span>
											{m.username && (
												<span className="block truncate font-sans text-[calc(12px*var(--ws-fs))] text-muted">
													@{m.username}
												</span>
											)}
										</span>
									</button>
									</CascadeRow>
								))}
								</motion.div>
							</motion.div>
						) : confirming ? (
							<motion.div key="confirm" {...swap} className="px-5 pb-5">
								<p className="font-sans text-[calc(15px*var(--ws-fs))] leading-relaxed text-primary">
									Send <span className="font-semibold">{fmt(amountMinor)}</span>{" "}
									to {targetName}
									{targetHandle ? ` (@${targetHandle})` : ""}?
								</p>
								<p className="mt-1.5 font-sans text-[calc(13px*var(--ws-fs))] text-muted">
									It leaves your wallet straight away. Transfers can&apos;t be
									reversed.
								</p>
								<div className="mt-5 flex gap-2">
									<button
										type="button"
										onClick={() => setConfirming(false)}
										disabled={sending}
										className="h-11 flex-1 cursor-pointer rounded-pill bg-chip font-sans text-[calc(14px*var(--ws-fs))] font-semibold text-primary transition-colors hover:bg-primary/5 disabled:opacity-60"
									>
										Back
									</button>
									<button
										type="button"
										onClick={send}
										disabled={sending}
										className="h-11 flex-1 cursor-pointer rounded-pill bg-brand font-sans text-[calc(14px*var(--ws-fs))] font-semibold text-brand-on transition-opacity hover:opacity-90 disabled:opacity-60"
									>
										{sending ? "Sending…" : "Proceed with payment"}
									</button>
								</div>
							</motion.div>
						) : (
							<motion.div
								key="amount"
								{...swap}
								// As the opening step it rides the panel's own entrance;
								// it only swaps in after Who, or on the way Back.
								initial={groupMode || chipsPlayed.current ? swap.initial : false}
								className="px-5 pb-5"
							>
								<div className="flex items-baseline justify-center gap-1 py-3">
									<span className="font-display text-[calc(34px*var(--ws-fs))] font-semibold text-subtle">
										$
									</span>
									<input
										// biome-ignore lint/a11y/noAutofocus: the amount is the point
										autoFocus
										inputMode="numeric"
										value={
											amountMinor ? (amountMinor / 100).toFixed(2) : "0.00"
										}
										onChange={(e) => setRaw(e.target.value)}
										aria-label="Amount"
										className="w-[7ch] bg-transparent text-center font-display text-[calc(34px*var(--ws-fs))] font-semibold tabular-nums text-primary outline-none"
									/>
								</div>

								<motion.div
									variants={staggerParent}
									initial={chipsPlayed.current ? false : "hidden"}
									animate="show"
									className="flex justify-center gap-2"
								>
									{QUICK.map((q) => (
										<motion.button
											key={q}
											variants={staggerPop}
											{...press}
											type="button"
											onClick={() => setRaw(String(q))}
											className="h-8 cursor-pointer rounded-pill bg-chip px-3 font-sans text-[calc(12.5px*var(--ws-fs))] font-medium text-muted transition-colors hover:text-primary"
										>
											{fmt(q)}
										</motion.button>
									))}
								</motion.div>

								<input
									value={note}
									onChange={(e) => setNote(e.target.value)}
									maxLength={140}
									placeholder="What's it for? (optional)"
									className="mt-4 w-full rounded-pill bg-primary/5 px-4 py-2.5 font-sans text-[calc(13.5px*var(--ws-fs))] text-primary outline-none transition-colors placeholder:text-subtle focus:bg-primary/10"
								/>

								<p className="mt-3 min-h-[18px] text-center font-sans text-[calc(12.5px*var(--ws-fs))]">
									{overBalance ? (
										<span className="text-danger">
											More than your balance
											{typeof balanceMinor === "number"
												? ` (${fmt(balanceMinor)})`
												: ""}
											.
										</span>
									) : tooSmall ? (
										<span className="text-muted">
											Minimum {fmt(MIN_MINOR)}.
										</span>
									) : tooBig ? (
										<span className="text-danger">
											Maximum {fmt(MAX_MINOR)}.
										</span>
									) : typeof balanceMinor === "number" ? (
										<span className="text-subtle">
											Balance {fmt(balanceMinor)}
										</span>
									) : null}
								</p>

								<button
									type="button"
									onClick={() => setConfirming(true)}
									disabled={!valid}
									className="mt-2 h-11 w-full cursor-pointer rounded-pill bg-brand font-sans text-[calc(14px*var(--ws-fs))] font-semibold text-brand-on transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
								>
									Review payment
								</button>
							</motion.div>
						)}
						</AnimatePresence>
					</OverlayPanel>
				</>
			)}
		</AnimatePresence>
	);
}
