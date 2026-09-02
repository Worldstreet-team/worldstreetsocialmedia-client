"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { OverlayHeader, useOverlayDismiss } from "@/components/ui/Overlay";
import { useImageZoom } from "@/hooks/useImageZoom";

interface ImageModalProps {
	isOpen: boolean;
	onClose: () => void;
	images: string[];
	initialIndex?: number;
	/** The tapped thumbnail's rect: the lightbox opens FROM it and the close
	 *  chip returns to it — the shared-element moment. Absent, it fades. */
	originRect?: DOMRect | null;
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
	originRect = null,
}: ImageModalProps) {
	const [currentIndex, setCurrentIndex] = useState(initialIndex);
	const zoomApi = useImageZoom();

	/**
	 * FLIP morph between the feed thumbnail and the lightbox frame. Enter:
	 * start the frame at the thumbnail's position and scale, then release it
	 * to identity in one 200ms beat. Close (chip/Esc/back): play the same
	 * path in reverse, then actually unmount. The wrapper is separate from
	 * the img so the morph transform never fights the zoom transform.
	 */
	const flipRef = useRef<HTMLDivElement | null>(null);
	const closingRef = useRef(false);
	const originDelta = () => {
		const el = flipRef.current;
		if (!el || !originRect) return null;
		const t = el.getBoundingClientRect();
		if (t.width === 0) return null;
		return {
			dx: originRect.left + originRect.width / 2 - (t.left + t.width / 2),
			dy: originRect.top + originRect.height / 2 - (t.top + t.height / 2),
			s: Math.max(0.06, originRect.width / t.width),
		};
	};
	const requestClose = useCallback(() => {
		if (closingRef.current) return;
		const el = flipRef.current;
		const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
		if (reduced || !el || !originRect || zoomApi.zoomed) {
			onClose();
			return;
		}
		const d = originDelta();
		if (!d || Math.abs(d.dy) > window.innerHeight * 1.5) {
			onClose();
			return;
		}
		closingRef.current = true;
		el.style.transition =
			"transform 200ms var(--ws-ease), opacity 200ms var(--ws-ease)";
		el.style.transform = `translate(${d.dx}px, ${d.dy}px) scale(${d.s})`;
		el.style.opacity = "0.4";
		window.setTimeout(onClose, 190);
		// biome-ignore lint/correctness/useExhaustiveDependencies: refs + stable math
	}, [onClose, originRect, zoomApi.zoomed]);
	/**
	 * Drag-to-dismiss: at rest (scale 1) a vertical pull moves the picture
	 * with the finger and fades the ground; past the threshold or on a
	 * flick, release closes. A horizontal fling at rest pages between
	 * images. Zoomed, every touch still belongs to the zoom hook's pan.
	 */
	const [pullY, setPullY] = useState(0);
	const [dragging, setDragging] = useState(false);
	const gestureRef = useRef<{
		x: number;
		y: number;
		intent: "none" | "v" | "h" | "off";
	} | null>(null);
	const lastMoveRef = useRef<{ y: number; t: number }>({ y: 0, t: 0 });
	const velocityRef = useRef(0);

	// A "screen"-class surface: system back (Android) and edge swipe-back
	// (iOS) must close the viewer, not leave the page.
	useOverlayDismiss(isOpen, requestClose, { backSentinel: true });

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

	const onTouchStart = (e: React.TouchEvent) => {
		zoomApi.handlers.onTouchStart(e);
		if (e.touches.length !== 1 || zoomApi.zoomed) {
			gestureRef.current = { x: 0, y: 0, intent: "off" };
			return;
		}
		const t = e.touches[0];
		gestureRef.current = { x: t.clientX, y: t.clientY, intent: "none" };
		lastMoveRef.current = { y: t.clientY, t: Date.now() };
		velocityRef.current = 0;
	};

	const onTouchMove = (e: React.TouchEvent) => {
		zoomApi.handlers.onTouchMove(e);
		const g = gestureRef.current;
		if (!g || g.intent === "off" || zoomApi.zoomed || e.touches.length !== 1)
			return;
		const t = e.touches[0];
		const dx = t.clientX - g.x;
		const dy = t.clientY - g.y;
		if (g.intent === "none") {
			if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
			g.intent = Math.abs(dy) >= Math.abs(dx) ? "v" : "h";
			if (g.intent === "v") setDragging(true);
		}
		if (g.intent === "v") {
			const now = Date.now();
			const last = lastMoveRef.current;
			// Real touches arrive per frame (8-16ms). Sub-frame samples (a
			// double-fired event) produce absurd velocities, so they are
			// ignored rather than clamped.
			if (now - last.t >= 8) {
				velocityRef.current = (t.clientY - last.y) / (now - last.t);
				lastMoveRef.current = { y: t.clientY, t: now };
			}
			// Downward follows 1:1; upward is damped resistance, not a pan.
			setPullY(dy >= 0 ? dy : dy * 0.25);
		}
	};

	const onTouchEnd = (e: React.TouchEvent) => {
		zoomApi.handlers.onTouchEnd(e);
		const g = gestureRef.current;
		if (!g || e.touches.length > 0) return;
		gestureRef.current = null;
		if (g.intent === "h" && images.length > 1) {
			const endX = e.changedTouches[0]?.clientX ?? g.x;
			const dx = endX - g.x;
			if (dx <= -56) handleNext();
			else if (dx >= 56) handlePrev();
			return;
		}
		if (g.intent === "v") {
			setDragging(false);
			if (pullY > 130 || (pullY > 40 && velocityRef.current > 0.6)) onClose();
			else setPullY(0);
		}
	};

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (!isOpen) return;
			if (e.key === "ArrowRight") handleNext();
			if (e.key === "ArrowLeft") handlePrev();
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [isOpen, handleNext, handlePrev]);

	// The enter morph, once per open. Double-rAF so the start state paints
	// before the release; reduced motion opens in place.
	// biome-ignore lint/correctness/useExhaustiveDependencies: once per open
	useEffect(() => {
		if (!isOpen) return;
		closingRef.current = false;
		const el = flipRef.current;
		if (!el) return;
		el.style.transition = "";
		el.style.transform = "";
		el.style.opacity = "";
		if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
		const d = originDelta();
		if (!d) return;
		// A thumbnail nowhere near the viewport would morph across half the
		// document — a teleport, not a shared element. Fade instead.
		if (Math.abs(d.dy) > window.innerHeight * 1.5) return;
		el.style.transition = "none";
		el.style.transform = `translate(${d.dx}px, ${d.dy}px) scale(${d.s})`;
		// Forced reflow commits the start state; no rAF, so the release is
		// not hostage to background-tab frame throttling.
		void el.offsetWidth;
		el.style.transition = "transform 200ms var(--ws-ease)";
		el.style.transform = "";
	}, [isOpen]);

	// A new photo always starts fit-to-frame. Top-level hook — this was
	// briefly nested INSIDE the keydown effect, which is an invalid hook call
	// and crashed the lightbox in production.
	// biome-ignore lint/correctness/useExhaustiveDependencies: reset on image change
	useEffect(() => {
		zoomApi.reset();
		setPullY(0);
		setDragging(false);
	}, [currentIndex, isOpen]);

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
					className="fixed inset-0 h-[100dvh] z-modal flex items-center justify-center"
					onClick={(e) => {
						e.stopPropagation();
						requestClose();
					}}
				>
					{/* The ground is its own layer so a drag fades it while the
					    picture keeps full opacity — the picture leaves, the room
					    dims back in. */}
					<div
						aria-hidden
						className="absolute inset-0 bg-page"
						style={{ opacity: Math.max(0.3, 1 - pullY / 480) }}
					/>
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
						ref={zoomApi.bindWheelRef}
						onTouchStart={onTouchStart}
						onTouchMove={onTouchMove}
						onTouchEnd={onTouchEnd}
						style={{
							transform: `translateY(${pullY}px)`,
							transition: dragging
								? "none"
								: "transform 200ms var(--ws-ease)",
							// Both axes are ours in here: vertical is dismiss,
							// horizontal pages, pinch belongs to the zoom hook.
							touchAction: "none",
						}}
					>
						{/* Pinch, double-tap and drag. There was NO zoom here at
						    all before — the only magnification a reader ever had
						    was the browser's page pinch, which does nothing
						    against a `fixed inset-0` layer because that is sized
						    to the layout viewport (iOS audit 2026-09-01). */}
						<div
							ref={flipRef}
							className="flex h-full w-full items-center justify-center"
						>
						<motion.img
							key={currentIndex}
							src={images[currentIndex]}
							alt={`Attachment ${currentIndex + 1} of ${images.length}`}
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
							style={{
								transform: `translate(${zoomApi.zoom.x}px, ${zoomApi.zoom.y}px) scale(${zoomApi.zoom.scale})`,
								transition: zoomApi.zoomed
									? "none"
									: "transform 160ms var(--ws-ease)",
							}}
							// h/w-full + contain, not max-*: max only shrinks, so a
							// phone-sized upload sat tiny in the middle of the
							// lightbox while large photos filled it — "some zoom
							// well and some don't". Fill the frame both ways.
							className="h-full w-full object-contain select-none"
							draggable={false}
						/>
						</div>

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
					<OverlayHeader onClose={requestClose} closeLabel="Close image viewer">
						<span className="flex-1" aria-hidden />
					</OverlayHeader>
				</div>
			)}
		</AnimatePresence>,
		document.body,
	);
}
