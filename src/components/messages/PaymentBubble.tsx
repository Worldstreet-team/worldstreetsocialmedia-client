"use client";

import { Check } from "@phosphor-icons/react";
import clsx from "clsx";
import { format } from "date-fns";
import { useRef, useState } from "react";
import { ReceiptSheet } from "./ReceiptSheet";

/**
 * A transfer, in the thread: a receipt ticket (owner pick 2026-10-07).
 *
 * Stays on the sender's shore like any other message — money has a
 * direction, and centring it would lose who paid whom. Wears the bubble's
 * own fill (gradient shore for mine, theirs for theirs) so it reads as a
 * message, then cuts a tear line with two notches into the chat's ground
 * so it also reads as proof. Tapping it opens the full receipt.
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
	reference,
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
	/** The payer's face, for the receipt. */
	fromAvatar?: string;
	/** The payee's face, for the receipt. */
	toAvatar?: string;
	/** The payment message's id; the receipt's reference is built from it. */
	reference?: string;
}) {
	const amount = `$${(amountMinor / 100).toFixed(2)}`;
	// A payment between two OTHER people is thread news, not my money.
	const bystander = !mine && !!toName && !toMe;
	const fromName = mine ? "You" : senderName || peerName || "Someone";
	const paidTo = mine ? toName || peerName || "them" : toMe ? "You" : toName || "them";
	const ticketRef = useRef<HTMLButtonElement>(null);
	const [open, setOpen] = useState(false);
	const [hero, setHero] = useState<{ fill?: string; ink?: string }>({});

	const label = mine ? "Payment sent" : bystander ? "Payment" : "Payment received";
	const line = mine
		? `to ${paidTo}`
		: bystander
			? `${fromName} to ${toName}`
			: `from ${fromName}`;

	const fill = mine
		? // The same fill and ink as MessageBubble's MINE_FILL / MINE_INK (not
			// imported: that file imports this one).
			{ background: "var(--chat-mine, #087A94)", color: "var(--chat-mine-ink, #FFFFFF)" }
		: { background: "var(--chat-theirs, var(--ws-bg-raised))", color: "var(--chat-theirs-ink, var(--ws-text-primary))" };
	// The notches show the chat's ground through the ticket.
	const notch = "absolute top-0 h-3 w-3 rounded-pill [background:var(--chat-ground,var(--ws-bg-page))]";

	const openReceipt = () => {
		// The sheet is portalled out of the themed pane, so read the fill the
		// ticket actually painted with and hand it over.
		const el = ticketRef.current;
		if (el) {
			const cs = getComputedStyle(el);
			setHero({ fill: cs.backgroundImage !== "none" ? cs.backgroundImage : cs.backgroundColor, ink: cs.color });
		}
		setOpen(true);
	};

	return (
		<div className={clsx("mt-1.5 flex", mine ? "justify-end" : "justify-start")}>
			<button
				ref={ticketRef}
				type="button"
				onClick={openReceipt}
				aria-label={`${label}, ${amount}. Open receipt`}
				className="w-[232px] cursor-pointer overflow-hidden rounded-[18px] text-left transition-[filter] hover:brightness-105"
				style={fill}
			>
				<span className="block px-4 pb-2.5 pt-3">
					<span className="flex items-center gap-1.5 font-sans text-[calc(12px*var(--ws-fs))] font-semibold opacity-85">
						<span className="flex h-4 w-4 items-center justify-center rounded-pill bg-[color-mix(in_srgb,currentColor_22%,transparent)]">
							<Check size={10} weight="bold" />
						</span>
						{label}
					</span>
					<span className="mt-1 block font-display text-[calc(26px*var(--ws-fs))] font-semibold leading-tight tracking-[-0.02em] tabular-nums">
						{amount}
					</span>
					<span className="block truncate font-sans text-[calc(12.5px*var(--ws-fs))] opacity-80">
						{note ? `${note} · ${line}` : line}
					</span>
				</span>
				<span aria-hidden className="relative block h-3">
					<span className={clsx(notch, "-left-1.5")} />
					<span className={clsx(notch, "-right-1.5")} />
					<span className="absolute inset-x-3.5 top-1.5 border-t border-dashed border-current opacity-35" />
				</span>
				<span className="flex items-center px-4 pb-2.5 pt-1 font-sans text-[calc(11px*var(--ws-fs))]">
					{at ? <span className="font-mono tabular-nums opacity-70">{format(new Date(at), "h:mm a")}</span> : null}
					<span className="ml-auto font-semibold">Receipt</span>
				</span>
			</button>
			<ReceiptSheet
				open={open}
				onClose={() => setOpen(false)}
				heroFill={hero.fill}
				heroInk={hero.ink}
				data={{
					amountMinor,
					note,
					at,
					fromName: mine ? "You" : fromName,
					toName: paidTo,
					fromAvatar,
					toAvatar,
					reference: reference || `${amountMinor}-${at ?? ""}`,
				}}
			/>
		</div>
	);
}
