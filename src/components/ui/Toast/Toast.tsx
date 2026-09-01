"use client";

import React, { useEffect, useState } from "react";
import clsx from "clsx";
// 03-icons: `check`, `x`, `bell` are in-set. `alert-triangle` is a justified
// deviation — the standardized set has no warning glyph.
import { X, Check, Bell, AlertTriangle } from "lucide-react";
import { Toast } from "./ToastContext";

interface ToastProps {
	toast: Toast;
	removeToast: (id: string) => void;
}

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
		<span className="flex h-6 w-6 items-center justify-center rounded-pill bg-success/15">
			<Check className="h-3.5 w-3.5 text-success" />
		</span>
	),
	error: (
		<span className="flex h-6 w-6 items-center justify-center rounded-pill bg-danger/15">
			<X className="h-3.5 w-3.5 text-danger" />
		</span>
	),
	warning: (
		<span className="flex h-6 w-6 items-center justify-center rounded-pill bg-warning/15">
			<AlertTriangle className="h-3.5 w-3.5 text-warning" />
		</span>
	),
	info: (
		<span className="flex h-6 w-6 items-center justify-center rounded-pill bg-primary/10">
			<Bell className="h-3.5 w-3.5 text-muted" />
		</span>
	),
};

export const ToastItem = ({ toast, removeToast }: ToastProps) => {
	const [isVisible, setIsVisible] = useState(false);

	useEffect(() => {
		requestAnimationFrame(() => setIsVisible(true));
	}, []);

	const handleDismiss = () => {
		setIsVisible(false);
		// Exits are a fast fade (06-motion-accessibility); ~fast token.
		setTimeout(() => removeToast(toast.id), 120);
	};

	// Danger interrupts; everything else is polite.
	const isDanger = toast.type === "error";

	// Enter translates in from the nearest edge, kept to the spec's small
	// transform budget rather than a full-width slide.
	const offscreen = toast.position?.includes("right")
		? "translate-x-2"
		: toast.position?.includes("left")
			? "-translate-x-2"
			: toast.position?.includes("bottom")
				? "translate-y-2"
				: "-translate-y-2";

	return (
		<output
			className={clsx(
				// min-w-0 on phones (the container stretches it full-width);
				// the 280px floor only applies once there's room for it.
				// Adaptive frost (glass-frost follows the theme) with the blur
				// at the usage site, per the one-blur-per-stack rule. No
				// border: the frost IS the surface; shadow-nav keeps it lifted
				// off whatever it floats over.
				"flex items-center gap-3 px-3.5 py-3 w-full sm:w-auto sm:min-w-[280px] max-w-full sm:max-w-md rounded-xl glass-frost backdrop-blur-xl backdrop-saturate-150 shadow-nav pointer-events-auto cursor-pointer",
				"transition-[opacity,transform] duration-[var(--ws-motion-base)] ease-ws",
				isVisible
					? "opacity-100 translate-x-0 translate-y-0 scale-100"
					: clsx("opacity-0 scale-[0.98]", offscreen),
			)}
			onClick={handleDismiss}
			role={isDanger ? "alert" : "status"}
			aria-live={isDanger ? "assertive" : "polite"}
		>
			<span className="shrink-0">{icons[toast.type]}</span>
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
		</output>
	);
};
