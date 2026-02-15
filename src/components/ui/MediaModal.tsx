"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

export interface MediaItem {
	url: string;
	type: "image" | "video";
}

interface MediaModalProps {
	isOpen: boolean;
	onClose: () => void;
	media: MediaItem[];
	initialIndex?: number;
}

export default function MediaModal({
	isOpen,
	onClose,
	media,
	initialIndex = 0,
}: MediaModalProps) {
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
			setCurrentIndex((prev) => (prev + 1) % media.length);
		},
		[media.length],
	);

	const handlePrev = useCallback(
		(e?: React.MouseEvent) => {
			e?.stopPropagation();
			setCurrentIndex((prev) => (prev - 1 + media.length) % media.length);
		},
		[media.length],
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

	const currentItem = media[currentIndex];

	return (
		<AnimatePresence>
			{isOpen && (
				<motion.div
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					transition={{ duration: 0.2 }}
					className="fixed inset-0 z-100 flex items-center justify-center bg-black/95 backdrop-blur-md"
					onClick={(e) => {
						e.stopPropagation();
						onClose();
					}}
				>
					{/* Close Button */}
					<button
						type="button"
						onClick={(e) => {
							e.stopPropagation();
							onClose();
						}}
						className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center text-white/70 hover:text-white bg-black/50 hover:bg-zinc-800 rounded-full transition-colors z-110 cursor-pointer"
					>
						<X className="w-6 h-6" />
					</button>

					{/* Navigation Arrows */}
					{media.length > 1 && (
						<>
							<button
								type="button"
								onClick={handlePrev}
								className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 flex items-center justify-center text-white/70 hover:text-white bg-black/50 hover:bg-zinc-800 rounded-full transition-all hover:scale-110 z-110 cursor-pointer"
							>
								<ChevronLeft className="w-8 h-8" />
							</button>
							<button
								type="button"
								onClick={handleNext}
								className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 flex items-center justify-center text-white/70 hover:text-white bg-black/50 hover:bg-zinc-800 rounded-full transition-all hover:scale-110 z-110 cursor-pointer"
							>
								<ChevronRight className="w-8 h-8" />
							</button>
						</>
					)}

					{/* Media Container */}
					<div
						className="relative w-full h-full flex items-center justify-center p-4 md:p-10"
						onClick={(e) => e.stopPropagation()} // Prevent closing when clicking on media area
					>
						{currentItem.type === "image" ? (
							<motion.img
								key={`image-${currentIndex}`}
								src={currentItem.url}
								alt={`Media ${currentIndex + 1}`}
								initial={{ opacity: 0, scale: 0.95 }}
								animate={{ opacity: 1, scale: 1 }}
								exit={{ opacity: 0, scale: 0.95 }}
								transition={{ type: "spring", stiffness: 300, damping: 30 }}
								className="max-h-full max-w-full object-contain shadow-2xl rounded-sm select-none"
								draggable={false}
							/>
						) : (
							<motion.video
								key={`video-${currentIndex}`}
								src={currentItem.url}
								controls
								autoPlay
								initial={{ opacity: 0, scale: 0.95 }}
								animate={{ opacity: 1, scale: 1 }}
								exit={{ opacity: 0, scale: 0.95 }}
								transition={{ type: "spring", stiffness: 300, damping: 30 }}
								className="max-h-full max-w-full object-contain shadow-2xl rounded-sm"
							/>
						)}

						{/* Counter */}
						{media.length > 1 && (
							<div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/50 text-white px-3 py-1 rounded-full text-sm font-medium backdrop-blur-md border border-white/10 font-space-mono z-110">
								{currentIndex + 1} / {media.length}
							</div>
						)}
					</div>
				</motion.div>
			)}
		</AnimatePresence>
	);
}
