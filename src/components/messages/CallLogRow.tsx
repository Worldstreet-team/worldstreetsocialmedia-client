"use client";

import {
	ArrowUUpLeft,
	PhoneCall,
	PhoneX,
	VideoCamera,
} from "@phosphor-icons/react";
import clsx from "clsx";
import { format } from "date-fns";

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
	onCallBack,
}: {
	content: string;
	at?: string;
	onCallBack?: (video: boolean) => void;
}) {
	const missed = /missed|declined|cancelled/i.test(content);
	const video = /video/i.test(content);
	const Icon = missed ? PhoneX : video ? VideoCamera : PhoneCall;

	return (
		<div className="my-4 flex justify-center">
			<div className="flex items-center gap-3 rounded-xl bg-raised py-2 pl-2.5 pr-3">
				<span
					className={clsx(
						"flex h-9 w-9 shrink-0 items-center justify-center rounded-pill",
						missed ? "bg-danger/15 text-danger" : "bg-success/15 text-success",
					)}
				>
					<Icon size={16} weight="fill" />
				</span>
				<span className="min-w-0">
					<span className="block truncate font-sans text-[13px] font-medium text-primary">
						{content}
					</span>
					{at && (
						<span className="block font-sans text-[11px] tabular-nums text-subtle">
							{format(new Date(at), "h:mm a")}
						</span>
					)}
				</span>
				{missed && onCallBack && (
					<button
						type="button"
						onClick={() => onCallBack(video)}
						className="ml-1 flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-pill bg-chip px-3 font-sans text-[12px] font-semibold text-primary transition-colors hover:bg-primary hover:text-page"
					>
						<ArrowUUpLeft size={13} weight="bold" />
						Call back
					</button>
				)}
			</div>
		</div>
	);
}
