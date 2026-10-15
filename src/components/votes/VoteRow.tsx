"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getVoteCycle } from "@/lib/votes";
import { VoteBox } from "@/components/votes/VoteBox";

/** "1d 10h", "6h 12m", "14m": the two largest units, nothing smaller. */
function leftText(ms: number) {
	const m = Math.floor(ms / 60_000);
	const d = Math.floor(m / 1440);
	const h = Math.floor((m % 1440) / 60);
	if (d > 0) return `${d}d ${h}h`;
	if (h > 0) return `${h}h ${m % 60}m`;
	return `${Math.max(1, m)}m`;
}

/**
 * The Weekly Vote as one quiet row on the right rail (Concept A, 2026-10-15):
 * the ballot box from the left rail as a bare glyph, the prize, and when it
 * closes. The ticking digits live on /votes; a rail that is beside the feed
 * all day only needs to say how long is left, so this re-renders once a
 * minute, and not at all in a hidden tab.
 */
export function VoteRow() {
	const [endsAt, setEndsAt] = useState<number | null>(null);
	const [now, setNow] = useState(() => Date.now());

	useEffect(() => {
		let alive = true;
		void getVoteCycle().then((c) => {
			if (alive && c) setEndsAt(new Date(c.endsAt).getTime());
		});
		const id = setInterval(() => {
			if (document.visibilityState !== "hidden") setNow(Date.now());
		}, 60_000);
		return () => {
			alive = false;
			clearInterval(id);
		};
	}, []);

	const left = endsAt ? endsAt - now : null;
	const closes = endsAt
		? new Intl.DateTimeFormat(undefined, {
				weekday: "short",
				hour: "numeric",
				...(new Date(endsAt).getMinutes() ? { minute: "2-digit" } : {}),
			}).format(endsAt)
		: null;

	return (
		<Link
			href="/votes"
			className="flex items-center gap-3 rounded-xl px-3 py-2 transition-colors hover:bg-primary/5"
		>
			<span className="flex size-9 shrink-0 items-center justify-center text-primary">
				<VoteBox open={false} size={20} />
			</span>
			<span className="flex min-w-0 flex-col">
				<span className="truncate font-sans text-[calc(14px*var(--ws-fs))] font-semibold text-primary">
					Weekly vote · up to $200
				</span>
				{left === null ? (
					<span className="skeleton mt-1 h-3 w-36 rounded" />
				) : (
					<span className="font-sans text-[calc(12px*var(--ws-fs))] tabular-nums text-muted">
						{left > 0
							? `Closes ${closes} · ${leftText(left)} left`
							: "Voting closed, winner incoming"}
					</span>
				)}
			</span>
		</Link>
	);
}
