"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import clsx from "clsx";

interface VoiceMessageProps {
	src: string;
	isMe: boolean;
}

const BAR_COUNT = 44;
const BAR_MAX_HEIGHT = 28;
const BAR_MIN_HEIGHT = 3;

// Static placeholder silhouette shown while decoding — no shimmer loop.
const PLACEHOLDER_PEAKS = Array.from(
	{ length: BAR_COUNT },
	(_, i) => 0.25 + 0.45 * Math.abs(Math.sin(i * 0.9) * Math.cos(i * 0.35)),
);

type DecodedWave = { peaks: number[]; duration: number };

// Module-level caches: decoding is per-src, not per-mount, so re-renders,
// re-mounts and duplicate messages never re-fetch or re-decode.
const waveCache = new Map<string, DecodedWave>();
const wavePending = new Map<string, Promise<DecodedWave>>();
const waveFailed = new Set<string>();

// Only one voice note plays at a time.
let activeAudio: HTMLAudioElement | null = null;

async function decodeWave(src: string): Promise<DecodedWave> {
	// The R2 public bucket serves the file but no CORS headers, so a direct
	// read fails in the one place we need the BYTES rather than an element.
	// Fall back to the gateway's authenticated proxy, which is CORS-open.
	let bytes: ArrayBuffer;
	try {
		const res = await fetch(src);
		if (!res.ok) throw new Error(`waveform fetch failed: ${res.status}`);
		bytes = await res.arrayBuffer();
	} catch {
		const token = await (window as any).Clerk?.session?.getToken();
		if (!token) throw new Error("no session for media proxy");
		const proxied = await fetch(
			`${process.env.NEXT_PUBLIC_API_URL ?? ""}/api/messages/media?src=${encodeURIComponent(src)}`,
			{ headers: { Authorization: `Bearer ${token}` } },
		);
		if (!proxied.ok)
			throw new Error(`media proxy failed: ${proxied.status}`);
		bytes = await proxied.arrayBuffer();
	}
	const Ctor =
		window.AudioContext ??
		(window as unknown as { webkitAudioContext?: typeof AudioContext })
			.webkitAudioContext;
	if (!Ctor) throw new Error("WebAudio unavailable");
	const ctx = new Ctor();
	try {
		const buffer = await ctx.decodeAudioData(bytes);
		const channel = buffer.getChannelData(0);
		const block = Math.max(1, Math.floor(channel.length / BAR_COUNT));
		const peaks: number[] = [];
		for (let i = 0; i < BAR_COUNT; i++) {
			const start = i * block;
			const end = Math.min(start + block, channel.length);
			// Sample a stride within each block — a peak read of every Nth
			// sample is indistinguishable at 2px and much cheaper.
			const stride = Math.max(1, Math.floor((end - start) / 96));
			let peak = 0;
			for (let j = start; j < end; j += stride) {
				const v = Math.abs(channel[j]);
				if (v > peak) peak = v;
			}
			peaks.push(peak);
		}
		const max = Math.max(...peaks, 0.001);
		return { peaks: peaks.map((p) => p / max), duration: buffer.duration };
	} finally {
		ctx.close().catch(() => {});
	}
}

export const VoiceMessage = ({ src, isMe }: VoiceMessageProps) => {
	const [isPlaying, setIsPlaying] = useState(false);
	const [duration, setDuration] = useState(0);
	const [currentTime, setCurrentTime] = useState(0);
	const [peaks, setPeaks] = useState<number[] | null>(
		() => waveCache.get(src)?.peaks ?? null,
	);
	const [decodeFailed, setDecodeFailed] = useState(() => waveFailed.has(src));

	const audioRef = useRef<HTMLAudioElement>(null);
	const barsRef = useRef<HTMLDivElement>(null);
	const requestRef = useRef<number | undefined>(undefined);
	const draggingRef = useRef(false);

	// Decode the waveform. Any failure (CORS, codec) falls back to the
	// progress bar — it must never break playback.
	useEffect(() => {
		const cached = waveCache.get(src);
		if (cached) {
			setPeaks(cached.peaks);
			setDecodeFailed(false);
			setDuration((d) => (d > 0 && Number.isFinite(d) ? d : cached.duration));
			return;
		}
		if (waveFailed.has(src)) {
			setPeaks(null);
			setDecodeFailed(true);
			return;
		}
		setPeaks(null);
		setDecodeFailed(false);
		let cancelled = false;
		let pending = wavePending.get(src);
		if (!pending) {
			pending = decodeWave(src);
			wavePending.set(src, pending);
			pending
				.then((wave) => {
					waveCache.set(src, wave);
				})
				.catch(() => {
					waveFailed.add(src);
				})
				.finally(() => {
					wavePending.delete(src);
				});
		}
		pending
			.then((wave) => {
				if (cancelled) return;
				setPeaks(wave.peaks);
				// MediaRecorder blobs can report Infinity from the element;
				// the decoded buffer always knows the real duration.
				setDuration((d) => (d > 0 && Number.isFinite(d) ? d : wave.duration));
			})
			.catch(() => {
				if (!cancelled) setDecodeFailed(true);
			});
		return () => {
			cancelled = true;
		};
	}, [src]);

	const animate = useCallback(() => {
		const audio = audioRef.current;
		if (!audio) return;
		setCurrentTime(audio.currentTime);
		requestRef.current = requestAnimationFrame(animate);
	}, []);

	useEffect(() => {
		if (isPlaying) {
			requestRef.current = requestAnimationFrame(animate);
		} else if (requestRef.current !== undefined) {
			cancelAnimationFrame(requestRef.current);
		}
		return () => {
			if (requestRef.current !== undefined) {
				cancelAnimationFrame(requestRef.current);
			}
		};
	}, [isPlaying, animate]);

	// Release the module-level slot if this instance unmounts mid-play.
	useEffect(() => {
		const audio = audioRef.current;
		return () => {
			if (activeAudio === audio) activeAudio = null;
		};
	}, []);

	const togglePlay = () => {
		const audio = audioRef.current;
		if (!audio) return;
		if (audio.paused) {
			if (activeAudio && activeAudio !== audio) activeAudio.pause();
			activeAudio = audio;
			audio.play().catch(() => {});
		} else {
			audio.pause();
		}
	};

	const handlePlay = () => setIsPlaying(true);

	const handlePause = () => {
		setIsPlaying(false);
		if (audioRef.current) setCurrentTime(audioRef.current.currentTime);
	};

	const handleEnded = () => {
		if (audioRef.current) audioRef.current.currentTime = 0;
		setCurrentTime(0);
	};

	const handleLoadedMetadata = () => {
		const audio = audioRef.current;
		if (!audio) return;
		if (Number.isFinite(audio.duration) && audio.duration > 0) {
			setDuration(audio.duration);
		}
	};

	const formatTime = (time: number) => {
		if (!Number.isFinite(time) || Number.isNaN(time)) return "0:00";
		const minutes = Math.floor(time / 60);
		const seconds = Math.floor(time % 60);
		return `${minutes}:${seconds.toString().padStart(2, "0")}`;
	};

	const seekToClientX = (clientX: number) => {
		const el = barsRef.current;
		const audio = audioRef.current;
		if (!el || !audio || !duration) return;
		const rect = el.getBoundingClientRect();
		if (rect.width === 0) return;
		const frac = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
		const time = frac * duration;
		audio.currentTime = time;
		setCurrentTime(time);
	};

	const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
		draggingRef.current = true;
		e.currentTarget.setPointerCapture(e.pointerId);
		seekToClientX(e.clientX);
	};

	const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
		if (draggingRef.current) seekToClientX(e.clientX);
	};

	const endDrag = () => {
		draggingRef.current = false;
	};

	// Fallback progress-bar seek (decode failed).
	const handleRangeSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
		const audio = audioRef.current;
		if (!audio || !duration) return;
		const time = (Number(e.target.value) / 100) * duration;
		audio.currentTime = time;
		setCurrentTime(time);
	};

	const progress = duration > 0 ? currentTime / duration : 0;
	const decoding = peaks === null && !decodeFailed;
	const shownPeaks = peaks ?? PLACEHOLDER_PEAKS;

	return (
		<div
			className={clsx(
				"flex items-center gap-2 sm:gap-3 p-1 rounded-xl w-full min-w-0 select-none",
				isMe ? "text-brand-on" : "text-primary",
			)}
		>
			<button
				type="button"
				onClick={togglePlay}
				aria-label={isPlaying ? "Pause voice message" : "Play voice message"}
				className="flex h-10 w-10 shrink-0 items-center justify-center rounded-pill outline-none"
			>
				{isPlaying ? (
					<Pause className="h-4 w-4 fill-current" />
				) : (
					<Play className="h-4 w-4 fill-current" />
				)}
			</button>

			{decodeFailed ? (
				<div className="flex h-10 min-w-0 flex-1 flex-col justify-center">
					<input
						type="range"
						min="0"
						max="100"
						value={progress * 100}
						onChange={handleRangeSeek}
						aria-label="Seek"
						className="w-full h-1 py-3 box-content bg-current/20 rounded-lg appearance-none cursor-pointer accent-current touch-none"
					/>
				</div>
			) : (
				<div
					ref={barsRef}
					role="slider"
					aria-label="Seek"
					aria-valuemin={0}
					aria-valuemax={Math.round(duration) || 0}
					aria-valuenow={Math.round(currentTime)}
					onPointerDown={handlePointerDown}
					onPointerMove={handlePointerMove}
					onPointerUp={endDrag}
					onPointerCancel={endDrag}
					className="flex h-10 min-w-0 flex-1 cursor-pointer touch-none items-center gap-[2px] overflow-hidden"
				>
					{shownPeaks.map((peak, i) => (
						<span
							// biome-ignore lint/suspicious/noArrayIndexKey: bars are positional by definition
							key={i}
							className="w-[2px] shrink-0 rounded-full bg-current transition-opacity"
							style={{
								height: Math.max(
									BAR_MIN_HEIGHT,
									Math.round(peak * BAR_MAX_HEIGHT),
								),
								opacity: decoding ? 0.25 : i / BAR_COUNT < progress ? 1 : 0.35,
							}}
						/>
					))}
				</div>
			)}

			{/* tabular-nums does the fixed-width digits; no monospace family
			    exists in the type system. */}
			<span className="text-xs font-sans tabular-nums opacity-80 shrink-0 min-w-[32px] text-right">
				{formatTime(
					isPlaying ? Math.max(0, duration - currentTime) : duration,
				)}
			</span>

			<audio
				ref={audioRef}
				src={src}
				preload="metadata"
				onLoadedMetadata={handleLoadedMetadata}
				onPlay={handlePlay}
				onPause={handlePause}
				onEnded={handleEnded}
				className="hidden"
			/>
		</div>
	);
};
