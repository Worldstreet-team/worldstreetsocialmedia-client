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
const icons = {
	success: <Check className="w-4 h-4 text-success" />,
	error: <X className="w-4 h-4 text-danger" />,
	warning: <AlertTriangle className="w-4 h-4 text-warning" />,
	info: <Bell className="w-4 h-4 text-muted" />,
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
				"flex items-center gap-2.5 px-3.5 py-3 min-w-[280px] max-w-md rounded-lg bg-raised border border-hairline shadow-nav pointer-events-auto cursor-pointer",
				"transition-[opacity,transform] duration-[var(--ws-motion-base)] ease-ws",
				isVisible ? "opacity-100 translate-x-0 translate-y-0" : clsx("opacity-0", offscreen),
			)}
			onClick={handleDismiss}
			role={isDanger ? "alert" : "status"}
			aria-live={isDanger ? "assertive" : "polite"}
		>
			<span className="shrink-0">{icons[toast.type]}</span>
			<p className="flex-1 text-sm font-medium font-sans text-primary">
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
