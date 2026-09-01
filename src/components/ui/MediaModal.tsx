"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useImageZoom } from "@/hooks/useImageZoom";
import { OverlayHeader, useOverlayDismiss } from "@/components/ui/Overlay";

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

/**
 * The DM lightbox — images and video, full-bleed.
 *
 * Deliberately NOT an `OverlayPanel`: full-bleed media is not a plate, and it
 * needs an opaque ground rather than the grammar's 50% wash. It does take the
 * grammar's close chip (`OverlayHeader`) and `useOverlayDismiss` for Escape
 * and the scroll lock; the arrow keys stay local.
 */
export default function MediaModal({
	isOpen,
	onClose,
	media,
	initialIndex = 0,
}: MediaModalProps) {
	const [currentIndex, setCurrentIndex] = useState(initialIndex);
	const zoomApi = useImageZoom();

	useOverlayDismiss(isOpen, onClose);

	useEffect(() => {
		if (isOpen) setCurrentIndex(initialIndex);
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
			if (e.key === "ArrowRight") handleNext();
			if (e.key === "ArrowLeft") handlePrev();
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [isOpen, handleNext, handlePrev]);

	if (!isOpen) return null;

	const currentItem = media[currentIndex];

	return (
		<AnimatePresence>
			{isOpen && (
				<motion.div
					key="media-modal"
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
					{media.length > 1 && (
						<>
							<button
								type="button"
								onClick={handlePrev}
								aria-label="Previous item"
								className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-10 w-12 h-12 flex items-center justify-center text-muted hover:text-primary bg-surface/80 hover:bg-raised border border-hairline rounded-pill transition-colors cursor-pointer"
							>
								<ChevronLeft className="w-8 h-8" />
							</button>
							<button
								type="button"
								onClick={handleNext}
								aria-label="Next item"
								className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-10 w-12 h-12 flex items-center justify-center text-muted hover:text-primary bg-surface/80 hover:bg-raised border border-hairline rounded-pill transition-colors cursor-pointer"
							>
								<ChevronRight className="w-8 h-8" />
							</button>
						</>
					)}

					{/* Media Container */}
					<div
						className="relative w-full h-full flex items-center justify-center px-16 py-16 sm:p-4 md:p-10"
						onClick={(e) => e.stopPropagation()} // Prevent closing when clicking on media area
					>
						{currentItem.type === "image" ? (
							<motion.img
								key={`image-${currentIndex}`}
								src={currentItem.url}
								alt={`Media ${currentIndex + 1}`}
								initial={{ opacity: 0 }}
								animate={{ opacity: 1 }}
								exit={{ opacity: 0 }}
								transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
								onTouchStart={zoomApi.handlers.onTouchStart}
								onTouchMove={zoomApi.handlers.onTouchMove}
								onTouchEnd={zoomApi.handlers.onTouchEnd}
								style={{
									transform: `translate(${zoomApi.zoom.x}px, ${zoomApi.zoom.y}px) scale(${zoomApi.zoom.scale})`,
									transition: zoomApi.zoomed
										? "none"
										: "transform 160ms var(--ws-ease)",
									touchAction: zoomApi.zoomed ? "none" : "pan-y",
								}}
								className="max-h-full max-w-full object-contain rounded-lg select-none"
								draggable={false}
							/>
						) : (
							<motion.video
								key={`video-${currentIndex}`}
								src={currentItem.url}
								controls
								/* The policy VideoPlayer has always had: the browser's own
								   menu offers "Save video as" and routes around us. */
								controlsList="nodownload"
								autoPlay
								/* iOS refuses autoplay outright without `muted`, and
								   yanks any playing video into the native fullscreen
								   player without `playsInline` — this element had
								   neither, so every DM video was dead on iPhone
								   (iOS audit 2026-09-01). */
								muted
								playsInline
								ref={(el) => {
									// The muted ATTRIBUTE, which React omits and
									// iOS's autoplay gate requires.
									if (el) {
										el.defaultMuted = true;
										el.setAttribute("muted", "");
									}
								}}
								initial={{ opacity: 0, scale: 0.98 }}
								animate={{ opacity: 1, scale: 1 }}
								exit={{ opacity: 0, scale: 0.98 }}
								transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
								className="max-h-full max-w-full object-contain rounded-lg"
							/>
						)}

						{/* Counter */}
						{media.length > 1 && (
							<div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-raised text-primary px-3 py-1 rounded-pill text-[13px] font-medium border border-hairline font-sans tabular-nums">
								{currentIndex + 1} / {media.length}
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
					key="media-modal-chrome"
					className="pointer-events-none fixed inset-x-0 top-[env(safe-area-inset-top,0px)] z-modal [&_button]:pointer-events-auto"
				>
					<OverlayHeader onClose={onClose} closeLabel="Close media viewer">
						<span className="flex-1" aria-hidden />
					</OverlayHeader>
				</div>
			)}
		</AnimatePresence>
	);
}
