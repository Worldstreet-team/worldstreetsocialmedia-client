"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface ImageModalProps {
	isOpen: boolean;
	onClose: () => void;
	images: string[];
	initialIndex?: number;
}

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
					transition={{ duration: 0.2 }}
					className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"
					onClick={onClose}
				>
					{/* Close Button */}
					<button
						type="button"
						onClick={onClose}
						className="absolute top-4 right-4 w-12 h-12 flex items-center justify-center text-white/70 hover:text-white bg-black/50 hover:bg-black/70 rounded-full transition-colors z-50"
					>
						<span className="material-symbols-outlined text-2xl">close</span>
					</button>

					{/* Navigation Arrows */}
					{images.length > 1 && (
						<>
							<button
								type="button"
								onClick={handlePrev}
								className="absolute left-4 top-1/2 -translate-y-1/2 p-3 text-white/70 hover:text-white bg-black/50 hover:bg-black/70 rounded-full transition-all hover:scale-110 z-50"
							>
								<span className="material-symbols-outlined text-3xl">
									chevron_left
								</span>
							</button>
							<button
								type="button"
								onClick={handleNext}
								className="absolute right-4 top-1/2 -translate-y-1/2 p-3 text-white/70 hover:text-white bg-black/50 hover:bg-black/70 rounded-full transition-all hover:scale-110 z-50"
							>
								<span className="material-symbols-outlined text-3xl">
									chevron_right
								</span>
							</button>
						</>
					)}

					{/* Image Container */}
					<div
						className="relative w-full h-full flex items-center justify-center p-4 md:p-10"
						onClick={(e) => e.stopPropagation()} // Prevent closing when clicking on image area (optional, mostly for controls)
					>
						<motion.img
							key={currentIndex}
							src={images[currentIndex]}
							alt={`Image ${currentIndex + 1}`}
							initial={{ opacity: 0, scale: 0.9 }}
							animate={{ opacity: 1, scale: 1 }}
							exit={{ opacity: 0, scale: 0.9 }}
							transition={{ type: "spring", stiffness: 300, damping: 30 }}
							className="max-h-full max-w-full object-contain shadow-2xl rounded-sm select-none"
							draggable={false}
						/>

						{/* Image Counter */}
						{images.length > 1 && (
							<div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/50 text-white px-3 py-1 rounded-full text-sm font-medium backdrop-blur-md border border-white/10">
								{currentIndex + 1} / {images.length}
							</div>
						)}
					</div>
				</motion.div>
			)}
		</AnimatePresence>
	);
}
