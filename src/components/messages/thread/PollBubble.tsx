"use client";

import { Check } from "lucide-react";
import { useState } from "react";

export interface PollData {
	question: string;
	options: { id: string; text: string }[];
	multi?: boolean;
	anonymous?: boolean;
	endsAt?: string;
	counts?: Record<string, number>;
	total?: number;
	mine?: string[];
	votes?: { option: string; profile: string; at: string }[];
}

/** "Ends in 2 hours", "Ended". */
function endsWords(endsAt?: string): string | null {
	if (!endsAt) return null;
	const ms = new Date(endsAt).getTime() - Date.now();
	if (ms <= 0) return "Ended";
	const h = Math.round(ms / 3600_000);
	if (h >= 36) return `Ends in ${Math.round(h / 24)} days`;
	if (h >= 1) return `Ends in ${h} hour${h === 1 ? "" : "s"}`;
	return `Ends in ${Math.max(1, Math.round(ms / 60_000))} min`;
}

/**
 * A poll inside a bubble (audit G89). Tapping an option votes; in a
 * multiple-choice poll it toggles. Counts and your own picks come from
 * the gateway on every read, so a closed poll still shows its result;
 * an anonymous one shows numbers and never names.
 */
export function PollBubble({
	messageId,
	poll,
	isMe = false,
	onVote,
}: {
	messageId: string;
	poll: PollData;
	/** On my bubble the radio fills with my ink and the check takes the
	 *  accent; on theirs, their ink and their fill. Always single colours. */
	isMe?: boolean;
	onVote: (messageId: string, optionIds: string[]) => Promise<void> | void;
}) {
	const [busy, setBusy] = useState(false);
	const closed = Boolean(poll.endsAt && new Date(poll.endsAt).getTime() <= Date.now());
	const mine = new Set(poll.mine ?? []);
	const total = poll.total ?? 0;
	const counts = poll.counts ?? {};
	const voted = mine.size > 0;
	const ends = endsWords(poll.endsAt);

	const pick = async (id: string) => {
		if (closed || busy) return;
		const next = poll.multi
			? mine.has(id)
				? [...mine].filter((x) => x !== id)
				: [...mine, id]
			: mine.has(id)
				? []
				: [id];
		setBusy(true);
		try {
			await onVote(messageId, next);
		} finally {
			setBusy(false);
		}
	};

	return (
		<div className="w-[268px] max-w-full">
			<p className="font-sans text-[calc(14.5px*var(--ws-fs))] font-semibold leading-snug">{poll.question}</p>
			<p className="mb-2 mt-0.5 font-sans text-[calc(11.5px*var(--ws-fs))] opacity-70">
				{poll.multi ? "Pick as many as you like" : "Pick one"}
				{poll.anonymous ? " · anonymous" : ""}
			</p>
			<div className="flex flex-col gap-1.5">
				{poll.options.map((o) => {
					const n = counts[o.id] ?? 0;
					const pct = total > 0 ? Math.round((n / total) * 100) : 0;
					const on = mine.has(o.id);
					return (
						<button
							key={o.id}
							type="button"
							disabled={closed || busy}
							onClick={(e) => {
								e.stopPropagation();
								void pick(o.id);
							}}
							className="relative flex min-h-[40px] w-full cursor-pointer items-center gap-2 overflow-hidden rounded-[10px] px-3 py-2 text-left transition-opacity disabled:cursor-default"
							style={{ background: "color-mix(in srgb, currentColor 9%, transparent)" }}
						>
							{/* The bar grows behind the text, in the bubble's own ink. */}
							{(voted || closed) && (
								<span
									aria-hidden
									className="absolute inset-y-0 left-0 rounded-[10px] transition-[width] duration-300"
									style={{
										width: `${pct}%`,
										background: "color-mix(in srgb, currentColor 14%, transparent)",
									}}
								/>
							)}
							<span
								className="relative flex h-5 w-5 shrink-0 items-center justify-center rounded-pill"
								style={{
									border: "1.5px solid color-mix(in srgb, currentColor 55%, transparent)",
									background: on ? "currentColor" : "transparent",
								}}
							>
								{on && (
									<Check
										className="h-3 w-3"
										style={{
											color: isMe
												? "var(--chat-accent, var(--ws-brand-primary))"
												: "var(--chat-theirs, var(--ws-bg-raised))",
										}}
									/>
								)}
							</span>
							<span className="relative min-w-0 flex-1 truncate font-sans text-[calc(13.5px*var(--ws-fs))]">
								{o.text}
							</span>
							{(voted || closed) && (
								<span className="relative shrink-0 font-sans text-[calc(12px*var(--ws-fs))] tabular-nums opacity-80">
									{pct}%
								</span>
							)}
						</button>
					);
				})}
			</div>
			<p className="mt-2 font-sans text-[calc(11.5px*var(--ws-fs))] tabular-nums opacity-70">
				{total} {total === 1 ? "vote" : "votes"}
				{ends ? ` · ${ends}` : ""}
			</p>
		</div>
	);
}
