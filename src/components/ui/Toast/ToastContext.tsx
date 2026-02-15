"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import { ToastContainer } from "./ToastContainer";

export type ToastType = "success" | "error" | "info" | "warning";
export type ToastPosition =
	| "top-left"
	| "top-center"
	| "top-right"
	| "bottom-left"
	| "bottom-center"
	| "bottom-right";

export interface Toast {
	id: string;
	message: string;
	type: ToastType;
	duration?: number;
	position?: ToastPosition;
}

interface ToastContextType {
	toast: (
		message: string,
		options?: {
			type?: ToastType;
			duration?: number;
			position?: ToastPosition;
		},
	) => void;
	removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
	const [toasts, setToasts] = useState<Toast[]>([]);

	const removeToast = useCallback((id: string) => {
		setToasts((prev) => prev.filter((toast) => toast.id !== id));
	}, []);

	const toast = useCallback(
		(
			message: string,
			options: {
				type?: ToastType;
				duration?: number;
				position?: ToastPosition;
			} = {},
		) => {
			const id = Math.random().toString(36).substring(2, 9);
			const {
				type = "info",
				duration = 3000,
				position = "bottom-right",
			} = options;

			const newToast: Toast = { id, message, type, duration, position };
			setToasts((prev) => [...prev, newToast]);

			if (duration > 0) {
				setTimeout(() => {
					removeToast(id);
				}, duration);
			}
		},
		[removeToast],
	);

	return (
		<ToastContext.Provider value={{ toast, removeToast }}>
			{children}
			<ToastContainer toasts={toasts} removeToast={removeToast} />
		</ToastContext.Provider>
	);
}

export function useToast() {
	const context = useContext(ToastContext);
	if (!context) {
		throw new Error("useToast must be used within a ToastProvider");
	}
	return context;
}
