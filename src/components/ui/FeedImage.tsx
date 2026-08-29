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
				loading="lazy"
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
					// invisible, not just opacity-0: a hover:opacity-* at the
					// call site could otherwise resurrect the half-decoded frame.
					loaded ? "opacity-100" : "invisible opacity-0",
					imgClassName,
				)}
			/>
		</span>
	);
}
