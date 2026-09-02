"use client";

import { ArrowDown, ArrowUp } from "@phosphor-icons/react";
import clsx from "clsx";
import { format } from "date-fns";

/**
 * A transfer, in the thread.
 *
 * Stays on the sender's shore like any other message — unlike a call log,
 * money very much has a direction, and centring it would lose the one fact
 * that matters most at a glance: who paid whom.
 *
 * Deliberately not a green money-coloured card. The `money/*` tokens mean
 * credit and debit in a FEED of financial posts; here the direction is
 * already carried by which side the bubble sits on and by the arrow, so a
 * second colour system would just be loud.
 */
export function PaymentBubble({
	amountMinor,
	note,
	at,
	mine,
	peerName,
	toName,
	toMe,
	senderName,
}: {
	amountMinor: number;
	note?: string;
	at?: string;
	mine: boolean;
	peerName?: string;
	/** Group payments name their target (owner ruling 2026-09-02). */
	toName?: string;
	/** The target is the viewer — "Received", even in a room of ten. */
	toMe?: boolean;
	/** Who paid, for the third-party reading of a group payment. */
	senderName?: string;
}) {
	const amount = `$${(amountMinor / 100).toFixed(2).replace(/\.00$/, "")}`;
	// A payment between two OTHER people is thread news, not my money:
	// neutral header, both names, no received styling.
	const bystander = !mine && !!toName && !toMe;
	const Arrow = mine ? ArrowUp : ArrowDown;

	return (
		<div className={clsx("mt-1.5 flex", mine ? "justify-end" : "justify-start")}>
			<div
				className={clsx(
					"min-w-[190px] max-w-[280px] rounded-xl px-3.5 py-3",
					mine ? "bg-brand text-brand-on" : "bg-raised text-primary",
				)}
			>
				<span className="flex items-center gap-2">
					<span
						className={clsx(
							"flex h-7 w-7 shrink-0 items-center justify-center rounded-pill",
							mine ? "bg-brand-on/15" : "bg-success/15 text-success",
						)}
					>
						<Arrow size={14} weight="bold" />
					</span>
					<span className="min-w-0">
						<span className="block font-sans text-[11px] font-semibold uppercase tracking-[0.12em] opacity-70">
							{mine ? "Sent" : bystander ? "Payment" : "Received"}
						</span>
						<span className="block font-display text-[19px] font-semibold tabular-nums leading-tight">
							{amount}
						</span>
					</span>
				</span>

				{note ? (
					<p className="mt-2 break-words font-sans text-[13px] leading-relaxed opacity-90">
						{note}
					</p>
				) : null}

				<span className="mt-2 flex items-center justify-between gap-2 font-sans text-[11px] opacity-70">
					<span className="truncate">
						{mine
							? `To ${toName || peerName || "them"}`
							: bystander
								? `${senderName || "Someone"} → ${toName}`
								: `From ${senderName || peerName || "them"}`}
					</span>
					{at ? (
						<span className="shrink-0 tabular-nums">
							{format(new Date(at), "h:mm a")}
						</span>
					) : null}
				</span>
			</div>
		</div>
	);
}
