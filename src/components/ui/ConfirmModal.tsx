"use client";

import { AnimatePresence, motion } from "framer-motion";
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

/**
 * On-token dialog: overlay/scrim + z-modal, panel bg/surface radius 13 with
 * shadow-nav. Title Display/H2 (Poppins SemiBold 20), body UI/Body muted.
 * Destructive confirm uses status/danger; neutral confirm uses the
 * bg-primary/text-page repeated-action pattern (gold stays reserved).
 */
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
						className="fixed inset-0 z-modal flex items-center justify-center px-4"
						onClick={(e) => e.stopPropagation()}
					>
						<motion.div
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
							onClick={(e) => {
								e.stopPropagation();
								onClose();
							}}
							className="absolute inset-0 bg-scrim"
						/>
						<motion.div
							role={isDestructive ? "alertdialog" : "dialog"}
							aria-modal="true"
							aria-label={title}
							initial={{ opacity: 0, scale: 0.98, y: 8 }}
							animate={{ opacity: 1, scale: 1, y: 0 }}
							exit={{ opacity: 0, scale: 0.98, y: 8 }}
							transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
							onClick={(e) => e.stopPropagation()}
							className="relative bg-surface border border-hairline rounded-xl shadow-nav w-full max-w-sm overflow-hidden"
						>
							<div className="p-6">
								<h3 className="font-display font-semibold text-xl text-primary mb-2">
									{title}
								</h3>
								<p className="font-sans text-[15px] leading-relaxed text-muted">
									{message}
								</p>
							</div>
							<div className="flex flex-row gap-3 p-6 pt-0">
								<button
									type="button"
									onClick={onClose}
									className="flex-1 h-11 rounded-pill font-sans font-semibold text-[15px] border border-hairline text-primary hover:bg-raised transition-colors cursor-pointer"
								>
									{cancelText}
								</button>
								<button
									type="button"
									onClick={() => {
										onConfirm();
										onClose();
									}}
									className={`flex-1 h-11 rounded-pill font-sans font-semibold text-[15px] transition-colors cursor-pointer ${
										isDestructive
											? "bg-danger text-primary hover:opacity-90"
											: "bg-primary text-page hover:bg-muted"
									}`}
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
