"use client";

import clsx from "clsx";
import type { ReactNode } from "react";

/**
 * A small glass tooltip for icon buttons (owner pick, Messages round 3):
 * a short verb in frosted glass that appears after a beat on hover or
 * keyboard focus, below the button by default. CSS only, so it costs no
 * state and no portal; use it where the parent does not clip.
 */
export function GlassTip({
	label,
	side = "bottom",
	children,
}: {
	label: string;
	side?: "top" | "bottom";
	children: ReactNode;
}) {
	return (
		<span className="group/tip relative inline-flex">
			{children}
			<span
				role="tooltip"
				className={clsx(
					"pointer-events-none absolute left-1/2 z-dropdown -translate-x-1/2 whitespace-nowrap rounded-pill bg-surface/85 px-2.5 py-1 font-sans text-[calc(12px*var(--ws-fs))] font-semibold text-primary opacity-0 shadow-pop backdrop-blur-xl transition-opacity duration-150",
					"group-hover/tip:opacity-100 group-hover/tip:delay-[400ms] group-focus-within/tip:opacity-100",
					side === "bottom" ? "top-full mt-2" : "bottom-full mb-2",
				)}
			>
				{label}
			</span>
		</span>
	);
}
