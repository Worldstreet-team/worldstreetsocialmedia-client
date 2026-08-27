"use client";

import {
	useCallback,
	useEffect,
	useRef,
	useState,
	type PointerEvent as ReactPointerEvent,
} from "react";
import clsx from "clsx";
import {
	ArrowsIn,
	ArrowsOut,
	Pause,
	Play,
	SpeakerSimpleHigh,
	SpeakerSimpleX,
} from "@phosphor-icons/react";

const HIDE_AFTER = 2400;

/** mm:ss, and hh:mm:ss once a clip runs past an hour. */
function clock(seconds: number) {
	if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
	const s = Math.floor(seconds % 60);
	const m = Math.floor((seconds / 60) % 60);
	const h = Math.floor(seconds / 3600);
	const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
	return `${h > 0 ? `${h}:` : ""}${mm}:${String(s).padStart(2, "0")}`;
}

/**
 * The video player for posts and DMs.
 *
 * The browser's default controls are a different operating system on every
 * platform and ignore the design system entirely, so a post looked like a
 * WorldStreet post until you scrolled to a video. This is one control surface
 * everywhere, on the glass grammar the editors already use.
 *
 * Chrome auto-hides while playing and returns on any pointer or key activity;
 * it never hides while paused, scrubbing, or when the pointer is over the bar.
 */
export function VideoPlayer({
	src,
	poster,
	className,
	rounded = true,
}: {
	src: string;
	poster?: string;
	className?: string;
	rounded?: boolean;
}) {
	const wrapRef = useRef<HTMLDivElement | null>(null);
	const videoRef = useRef<HTMLVideoElement | null>(null);
	const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

	const [playing, setPlaying] = useState(false);
	const [muted, setMuted] = useState(false);
	const [duration, setDuration] = useState(0);
	const [current, setCurrent] = useState(0);
	const [buffered, setBuffered] = useState(0);
	const [chromeOn, setChromeOn] = useState(true);
	const [scrubbing, setScrubbing] = useState(false);
	const [overBar, setOverBar] = useState(false);
	const [full, setFull] = useState(false);
	const [waiting, setWaiting] = useState(false);

	const pinned = !playing || scrubbing || overBar;

	const bump = useCallback(() => {
		setChromeOn(true);
		if (hideTimer.current) clearTimeout(hideTimer.current);
		if (pinned) return;
		hideTimer.current = setTimeout(() => setChromeOn(false), HIDE_AFTER);
	}, [pinned]);

	useEffect(() => {
		bump();
		return () => {
			if (hideTimer.current) clearTimeout(hideTimer.current);
		};
	}, [bump]);

	const toggle = useCallback(() => {
		const v = videoRef.current;
		if (!v) return;
		if (v.paused) void v.play().catch(() => {});
		else v.pause();
	}, []);

	const seekBy = useCallback((delta: number) => {
		const v = videoRef.current;
		if (!v) return;
		v.currentTime = Math.min(
			Math.max(0, v.currentTime + delta),
			v.duration || 0,
		);
	}, []);

	const toggleFull = useCallback(() => {
		const el = wrapRef.current;
		if (!el) return;
		if (document.fullscreenElement) void document.exitFullscreen();
		else void el.requestFullscreen?.().catch(() => {});
	}, []);

	useEffect(() => {
		const onFs = () => setFull(Boolean(document.fullscreenElement));
		document.addEventListener("fullscreenchange", onFs);
		return () => document.removeEventListener("fullscreenchange", onFs);
	}, []);

	// Scrubbing tracks the pointer beyond the bar's bounds, so a drag that
	// wanders off the track keeps seeking instead of stopping dead.
	const scrubTo = useCallback((clientX: number, track: HTMLElement) => {
		const v = videoRef.current;
		if (!v || !v.duration) return;
		const rect = track.getBoundingClientRect();
		const ratio = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
		v.currentTime = ratio * v.duration;
		setCurrent(v.currentTime);
	}, []);

	const onTrackDown = (e: ReactPointerEvent<HTMLDivElement>) => {
		const track = e.currentTarget;
		track.setPointerCapture(e.pointerId);
		setScrubbing(true);
		scrubTo(e.clientX, track);
	};

	const progress = duration > 0 ? (current / duration) * 100 : 0;
	const bufferedPct = duration > 0 ? (buffered / duration) * 100 : 0;

	const btn =
		"flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-pill glass-chip transition-colors";

	return (
		<div
			ref={wrapRef}
			className={clsx(
				"group relative overflow-hidden bg-black",
				rounded && !full && "rounded-xl",
				className,
			)}
			onPointerMove={bump}
			onPointerLeave={() => !pinned && setChromeOn(false)}
			onKeyDown={(e) => {
				if (e.key === " " || e.key === "k") {
					e.preventDefault();
					toggle();
				} else if (e.key === "ArrowRight") seekBy(5);
				else if (e.key === "ArrowLeft") seekBy(-5);
				else if (e.key === "m") setMuted((m) => !m);
				else if (e.key === "f") toggleFull();
				bump();
			}}
			// Focusable so the keyboard shortcuts have somewhere to land.
			tabIndex={0}
			role="region"
			aria-label="Video player"
		>
			<video
				ref={videoRef}
				src={src}
				poster={poster}
				playsInline
				preload="metadata"
				muted={muted}
				className="h-full w-full object-contain"
				onClick={toggle}
				onDoubleClick={toggleFull}
				onPlay={() => setPlaying(true)}
				onPause={() => setPlaying(false)}
				onWaiting={() => setWaiting(true)}
				onPlaying={() => setWaiting(false)}
				onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
				onTimeUpdate={(e) => {
					if (scrubbing) return;
					setCurrent(e.currentTarget.currentTime);
				}}
				onProgress={(e) => {
					const v = e.currentTarget;
					if (v.buffered.length) {
						setBuffered(v.buffered.end(v.buffered.length - 1));
					}
				}}
				onEnded={() => setPlaying(false)}
				// The browser's own menu offers "Save video as", which would
				// route around anything the product decides about downloads.
				onContextMenu={(e) => e.preventDefault()}
				controlsList="nodownload"
			/>

			{/* centre affordance: only while paused, and never over the bar */}
			{!playing && (
				<button
					type="button"
					onClick={toggle}
					aria-label="Play"
					className="absolute inset-0 flex cursor-pointer items-center justify-center"
				>
					<span className="flex h-16 w-16 items-center justify-center rounded-pill glass-dock backdrop-blur-xl backdrop-saturate-150 glass-ink">
						<Play size={26} weight="fill" className="translate-x-[2px]" />
					</span>
				</button>
			)}

			{waiting && playing && (
				<span className="pointer-events-none absolute inset-0 flex items-center justify-center">
					<span className="h-8 w-8 animate-spin rounded-pill border-2 border-white/25 border-t-white/90" />
				</span>
			)}

			{/* control bar */}
			<div
				onPointerEnter={() => setOverBar(true)}
				onPointerLeave={() => setOverBar(false)}
				className={clsx(
					"absolute inset-x-0 bottom-0 p-2 transition-opacity duration-200",
					chromeOn || pinned
						? "opacity-100"
						: "pointer-events-none opacity-0",
				)}
			>
				<div className="flex items-center gap-2 rounded-xl glass-dock backdrop-blur-xl backdrop-saturate-150 glass-ink px-2 py-1.5">
					<button
						type="button"
						onClick={toggle}
						aria-label={playing ? "Pause" : "Play"}
						className={btn}
					>
						{playing ? (
							<Pause size={15} weight="fill" />
						) : (
							<Play size={15} weight="fill" />
						)}
					</button>

					<span className="shrink-0 font-sans text-[11.5px] tabular-nums glass-ink-dim">
						{clock(current)}
					</span>

					{/* track: buffered underneath, played on top */}
					<div
						onPointerDown={onTrackDown}
						onPointerMove={(e) =>
							scrubbing && scrubTo(e.clientX, e.currentTarget)
						}
						onPointerUp={() => setScrubbing(false)}
						onPointerCancel={() => setScrubbing(false)}
						role="slider"
						aria-label="Seek"
						aria-valuemin={0}
						aria-valuemax={Math.round(duration)}
						aria-valuenow={Math.round(current)}
						tabIndex={0}
						className="group/track relative h-6 min-w-0 flex-1 cursor-pointer touch-none"
					>
						<span className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 overflow-hidden rounded-pill bg-[#fafaf9]/20">
							<span
								className="absolute inset-y-0 left-0 bg-[#fafaf9]/25"
								style={{ width: `${bufferedPct}%` }}
							/>
							<span
								className="absolute inset-y-0 left-0 bg-brand"
								style={{ width: `${progress}%` }}
							/>
						</span>
						<span
							className={clsx(
								"absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-pill bg-brand transition-transform",
								scrubbing ? "scale-110" : "scale-0 group-hover/track:scale-100",
							)}
							style={{ left: `${progress}%` }}
						/>
					</div>

					<span className="shrink-0 font-sans text-[11.5px] tabular-nums glass-ink-faint">
						{clock(duration)}
					</span>

					<button
						type="button"
						onClick={() => setMuted((m) => !m)}
						aria-label={muted ? "Unmute" : "Mute"}
						className={btn}
					>
						{muted ? (
							<SpeakerSimpleX size={15} weight="fill" />
						) : (
							<SpeakerSimpleHigh size={15} weight="fill" />
						)}
					</button>

					<button
						type="button"
						onClick={toggleFull}
						aria-label={full ? "Exit full screen" : "Full screen"}
						className={btn}
					>
						{full ? (
							<ArrowsIn size={15} weight="bold" />
						) : (
							<ArrowsOut size={15} weight="bold" />
						)}
					</button>
				</div>
			</div>
		</div>
	);
}
