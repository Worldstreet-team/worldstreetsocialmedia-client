"use client";

import clsx from "clsx";
import { RiCloseLine, RiPlayFill, RiRestartLine } from "@remixicon/react";
import { useMemo, useState } from "react";
import { thumbhashToDataURL } from "@/lib/media-meta";

/**
 * A media tile that never fights the scroller.
 *
 * The box's ASPECT RATIO is reserved from the message's stored geometry and
 * painted with its thumbhash until pixels arrive — no layout shift, no
 * placeholder flash. While the sender's copy uploads it wears a progress
 * ring with a cancel in the middle (register 68); a failed upload keeps the
 * bubble and offers retry instead of silently vanishing (register 69).
 */
export function Attachment({
	src,
	type,
	isTemp,
	width,
	height,
	thumbhash,
	uploadPct,
	failed,
	durationSec,
	onClick,
	onRetry,
	onCancelUpload,
}: {
	/** Video length, for the corner chip (owner pick: poster + play + duration). */
	durationSec?: number;
	src: string;
	type: "image" | "video";
	isTemp: boolean;
	width?: number;
	height?: number;
	thumbhash?: string;
	/** 0..1 while this tab is uploading the file; undefined otherwise. */
	uploadPct?: number;
	failed?: boolean;
	onClick: () => void;
	onRetry?: () => void;
	onCancelUpload?: () => void;
}) {
	const [retryKey, setRetryKey] = useState(0);
	const ratio =
		width && height ? Math.min(2.2, Math.max(0.45, width / height)) : 1;
	const placeholder = useMemo(() => thumbhashToDataURL(thumbhash), [thumbhash]);
	const uploading = isTemp && !failed && typeof uploadPct === "number";
	// A GIF floats bare (owner pick): no frame radius, no tint — the artwork
	// is the message.
	const bare = type === "image" && /\.gif(\?|$)/i.test(src);
	const clock = durationSec
		? `${Math.floor(durationSec / 60)}:${String(Math.round(durationSec % 60)).padStart(2, "0")}`
		: null;

	return (
		<div
			onClick={uploading || failed ? undefined : onClick}
			className={clsx(
				// w-[280px], not w-full: the bubble is shrink-to-fit, and 100% of
				// an auto-width parent is ZERO — the tile collapsed to a bare
				// timestamp row (found 2026-09-02). max-w-full keeps phones honest.
				"relative w-[280px] max-w-full overflow-hidden transition-opacity",
				bare ? "rounded-md" : "rounded-[inherit]",
				!uploading && !failed && "cursor-zoom-in hover:opacity-95",
				isTemp && !uploading && !failed && "opacity-70",
			)}
			style={{ aspectRatio: String(ratio) }}
		>
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
					{!uploading && !failed && (
						<>
							<span className="absolute inset-0 flex items-center justify-center">
								<span className="flex h-12 w-12 items-center justify-center rounded-pill bg-scrim text-primary">
									<RiPlayFill className="ml-0.5 h-5 w-5" />
								</span>
							</span>
							{clock && (
								<span className="absolute bottom-2 right-2 rounded-pill bg-black/55 px-1.5 py-0.5 font-sans text-[11px] font-medium tabular-nums text-white">
									{clock}
								</span>
							)}
						</>
					)}
				</>
			)}
			{uploading && (
				// Telegram grammar (owner pick): a percent chip in the corner, the
				// image visible underneath, a small cancel opposite it.
				<>
					<span className="absolute inset-0 bg-scrim/35" aria-hidden />
					<span className="absolute left-2 top-2 rounded-pill bg-black/60 px-2 py-0.5 font-sans text-[11px] font-semibold tabular-nums text-white">
						{Math.round(Math.min(1, uploadPct ?? 0) * 100)}%
					</span>
					<button
						type="button"
						onClick={onCancelUpload}
						aria-label="Cancel upload"
						className="absolute right-2 top-2 flex h-7 w-7 cursor-pointer items-center justify-center rounded-pill bg-black/60 text-white"
					>
						<RiCloseLine size={14} />
					</button>
				</>
			)}
			{failed && (
				<span className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-scrim/70">
					<button
						type="button"
						onClick={onRetry}
						className="flex cursor-pointer items-center gap-1.5 rounded-pill bg-raised px-3.5 py-1.5 font-sans text-[12.5px] font-semibold text-primary transition-colors hover:bg-chip"
					>
						<RiRestartLine size={14} />
						Retry
					</button>
					<button
						type="button"
						onClick={onCancelUpload}
						className="cursor-pointer font-sans text-[11.5px] text-muted transition-colors hover:text-primary"
					>
						Remove
					</button>
				</span>
			)}
		</div>
	);
}
