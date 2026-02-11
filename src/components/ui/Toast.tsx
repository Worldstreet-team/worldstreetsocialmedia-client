"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/store/toast.atom";

export function Toast() {
	const { toast, hideToast } = useToast();

	return (
		<AnimatePresence>
			{toast.isVisible && (
				<motion.div
					initial={{ opacity: 0, y: 50 }}
					animate={{ opacity: 1, y: 0 }}
					exit={{ opacity: 0, y: 50 }}
					transition={{ type: "spring", stiffness: 500, damping: 30 }}
					className="fixed bottom-6 left-1/2 -translate-x-1/2 z-100 flex items-center justify-between gap-4 px-4 py-3 bg-[#1D9BF0] text-white rounded-md shadow-lg min-w-[300px] max-w-[90vw]"
				>
					<span className="font-medium text-[15px]">{toast.message}</span>
					{toast.actionLabel && toast.onAction && (
						<button
							type="button"
							onClick={(e) => {
								e.stopPropagation();
								toast.onAction?.();
								hideToast();
							}}
							className="font-bold text-[15px] hover:underline"
						>
							{toast.actionLabel}
						</button>
					)}
				</motion.div>
			)}
		</AnimatePresence>
	);
}
