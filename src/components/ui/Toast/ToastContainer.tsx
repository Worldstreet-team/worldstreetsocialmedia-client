"use client";

import { Toast, ToastPosition } from "./ToastContext";
import { ToastItem } from "./Toast";
import clsx from "clsx";

interface ToastContainerProps {
	toasts: Toast[];
	removeToast: (id: string) => void;
}

const positionClasses: Record<ToastPosition, string> = {
	"top-left": "top-0 left-0 items-start",
	"top-center": "top-0 left-1/2 -translate-x-1/2 items-center",
	"top-right": "top-0 right-0 items-end",
	"bottom-left": "bottom-0 left-0 items-start",
	"bottom-center": "bottom-0 left-1/2 -translate-x-1/2 items-center",
	"bottom-right": "bottom-0 right-0 items-end",
};

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
			{(Object.keys(toastsByPosition) as ToastPosition[]).map((position) => (
				<div
					key={position}
					className={clsx(
						"fixed z-9999 flex flex-col gap-3 p-4 pointer-events-none",
						positionClasses[position],
					)}
				>
					{toastsByPosition[position].map((toast) => (
						<ToastItem key={toast.id} toast={toast} removeToast={removeToast} />
					))}
				</div>
			))}
		</>
	);
};
