"use client";

import { PhoneCall, PhoneX, VideoCamera } from "@phosphor-icons/react";
import clsx from "clsx";

/**
 * A finished call, in the thread.
 *
 * Centred and chip-shaped rather than a bubble: a call isn't something either
 * person said, so giving it a speech bubble on one side would misattribute it.
 */
export function CallLogRow({ content }: { content: string }) {
	const missed = /missed|declined|cancelled/i.test(content);
	const video = /video/i.test(content);
	const Icon = missed ? PhoneX : video ? VideoCamera : PhoneCall;

	return (
		<div className="mb-4 flex justify-center">
			<span
				className={clsx(
					"inline-flex items-center gap-2 rounded-pill bg-raised px-3 py-1.5 text-xs",
					missed ? "text-danger" : "text-muted",
				)}
			>
				<Icon size={14} weight="fill" />
				<span className="tabular-nums">{content}</span>
			</span>
		</div>
	);
}
