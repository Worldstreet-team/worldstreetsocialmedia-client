"use client";

import type { Ref } from "react";
import { motion } from "framer-motion";
// 03-icons: `check`, `x`, `bell` are in-set. `alert-triangle` is a justified
// deviation — the standardized set has no warning glyph.
import { X, Check, Bell, AlertTriangle } from "lucide-react";
import { menuStagger, snappySpring, staggerPop } from "@/lib/motion-presets";
import type { Toast, ToastPosition } from "./ToastContext";

interface ToastProps {
	toast: Toast;
	removeToast: (id: string) => void;
	/** AnimatePresence (popLayout) measures the pill through this. */
	ref?: Ref<HTMLOutputElement>;
}

// A toast unfolds from the screen corner it is pinned to, so the six
// positions map straight onto the menu preset's origins.
const ORIGIN: Record<ToastPosition, Parameters<typeof menuStagger>[0]> = {
	"top-left": "top-left",
	"top-center": "top",
	"top-right": "top-right",
	"bottom-left": "bottom-left",
	"bottom-center": "bottom",
	"bottom-right": "bottom-right",
};

/**
 * 04-components "Toast": horizontal pill-card, padding 12/14, gap 10,
 * radius 10, fill bg/raised, hairline border, Shadow/Nav. Leading 16px icon in
 * the tone color, message Medium 14 text/primary, trailing 13px x in
 * text/subtle.
 *
 * Tone -> token: success = status/success, error = status/danger,
 * warning = status/warning, info = text/muted (the spec's neutral bell).
 */
/**
 * The glyph sits in a tone-tinted puck rather than floating bare: on a
 * translucent surface a lone 16px icon reads as debris, while a small
 * filled disc gives the message an anchor and carries the tone without
 * tinting the whole pill.
 */
const icons = {
	success: (
		<span className="flex h-7 w-7 items-center justify-center rounded-pill bg-success/20 ring-1 ring-success/25">
			<Check className="h-[15px] w-[15px] text-success" strokeWidth={2.6} />
		</span>
	),
	error: (
		<span className="flex h-7 w-7 items-center justify-center rounded-pill bg-danger/20 ring-1 ring-danger/25">
			<X className="h-[15px] w-[15px] text-danger" strokeWidth={2.6} />
		</span>
	),
	warning: (
		<span className="flex h-7 w-7 items-center justify-center rounded-pill bg-warning/20 ring-1 ring-warning/25">
			<AlertTriangle className="h-[15px] w-[15px] text-warning" strokeWidth={2.4} />
		</span>
	),
	info: (
		<span className="flex h-7 w-7 items-center justify-center rounded-pill bg-primary/15 ring-1 ring-primary/20">
			<Bell className="h-[15px] w-[15px] text-primary" strokeWidth={2.2} />
		</span>
	),
};

export const ToastItem = ({ toast, removeToast, ref }: ToastProps) => {
	// No timer and no visible flag any more: the container's AnimatePresence
	// plays the exit for EVERY removal. The old hand-rolled fade only ran for
	// a click; the 4s auto-dismiss pulled the toast from state directly and
	// it simply vanished.
	const handleDismiss = () => removeToast(toast.id);

	// Danger interrupts; everything else is polite.
	const isDanger = toast.type === "error";

	return (
		<motion.output
			ref={ref}
			// Position only: when a neighbour leaves, the rest glide into the
			// gap instead of jumping. A spring, because a second toast can
			// leave while the first reflow is still in flight.
			layout="position"
			{...menuStagger(ORIGIN[toast.position ?? "bottom-right"])}
			transition={{ layout: snappySpring }}
			className={
				// min-w-0 on phones (the container stretches it full-width);
				// the 280px floor only applies once there's room for it.
				// Adaptive frost (glass-frost follows the theme) with the blur
				// at the usage site, per the one-blur-per-stack rule. No
				// border: the frost IS the surface; shadow-nav keeps it lifted
				// off whatever it floats over.
				"flex items-center gap-3 px-3.5 py-3 w-full sm:w-auto sm:min-w-[280px] max-w-full sm:max-w-md rounded-[18px] glass-toast backdrop-blur-2xl backdrop-saturate-150 pointer-events-auto cursor-pointer"
			}
			onClick={handleDismiss}
			role={isDanger ? "alert" : "status"}
			aria-live={isDanger ? "assertive" : "polite"}
		>
			{/* The puck lands a beat after the pill, with the small-glyph
			    overshoot: it is 28px, the pill itself never bounces. */}
			<motion.span variants={staggerPop} className="shrink-0">
				{icons[toast.type]}
			</motion.span>
			<p className="flex-1 min-w-0 text-sm font-medium font-sans text-primary break-words">
				{toast.message}
			</p>
			<button
				type="button"
				aria-label="Dismiss notification"
				onClick={(e) => {
					e.stopPropagation();
					handleDismiss();
				}}
				className="shrink-0 flex h-10 w-10 -my-2 -mr-2 items-center justify-center rounded-pill text-subtle hover:text-primary transition-colors cursor-pointer"
			>
				<X className="w-[13px] h-[13px]" />
			</button>
		</motion.output>
	);
};
