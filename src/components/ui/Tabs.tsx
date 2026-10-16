"use client";

import clsx from "clsx";
import { motion } from "framer-motion";
import { CaretLeft, CaretRight, type Icon } from "@phosphor-icons/react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { thumbSpring } from "@/lib/motion-presets";
import { motionReduced } from "@/lib/motion";

/** How far into a row the edge fade reaches, in px. */
const FADE = 48;

export interface TabItem<K extends string = string> {
	key: K;
	label: string;
	/** Phosphor glyph. Filled and gold when the tab is active. */
	Icon?: Icon;
	/** Unread count, rendered as a neutral badge after the label. */
	badge?: number;
	/**
	 * Above this the badge renders `${badgeMax}+`. A cap is right for unread
	 * counts, where "lots" is the whole message; it is wrong for a follower
	 * total, where the number IS the thing you opened the modal to read.
	 */
	badgeMax?: number;
}

/**
 * THE tab control.
 *
 * Two looks, one control. `pill` (the default): chips with a sliding fill.
 * `line`: Home's own row (FeedTabs, owner 2026-10-16, X's grammar), plain
 * words, the active one bold with a short brand bar sliding under it (the
 * hairline under the row is the page's: a header border, or `className`).
 * Communities wears `line` so it reads as one tab
 * system with Home (owner 2026-10-16: "use one tab system for the
 * communities as it's on the home").
 *
 * The pills matched FeedTabs, which was the grammar the app shipped then.
 * Underline tabs kept reappearing on new surfaces because each one was
 * hand-rolled from whatever the nearest reference looked like, so the app had
 * two tab languages at once. There is one here now.
 *
 * The row scrolls rather than wraps: five tabs in a long locale will not fit
 * a 320px phone, and a wrapped second row reads as a different control.
 *
 * The active fill is ONE element that slides between chips (shared layoutId),
 * not a background each chip switches on. The id is per instance: two tab
 * rows on one page sharing an id would throw the thumb from one to the other.
 *
 * A row that overflows SAYS so (owner 2026-10-15, on /voice's fourteen
 * topics: "I didn't even know it's swipable"). The old hint was a static
 * right-edge fade, which reads as a clipped word, not as "more". Now the
 * row measures itself and, on whichever side there is more, fades the
 * edge and puts a round arrow there (mouse and trackpad only; a phone
 * swipes, and keeps the fade). A vertical mouse wheel over the row scrolls
 * it sideways, and the selected chip is always scrolled into view.
 */
export function Tabs<K extends string>({
	items,
	value,
	onChange,
	ariaLabel,
	className,
	rootClassName,
	size = "md",
	variant = "pill",
}: {
	items: TabItem<K>[];
	value: K;
	onChange: (key: K) => void;
	ariaLabel: string;
	/** md = the app default; lg for surfaces owner review wants louder (profile). */
	size?: "md" | "lg";
	/** pill = chips (the default); line = Home's underline row. */
	variant?: "pill" | "line";
	/** On the scrolling row itself (padding overrides, as before). */
	className?: string;
	/** On the wrapper that holds the row and its arrows: sizing in a flex row. */
	rootClassName?: string;
}) {
	const thumbId = useId();
	const row = useRef<HTMLDivElement>(null);
	const [edges, setEdges] = useState({ left: false, right: false });

	const measure = useCallback(() => {
		const el = row.current;
		if (!el) return;
		const left = el.scrollLeft > 1;
		const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
		setEdges((e) => (e.left === left && e.right === right ? e : { left, right }));
	}, []);

	useEffect(() => {
		const el = row.current;
		if (!el) return;
		measure();
		const ro = new ResizeObserver(measure);
		ro.observe(el);
		// A mouse wheel only scrolls vertically; over an overflowing row it
		// moves the row instead, until the row runs out, then the page scrolls.
		const onWheel = (e: WheelEvent) => {
			if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
			const max = el.scrollWidth - el.clientWidth;
			if (max <= 0) return;
			const next = Math.min(max, Math.max(0, el.scrollLeft + e.deltaY));
			if (next === el.scrollLeft) return;
			e.preventDefault();
			el.scrollLeft = next;
		};
		el.addEventListener("wheel", onWheel, { passive: false });
		return () => {
			ro.disconnect();
			el.removeEventListener("wheel", onWheel);
		};
	}, [measure]);

	// The selected chip is never left off-screen, on load or after a change.
	useEffect(() => {
		const el = row.current;
		const chip = el?.querySelector<HTMLElement>('[aria-selected="true"]');
		if (!el || !chip) return;
		const from = chip.offsetLeft - FADE;
		const to = chip.offsetLeft + chip.offsetWidth + FADE - el.clientWidth;
		if (el.scrollLeft > from || el.scrollLeft < to)
			el.scrollTo({
				left: el.scrollLeft > from ? from : to,
				behavior: motionReduced() ? "auto" : "smooth",
			});
	}, [value]);

	const nudge = (dir: -1 | 1) => {
		const el = row.current;
		if (!el) return;
		el.scrollBy({
			left: dir * el.clientWidth * 0.7,
			behavior: motionReduced() ? "auto" : "smooth",
		});
	};

	const mask =
		edges.left || edges.right
			? `linear-gradient(to right, ${edges.left ? "transparent" : "#000"}, #000 ${edges.left ? FADE : 0}px, #000 calc(100% - ${edges.right ? FADE : 0}px), ${edges.right ? "transparent" : "#000"})`
			: undefined;

	const arrow = (dir: -1 | 1) => (
		<button
			type="button"
			tabIndex={-1}
			aria-hidden
			onClick={() => nudge(dir)}
			className={clsx(
				"absolute top-1/2 z-[1] hidden size-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-pill bg-surface text-primary ring-1 ring-hairline transition-colors hover:bg-raised [@media(pointer:fine)]:flex",
				dir < 0 ? "left-0" : "right-0",
			)}
		>
			{dir < 0 ? <CaretLeft size={15} weight="bold" /> : <CaretRight size={15} weight="bold" />}
		</button>
	);

	return (
		<div className={clsx("relative min-w-0", rootClassName)}>
		{edges.left && arrow(-1)}
		{edges.right && arrow(1)}
		<motion.div
			ref={row}
			role="tablist"
			aria-label={ariaLabel}
			onScroll={measure}
			// The row scrolls sideways; without this the thumb is measured as
			// if it did not, and slides from the wrong place.
			layoutScroll
			style={mask ? { maskImage: mask, WebkitMaskImage: mask } : undefined}
			className={clsx(
				variant === "line"
					? "flex overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
					: "flex gap-1.5 overflow-x-auto px-2 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
				className,
			)}
		>
			{items.map(({ key, label, Icon, badge, badgeMax }) => {
				const active = key === value;
				return (
					<button
						key={key}
						type="button"
						role="tab"
						aria-selected={active}
						onClick={() => onChange(key)}
						className={clsx(
							variant === "line"
								? "relative flex h-full min-h-[46px] shrink-0 items-center gap-2 whitespace-nowrap px-4 font-sans text-[calc(15px*var(--ws-fs))] transition-colors"
								: size === "lg"
									? "relative flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-pill px-4 font-sans text-[calc(15px*var(--ws-fs))] transition-colors"
									: "relative flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-pill px-3.5 font-sans text-[calc(13.5px*var(--ws-fs))] transition-colors",
							variant === "line"
								? active
									? "font-bold text-primary"
									: "cursor-pointer font-medium text-muted hover:text-primary"
								: active
									? "font-semibold text-primary"
									: "cursor-pointer font-medium text-muted hover:bg-raised/50 hover:text-primary",
						)}
					>
						{active && (
							<motion.span
								aria-hidden
								layoutId={thumbId}
								transition={thumbSpring}
								className={
									variant === "line"
										? "absolute inset-x-0 bottom-0 mx-auto h-[3px] w-7 rounded-pill bg-brand"
										: "absolute inset-0 rounded-pill bg-raised"
								}
							/>
						)}
						{/* Positioned, so it paints above the thumb. */}
						<span className="relative flex items-center gap-1.5">
							{/* Home's row is plain words: no glyph in the line look. */}
							{Icon && variant !== "line" && (
								<Icon
									size={15}
									weight={active ? "fill" : "regular"}
									className={active ? "text-gold" : undefined}
								/>
							)}
							{label}
							<Badge tone="neutral" count={badge} max={badgeMax} ring={false} />
						</span>
					</button>
				);
			})}
		</motion.div>
		</div>
	);
}
