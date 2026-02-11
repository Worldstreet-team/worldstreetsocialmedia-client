import { atom, useAtom } from "jotai";
import { useCallback } from "react";

type ToastType = "success" | "error" | "info";

interface ToastState {
	message: string;
	isVisible: boolean;
	actionLabel?: string;
	onAction?: () => void;
	type?: ToastType;
}

const initialToastState: ToastState = {
	message: "",
	isVisible: false,
};

export const toastAtom = atom<ToastState>(initialToastState);

export const useToast = () => {
	const [toast, setToast] = useAtom(toastAtom);

	const showToast = useCallback(
		(
			message: string,
			options?: {
				actionLabel?: string;
				onAction?: () => void;
				type?: ToastType;
				duration?: number;
			},
		) => {
			setToast({
				message,
				isVisible: true,
				actionLabel: options?.actionLabel,
				onAction: options?.onAction,
				type: options?.type || "info",
			});

			if (options?.duration !== Infinity) {
				setTimeout(() => {
					setToast((prev) => ({ ...prev, isVisible: false }));
				}, options?.duration || 3000);
			}
		},
		[setToast],
	);

	const hideToast = useCallback(() => {
		setToast((prev) => ({ ...prev, isVisible: false }));
	}, [setToast]);

	return { toast, showToast, hideToast };
};
