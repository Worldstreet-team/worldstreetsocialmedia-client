"use client";

import { SafeAvatar } from "@/components/ui/SafeAvatar";

/**
 * The face inside a live ring. Solo broadcast: the host, exactly as before.
 * A merged stage: the circle SPLITS — host on the left half, first co-host
 * on the right, a hairline of the page ground between them — so the rail
 * says "two people are live here" before anyone taps in. Three or more on
 * stage adds a +N pip over the seam.
 *
 * The split is vertical halves, not a diagonal or quadrants: at 56px a face
 * survives losing its sides far better than losing its top or bottom, and
 * two half-faces side by side is the established duo grammar everywhere.
 */
export function StageAvatar({
	avatar,
	stage,
}: {
	avatar?: string;
	stage?: { username: string; avatar: string }[];
}) {
	const live = stage ?? [];
	if (live.length === 0) return <SafeAvatar src={avatar} />;

	const extra = live.length - 1;
	return (
		<span className="absolute inset-0 flex">
			<span className="relative h-full w-1/2 overflow-hidden">
				<SafeAvatar src={avatar} />
			</span>
			<span aria-hidden className="h-full w-px shrink-0 bg-page" />
			<span className="relative h-full w-1/2 overflow-hidden">
				<SafeAvatar src={live[0].avatar} />
			</span>
			{extra > 0 && (
				// Top of the seam, not the bottom: the ring's LIVE chip already
				// owns bottom-centre and the two would collide.
				<span className="absolute top-0 left-1/2 -translate-x-1/2 rounded-pill bg-page px-1 font-sans text-[8px] font-bold leading-[12px] text-primary tabular-nums">
					+{extra}
				</span>
			)}
		</span>
	);
}
