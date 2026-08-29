"use client";

import clsx from "clsx";
import { SafeAvatar } from "@/components/ui/SafeAvatar";

/**
 * The face inside a live ring. Solo broadcast: the host, exactly as before.
 * A merged stage overlaps a co-host SATELLITE onto the ring — the collab
 * grammar every platform trained people on — rather than splitting the
 * circle: overlap keeps both faces whole, where vertical halves cropped
 * every avatar that wasn't a centred portrait to an unrecognisable sliver.
 *
 * The satellite sits top-right, because bottom-centre belongs to the LIVE
 * chip. Three or more on stage adds a +N pip under the satellite.
 *
 * Owns the inner circle (the clipping boundary the satellite must escape);
 * the consumer keeps the outer ring, its colour and the LIVE chip.
 */
export function StageAvatar({
	avatar,
	stage,
	innerClassName,
}: {
	avatar?: string;
	stage?: { username: string; avatar: string }[];
	/** The inner circle's ground/border, per surface. */
	innerClassName?: string;
}) {
	const live = stage ?? [];
	const extra = live.length - 1;
	return (
		<>
			<span
				className={clsx(
					"relative block h-full w-full overflow-hidden rounded-pill",
					innerClassName,
				)}
			>
				<SafeAvatar src={avatar} />
			</span>
			{live.length > 0 && (
				<span className="absolute -right-1 -top-1 h-[45%] w-[45%] overflow-hidden rounded-pill border-2 border-page bg-raised">
					<SafeAvatar src={live[0].avatar} />
				</span>
			)}
			{extra > 0 && (
				<span className="absolute -left-1 -top-1 rounded-pill border border-page bg-raised px-1 font-sans text-[8px] font-bold leading-[13px] text-primary tabular-nums">
					+{extra}
				</span>
			)}
		</>
	);
}
