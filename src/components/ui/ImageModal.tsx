"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

interface ImageModalProps {
	isOpen: boolean;
	onClose: () => void;
	images: string[];
	initialIndex?: number;
}

/**
 * Lightbox, on-token: z-modal, near-opaque page fill (a lightbox needs more
 * than overlay/scrim's 60%), controls on the surface ladder with color-only
 * hovers (never scale), counter in tabular numerals.
 */
export default function ImageModal({
	isOpen,
	onClose,
	images,
	initialIndex = 0,
}: ImageModalProps) {
	const [currentIndex, setCurrentIndex] = useState(initialIndex);

	useEffect(() => {
		if (isOpen) {
			setCurrentIndex(initialIndex);
			document.body.style.overflow = "hidden"; // Prevent background scrolling
		} else {
			document.body.style.overflow = "unset";
		}
		return () => {
			document.body.style.overflow = "unset";
		};
	}, [isOpen, initialIndex]);

	const handleNext = useCallback(
		(e?: React.MouseEvent) => {
			e?.stopPropagation();
			setCurrentIndex((prev) => (prev + 1) % images.length);
		},
		[images.length],
	);

	const handlePrev = useCallback(
		(e?: React.MouseEvent) => {
			e?.stopPropagation();
			setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
		},
		[images.length],
	);

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (!isOpen) return;
			if (e.key === "Escape") onClose();
			if (e.key === "ArrowRight") handleNext();
			if (e.key === "ArrowLeft") handlePrev();
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [isOpen, onClose, handleNext, handlePrev]);

	if (!isOpen) return null;

	return (
		<AnimatePresence>
			{isOpen && (
				<motion.div
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
					className="fixed inset-0 z-modal flex items-center justify-center bg-page"
					onClick={(e) => {
						e.stopPropagation();
						onClose();
					}}
				>
					{/* Close Button */}
					<button
						type="button"
						aria-label="Close image viewer"
						onClick={(e) => {
							e.stopPropagation();
							onClose();
						}}
						className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center text-muted hover:text-primary bg-surface/80 hover:bg-raised border border-hairline rounded-pill transition-colors cursor-pointer"
					>
						<X className="w-5 h-5" />
					</button>

					{/* Navigation Arrows */}
					{images.length > 1 && (
						<>
							<button
								type="button"
								aria-label="Previous image"
								onClick={handlePrev}
								className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 flex items-center justify-center text-muted hover:text-primary bg-surface/80 hover:bg-raised border border-hairline rounded-pill transition-colors cursor-pointer"
							>
								<ChevronLeft className="w-6 h-6" />
							</button>
							<button
								type="button"
								aria-label="Next image"
								onClick={handleNext}
								className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 flex items-center justify-center text-muted hover:text-primary bg-surface/80 hover:bg-raised border border-hairline rounded-pill transition-colors cursor-pointer"
							>
								<ChevronRight className="w-6 h-6" />
							</button>
						</>
					)}

					{/* Image Container */}
					<div
						className="relative w-full h-full flex items-center justify-center p-4 md:p-10"
						onClick={(e) => e.stopPropagation()} // Prevent closing when clicking on image area
					>
						<motion.img
							key={currentIndex}
							src={images[currentIndex]}
							alt={`Attachment ${currentIndex + 1} of ${images.length}`}
							initial={{ opacity: 0, scale: 0.98 }}
							animate={{ opacity: 1, scale: 1 }}
							exit={{ opacity: 0, scale: 0.98 }}
							transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
							className="max-h-full max-w-full object-contain rounded-lg select-none"
							draggable={false}
						/>

						{/* Image Counter */}
						{images.length > 1 && (
							<div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-raised/90 text-primary px-3 py-1 rounded-pill text-[13px] font-medium font-sans tabular-nums border border-hairline">
								{currentIndex + 1} / {images.length}
							</div>
						)}
					</div>
				</motion.div>
			)}
		</AnimatePresence>
	);
}
