"use client";

import { RiCheckLine, RiCheckDoubleLine, RiTimeLine } from "@remixicon/react";
import clsx from "clsx";

/**
 * Delivery state for a message I sent, in the tick language people already
 * know from every other chat app:
 *
 *   clock        queued locally, the POST hasn't come back yet
 *   one tick     the gateway has it
 *   two ticks    their client acknowledged receipt
 *   two gold     they've actually read it
 *
 * Gold is the app's "this matters" colour and read is the only state the
 * sender is really waiting on, so it earns the one bit of colour here.
 */
export type TickState = "sending" | "sent" | "delivered" | "read";

export function tickStateFor({
	id,
	createdAt,
	deliveredAt,
	readAt,
	peerReadUpTo,
}: {
	id: string;
	createdAt: string;
	deliveredAt: number | null;
	readAt: number | null;
	/** The peer's persisted high-water mark (a message id). ObjectIds are
	 *  time-ordered hex of equal length, so a plain string compare answers
	 *  "is my message at or before their mark" — this is what makes ticks
	 *  SURVIVE RELOAD instead of resetting to a single grey check. */
	peerReadUpTo?: string | null;
}): TickState {
	// Optimistic bubbles carry a temp id until the server answers.
	if (id.startsWith("temp-")) return "sending";
	if (peerReadUpTo && id <= peerReadUpTo) return "read";
	const sentAt = new Date(createdAt).getTime();
	if (readAt !== null && readAt >= sentAt) return "read";
	if (deliveredAt !== null && deliveredAt >= sentAt) return "delivered";
	return "sent";
}

const LABEL: Record<TickState, string> = {
	sending: "Sending",
	sent: "Sent",
	delivered: "Delivered",
	read: "Read",
};

export function MessageTicks({ state }: { state: TickState }) {
	const Icon =
		state === "sending"
			? RiTimeLine
			: state === "sent"
				? RiCheckLine
				: RiCheckDoubleLine;
	return (
		<span
			// Re-keyed per state so each morph crossfades in at the fast tier
			// (register 122) — a tick that silently swaps reads as a glitch.
			key={state}
			// The label is the accessible text; the glyph alone would announce
			// as nothing at all.
			role="img"
			aria-label={LABEL[state]}
			title={LABEL[state]}
			className={clsx(
				"inline-flex items-center animate-tick-in",
				state === "read" ? "text-gold" : "text-muted",
			)}
		>
			<Icon size={15} />
		</span>
	);
}
