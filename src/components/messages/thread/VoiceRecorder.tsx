"use client";

import {
	RiCheckLine,
	RiDeleteBin6Line,
	RiLock2Line,
	RiMicFill,
	RiPauseFill,
	RiPlayFill,
	RiSendPlane2Fill,
} from "@remixicon/react";
import clsx from "clsx";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Voice v2 (register 80-83, 89, 91). One overlay over the composer that owns
 * the whole recording lifecycle:
 *
 * - The live waveform IS the level meter — an AnalyserNode feeds a canvas,
 *   so the user watches their own voice, not a placeholder animation.
 * - Hold-to-record on touch: slide LEFT to cancel, slide UP to lock,
 *   release to send. Desktop taps to toggle and starts locked.
 * - Locked mode gets pause/resume and a review step: stop → draft with the
 *   real waveform, play it back, delete it, or send it.
 * - Peaks (~64 buckets) are accumulated WHILE recording and ride the
 *   message, so the receiver renders the waveform with zero audio fetch.
 *
 * Gesture listeners live on `window`, not the mic button — the button's
 * component can re-render or swap freely mid-hold without dropping the
 * pointer.
 */

export interface RecorderStart {
	x: number;
	y: number;
	pointerType: string;
}

export interface VoiceMeta {
	durationSec: number;
	peaks: number[];
	mime: string;
}

const PEAK_BUCKETS = 64;
const SAMPLE_EVERY_MS = 80;
const CANCEL_DX = -70;
const LOCK_DY = -55;
const MAX_SECONDS = 600;

/** First recorder mime the browser admits to (register 89). */
function pickMime(): string {
	if (typeof MediaRecorder === "undefined") return "";
	for (const m of [
		"audio/webm;codecs=opus",
		"audio/webm",
		"audio/mp4",
	]) {
		try {
			if (MediaRecorder.isTypeSupported(m)) return m;
		} catch {
			/* older Safari throws on unknown types */
		}
	}
	return "";
}

/** Collapse the raw level history into the wire-format peak buckets. */
function toPeaks(levels: number[]): number[] {
	if (levels.length === 0) return [];
	const buckets = Math.min(PEAK_BUCKETS, Math.max(8, levels.length));
	const per = levels.length / buckets;
	const peaks: number[] = [];
	for (let i = 0; i < buckets; i++) {
		const start = Math.floor(i * per);
		const end = Math.max(start + 1, Math.floor((i + 1) * per));
		let peak = 0;
		for (let j = start; j < end && j < levels.length; j++) {
			if (levels[j] > peak) peak = levels[j];
		}
		peaks.push(peak);
	}
	const max = Math.max(...peaks, 0.001);
	return peaks.map((p) => Math.round((p / max) * 100) / 100);
}

function fmt(sec: number) {
	return `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;
}

export function VoiceRecorder({
	start,
	onSend,
	onClose,
	onError,
	onSignal,
}: {
	start: RecorderStart;
	onSend: (blob: Blob, meta: VoiceMeta) => void;
	onClose: () => void;
	onError: (message: string) => void;
	onSignal?: () => void;
}) {
	const [phase, setPhase] = useState<"live" | "review">("live");
	const [locked, setLocked] = useState(start.pointerType === "mouse");
	const [paused, setPaused] = useState(false);
	const [elapsed, setElapsed] = useState(0);
	const [review, setReview] = useState<{
		blob: Blob;
		url: string;
		peaks: number[];
		durationSec: number;
		mime: string;
	} | null>(null);
	const [playingReview, setPlayingReview] = useState(false);

	const recorderRef = useRef<MediaRecorder | null>(null);
	const streamRef = useRef<MediaStream | null>(null);
	const audioCtxRef = useRef<AudioContext | null>(null);
	const analyserRef = useRef<AnalyserNode | null>(null);
	const chunksRef = useRef<Blob[]>([]);
	const levelsRef = useRef<number[]>([]);
	// Recorded time = the sum of finished segments + the running one. Kept
	// on wall-clock timestamps (start, pause, resume, stop), NOT on frames:
	// the rAF loop below stops the moment the tab is hidden, and a note
	// recorded while the person glanced at another window used to come out
	// with a duration of whatever they watched the meter for (2026-09-11).
	const doneMsRef = useRef(0);
	// null until the MediaRecorder is actually running: everything before
	// that (the permission prompt especially) is not recorded audio, and
	// performance.now() is time since page load, so an unguarded first
	// frame once started the clock at 4:00 (owner 2026-09-10).
	const segmentStartRef = useRef<number | null>(null);
	const elapsedMs = useCallback(
		() =>
			doneMsRef.current +
			(segmentStartRef.current === null || pausedRef.current
				? 0
				: performance.now() - segmentStartRef.current),
		[],
	);
	const recordingRef = useRef(false);
	const rafRef = useRef<number | undefined>(undefined);
	const canvasRef = useRef<HTMLCanvasElement | null>(null);
	const hintRef = useRef<HTMLDivElement | null>(null);
	const pausedRef = useRef(false);
	const mimeRef = useRef("");
	const closedRef = useRef(false);
	const reviewAudioRef = useRef<HTMLAudioElement | null>(null);
	// "What happens when the recorder stops" is decided at stop time — the
	// same onstop fires for cancel, review and release-to-send.
	const onStopModeRef = useRef<"discard" | "review" | "send">("review");

	const teardownMedia = useCallback(() => {
		try {
			recorderRef.current?.state !== "inactive" &&
				recorderRef.current?.stop();
		} catch {
			/* already stopped */
		}
		streamRef.current?.getTracks().forEach((t) => t.stop());
		streamRef.current = null;
		void audioCtxRef.current?.close().catch(() => {});
		audioCtxRef.current = null;
	}, []);

	const finish = useCallback(
		(mode: "discard" | "review" | "send") => {
			const rec = recorderRef.current;
			onStopModeRef.current = mode;
			// Freeze the clock the moment we ask it to stop, so the tail of
			// frames between stop() and onstop cannot inflate the duration.
			if (segmentStartRef.current !== null && !pausedRef.current) {
				doneMsRef.current += performance.now() - segmentStartRef.current;
			}
			segmentStartRef.current = null;
			recordingRef.current = false;
			if (!rec || rec.state === "inactive") {
				if (mode === "discard") onClose();
				return;
			}
			try {
				rec.stop();
			} catch {
				onClose();
			}
		},
		[onClose],
	);

	// ── Acquire mic + recorder + analyser ──
	useEffect(() => {
		let alive = true;
		// StrictMode runs acquire → cleanup → acquire on one mount, and the
		// cleanup below sets closedRef true. Without resetting it here, the
		// SECOND acquire records into a recorder whose onstop sees
		// closedRef=true and treats every stop — including "send" — as a
		// discard: the voice note recorded, sent, and silently vanished
		// (owner report 2026-09-03).
		closedRef.current = false;
		void (async () => {
			try {
				const stream = await navigator.mediaDevices.getUserMedia({
					audio: true,
				});
				if (!alive) {
					stream.getTracks().forEach((t) => t.stop());
					return;
				}
				streamRef.current = stream;
				const mime = pickMime();
				mimeRef.current = mime;
				const rec = new MediaRecorder(
					stream,
					mime ? { mimeType: mime } : undefined,
				);
				recorderRef.current = rec;
				chunksRef.current = [];
				rec.ondataavailable = (e) => {
					if (e.data.size > 0) chunksRef.current.push(e.data);
				};
				rec.onstop = () => {
					const mode = onStopModeRef.current;
					stream.getTracks().forEach((t) => t.stop());
					void audioCtxRef.current?.close().catch(() => {});
					audioCtxRef.current = null;
					if (mode === "discard" || closedRef.current) {
						onClose();
						return;
					}
					const blob = new Blob(chunksRef.current, {
						type: mimeRef.current || "audio/webm",
					});
					const durationSec = Math.max(1, Math.round(elapsedMs() / 1000));
					const peaks = toPeaks(levelsRef.current);
					if (mode === "send") {
						onSend(blob, {
							durationSec,
							peaks,
							mime: mimeRef.current || "audio/webm",
						});
						onClose();
						return;
					}
					setReview({
						blob,
						url: URL.createObjectURL(blob),
						peaks,
						durationSec,
						mime: mimeRef.current || "audio/webm",
					});
					setPhase("review");
				};
				const Ctor =
					window.AudioContext ??
					(
						window as unknown as {
							webkitAudioContext?: typeof AudioContext;
						}
					).webkitAudioContext;
				if (Ctor) {
					const ctx = new Ctor();
					audioCtxRef.current = ctx;
					const src = ctx.createMediaStreamSource(stream);
					const analyser = ctx.createAnalyser();
					analyser.fftSize = 1024;
					src.connect(analyser);
					analyserRef.current = analyser;
				}
				rec.start(250);
				// The clock starts HERE, not at mount.
				doneMsRef.current = 0;
				segmentStartRef.current = performance.now();
				recordingRef.current = true;
			} catch {
				onError("Microphone access denied");
				onClose();
			}
		})();
		return () => {
			alive = false;
			closedRef.current = true;
			teardownMedia();
		};
		// biome-ignore lint/correctness/useExhaustiveDependencies: acquire once per mount
	}, [elapsedMs]);

	// ── Level sampling + the clock, on timers that keep going in a hidden
	// tab (throttled to once a second there, which still leaves the peaks
	// honest in shape); the rAF loop below only draws. ──
	useEffect(() => {
		if (phase !== "live") return;
		const data = new Uint8Array(1024);
		const sample = () => {
			if (!recordingRef.current || pausedRef.current) return;
			const analyser = analyserRef.current;
			if (!analyser) return;
			analyser.getByteTimeDomainData(data);
			let sum = 0;
			for (let i = 0; i < data.length; i++) {
				const v = (data[i] - 128) / 128;
				sum += v * v;
			}
			// RMS with a touch of gain — speech rarely nears full scale.
			levelsRef.current.push(Math.min(1, Math.sqrt(sum / data.length) * 3.2));
		};
		const tick = () => {
			if (!recordingRef.current) return;
			setElapsed((prev) => {
				const next = Math.floor(elapsedMs() / 1000);
				return next === prev ? prev : next;
			});
			if (elapsedMs() >= MAX_SECONDS * 1000) finish("review");
		};
		const sampler = setInterval(sample, SAMPLE_EVERY_MS);
		const clock = setInterval(tick, 250);
		return () => {
			clearInterval(sampler);
			clearInterval(clock);
		};
	}, [phase, finish, elapsedMs]);

	// ── The live canvas: the last N levels as bars, one rAF loop ──
	useEffect(() => {
		if (phase !== "live") return;
		const step = () => {
			rafRef.current = requestAnimationFrame(step);
			if (!recordingRef.current) return;
			const canvas = canvasRef.current;
			const ctx = canvas?.getContext("2d");
			if (canvas && ctx) {
				const dpr = window.devicePixelRatio || 1;
				const w = canvas.clientWidth;
				const h = canvas.clientHeight;
				if (canvas.width !== w * dpr) {
					canvas.width = w * dpr;
					canvas.height = h * dpr;
				}
				ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
				ctx.clearRect(0, 0, w, h);
				const barW = 2;
				const gap = 2;
				const count = Math.floor(w / (barW + gap));
				const levels = levelsRef.current;
				ctx.fillStyle = getComputedStyle(canvas).color;
				for (let i = 0; i < count; i++) {
					const level = levels[levels.length - count + i] ?? 0;
					const bh = Math.max(2, level * (h - 4));
					ctx.beginPath();
					ctx.roundRect(
						i * (barW + gap),
						(h - bh) / 2,
						barW,
						bh,
						1,
					);
					ctx.fill();
				}
			}
		};
		rafRef.current = requestAnimationFrame(step);
		return () => {
			if (rafRef.current !== undefined) cancelAnimationFrame(rafRef.current);
		};
	}, [phase]);

	// ── "recording audio…" heartbeat to the peer (register 84) ──
	useEffect(() => {
		if (phase !== "live" || !onSignal) return;
		onSignal();
		const t = setInterval(() => {
			if (!pausedRef.current) onSignal();
		}, 2500);
		return () => clearInterval(t);
	}, [phase, onSignal]);

	// ── Hold gesture: slide left to cancel, up to lock, release to send ──
	useEffect(() => {
		if (locked || phase !== "live") return;
		const onMove = (e: PointerEvent) => {
			const dx = e.clientX - start.x;
			const dy = e.clientY - start.y;
			const hint = hintRef.current;
			if (hint) {
				const shown = Math.min(0, Math.max(CANCEL_DX, dx));
				hint.style.transform = `translateX(${shown * 0.5}px)`;
				hint.style.opacity = String(1 + shown / (CANCEL_DX * 1.2));
			}
			if (dx < CANCEL_DX) {
				finish("discard");
				return;
			}
			if (dy < LOCK_DY) setLocked(true);
		};
		const onUp = () => {
			// A sub-second press is a TAP, not a hold: lock and keep
			// recording (Telegram grammar). Discarding here made the mic
			// button feel dead on phones — tap, overlay blinks, nothing.
			if (elapsedMs() < 700) setLocked(true);
			else finish("send");
		};
		window.addEventListener("pointermove", onMove);
		window.addEventListener("pointerup", onUp);
		window.addEventListener("pointercancel", onUp);
		return () => {
			window.removeEventListener("pointermove", onMove);
			window.removeEventListener("pointerup", onUp);
			window.removeEventListener("pointercancel", onUp);
		};
	}, [locked, phase, start.x, start.y, finish, elapsedMs]);

	const togglePause = () => {
		const rec = recorderRef.current;
		if (!rec) return;
		if (rec.state === "recording") {
			rec.pause();
			if (segmentStartRef.current !== null)
				doneMsRef.current += performance.now() - segmentStartRef.current;
			pausedRef.current = true;
			setPaused(true);
		} else if (rec.state === "paused") {
			rec.resume();
			segmentStartRef.current = performance.now();
			pausedRef.current = false;
			setPaused(false);
		}
	};

	const toggleReviewPlay = () => {
		const a = reviewAudioRef.current;
		if (!a) return;
		if (a.paused) void a.play().catch(() => {});
		else a.pause();
	};

	const discardReview = () => {
		if (review) URL.revokeObjectURL(review.url);
		onClose();
	};

	const sendReview = () => {
		if (!review) return;
		onSend(review.blob, {
			durationSec: review.durationSec,
			peaks: review.peaks,
			mime: review.mime,
		});
		URL.revokeObjectURL(review.url);
		onClose();
	};

	if (phase === "review" && review) {
		return (
			<div className="absolute inset-0 z-10 flex items-center gap-1 rounded-xl bg-raised px-2">
				<button
					type="button"
					onClick={discardReview}
					aria-label="Delete recording"
					className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-pill text-muted transition-colors hover:bg-chip hover:text-danger"
				>
					<RiDeleteBin6Line size={19} />
				</button>
				<button
					type="button"
					onClick={toggleReviewPlay}
					aria-label={playingReview ? "Pause" : "Play recording"}
					className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-pill text-primary transition-colors hover:bg-chip"
				>
					{playingReview ? (
						<RiPauseFill size={20} />
					) : (
						<RiPlayFill size={20} />
					)}
				</button>
				<div className="flex h-8 min-w-0 flex-1 items-center justify-between overflow-hidden">
					{review.peaks.map((p, i) => (
						<span
							// biome-ignore lint/suspicious/noArrayIndexKey: bars are positional
							key={i}
							// Spread across the row: a short note has few peaks, and a
							// fixed 2px pitch left them huddled at the left edge.
							className="w-[2px] shrink-0 rounded-pill bg-gold"
							style={{ height: Math.max(3, p * 26) }}
						/>
					))}
				</div>
				<span className="shrink-0 font-sans text-[calc(12px*var(--ws-fs))] tabular-nums text-muted">
					{fmt(review.durationSec)}
				</span>
				<button
					type="button"
					onClick={sendReview}
					aria-label="Send voice message"
					className="ml-1 flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-pill bg-brand text-brand-on transition-colors hover:bg-brand-active"
				>
					<RiSendPlane2Fill size={16} />
				</button>
				{/* Playback only exists in review; hidden element, no chrome. */}
				<audio
					ref={reviewAudioRef}
					src={review.url}
					onPlay={() => setPlayingReview(true)}
					onPause={() => setPlayingReview(false)}
					onEnded={() => setPlayingReview(false)}
					className="hidden"
				/>
			</div>
		);
	}

	return (
		<div className="absolute inset-0 z-10 flex items-center gap-2 rounded-xl bg-raised px-3">
			{/* Sanctioned live-state loop: opacity-only pulse (06-motion). */}
			<span
				className={clsx(
					"h-2.5 w-2.5 shrink-0 rounded-pill bg-danger",
					!paused && "animate-pulse",
				)}
			/>
			<span className="shrink-0 font-sans text-[calc(13px*var(--ws-fs))] font-semibold tabular-nums text-primary">
				{fmt(elapsed)}
			</span>
			<canvas
				ref={canvasRef}
				className="h-8 min-w-0 flex-1 text-gold"
				aria-hidden
			/>
			{locked ? (
				<>
					<button
						type="button"
						onClick={() => finish("discard")}
						aria-label="Cancel recording"
						className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-pill text-muted transition-colors hover:bg-chip hover:text-danger"
					>
						<RiDeleteBin6Line size={19} />
					</button>
					<button
						type="button"
						onClick={togglePause}
						aria-label={paused ? "Resume recording" : "Pause recording"}
						className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-pill text-primary transition-colors hover:bg-chip"
					>
						{paused ? <RiMicFill size={18} /> : <RiPauseFill size={19} />}
					</button>
					<button
						type="button"
						onClick={() => finish("review")}
						aria-label="Stop and review"
						className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-pill text-primary transition-colors hover:bg-chip"
					>
						<RiCheckLine size={20} />
					</button>
					<button
						type="button"
						onClick={() => finish("send")}
						aria-label="Send voice message"
						className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-pill bg-brand text-brand-on transition-colors hover:bg-brand-active"
					>
						<RiSendPlane2Fill size={16} />
					</button>
				</>
			) : (
				<div
					ref={hintRef}
					className="flex shrink-0 items-center gap-2 text-muted"
				>
					<span className="font-sans text-[calc(12px*var(--ws-fs))]">‹ slide to cancel</span>
					<span className="flex h-7 w-7 items-center justify-center rounded-pill bg-chip">
						<RiLock2Line size={14} />
					</span>
				</div>
			)}
		</div>
	);
}
