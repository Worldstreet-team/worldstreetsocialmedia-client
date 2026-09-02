"use client";

import { memo } from "react";
import { gradientById, type WallpaperSetting } from "./wallpaper";

/**
 * The layered ground behind a thread. Absolute under the (transparent)
 * virtuoso scroller. `pulse` rotates the gradient one step per sent
 * message — Telegram's alive-background beat, one animated angle,
 * stilled by the global reduced-motion block.
 */
export const ThreadBackdrop = memo(function ThreadBackdrop({
	wallpaper,
	pulse,
}: {
	wallpaper: WallpaperSetting;
	pulse: number;
}) {
	const wp = wallpaper ?? { type: "default" };
	const angle = 160 + (pulse % 12) * 30;
	const dim = Math.max(0, Math.min(80, wp.dim ?? 0)) / 100;

	let ground: React.CSSProperties = {};
	if (wp.type === "gradient") {
		const g = gradientById(wp.value);
		ground = {
			backgroundImage: `linear-gradient(${angle}deg, ${g.stops[0]}, ${g.stops[1]})`,
			transition: "background-image 600ms var(--ws-ease)",
		};
	} else if (wp.type === "solid" && wp.value) {
		ground = { backgroundColor: wp.value };
	}

	return (
		<div aria-hidden className="absolute inset-0 overflow-hidden">
			{/* Fill / gradient ground (default keeps the token page color). */}
			<div className="absolute inset-0" style={ground} />
			{/* User image, blurred via a filter ON the image — the sanctioned
			    path; backdrop-blur stays banned outside the glass families. */}
			{wp.type === "image" && (wp.valueUrl || wp.value) && (
				// eslint-disable-next-line @next/next/no-img-element
				<img
					src={wp.valueUrl || wp.value}
					alt=""
					className="absolute inset-0 h-full w-full scale-105 object-cover"
					style={wp.blur ? { filter: "blur(14px)" } : undefined}
				/>
			)}
			{/* The brand doodle: the mark tiled at whisper opacity. Sits over
			    fills, under the dim, and skips photo wallpapers (texture on a
			    photo reads as dirt). */}
			{wp.type !== "image" && (
				<div
					className="absolute inset-0 opacity-[0.05]"
					style={{
						backgroundImage: "url(/images/worldspace-mark.png)",
						backgroundSize: "72px 72px",
						backgroundRepeat: "repeat",
						filter: "grayscale(1)",
					}}
				/>
			)}
			{/* The one-div legibility answer: a dim wash over anything. */}
			{dim > 0 && (
				<div
					className="absolute inset-0 bg-black"
					style={{ opacity: dim }}
				/>
			)}
		</div>
	);
});
