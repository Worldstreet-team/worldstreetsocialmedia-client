"use client";

import {
	RiArrowGoBackLine,
	RiPhoneFill,
	RiPhoneLine,
	RiVideoOnFill,
} from "@remixicon/react";
import clsx from "clsx";
import { viaLabel } from "@/lib/platform";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { press } from "@/lib/motion-presets";

/**
 * A finished call, in the thread.
 *
 * Centred rather than a bubble: a call isn't something either person said,
 * so a speech bubble on one side would misattribute it.
 *
 * It used to be a bare red pill of text, which read as an error toast that
 * had wandered into the conversation. Now it is a small card: the outcome in
 * an icon disc, the line, the time — and on a missed or cancelled call, a
 * call-back affordance, because the one thing you want from a missed call is
 * to return it, not to read about it.
 */
export function CallLogRow({
	content,
	at,
	source,
	mine,
	onCallBack,
}: {
	content: string;
	at?: string;
	/** The platform the call was placed from; named when it is not home. */
	source?: string;
	/** The caller logs the call, so the sender IS the caller: the row sits
	 *  on their shore like any other message (owner pick 2026-09-03). */
	mine?: boolean;
	onCallBack?: (video: boolean) => void;
}) {
	const missed = /missed|declined|cancelled/i.test(content);
	const video = /video/i.test(content);
	// No phone-slash in the Remix core set — a missed call reads from the
	// danger disc plus the outline (vs filled) phone.
	const Icon = missed ? RiPhoneLine : video ? RiVideoOnFill : RiPhoneFill;

	return (
		// py, not my: this renders inside a virtuoso item, and a margin at the
		// edge of an item collapses out of the box the list measures.
		<div className={clsx("flex px-4 py-2 sm:px-6", mine ? "justify-end" : "justify-start")}>
			<div
				// The card sits on the sender's shore, so it wears that shore's
				// fill and ink (audit 2026-09-25: it was the raised token, a grey
				// slab beside coloured bubbles on every theme but the house one).
				className="chat-bubble-ink flex items-center gap-3 py-2 pl-2.5 pr-3"
				style={{
					borderRadius: "var(--chat-r, 22px)",
					background: mine ? "var(--chat-mine, var(--ws-bg-raised))" : "var(--chat-theirs, var(--ws-bg-raised))",
					color: mine ? "var(--chat-mine-ink, var(--ws-text-primary))" : "var(--chat-theirs-ink, var(--ws-text-primary))",
				}}
			>
				<span
					className={clsx(
						"flex h-9 w-9 shrink-0 items-center justify-center rounded-pill",
						missed ? "bg-danger/15 text-danger" : "bg-success/15 text-success",
					)}
				>
					<Icon size={17} />
				</span>
				<span className="min-w-0">
					<span className="block truncate font-sans text-[calc(13px*var(--ws-fs))] font-medium">
						{content}
					</span>
					{(at || viaLabel(source)) && (
						<span className="block font-sans text-[calc(12px*var(--ws-fs))] tabular-nums opacity-70">
							{at ? format(new Date(at), "h:mm a") : null}
							{at && viaLabel(source) ? " · " : null}
							{viaLabel(source)}
						</span>
					)}
				</span>
				{missed && onCallBack && (
					<motion.button
						type="button"
						{...press}
						onClick={() => onCallBack(video)}
						className="ml-1 flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-pill px-3 font-sans text-[calc(12px*var(--ws-fs))] font-semibold transition-opacity hover:opacity-85"
						style={{ background: "color-mix(in srgb, currentColor 18%, transparent)" }}
					>
						<RiArrowGoBackLine size={14} />
						Call back
					</motion.button>
				)}
			</div>
		</div>
	);
}
