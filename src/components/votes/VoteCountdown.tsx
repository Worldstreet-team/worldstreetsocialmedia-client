"use client";

import { useEffect, useState } from "react";
import { getVoteCycle } from "@/lib/votes";

/**
 * The dramatic clock. Gold, tabular, ticking every second toward Friday
 * 11:59 PM — the same numbers on the /votes stage and the right rail, so
 * the whole app agrees on when the race ends. Flips to the closed line at
 * zero.
 */
export function VoteCountdown({
	size = "md",
}: {
	/** md = right rail; lg = the /votes stage. */
	size?: "md" | "lg";
}) {
	const [endsAt, setEndsAt] = useState<number | null>(null);
	const [now, setNow] = useState(() => Date.now());

	useEffect(() => {
		let alive = true;
		void getVoteCycle().then((c) => {
			if (alive && c) setEndsAt(new Date(c.endsAt).getTime());
		});
		const t = setInterval(() => setNow(Date.now()), 1000);
		return () => {
			alive = false;
			clearInterval(t);
		};
	}, []);

	if (!endsAt) {
		return (
			<span
				className={
					size === "lg"
						? "skeleton inline-block h-10 w-64 rounded-[7px]"
						: "skeleton inline-block h-6 w-40 rounded-[4px]"
				}
			/>
		);
	}

	const left = Math.max(0, endsAt - now);
	if (left === 0) {
		return (
			<span
				className={
					size === "lg"
						? "font-display text-2xl font-semibold text-gold"
						: "font-display text-sm font-semibold text-gold"
				}
			>
				Voting closed — winner incoming
			</span>
		);
	}
	const d = Math.floor(left / 86_400_000);
	const h = Math.floor((left % 86_400_000) / 3_600_000);
	const m = Math.floor((left % 3_600_000) / 60_000);
	const s = Math.floor((left % 60_000) / 1000);
	const pad = (n: number) => String(n).padStart(2, "0");

	const cells: [string, string][] = [
		[pad(d), "days"],
		[pad(h), "hrs"],
		[pad(m), "min"],
		[pad(s), "sec"],
	];

	return (
		<span
			className={
				size === "lg"
					? "flex items-end gap-3"
					: "flex items-end gap-2"
			}
			role="timer"
			aria-label="Time left in this week's vote"
		>
			{cells.map(([v, l]) => (
				<span key={l} className="flex flex-col items-center">
					<span
						className={
							size === "lg"
								? "font-display text-[40px] font-semibold leading-none tabular-nums text-gold"
								: "font-display text-[19px] font-semibold leading-none tabular-nums text-gold"
						}
					>
						{v}
					</span>
					<span
						className={
							size === "lg"
								? "mt-1.5 font-sans text-[11px] uppercase tracking-widest text-subtle"
								: "mt-1 font-sans text-[9.5px] uppercase tracking-widest text-subtle"
						}
					>
						{l}
					</span>
				</span>
			))}
		</span>
	);
}
