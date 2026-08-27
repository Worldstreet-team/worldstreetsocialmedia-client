"use client";

import { AnimatePresence } from "framer-motion";
import ConfirmModalPortal from "./ConfirmModalPortal";
import { OverlayPanel, OverlayScrim, useOverlayDismiss } from "./Overlay";

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
 * The confirm dialog, on the standard overlay grammar: `OverlayScrim` +
 * the centred `OverlayPanel`, capped narrow because a confirm is a sentence
 * and two buttons, not a plate. Title Display/H2 (Poppins SemiBold 20), body
 * UI/Body muted. Destructive confirm uses status/danger; neutral confirm uses
 * the bg-primary/text-page repeated-action pattern (gold stays reserved).
 *
 * No `OverlayHeader`: the choice IS the dismissal, so there is no close chip
 * to standardise — Cancel and the scrim are the two ways out.
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
	useOverlayDismiss(isOpen, onClose);

	return (
		<ConfirmModalPortal>
			<AnimatePresence>
				{isOpen && (
					<OverlayScrim key="confirm-scrim" onClose={onClose} label={cancelText} />
				)}
				{isOpen && (
					<OverlayPanel
						key="confirm-panel"
						variant="center"
						label={title}
						className="max-w-[420px]"
					
					role={isDestructive ? "alertdialog" : "dialog"}>
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
					</OverlayPanel>
				)}
			</AnimatePresence>
		</ConfirmModalPortal>
	);
}
