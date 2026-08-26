"use client";

import { Check, Checks, Clock } from "@phosphor-icons/react";
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
}: {
	id: string;
	createdAt: string;
	deliveredAt: number | null;
	readAt: number | null;
}): TickState {
	// Optimistic bubbles carry a temp id until the server answers.
	if (id.startsWith("temp-")) return "sending";
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
	const Icon = state === "sending" ? Clock : state === "sent" ? Check : Checks;
	return (
		<span
			// The label is the accessible text; the glyph alone would announce
			// as nothing at all.
			role="img"
			aria-label={LABEL[state]}
			title={LABEL[state]}
			className={clsx(
				"inline-flex items-center",
				state === "read" ? "text-gold" : "text-muted",
			)}
		>
			<Icon size={14} weight="bold" />
		</span>
	);
}
