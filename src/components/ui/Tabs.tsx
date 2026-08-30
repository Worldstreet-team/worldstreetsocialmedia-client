"use client";

import clsx from "clsx";
import type { Icon } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/Badge";

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
 * Pill chips, matching FeedTabs, which is the grammar the app actually ships.
 * Underline tabs kept reappearing on new surfaces because each one was
 * hand-rolled from whatever the nearest reference looked like, so the app had
 * two tab languages at once. There is one here now.
 *
 * The row scrolls rather than wraps: five tabs in a long locale will not fit
 * a 320px phone, and a wrapped second row reads as a different control.
 */
export function Tabs<K extends string>({
	items,
	value,
	onChange,
	ariaLabel,
	className,
	size = "md",
}: {
	items: TabItem<K>[];
	value: K;
	onChange: (key: K) => void;
	ariaLabel: string;
	/** md = the app default; lg for surfaces owner review wants louder (profile). */
	size?: "md" | "lg";
	className?: string;
}) {
	return (
		<div
			role="tablist"
			aria-label={ariaLabel}
			className={clsx(
				"flex gap-1.5 overflow-x-auto px-2 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
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
							size === "lg"
								? "relative flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-pill px-4 font-sans text-[15px] transition-colors"
								: "relative flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-pill px-3.5 font-sans text-[13.5px] transition-colors",
							active
								? "bg-raised font-semibold text-primary"
								: "cursor-pointer font-medium text-muted hover:bg-raised/50 hover:text-primary",
						)}
					>
						{Icon && (
							<Icon
								size={15}
								weight={active ? "fill" : "regular"}
								className={active ? "text-gold" : undefined}
							/>
						)}
						{label}
						<Badge tone="neutral" count={badge} max={badgeMax} ring={false} />
					</button>
				);
			})}
		</div>
	);
}
