"use client";

import clsx from "clsx";
import { useRef, useState } from "react";
import { FeedImage } from "@/components/ui/FeedImage";

/**
 * Multi-image posts are a swipeable carousel (owner ruling 2026-09-03), not
 * a collage grid: one image per slide at full card width, scroll-snap does
 * the paging, a counter chip and dots say where you are. Every image shows
 * at its own full frame instead of four crops fighting a square.
 *
 * Plain CSS scroll-snap — no library, momentum and edge resistance come
 * from the platform, and it works identically with a trackpad.
 */
export function ImageCarousel({
	images,
	onImageTap,
}: {
	images: string[];
	onImageTap: (index: number, rect: DOMRect) => void;
}) {
	const trackRef = useRef<HTMLDivElement | null>(null);
	const [page, setPage] = useState(0);

	const onScroll = () => {
		const el = trackRef.current;
		if (!el) return;
		const next = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
		setPage((p) => (p === next ? p : next));
	};

	return (
		<div className="relative mb-3 w-full overflow-hidden rounded-xl border border-hairline pointer-events-auto">
			<div
				ref={trackRef}
				onScroll={onScroll}
				className="flex w-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain scrollbar-none"
			>
				{images.map((src, i) => (
					<FeedImage
						key={src}
						src={src}
						className="relative z-10 aspect-[4/3] w-full shrink-0 snap-center"
						imgClassName="absolute inset-0 h-full w-full object-cover cursor-zoom-in"
						onClick={(e) => {
							e.stopPropagation();
							e.preventDefault();
							onImageTap(
								i,
								(
									e.currentTarget as HTMLElement
								).getBoundingClientRect(),
							);
						}}
					/>
				))}
			</div>

			{/* Where you are: counter chip up top, dots below. Tabular so the
			    chip never jitters between pages. */}
			<span className="absolute right-2 top-2 z-20 rounded-pill bg-black/60 px-2 py-0.5 font-sans text-[11.5px] font-semibold tabular-nums text-white">
				{page + 1}/{images.length}
			</span>
			<span className="pointer-events-none absolute inset-x-0 bottom-2 z-20 flex justify-center gap-1.5">
				{images.map((src, i) => (
					<span
						key={src}
						className={clsx(
							"h-1.5 w-1.5 rounded-pill transition-colors",
							i === page ? "bg-white" : "bg-white/40",
						)}
					/>
				))}
			</span>
		</div>
	);
}
