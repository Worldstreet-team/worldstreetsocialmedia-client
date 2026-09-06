"use client";

import clsx from "clsx";
import { format } from "date-fns";

/**
 * A transfer, in the thread.
 *
 * Stays on the sender's shore like any other message — unlike a call log,
 * money very much has a direction, and centring it would lose the one fact
 * that matters most at a glance: who paid whom.
 *
 * Wears the SAME bubble grammar as a message (owner 2026-09-06): gradient
 * shore for mine, raised for theirs, 22px radius. The direction is drawn,
 * not spelled: payer's and payee's faces overlap, payer in front — the
 * money reads left to right, from one face to the other.
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
	fromAvatar,
	toAvatar,
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
	/** The payer's face, leading the overlap. */
	fromAvatar?: string;
	/** The payee's face, tucked behind; initial chip when unknown. */
	toAvatar?: string;
}) {
	const amount = `$${(amountMinor / 100).toFixed(2).replace(/\.00$/, "")}`;
	// A payment between two OTHER people is thread news, not my money:
	// neutral header, both names, no received styling.
	const bystander = !mine && !!toName && !toMe;
	const fromName = mine ? "You" : senderName || peerName;
	const paidTo = mine ? toName || peerName : toMe ? "You" : toName;
	// The ring cuts each face out of the one behind it. Mine sits on the
	// gradient, so the ring is a white wash; theirs matches the raised fill.
	const ring = mine
		? { boxShadow: "0 0 0 2px rgba(255,255,255,0.4)" }
		: { boxShadow: "0 0 0 2px var(--ws-surface-raised)" };

	const face = (src: string | undefined, name: string | undefined) =>
		src ? (
			// eslint-disable-next-line @next/next/no-img-element
			<img
				src={src}
				alt=""
				style={ring}
				className="h-9 w-9 rounded-pill object-cover"
			/>
		) : (
			<span
				style={ring}
				className={clsx(
					"flex h-9 w-9 items-center justify-center rounded-pill font-sans text-[13px] font-semibold",
					mine ? "bg-white/25 text-white" : "bg-chip text-muted",
				)}
			>
				{(name || "?").charAt(0).toUpperCase()}
			</span>
		);

	return (
		<div className={clsx("mt-1.5 flex", mine ? "justify-end" : "justify-start")}>
			<div
				className={clsx(
					"min-w-[200px] max-w-[280px] rounded-[22px] px-4 py-3",
					mine ? "text-white" : "bg-raised text-primary",
				)}
				style={
					mine
						? {
								backgroundImage:
									"linear-gradient(135deg, var(--ws-brand-primary), #6D5BFF)",
							}
						: undefined
				}
			>
				<span className="flex items-center gap-3">
					{/* Payer in front, payee tucked behind — the overlap IS the
					    arrow. */}
					<span className="relative h-9 w-[58px] shrink-0">
						<span className="absolute left-[22px] top-0">
							{face(toAvatar, paidTo)}
						</span>
						<span className="absolute left-0 top-0">
							{face(fromAvatar, fromName)}
						</span>
					</span>
					<span className="min-w-0">
						<span className="block font-sans text-[10.5px] font-semibold uppercase tracking-[0.14em] opacity-70">
							{mine ? "Sent" : bystander ? "Payment" : "Received"}
						</span>
						<span className="block font-display text-[20px] font-semibold tabular-nums leading-tight">
							{amount}
						</span>
					</span>
				</span>

				{note ? (
					<p className="mt-2 break-words font-sans text-[13px] leading-relaxed opacity-90">
						{note}
					</p>
				) : null}

				<span className="mt-2.5 flex items-center justify-between gap-2 font-sans text-[11px] opacity-70">
					<span className="truncate">
						{bystander
							? `${fromName || "Someone"} → ${toName}`
							: `${fromName || "They"} paid ${paidTo || "them"}`}
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
