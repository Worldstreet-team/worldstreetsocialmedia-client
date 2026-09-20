"use client";

import clsx from "clsx";
import { motion } from "framer-motion";
import { snappySpring } from "@/lib/motion-presets";

/**
 * The house switch: a track and a thumb, the shape people already know
 * from their phone's own settings.
 *
 * A native checkbox is the wrong affordance for a preference that takes
 * effect the moment it is touched — a tick reads as "this will apply when
 * I submit something". This reads as a state.
 *
 * Built as a real `button role="switch"`, so a screen reader announces on
 * and off and the keyboard drives it. The track is a 44px-tall hit area
 * with a 24px painted track inside it, because the target must clear the
 * minimum even though the drawn control is smaller (house rule).
 */
export function Switch({
	checked,
	onChange,
	disabled,
	label,
	className,
}: {
	checked: boolean;
	onChange: (next: boolean) => void;
	disabled?: boolean;
	/** For the accessible name when the visible label is elsewhere. */
	label?: string;
	className?: string;
}) {
	return (
		<button
			type="button"
			role="switch"
			aria-checked={checked}
			aria-label={label}
			disabled={disabled}
			onClick={() => onChange(!checked)}
			className={clsx(
				"group relative flex h-11 w-[52px] shrink-0 items-center justify-center rounded-pill",
				disabled ? "cursor-default opacity-50" : "cursor-pointer",
				className,
			)}
		>
			{/* Track */}
			<span
				aria-hidden
				className={clsx(
					"relative block h-[26px] w-[46px] rounded-pill transition-colors",
					checked ? "bg-brand" : "bg-chip",
				)}
			>
				{/* Thumb. Translate, never scale — the house forbids scale on
				    hover, and a sliding thumb is the whole affordance. A spring,
				    not a bezier: a toggle gets flipped back mid-flight, and a
				    spring turns round where a curve would restart. It rides
				    `x`, not `left`, so the slide never touches layout.
				    `initial={false}`: a switch that loads ON is on, it does not
				    slide there. */}
				<motion.span
					initial={false}
					animate={{ x: checked ? 20 : 0 }}
					transition={snappySpring}
					className="absolute left-[3px] top-[3px] block h-5 w-5 rounded-pill bg-page shadow-nav"
				/>
			</span>
		</button>
	);
}
