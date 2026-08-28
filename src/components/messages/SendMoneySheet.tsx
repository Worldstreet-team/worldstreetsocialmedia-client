"use client";

import { useAuth } from "@clerk/nextjs";
import { AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";

import {
	OverlayHeader,
	OverlayPanel,
	OverlayScrim,
	useOverlayDismiss,
} from "@/components/ui/Overlay";
import { useToast } from "@/components/ui/Toast/ToastContext";
import { BACKEND_URL } from "@/const";

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
export function SendMoneySheet({
	open,
	onClose,
	conversationId,
	peerName,
	peerHandle,
	balanceMinor,
	onSent,
}: {
	open: boolean;
	onClose: () => void;
	conversationId: string;
	peerName: string;
	peerHandle?: string;
	/** Shown so the sender can see what they have without leaving the thread. */
	balanceMinor?: number | null;
	onSent?: (message: any) => void;
}) {
	const { getToken } = useAuth();
	const { toast } = useToast();
	const [raw, setRaw] = useState("");
	const [note, setNote] = useState("");
	const [confirming, setConfirming] = useState(false);
	const [sending, setSending] = useState(false);

	useOverlayDismiss(open, onClose);

	useEffect(() => {
		if (!open) {
			setRaw("");
			setNote("");
			setConfirming(false);
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
					body: JSON.stringify({ amountMinor, note: note.trim() }),
				},
			);
			const body = await res.json().catch(() => null);
			if (!res.ok) {
				toast(body?.message ?? "That didn't go through.", { type: "error" });
				setConfirming(false);
				return;
			}
			toast(`${fmt(amountMinor)} sent to ${peerName}`, { type: "success" });
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
							<span className="font-sans text-[15px] font-semibold text-primary">
								{confirming ? "Confirm" : `Send to ${peerName}`}
							</span>
						</OverlayHeader>

						{confirming ? (
							<div className="px-5 pb-5">
								<p className="font-sans text-[15px] leading-relaxed text-primary">
									Send <span className="font-semibold">{fmt(amountMinor)}</span>{" "}
									to {peerName}
									{peerHandle ? ` (@${peerHandle})` : ""}?
								</p>
								<p className="mt-1.5 font-sans text-[13px] text-muted">
									It leaves your wallet straight away. Transfers can&apos;t be
									reversed.
								</p>
								<div className="mt-5 flex gap-2">
									<button
										type="button"
										onClick={() => setConfirming(false)}
										disabled={sending}
										className="h-11 flex-1 cursor-pointer rounded-pill bg-chip font-sans text-[14px] font-semibold text-primary transition-colors hover:bg-raised disabled:opacity-60"
									>
										Back
									</button>
									<button
										type="button"
										onClick={send}
										disabled={sending}
										className="h-11 flex-1 cursor-pointer rounded-pill bg-brand font-sans text-[14px] font-semibold text-brand-on transition-opacity hover:opacity-90 disabled:opacity-60"
									>
										{sending ? "Sending…" : "Proceed with payment"}
									</button>
								</div>
							</div>
						) : (
							<div className="px-5 pb-5">
								<div className="flex items-baseline justify-center gap-1 py-3">
									<span className="font-display text-[34px] font-semibold text-subtle">
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
										className="w-[7ch] bg-transparent text-center font-display text-[34px] font-semibold tabular-nums text-primary outline-none"
									/>
								</div>

								<div className="flex justify-center gap-2">
									{QUICK.map((q) => (
										<button
											key={q}
											type="button"
											onClick={() => setRaw(String(q))}
											className="h-8 cursor-pointer rounded-pill bg-chip px-3 font-sans text-[12.5px] font-medium text-muted transition-colors hover:text-primary"
										>
											{fmt(q)}
										</button>
									))}
								</div>

								<input
									value={note}
									onChange={(e) => setNote(e.target.value)}
									maxLength={140}
									placeholder="What's it for? (optional)"
									className="mt-4 w-full rounded-pill bg-sunken px-4 py-2.5 font-sans text-[13.5px] text-primary outline-none transition-colors placeholder:text-subtle focus:bg-raised"
								/>

								<p className="mt-3 min-h-[18px] text-center font-sans text-[12.5px]">
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
									className="mt-2 h-11 w-full cursor-pointer rounded-pill bg-brand font-sans text-[14px] font-semibold text-brand-on transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
								>
									Review payment
								</button>
							</div>
						)}
					</OverlayPanel>
				</>
			)}
		</AnimatePresence>
	);
}
