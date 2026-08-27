"use client";

import { useMemo, useState } from "react";
import { MagnifyingGlass, Check } from "@phosphor-icons/react";
import clsx from "clsx";
import {
	CATEGORIES,
	VERTICALS,
	MAX_INTERESTS,
	type ContentCategory,
} from "@/data/categories";

/**
 * The interest picker. 100 categories is far too many for a flat grid, so
 * they stay grouped by vertical and a search box cuts across the groups —
 * someone who knows they want "Afrobeats" types it, someone browsing scrolls.
 *
 * Selection is by category ID, never label: the ids are permanent algorithm
 * keys the ranking service stores interest vectors against.
 *
 * `sensitive` categories (politics, betting, mental health…) are shown but
 * never pre-selected — they are opt-in by design.
 */
export function InterestPicker({
	selected,
	onToggle,
}: {
	selected: string[];
	onToggle: (id: string) => void;
}) {
	const [query, setQuery] = useState("");
	const atCap = selected.length >= MAX_INTERESTS;

	const groups = useMemo(() => {
		const q = query.trim().toLowerCase();
		const match = (c: ContentCategory) =>
			!q ||
			c.label.toLowerCase().includes(q) ||
			c.keywords.some((k) => k.includes(q));

		return VERTICALS.map((v) => ({
			vertical: v,
			items: CATEGORIES.filter((c) => c.vertical === v.id && match(c)),
		})).filter((g) => g.items.length > 0);
	}, [query]);

	return (
		<div className="w-full space-y-4">
			<div className="relative">
				<MagnifyingGlass
					size={16}
					className="absolute left-4 top-1/2 -translate-y-1/2 text-subtle pointer-events-none"
				/>
				<input
					type="text"
					value={query}
					onChange={(e) => setQuery(e.target.value)}
					placeholder="Search topics"
					aria-label="Search topics"
					// text-base on touch: a smaller field makes iOS zoom the card.
					className="glass-tile w-full rounded-pill h-11 pl-10 pr-4 text-primary placeholder:text-subtle outline-none focus:ring-2 focus:ring-brand/40 font-sans text-base sm:text-sm transition-colors"
				/>
			</div>

			{/* The cap is a HEIGHT BUDGET, not a taste call: the card also carries
			    a lockup, progress, heading, caption, search field, count and two
			    buttons. At 42dvh the whole thing overran the viewport and pushed
			    "Create profile" below the fold — the one control the step exists
			    to reach. 32dvh keeps the CTA on screen down to a laptop. */}
			<div className="max-h-[min(300px,32dvh)] overflow-y-auto overscroll-contain pr-1 space-y-5 text-left">
				{groups.map(({ vertical, items }) => (
					<section key={vertical.id} className="space-y-2">
						<div className="px-0.5">
							<h3 className="font-sans text-[10px] font-semibold uppercase tracking-[0.14em] text-subtle">
								{vertical.label}
							</h3>
						</div>
						<div className="flex flex-wrap gap-2">
							{items.map((c) => {
								const on = selected.includes(c.id);
								// At the cap, unselected chips go inert rather than
								// silently doing nothing when tapped.
								const locked = atCap && !on;
								return (
									<button
										key={c.id}
										type="button"
										onClick={() => !locked && onToggle(c.id)}
										aria-pressed={on}
										disabled={locked}
										className={clsx(
											"inline-flex items-center gap-1.5 min-h-9 px-3 rounded-pill font-sans text-[13px] font-medium transition-colors",
											on
												? "glass-tile glass-tile-on text-primary"
												: "glass-tile text-muted hover:text-primary",
											locked && "opacity-40 cursor-not-allowed",
											!locked && "cursor-pointer",
										)}
									>
										{on && (
											<Check
												size={12}
												weight="bold"
												className="text-gold shrink-0"
											/>
										)}
										{c.label}
									</button>
								);
							})}
						</div>
					</section>
				))}

				{groups.length === 0 && (
					<p className="text-muted text-sm font-sans py-6 text-center">
						No topics match “{query}”.
					</p>
				)}
			</div>
		</div>
	);
}
