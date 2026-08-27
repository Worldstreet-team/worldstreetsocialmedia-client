"use client";

import Image from "next/image";
import { useState } from "react";
import { DEFAULT_AVATAR } from "@/const";

/**
 * THE avatar renderer. Every profile picture in the app goes through this —
 * do not hand-roll `<Image src={someone.avatar} />` again.
 *
 * Two failure modes, and both were live in the app before this component was
 * made mandatory:
 *
 * 1. **No avatar at all.** `src=""`/undefined on `next/image` renders nothing
 *    and logs. Accounts that never uploaded a picture simply had a hole where
 *    their face goes, in the feed, the sidebar, chat and the Studio.
 * 2. **A dead URL.** A `?? DEFAULT_AVATAR` fallback only catches the empty
 *    case; a stored URL that 404s (bucket moved, object deleted) sails past it
 *    and paints the browser's broken-image glyph. Only `onError` catches that,
 *    which is why the fallback has to live in one component instead of being
 *    re-typed at every call site.
 *
 * Fill-mode by default — the parent supplies size, rounding and position.
 * Pass `width`/`height` together for a fixed-size avatar that carries its own
 * box instead.
 */
export function SafeAvatar({
	src,
	className = "object-cover",
	sizes,
	width,
	height,
	alt = "",
}: {
	src?: string | null;
	className?: string;
	sizes?: string;
	width?: number;
	height?: number;
	alt?: string;
}) {
	const [failed, setFailed] = useState(false);
	const resolved = failed || !src ? DEFAULT_AVATAR : src;

	if (width !== undefined && height !== undefined) {
		return (
			<Image
				src={resolved}
				alt={alt}
				width={width}
				height={height}
				className={className}
				onError={() => setFailed(true)}
			/>
		);
	}

	return (
		<Image
			src={resolved}
			alt={alt}
			fill
			sizes={sizes}
			className={className}
			onError={() => setFailed(true)}
		/>
	);
}
