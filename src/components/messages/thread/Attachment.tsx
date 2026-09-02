"use client";

import clsx from "clsx";
import { Play } from "lucide-react";
import { useMemo, useState } from "react";
import { thumbhashToDataURL } from "@/lib/media-meta";

/**
 * A media tile that never fights the scroller.
 *
 * The old version axios-fetched the R2 URL as a blob for a progress bar the
 * public bucket's missing CORS headers made impossible: every received image
 * downloaded twice and error-logged once. This one is an <img> in a box whose
 * ASPECT RATIO is reserved from the message's stored geometry, painted with
 * its thumbhash until pixels arrive — no layout shift, no second download,
 * placeholder before a single media byte.
 */
export function Attachment({
	src,
	type,
	isTemp,
	width,
	height,
	thumbhash,
	onClick,
}: {
	src: string;
	type: "image" | "video";
	isTemp: boolean;
	width?: number;
	height?: number;
	thumbhash?: string;
	onClick: () => void;
}) {
	const [retryKey, setRetryKey] = useState(0);
	const ratio =
		width && height ? Math.min(2.2, Math.max(0.45, width / height)) : 1;
	const placeholder = useMemo(() => thumbhashToDataURL(thumbhash), [thumbhash]);

	return (
		<div
			onClick={onClick}
			className={clsx(
				"relative w-full max-w-[280px] cursor-zoom-in overflow-hidden rounded-xl transition-opacity hover:opacity-95",
				isTemp && "opacity-70",
			)}
			style={{ aspectRatio: String(ratio) }}
		>
			{isTemp && (
				<div className="absolute inset-0 z-10 bg-page/20 animate-pulse" />
			)}
			<div
				aria-hidden
				className="absolute inset-0 bg-sunken bg-cover bg-center"
				style={
					placeholder ? { backgroundImage: `url(${placeholder})` } : undefined
				}
			/>
			{type === "image" ? (
				<img
					key={retryKey}
					src={src}
					alt="attachment"
					className="absolute inset-0 h-full w-full object-cover"
					onError={() => {
						if (retryKey < 4)
							setTimeout(() => setRetryKey((k) => k + 1), 600 * (retryKey + 1));
					}}
				/>
			) : (
				<>
					{/* A tile, not an inline player — the lightbox has the controls. */}
					{/* eslint-disable-next-line jsx-a11y/media-has-caption */}
					<video
						src={`${src}#t=0.1`}
						preload="metadata"
						muted
						playsInline
						className="absolute inset-0 h-full w-full object-cover"
					/>
					<span className="absolute inset-0 flex items-center justify-center">
						<span className="flex h-12 w-12 items-center justify-center rounded-pill bg-scrim text-primary">
							<Play className="ml-0.5 h-5 w-5" fill="currentColor" />
						</span>
					</span>
				</>
			)}
		</div>
	);
}
