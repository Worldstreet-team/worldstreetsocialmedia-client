"use client";

import React, { useEffect, useState } from "react";
import clsx from "clsx";
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from "lucide-react";
import { Toast, ToastType } from "./ToastContext";

interface ToastProps {
	toast: Toast;
	removeToast: (id: string) => void;
}

const icons = {
	success: <CheckCircle className="w-5 h-5 text-green-600" />,
	error: <AlertCircle className="w-5 h-5 text-red-600" />,
	info: <Info className="w-5 h-5 text-blue-600" />,
	warning: <AlertTriangle className="w-5 h-5 text-yellow-600" />,
};

const borderColors = {
	success: "border-green-600",
	error: "border-red-600",
	info: "border-blue-600",
	warning: "border-yellow-600",
};

const shadowColors = {
	success: "shadow-[4px_4px_0px_0px_rgba(22,163,74,1)]", // green-600
	error: "shadow-[4px_4px_0px_0px_rgba(220,38,38,1)]", // red-600
	info: "shadow-[4px_4px_0px_0px_rgba(37,99,235,1)]", // blue-600
	warning: "shadow-[4px_4px_0px_0px_rgba(202,138,4,1)]", // yellow-600
};

export const ToastItem = ({ toast, removeToast }: ToastProps) => {
	const [isVisible, setIsVisible] = useState(false);

	useEffect(() => {
		// Trigger enter animation
		requestAnimationFrame(() => setIsVisible(true));
	}, []);

	const handleDismiss = () => {
		setIsVisible(false);
		// Wait for exit animation to finish before removing from DOM
		setTimeout(() => removeToast(toast.id), 300);
	};

	return (
		<div
			className={clsx(
				"flex items-center gap-3 px-4 py-3 min-w-[300px] max-w-md bg-white border-2 transition-all duration-300 ease-out transform pointer-events-auto cursor-pointer",
				borderColors[toast.type],
				shadowColors[toast.type],
				isVisible
					? "translate-x-0 opacity-100 scale-100"
					: clsx(
							"opacity-0 scale-95",
							toast.position?.includes("right")
								? "translate-x-full"
								: toast.position?.includes("left")
									? "-translate-x-full"
									: toast.position?.includes("bottom")
										? "translate-y-full"
										: "-translate-y-full",
						),
			)}
			onClick={handleDismiss}
			role="alert"
		>
			<div className="shrink-0">{icons[toast.type]}</div>
			<div className="flex-1">
				<p className="text-sm font-bold font-sans text-black">
					{toast.message}
				</p>
			</div>
			<button
				onClick={(e) => {
					e.stopPropagation();
					handleDismiss();
				}}
				className="shrink-0 text-zinc-400 hover:text-black transition-colors"
			>
				<X className="w-4 h-4" />
			</button>
		</div>
	);
};
