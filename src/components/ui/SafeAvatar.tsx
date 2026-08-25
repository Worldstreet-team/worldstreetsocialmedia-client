"use client";

import Image from "next/image";
import { useState } from "react";
import { DEFAULT_AVATAR } from "@/const";

/**
 * Avatar that can't break: a dead URL swaps to the default image instead of
 * the browser's broken-image glyph and spilled alt text. Fill-mode — the
 * parent supplies size, rounding and position.
 */
export function SafeAvatar({
	src,
	className = "object-cover",
}: {
	src?: string | null;
	className?: string;
}) {
	const [failed, setFailed] = useState(false);
	return (
		<Image
			src={failed || !src ? DEFAULT_AVATAR : src}
			alt=""
			fill
			className={className}
			onError={() => setFailed(true)}
		/>
	);
}
