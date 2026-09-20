"use client";

import { AnimatePresence } from "framer-motion";
import { Toast, ToastPosition } from "./ToastContext";
import { ToastItem } from "./Toast";
import clsx from "clsx";

interface ToastContainerProps {
	toasts: Toast[];
	removeToast: (id: string) => void;
}

/* Bottom-anchored toasts sit at z-toast (1200), which is above the fixed
   MobileBottomNav (z-sticky, 100) they used to cover the tab bar outright.
   `pb-nav` lifts them clear of it on phones; `md:pb-4` restores the plain
   16px gutter once the bar is gone. Left/right anchoring also collapses to
   full-width on phones so a 280px pill can't sit half off a 320px screen. */
const positionClasses: Record<ToastPosition, string> = {
	"top-left": "top-0 left-0 right-0 sm:right-auto items-stretch sm:items-start pt-safe",
	"top-center": "top-0 left-0 right-0 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 items-stretch sm:items-center pt-safe",
	"top-right": "top-0 left-0 right-0 sm:left-auto items-stretch sm:items-end pt-safe",
	"bottom-left":
		"bottom-0 left-0 right-0 sm:right-auto items-stretch sm:items-start pb-nav md:pb-4",
	"bottom-center":
		"bottom-0 left-0 right-0 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 items-stretch sm:items-center pb-nav md:pb-4",
	"bottom-right":
		"bottom-0 left-0 right-0 sm:left-auto items-stretch sm:items-end pb-nav md:pb-4",
};

/* Every position's container is always mounted (empty, click-through).
   They used to exist only while they held a toast, which meant the LAST
   toast took its container, and the AnimatePresence in it, away with it and
   had nowhere to play an exit. */
const POSITIONS = Object.keys(positionClasses) as ToastPosition[];

export const ToastContainer = ({
	toasts,
	removeToast,
}: ToastContainerProps) => {
	// Group toasts by position so we can render multiple containers if needed
	const toastsByPosition = toasts.reduce(
		(acc, toast) => {
			const pos = toast.position || "bottom-right";
			if (!acc[pos]) acc[pos] = [];
			acc[pos].push(toast);
			return acc;
		},
		{} as Record<ToastPosition, Toast[]>,
	);

	return (
		<>
			{POSITIONS.map((position) => (
				<div
					key={position}
					className={clsx(
						"fixed z-toast flex flex-col gap-3 p-4 pointer-events-none",
						positionClasses[position],
					)}
				>
					{/* popLayout lifts the leaving toast out of the column so the
					    others close up at once (each glides: `layout` on the item).
					    The anchors pin it to the corner the column hangs from,
					    because the column resizes the moment it is lifted out. */}
					<AnimatePresence
						mode="popLayout"
						anchorX={position.endsWith("right") ? "right" : "left"}
						anchorY={position.startsWith("bottom") ? "bottom" : "top"}
					>
						{(toastsByPosition[position] ?? []).map((toast) => (
							<ToastItem
								key={toast.id}
								toast={toast}
								removeToast={removeToast}
							/>
						))}
					</AnimatePresence>
				</div>
			))}
		</>
	);
};
