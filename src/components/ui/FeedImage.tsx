"use client";

import clsx from "clsx";
import { useState } from "react";

/**
 * A feed image that never half-paints. Big originals arrive as a progressive
 * smear of scan lines ("painting small small") — so the img stays invisible
 * on a sunken ground until the browser has the WHOLE frame decoded, then
 * fades in on the token curve. Lazy + async so offscreen cards cost nothing.
 *
 * The wrapper owns the box (size it at the call site); the img fills it.
 */
export function FeedImage({
	src,
	alt = "",
	className,
	imgClassName,
	onClick,
}: {
	src: string;
	alt?: string;
	className?: string;
	imgClassName?: string;
	onClick?: (e: React.MouseEvent) => void;
}) {
	const [loaded, setLoaded] = useState(false);
	return (
		<span className={clsx("relative block overflow-hidden bg-sunken", className)}>
			<img
				src={src}
				alt={alt}
				// NOT lazy. Feed cards sit inside `content-visibility: auto`
				// (`feed-cv`), and a lazy image inside a content-visibility
				// subtree never gets its load triggered — the subtree's contents
				// aren't rendered, so the intersection that starts the fetch never
				// resolves. Every post image sat at 0x0 with naturalWidth 0
				// forever, which is also why they stopped being tappable to zoom
				// (owner, 2026-09-02). content-visibility already does the
				// offscreen-work skipping that lazy was there for.
				loading="eager"
				decoding="async"
				// A cached image can finish before React attaches onLoad —
				// without this ref check it would stay invisible forever.
				ref={(el) => {
					if (el?.complete && el.naturalWidth > 0) setLoaded(true);
				}}
				onLoad={() => setLoaded(true)}
				onClick={onClick}
				className={clsx(
					"transition-opacity",
					// opacity-0, never `invisible`: visibility:hidden removes the
					// element from hit-testing, so an undecoded image was
					// unclickable — and since the box is sized BY the image in the
					// single-image layout, it collapsed to 0x0 and stayed there.
					// Opacity keeps the box, the click target and the
					// no-half-paint intent at once.
					loaded ? "opacity-100" : "opacity-0",
					imgClassName,
				)}
			/>
		</span>
	);
}
