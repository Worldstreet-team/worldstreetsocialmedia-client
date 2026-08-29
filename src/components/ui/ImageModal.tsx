"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { OverlayHeader, useOverlayDismiss } from "@/components/ui/Overlay";

interface ImageModalProps {
	isOpen: boolean;
	onClose: () => void;
	images: string[];
	initialIndex?: number;
}

/**
 * Lightbox, on-token: z-modal, opaque page fill, controls on the surface
 * ladder with color-only hovers (never scale), counter in tabular numerals.
 *
 * Deliberately NOT an `OverlayPanel`: a lightbox is full-bleed media, not a
 * plate, and it needs an opaque ground rather than the grammar's 50% wash —
 * a photo read through a half-lit feed is a worse photo. What it does take
 * from the grammar is the close chip (`OverlayHeader`) and `useOverlayDismiss`
 * for Escape and the scroll lock; the arrow keys stay local.
 */
export default function ImageModal({
	isOpen,
	onClose,
	images,
	initialIndex = 0,
}: ImageModalProps) {
	const [currentIndex, setCurrentIndex] = useState(initialIndex);

	useOverlayDismiss(isOpen, onClose);

	useEffect(() => {
		if (isOpen) setCurrentIndex(initialIndex);
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
			if (e.key === "ArrowRight") handleNext();
			if (e.key === "ArrowLeft") handlePrev();
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [isOpen, handleNext, handlePrev]);

	if (!isOpen) return null;

	// Portalled to <body>, and this stopped being optional the day the feed
	// gained content-visibility windowing: a card's paint containment CLIPS
	// any fixed-position descendant to the card's own box, so the lightbox
	// opened at post-thumbnail size instead of filling the screen. Every
	// other overlay the card renders already portals; this was the straggler.
	return createPortal(
		<AnimatePresence>
			{isOpen && (
				<motion.div
					key="image-modal"
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
					className="fixed inset-0 h-[100dvh] z-modal flex items-center justify-center bg-page"
					onClick={(e) => {
						e.stopPropagation();
						onClose();
					}}
				>
					{/* Navigation Arrows */}
					{images.length > 1 && (
						<>
							<button
								type="button"
								aria-label="Previous image"
								onClick={handlePrev}
								className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-10 w-12 h-12 flex items-center justify-center text-muted hover:text-primary bg-surface/80 hover:bg-raised border border-hairline rounded-pill transition-colors cursor-pointer"
							>
								<ChevronLeft className="w-6 h-6" />
							</button>
							<button
								type="button"
								aria-label="Next image"
								onClick={handleNext}
								className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-10 w-12 h-12 flex items-center justify-center text-muted hover:text-primary bg-surface/80 hover:bg-raised border border-hairline rounded-pill transition-colors cursor-pointer"
							>
								<ChevronRight className="w-6 h-6" />
							</button>
						</>
					)}

					{/* Image Container */}
					<div
						// px-16 below sm keeps the image clear of the prev/next buttons
						// instead of letting them sit on top of the photo.
						className="relative w-full h-full flex items-center justify-center px-2 py-14 sm:p-4 md:p-10"
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
							// h/w-full + contain, not max-*: max only shrinks, so a
							// phone-sized upload sat tiny in the middle of the
							// lightbox while large photos filled it — "some zoom
							// well and some don't". Fill the frame both ways.
							className="h-full w-full object-contain select-none"
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
			{isOpen && (
				/* The grammar's close chip, on its own click-through layer: the
				   strip beside it still dismisses like the rest of the ground,
				   and the chip's own click never doubles back into it. */
				<div
					key="image-modal-chrome"
					className="pointer-events-none fixed inset-x-0 top-[env(safe-area-inset-top,0px)] z-modal [&_button]:pointer-events-auto"
				>
					<OverlayHeader onClose={onClose} closeLabel="Close image viewer">
						<span className="flex-1" aria-hidden />
					</OverlayHeader>
				</div>
			)}
		</AnimatePresence>,
		document.body,
	);
}
