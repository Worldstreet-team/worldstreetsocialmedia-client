"use client";

import clsx from "clsx";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import {
	Microphone,
	Pause,
	Stop,
	ArrowCounterClockwise,
} from "@phosphor-icons/react";
import {
	OverlayHeader,
	OverlayPanel,
	OverlayScrim,
	useOverlayDismiss,
} from "@/components/ui/Overlay";
import { AudioCard } from "@/components/feed/AudioCard";
import { analyzeAudioFile } from "@/lib/audio-analyze";

/**
 * The in-app voice recorder for feed posts — the suite's first station.
 *
 * Segmented by design: pause and continue as often as needed and the gaps
 * never reach the file (MediaRecorder's own pause/resume drops them, no
 * decode-and-splice required). Stop lands on a review pass — listen, then
 * Use it or scrap it — because the one-shot recorder was the story lane's
 * biggest complaint: a stumble at second fifty meant starting over.
 *
 * The live meter draws real amplitude off an AnalyserNode, not decoration.
 * The clock counts recorded time only (pauses don't tick) and the tier cap
 * stops the take cleanly at the limit rather than failing at post time.
 */
export function RecordVoiceSheet({
	open,
	maxSeconds,
	avatar,
	initialFile,
	onClose,
	onDone,
}: {
	open: boolean;
	maxSeconds: number;
	/** The poster's picture — the preview must show THEIR card. */
	avatar?: string;
	/** A file picked outside (upload path): the sheet opens straight on the
	 *  finishing step, so upload and record share one finishing room. */
	initialFile?: File | null;
	onClose: () => void;
	onDone: (file: File, opts: { blurBg: boolean }) => void;
}) {
	useOverlayDismiss(open, onClose);
	const [phase, setPhase] = useState<
		"idle" | "recording" | "paused" | "review" | "denied"
	>("idle");
	const [elapsed, setElapsed] = useState(0);
	const [bars, setBars] = useState<number[]>([]);
	const [reviewUrl, setReviewUrl] = useState<string | null>(null);
	const [reviewFile, setReviewFile] = useState<File | null>(null);
	const [reviewMeta, setReviewMeta] = useState<{
		durationSec: number;
		peaks: number[];
	} | null>(null);
	const [blurBg, setBlurBg] = useState(true);

	const recRef = useRef<MediaRecorder | null>(null);
	const streamRef = useRef<MediaStream | null>(null);
	const chunksRef = useRef<Blob[]>([]);
	const rafRef = useRef<number>(0);
	const analyserRef = useRef<AnalyserNode | null>(null);
	const ctxRef = useRef<AudioContext | null>(null);
	const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const elapsedRef = useRef(0);

	const cleanup = useCallback(() => {
		cancelAnimationFrame(rafRef.current);
		if (tickRef.current) clearInterval(tickRef.current);
		tickRef.current = null;
		recRef.current = null;
		for (const t of streamRef.current?.getTracks() ?? []) t.stop();
		streamRef.current = null;
		void ctxRef.current?.close().catch(() => {});
		ctxRef.current = null;
		analyserRef.current = null;
	}, []);

	// Closing the sheet mid-take must release the mic — a red recording dot
	// in the tab after "cancel" is how trust dies.
	useEffect(() => {
		if (!open) {
			cleanup();
			setPhase("idle");
			setElapsed(0);
			elapsedRef.current = 0;
			setBars([]);
			if (reviewUrl) URL.revokeObjectURL(reviewUrl);
			setReviewUrl(null);
			setReviewFile(null);
			setReviewMeta(null);
			setBlurBg(true);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [open]);

	// Upload path: the picked file lands on the same finishing step the
	// recorder ends on — one room for both roads.
	useEffect(() => {
		if (!open || !initialFile) return;
		let cancelled = false;
		void analyzeAudioFile(initialFile).then((meta) => {
			if (cancelled || !meta) return;
			setReviewFile(initialFile);
			setReviewMeta(meta);
			setElapsed(meta.durationSec);
			elapsedRef.current = meta.durationSec;
			setReviewUrl(URL.createObjectURL(initialFile));
			setPhase("review");
		});
		return () => {
			cancelled = true;
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [open, initialFile]);

	const meter = useCallback(() => {
		const an = analyserRef.current;
		if (!an) return;
		const data = new Uint8Array(an.frequencyBinCount);
		const step = () => {
			an.getByteTimeDomainData(data);
			let max = 0;
			for (let i = 0; i < data.length; i += 4) {
				const v = Math.abs(data[i] - 128) / 128;
				if (v > max) max = v;
			}
			setBars((prev) => [...prev.slice(-47), Math.round(max * 127)]);
			rafRef.current = requestAnimationFrame(step);
		};
		rafRef.current = requestAnimationFrame(step);
	}, []);

	const start = useCallback(async () => {
		try {
			const stream = await navigator.mediaDevices.getUserMedia({
				audio: { echoCancellation: true, noiseSuppression: true },
			});
			streamRef.current = stream;
			const Ctx =
				window.AudioContext ?? (window as any).webkitAudioContext;
			const ctx = new Ctx();
			ctxRef.current = ctx;
			const srcNode = ctx.createMediaStreamSource(stream);
			const an = ctx.createAnalyser();
			an.fftSize = 512;
			srcNode.connect(an);
			analyserRef.current = an;

			const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
				? "audio/webm;codecs=opus"
				: MediaRecorder.isTypeSupported("audio/mp4")
					? "audio/mp4"
					: "";
			const rec = new MediaRecorder(
				stream,
				mime ? { mimeType: mime } : undefined,
			);
			recRef.current = rec;
			chunksRef.current = [];
			rec.ondataavailable = (e) => {
				if (e.data.size > 0) chunksRef.current.push(e.data);
			};
			rec.onstop = () => {
				const blob = new Blob(chunksRef.current, {
					type: rec.mimeType || "audio/webm",
				});
				const ext = blob.type.includes("mp4") ? "m4a" : "webm";
				const file = new File([blob], `voice-note.${ext}`, {
					type: blob.type,
				});
				setReviewFile(file);
				setReviewUrl(URL.createObjectURL(blob));
				setPhase("review");
				cleanup();
				// Real peaks for the preview — the card shown here is the card
				// the feed will render, waveform and all.
				void analyzeAudioFile(file).then((meta) => {
					if (meta) setReviewMeta(meta);
				});
			};
			rec.start(250);
			setPhase("recording");
			meter();
			tickRef.current = setInterval(() => {
				elapsedRef.current += 0.2;
				setElapsed(elapsedRef.current);
				// The cap ends the take cleanly instead of letting the post fail.
				if (elapsedRef.current >= maxSeconds) recRef.current?.stop();
			}, 200);
		} catch {
			setPhase("denied");
		}
	}, [cleanup, meter, maxSeconds]);

	const pauseResume = useCallback(() => {
		const rec = recRef.current;
		if (!rec) return;
		if (rec.state === "recording") {
			rec.pause();
			if (tickRef.current) clearInterval(tickRef.current);
			cancelAnimationFrame(rafRef.current);
			setPhase("paused");
		} else if (rec.state === "paused") {
			rec.resume();
			meter();
			tickRef.current = setInterval(() => {
				elapsedRef.current += 0.2;
				setElapsed(elapsedRef.current);
				if (elapsedRef.current >= maxSeconds) recRef.current?.stop();
			}, 200);
			setPhase("recording");
		}
	}, [meter, maxSeconds]);

	const use = useCallback(() => {
		if (!reviewFile) return;
		onDone(reviewFile, { blurBg });
		onClose();
	}, [reviewFile, blurBg, onDone, onClose]);

	const clock = (s: number) =>
		`${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
	const nearCap = elapsed > maxSeconds - 10;

	return (
		<AnimatePresence>
			{open && (
				<>
					<OverlayScrim onClose={onClose} />
					<OverlayPanel variant="sheet" label="Record a voice note">
						<OverlayHeader title="Voice note" onClose={onClose} />
						<div className="flex flex-col items-center gap-5 px-5 pb-6 pt-1">
							{/* live meter while recording; in review the REAL card
							    takes this spot */}
							{phase !== "review" && (
								<div className="flex h-16 w-full items-center justify-center gap-[3px] rounded-xl bg-sunken px-4">
									{phase === "denied" ? (
										<p className="font-sans text-[13px] text-muted">
											Microphone access was refused — allow it in the
											browser and try again.
										</p>
									) : bars.length === 0 ? (
										<p className="font-sans text-[13px] text-subtle">
											Your voice draws here.
										</p>
									) : (
										bars.map((v, i) => (
											<span
												key={i}
												className="w-[3px] rounded-pill bg-gold"
												style={{ height: `${Math.max(8, (v / 127) * 100)}%` }}
											/>
										))
									)}
								</div>
							)}

							{phase !== "review" && (
							<div className="flex items-baseline gap-2 font-sans tabular-nums">
								<span
									className={clsx(
										"text-[26px] font-semibold",
										nearCap ? "text-danger" : "text-primary",
									)}
								>
									{clock(elapsed)}
								</span>
								<span className="text-[13px] text-subtle">
									/ {clock(maxSeconds)}
								</span>
							</div>
							)}

							{phase === "review" && reviewUrl ? (
								<>
									{/* WYSIWYG: this IS the feed card — same component,
									    same waveform, same ground — playable right here.
									    What gets approved is what gets rendered. */}
									<div className="w-full">
										<AudioCard
											key={`${blurBg}-${reviewMeta ? "m" : "x"}`}
											audio={{
												url: reviewUrl,
												durationSec:
													reviewMeta?.durationSec ??
													Math.round(elapsedRef.current),
												peaks: reviewMeta?.peaks ?? [],
												blurBg,
											}}
											avatar={avatar}
										/>
									</div>

									{/* The background is chosen HERE, on the preview,
									    where the choice is visible — not on a chip in
									    the composer after the sheet is gone. */}
									<div className="-mt-1 flex w-full items-center justify-between">
										<span className="font-sans text-[12.5px] text-muted">
											Background
										</span>
										<div className="flex gap-1.5">
											<button
												type="button"
												onClick={() => setBlurBg(true)}
												className={clsx(
													"cursor-pointer rounded-pill px-3.5 py-1.5 font-sans text-[12px] font-semibold transition-colors",
													blurBg
														? "bg-brand text-brand-on"
														: "bg-raised text-muted hover:bg-chip",
												)}
											>
												Your photo, blurred
											</button>
											<button
												type="button"
												onClick={() => setBlurBg(false)}
												className={clsx(
													"cursor-pointer rounded-pill px-3.5 py-1.5 font-sans text-[12px] font-semibold transition-colors",
													!blurBg
														? "bg-brand text-brand-on"
														: "bg-raised text-muted hover:bg-chip",
												)}
											>
												Flat
											</button>
										</div>
									</div>

									<div className="flex items-center gap-3">
										<button
											type="button"
											onClick={use}
											className="h-12 cursor-pointer rounded-pill bg-brand px-7 font-sans text-[14px] font-semibold text-brand-on transition-colors hover:opacity-90"
										>
											Use voice note
										</button>
										<button
											type="button"
											aria-label="Record again"
											onClick={() => {
												if (reviewUrl) URL.revokeObjectURL(reviewUrl);
												setReviewUrl(null);
												setReviewFile(null);
												setReviewMeta(null);
												setBars([]);
												setElapsed(0);
												elapsedRef.current = 0;
												setPhase("idle");
											}}
											className="flex h-12 w-12 cursor-pointer items-center justify-center rounded-pill bg-raised text-muted transition-colors hover:bg-chip hover:text-primary"
										>
											<ArrowCounterClockwise size={18} />
										</button>
									</div>
								</>
							) : (
								<div className="flex items-center gap-3">
									{phase === "idle" || phase === "denied" ? (
										<button
											type="button"
											onClick={start}
											className="flex h-14 cursor-pointer items-center gap-2.5 rounded-pill bg-danger px-7 font-sans text-[14.5px] font-semibold text-white transition-colors hover:opacity-90"
										>
											<Microphone size={20} weight="fill" />
											{phase === "denied" ? "Try again" : "Record"}
										</button>
									) : (
										<>
											<button
												type="button"
												aria-label={
													phase === "recording" ? "Pause recording" : "Resume"
												}
												onClick={pauseResume}
												className="flex h-14 w-14 cursor-pointer items-center justify-center rounded-pill bg-raised text-primary transition-colors hover:bg-chip"
											>
												{phase === "recording" ? (
													<Pause size={20} weight="fill" />
												) : (
													<Microphone size={20} weight="fill" />
												)}
											</button>
											<button
												type="button"
												aria-label="Finish recording"
												onClick={() => recRef.current?.stop()}
												className="flex h-14 cursor-pointer items-center gap-2.5 rounded-pill bg-danger px-7 font-sans text-[14.5px] font-semibold text-white transition-colors hover:opacity-90"
											>
												<Stop size={18} weight="fill" />
												Finish
											</button>
										</>
									)}
								</div>
							)}

							{phase === "paused" && (
								<p className="font-sans text-[12px] text-subtle">
									Paused — the gap won't be in the note.
								</p>
							)}
						</div>
					</OverlayPanel>
				</>
			)}
		</AnimatePresence>
	);
}
