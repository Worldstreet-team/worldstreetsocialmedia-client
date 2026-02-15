"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect } from "react";
import ConfirmModalPortal from "./ConfirmModalPortal";

interface ConfirmModalProps {
	isOpen: boolean;
	onClose: () => void;
	onConfirm: () => void;
	title: string;
	message: string;
	confirmText?: string;
	cancelText?: string;
	isDestructive?: boolean;
}

export default function ConfirmModal({
	isOpen,
	onClose,
	onConfirm,
	title,
	message,
	confirmText = "Confirm",
	cancelText = "Cancel",
	isDestructive = false,
}: ConfirmModalProps) {
	useEffect(() => {
		if (isOpen) {
			document.body.style.overflow = "hidden";
		} else {
			document.body.style.overflow = "unset";
		}
		return () => {
			document.body.style.overflow = "unset";
		};
	}, [isOpen]);

	return (
		<ConfirmModalPortal>
			<AnimatePresence>
				{isOpen && (
					<div
						className="fixed inset-0 z-50 flex items-center justify-center px-4"
						onClick={(e) => e.stopPropagation()}
					>
						<motion.div
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							onClick={(e) => {
								e.stopPropagation();
								onClose();
							}}
							className="absolute inset-0 bg-black/80 backdrop-blur-sm"
						/>
						<motion.div
							initial={{ opacity: 0, scale: 0.95, y: 10 }}
							animate={{ opacity: 1, scale: 1, y: 0 }}
							exit={{ opacity: 0, scale: 0.95, y: 10 }}
							onClick={(e) => e.stopPropagation()}
							className="relative bg-zinc-900 border border-zinc-800 rounded-2xl shadow-xl w-full max-w-sm overflow-hidden z-50"
						>
							<div className="p-6">
								<h3 className="text-xl font-bold mb-2 text-white">{title}</h3>
								<p className="text-zinc-400 text-[15px] leading-relaxed">
									{message}
								</p>
							</div>
							<div className="flex flex-row gap-3 p-6 pt-0">
								<button
									type="button"
									onClick={onClose}
									className="flex-1 py-3 rounded-full font-bold border border-zinc-700 hover:bg-zinc-800 transition-colors text-white text-[15px]"
								>
									{cancelText}
								</button>
								<button
									type="button"
									onClick={() => {
										onConfirm();
										onClose();
									}}
									className={`
                                    flex-1 py-3 rounded-full font-bold transition-colors text-[15px]
                                    ${
																			isDestructive
																				? "bg-red-600 text-white hover:bg-red-700"
																				: "bg-white text-black hover:bg-gray-200"
																		}
                                `}
								>
									{confirmText}
								</button>
							</div>
						</motion.div>
					</div>
				)}
			</AnimatePresence>
		</ConfirmModalPortal>
	);
}
