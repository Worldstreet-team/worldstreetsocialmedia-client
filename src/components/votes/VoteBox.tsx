"use client";

import clsx from "clsx";

/**
 * The ballot box — a little carton whose lid flaps swing open when a vote
 * lands (owner sample: the open-box mark). Pure SVG, animated with CSS
 * transforms only, so it obeys the motion rules and reduced-motion for
 * free. `open` is momentary: the chip opens it on a successful vote and
 * lets it fall shut again.
 */
export function VoteBox({
	open,
	size = 18,
	className,
}: {
	open: boolean;
	size?: number;
	className?: string;
}) {
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2.1"
			strokeLinecap="round"
			strokeLinejoin="round"
			className={clsx("shrink-0", className)}
			aria-hidden
		>
			<path d="M4 9.5 L12 13.5 L20 9.5 L20 16.5 L12 20.5 L4 16.5 Z" />
			<path d="M12 13.5 L12 20.5" strokeWidth="1.6" opacity="0.55" />
			<g
				style={{
					transform: open ? "rotate(-78deg)" : "rotate(0deg)",
					transformOrigin: "4px 9.5px",
					transition: "transform 320ms var(--ws-ease)",
				}}
			>
				<path d="M4 9.5 L11.4 12.9" />
			</g>
			<g
				style={{
					transform: open ? "rotate(78deg)" : "rotate(0deg)",
					transformOrigin: "20px 9.5px",
					transition: "transform 320ms var(--ws-ease)",
				}}
			>
				<path d="M20 9.5 L12.6 12.9" />
			</g>
		</svg>
	);
}
