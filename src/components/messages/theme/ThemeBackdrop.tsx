"use client";

import { memo } from "react";
import { groundCss, type ThemeWallpaper, wallpaperSrc } from "./chatTheme";

/**
 * The picture behind a chat. Absolute under the transparent header, list
 * and composer of whatever pane it sits in.
 *
 * Frost is a blur ON the image (the sanctioned path; backdrop-blur stays
 * with the two glass families). Cyan hue is a grayscale image with the
 * brand colour blended in `color` mode, isolated so the blend never leaks
 * onto the page. Dim is the one-div legibility wash.
 */
export const ThemeBackdrop = memo(function ThemeBackdrop({
	wallpaper,
}: {
	wallpaper: ThemeWallpaper;
}) {
	const src = wallpaperSrc(wallpaper);
	const painted = groundCss(wallpaper);
	// A painted ground needs no image, no blur and no dim - it IS the colour.
	if (!src)
		return painted ? (
			<div
				aria-hidden
				className="pointer-events-none absolute inset-0"
				style={{ background: painted }}
			/>
		) : null;
	const blur = Math.round((wallpaper.frost / 100) * 24);
	const cyan = wallpaper.hue === "cyan";
	return (
		<div
			aria-hidden
			className="pointer-events-none absolute inset-0 overflow-hidden"
			style={{ isolation: "isolate" }}
		>
			{/* eslint-disable-next-line @next/next/no-img-element */}
			<img
				src={src}
				alt=""
				decoding="async"
				className="absolute inset-0 h-full w-full object-cover"
				style={{
					filter: `${blur ? `blur(${blur}px)` : ""} ${cyan ? "grayscale(1)" : ""}`.trim() || undefined,
					// Over-scale so the blur's soft edge never shows the pane.
					transform: "scale(1.08)",
				}}
			/>
			{cyan && (
				<div
					className="absolute inset-0"
					style={{
						background: "var(--ws-brand-primary)",
						mixBlendMode: "color",
						opacity: 0.92,
					}}
				/>
			)}
			{wallpaper.dim > 0 && (
				<div
					className="absolute inset-0 bg-black"
					style={{ opacity: wallpaper.dim / 100 }}
				/>
			)}
		</div>
	);
});
