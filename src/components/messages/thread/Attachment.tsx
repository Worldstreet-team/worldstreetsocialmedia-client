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
	onClick,
	onRetry,
	onCancelUpload,
}: {
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
	// r=16 ring; the sweep is stroke-dashoffset over the circumference.
	const C = 2 * Math.PI * 16;

	return (
		<div
			onClick={uploading || failed ? undefined : onClick}
			className={clsx(
				"relative w-full max-w-[280px] overflow-hidden rounded-xl transition-opacity",
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
						<span className="absolute inset-0 flex items-center justify-center">
							<span className="flex h-12 w-12 items-center justify-center rounded-pill bg-scrim text-primary">
								<RiPlayFill className="ml-0.5 h-5 w-5" />
							</span>
						</span>
					)}
				</>
			)}
			{uploading && (
				<span className="absolute inset-0 flex items-center justify-center bg-scrim/60">
					<button
						type="button"
						onClick={onCancelUpload}
						aria-label="Cancel upload"
						className="relative flex h-11 w-11 cursor-pointer items-center justify-center rounded-pill text-primary"
					>
						<svg
							viewBox="0 0 40 40"
							className="absolute inset-0 h-full w-full -rotate-90"
							aria-hidden
						>
							<circle
								cx="20"
								cy="20"
								r="16"
								fill="none"
								stroke="currentColor"
								strokeOpacity="0.25"
								strokeWidth="3"
							/>
							<circle
								cx="20"
								cy="20"
								r="16"
								fill="none"
								stroke="var(--ws-brand-primary)"
								strokeWidth="3"
								strokeLinecap="round"
								strokeDasharray={C}
								strokeDashoffset={C * (1 - Math.min(1, uploadPct ?? 0))}
								className="transition-[stroke-dashoffset]"
							/>
						</svg>
						<RiCloseLine size={16} />
					</button>
				</span>
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
