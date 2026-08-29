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
/** Far enough to read a chart or a face; past this it is just mush. */
const MAX_ZOOM = 4;

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
	fitToMedia = false,
}: {
	src: string;
	poster?: string;
	className?: string;
	rounded?: boolean;
	/** Size the frame to the clip's own aspect ratio (feed/timeline usage). */
	fitToMedia?: boolean;
}) {
	const wrapRef = useRef<HTMLDivElement | null>(null);
	const videoRef = useRef<HTMLVideoElement | null>(null);
	const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

	const [playing, setPlaying] = useState(false);
	// Feed videos start MUTED and autoplay on view (owner ruling): sound is
	// a choice, motion is free. Muted-by-default is also what lets the
	// browser allow the autoplay at all.
	const [muted, setMuted] = useState(true);
	const [duration, setDuration] = useState(0);
	/**
	 * The clip's own aspect ratio, once the metadata says what it is.
	 *
	 * Without it the frame was a fixed 16/9 box and every portrait video sat
	 * in the middle of it between two black bars. Portrait is most of what
	 * gets posted from a phone, so most videos in the feed were letterboxed.
	 *
	 * Clamped rather than trusted outright: a 9:16 clip at full height would
	 * push the rest of the post off screen, so very tall media stops at 4:5
	 * and keeps its bars — the same bound X uses. Everything between 4:5 and
	 * 16:9, which is nearly everything, now fits its frame exactly.
	 */
	const [ratio, setRatio] = useState<number | null>(null);
	const [current, setCurrent] = useState(0);
	const [buffered, setBuffered] = useState(0);
	const [chromeOn, setChromeOn] = useState(true);
	const [scrubbing, setScrubbing] = useState(false);
	const [overBar, setOverBar] = useState(false);
	const [full, setFull] = useState(false);
	const [waiting, setWaiting] = useState(false);

	/** 1 = fit. Pinch on touch, ctrl+wheel (trackpad pinch) on a desktop. */
	const [zoom, setZoom] = useState(1);
	const [pan, setPan] = useState({ x: 0, y: 0 });
	/** Live pointers, so two of them can be told apart from one. */
	const pointers = useRef(new Map<number, { x: number; y: number }>());
	const pinchRef = useRef<{ dist: number; zoom: number } | null>(null);
	const panRef = useRef<{ x: number; y: number; px: number; py: number } | null>(
		null,
	);
	/** A drag that panned must not also land as a play/pause tap. */
	const movedRef = useRef(false);

	const zoomed = zoom > 1.01;

	/**
	 * Keep the frame covered. Scaling by `z` about the centre extends each
	 * edge by (z-1)/2, which is exactly how far the picture may be pushed
	 * before its edge crosses into view.
	 */
	const clampPan = useCallback(
		(x: number, y: number, z: number) => {
			const r = videoRef.current?.getBoundingClientRect();
			if (!r) return { x: 0, y: 0 };
			const mx = ((z - 1) / 2) * r.width;
			const my = ((z - 1) / 2) * r.height;
			return {
				x: Math.min(mx, Math.max(-mx, x)),
				y: Math.min(my, Math.max(-my, y)),
			};
		},
		[],
	);

	const applyZoom = useCallback(
		(next: number) => {
			const z = Math.min(MAX_ZOOM, Math.max(1, next));
			setZoom(z);
			// Falling back to fit re-centres; otherwise a pan from a previous
			// zoom would strand the picture off to one side at 1x.
			setPan((prev) =>
				z <= 1.01 ? { x: 0, y: 0 } : clampPan(prev.x, prev.y, z),
			);
		},
		[clampPan],
	);

	const resetZoom = useCallback(() => {
		setZoom(1);
		setPan({ x: 0, y: 0 });
	}, []);

	// Non-passive, because a trackpad pinch arrives as ctrl+wheel and the
	// browser would otherwise zoom the whole page instead of the video.
	useEffect(() => {
		const el = videoRef.current;
		if (!el) return;
		const onWheel = (e: WheelEvent) => {
			if (!e.ctrlKey) return;
			e.preventDefault();
			applyZoom(zoom * (1 - e.deltaY / 200));
		};
		el.addEventListener("wheel", onWheel, { passive: false });
		return () => el.removeEventListener("wheel", onWheel);
	}, [zoom, applyZoom]);

	const onPointerDown = (e: ReactPointerEvent<HTMLVideoElement>) => {
		pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
		movedRef.current = false;
		if (pointers.current.size === 2) {
			const [a, b] = [...pointers.current.values()];
			pinchRef.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom };
			panRef.current = null;
		} else if (pointers.current.size === 1 && zoomed) {
			// Capture keeps the drag alive when the finger leaves the frame.
			// It throws if the browser has already released that pointer, and
			// a throw here would lose the pan entirely — the capture is a
			// nicety, the pan is the point.
			try {
				e.currentTarget.setPointerCapture(e.pointerId);
			} catch {
				/* not capturable; the drag still works inside the frame */
			}
			panRef.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
		}
	};

	const onPointerMove = (e: ReactPointerEvent<HTMLVideoElement>) => {
		if (!pointers.current.has(e.pointerId)) return;
		pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

		if (pointers.current.size === 2 && pinchRef.current) {
			const [a, b] = [...pointers.current.values()];
			const dist = Math.hypot(a.x - b.x, a.y - b.y);
			if (pinchRef.current.dist > 0) {
				movedRef.current = true;
				applyZoom(pinchRef.current.zoom * (dist / pinchRef.current.dist));
			}
			return;
		}

		if (panRef.current) {
			const dx = e.clientX - panRef.current.x;
			const dy = e.clientY - panRef.current.y;
			if (Math.abs(dx) > 3 || Math.abs(dy) > 3) movedRef.current = true;
			setPan(clampPan(panRef.current.px + dx, panRef.current.py + dy, zoom));
		}
	};

	const endPointer = (e: ReactPointerEvent<HTMLVideoElement>) => {
		pointers.current.delete(e.pointerId);
		if (pointers.current.size < 2) pinchRef.current = null;
		if (pointers.current.size === 0) panRef.current = null;
	};

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

	// Autoplay on view, muted; leaving the viewport pauses. The observer only
	// ever starts a MUTED clip — if the person unmuted and scrolled away, the
	// pause keeps their place but the return replay stays silent until they
	// choose sound again. 60% visible so half-cards don't all talk at once.
	useEffect(() => {
		const el = wrapRef.current;
		const v = videoRef.current;
		if (!el || !v) return;
		const io = new IntersectionObserver(
			([e]) => {
				if (e.isIntersecting) {
					if (v.paused) {
						v.muted = true;
						setMuted(true);
						void v.play().catch(() => {});
					}
				} else if (!v.paused) {
					v.pause();
				}
			},
			{ threshold: 0.6 },
		);
		io.observe(el);
		return () => io.disconnect();
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

	// No chip fill per button. Six glass pills in a row inside a feed-width
	// card read as clutter; the bar is already the glass surface, so the
	// controls sit on it and only light up on hover.
	const btn =
		"flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-pill glass-ink transition-colors hover:bg-white/10";

	return (
		<div
			ref={wrapRef}
			className={clsx(
				"group relative overflow-hidden bg-black",
				rounded && !full && "rounded-xl",
				className,
			)}
			style={
				// Full screen owns its own box; otherwise adopt the clip's shape
				// once known. Until then the caller's placeholder ratio holds the
				// space, so the frame resizes at most once and the feed below it
				// never jumps twice.
				fitToMedia && !full && ratio
					? { aspectRatio: String(ratio) }
					: undefined
			}
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
				style={{
					transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
					// No transition while pinching — it would lag the fingers.
					transition: pinchRef.current ? "none" : "transform 120ms var(--ws-ease)",
					// `pan-y` at fit keeps a vertical swipe scrolling the feed
					// while still handing us the pinch; once zoomed the drag is
					// ours in both axes.
					touchAction: zoomed ? "none" : "pan-y",
					cursor: zoomed ? "grab" : undefined,
				}}
				onPointerDown={onPointerDown}
				onPointerMove={onPointerMove}
				onPointerUp={endPointer}
				onPointerCancel={endPointer}
				onClick={() => {
					// A pinch or a pan ends with a pointerup over the video; it
					// must not also read as a tap to play.
					if (movedRef.current) {
						movedRef.current = false;
						return;
					}
					// In the feed (fitToMedia) a tap answers the autoplay
					// question — sound on/off — the way every muted-autoplay
					// feed works. Pause lives on the control bar. Elsewhere
					// (detail pages, modals) a tap still means play/pause.
					if (fitToMedia && playing) {
						setMuted((m) => {
							const v = videoRef.current;
							if (v) v.muted = !m;
							return !m;
						});
						bump();
						return;
					}
					toggle();
				}}
				onDoubleClick={toggleFull}
				onPlay={() => setPlaying(true)}
				onPause={() => setPlaying(false)}
				onWaiting={() => setWaiting(true)}
				onPlaying={() => setWaiting(false)}
				onLoadedMetadata={(e) => {
					const el = e.currentTarget;
					setDuration(el.duration || 0);
					if (el.videoWidth > 0 && el.videoHeight > 0) {
						const r = el.videoWidth / el.videoHeight;
						setRatio(Math.min(16 / 9, Math.max(4 / 5, r)));
					}
				}}
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

			{/* Where you are, and the way back. Zoomed into a corner of a clip
			    with no readout, "fit" is a guess. */}
			{zoomed && (
				<button
					type="button"
					onClick={resetZoom}
					aria-label="Reset zoom"
					className="absolute left-3 top-3 z-10 flex h-8 cursor-pointer items-center gap-1.5 rounded-pill glass-chip px-3 font-sans text-[12px] font-semibold tabular-nums"
				>
					{zoom.toFixed(1)}x
					<span className="glass-ink-faint font-normal">Reset</span>
				</button>
			)}

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
				<div className="flex items-center gap-1.5 rounded-xl glass-dock backdrop-blur-xl backdrop-saturate-150 glass-ink px-1.5 py-1">
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
						className="group/track relative mx-1 h-6 min-w-0 flex-1 cursor-pointer touch-none"
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

					{/* One readout, not two flanking the track. Elapsed is the
					    number people actually read; the total rides with it. */}
					<span className="shrink-0 px-0.5 font-sans text-[11.5px] tabular-nums glass-ink-dim">
						{clock(current)}
						<span className="glass-ink-faint"> / {clock(duration)}</span>
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
