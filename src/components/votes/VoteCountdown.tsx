"use client";

import { useEffect, useState } from "react";
import { getVoteCycle } from "@/lib/votes";

/**
 * The clock, redesigned (owner note: the flat gold line read bland).
 * Each unit sits in its own quiet raised tile — gold tabular digits, tiny
 * uppercase labels — over a hairline track that fills as the week burns
 * down. No card behind it: the tiles ARE the surface, so it floats on the
 * page instead of sitting in a bright box.
 */
export function VoteCountdown({
	size = "md",
}: {
	/** md = right rail / sidebar; lg = the /votes stage. */
	size?: "md" | "lg";
}) {
	const [endsAt, setEndsAt] = useState<number | null>(null);
	const [now, setNow] = useState(() => Date.now());

	useEffect(() => {
		let alive = true;
		void getVoteCycle().then((c) => {
			if (alive && c) setEndsAt(new Date(c.endsAt).getTime());
		});
		// Render-only tick, but it mounts app-wide via the rail — a hidden
		// tab has no business re-rendering every second (audit 2026-09-01).
		const t = setInterval(() => {
			if (document.visibilityState !== "hidden") setNow(Date.now());
		}, 1000);
		return () => {
			alive = false;
			clearInterval(t);
		};
	}, []);

	const lg = size === "lg";

	if (!endsAt) {
		return (
			<span
				className={
					lg
						? "skeleton inline-block h-14 w-72 rounded-[7px]"
						: "skeleton inline-block h-9 w-44 rounded-[7px]"
				}
			/>
		);
	}

	const left = Math.max(0, endsAt - now);
	if (left === 0) {
		return (
			<span
				className={
					lg
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
		<div
			className={lg ? "inline-flex flex-col gap-2.5" : "inline-flex flex-col gap-2"}
			role="timer"
			aria-label="Time left in this week's vote"
		>
			<div className={lg ? "flex items-center gap-2" : "flex items-center gap-1.5"}>
				{cells.map(([v, l], i) => (
					<span key={l} className="flex items-center gap-1.5">
						{i > 0 && (
							<span
								className={
									lg
										? "-mt-4 font-display text-xl font-semibold text-subtle"
										: "-mt-3 font-display text-[13px] font-semibold text-subtle"
								}
							>
								:
							</span>
						)}
						<span className="flex flex-col items-center gap-1">
							<span
								className={
									lg
										? "flex min-w-[62px] items-center justify-center rounded-[10px] bg-raised px-2.5 py-2.5 font-display text-[32px] font-semibold leading-none tabular-nums text-gold"
										: "flex min-w-[36px] items-center justify-center rounded-[7px] bg-raised px-1.5 py-1.5 font-display text-[16px] font-semibold leading-none tabular-nums text-gold"
								}
							>
								{v}
							</span>
							<span
								className={
									lg
										? "font-sans text-[10px] font-semibold uppercase tracking-[0.18em] text-subtle"
										: "font-sans text-[8.5px] font-semibold uppercase tracking-[0.16em] text-subtle"
								}
							>
								{l}
							</span>
						</span>
					</span>
				))}
			</div>
		</div>
	);
}
