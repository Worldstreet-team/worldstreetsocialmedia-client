"use client";

import clsx from "clsx";
import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "@phosphor-icons/react";
import { SafeAvatar } from "@/components/ui/SafeAvatar";

/**
 * The voice-note post player. The waveform IS the scrubber (SoundCloud's
 * lesson): 64 bars from the peaks stored with the post, so the card draws
 * before a single audio byte loads. Ground is the author's avatar art —
 * blurred into atmosphere by default, or a flat surface when the poster
 * turned blur off at publish. Never autoplays; scrolling past pauses it.
 */
export function AudioCard({
	audio,
	avatar,
	onFirstPlay,
}: {
	audio: { url: string; durationSec: number; peaks: number[]; blurBg: boolean };
	avatar?: string;
	onFirstPlay?: () => void;
}) {
	const audioRef = useRef<HTMLAudioElement>(null);
	const [playing, setPlaying] = useState(false);
	const [progress, setProgress] = useState(0); // 0..1
	const playedOnce = useRef(false);

	// 64 bars, always: missing peaks render as a quiet flat line.
	const peaks =
		audio.peaks?.length > 0
			? audio.peaks
			: Array.from({ length: 64 }, () => 18);

	useEffect(() => {
		const el = audioRef.current;
		if (!el) return;
		const onTime = () =>
			setProgress(el.duration > 0 ? el.currentTime / el.duration : 0);
		const onEnd = () => {
			setPlaying(false);
			setProgress(0);
		};
		el.addEventListener("timeupdate", onTime);
		el.addEventListener("ended", onEnd);
		return () => {
			el.removeEventListener("timeupdate", onTime);
			el.removeEventListener("ended", onEnd);
		};
	}, []);

	// Scrolled out of view = paused. An unattended voice keeps talking over
	// the feed otherwise.
	const rootRef = useRef<HTMLDivElement>(null);
	useEffect(() => {
		const root = rootRef.current;
		if (!root) return;
		const io = new IntersectionObserver(
			([e]) => {
				if (!e.isIntersecting) {
					audioRef.current?.pause();
					setPlaying(false);
				}
			},
			{ threshold: 0.2 },
		);
		io.observe(root);
		return () => io.disconnect();
	}, []);

	const toggle = (e: React.MouseEvent) => {
		e.stopPropagation();
		e.preventDefault();
		const el = audioRef.current;
		if (!el) return;
		if (playing) {
			el.pause();
			setPlaying(false);
		} else {
			void el.play();
			setPlaying(true);
			if (!playedOnce.current) {
				playedOnce.current = true;
				onFirstPlay?.();
			}
		}
	};

	const seek = (e: React.MouseEvent<HTMLDivElement>) => {
		e.stopPropagation();
		e.preventDefault();
		const el = audioRef.current;
		if (!el || !el.duration) return;
		const rect = e.currentTarget.getBoundingClientRect();
		const frac = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
		el.currentTime = frac * el.duration;
		setProgress(frac);
	};

	const clock = (sec: number) =>
		`${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;
	const shown = playing
		? progress * (audioRef.current?.duration || audio.durationSec)
		: audio.durationSec;

	return (
		<div
			ref={rootRef}
			className="pointer-events-auto relative z-10 mb-3 overflow-hidden rounded-xl border border-hairline"
		>
			{/* eslint-disable-next-line jsx-a11y/media-has-caption */}
			<audio ref={audioRef} src={audio.url} preload="none" />
			{/* Ground: the author's art blurred into atmosphere, or flat
			    surface if the poster opted out. The wash keeps the bars and
			    clock honest on any picture. */}
			{audio.blurBg && avatar ? (
				<>
					<span aria-hidden className="absolute inset-0 scale-125 blur-[24px]">
						<SafeAvatar src={avatar} />
					</span>
					<span aria-hidden className="absolute inset-0 bg-page/60" />
				</>
			) : (
				<span aria-hidden className="absolute inset-0 bg-sunken" />
			)}

			<div className="relative flex items-center gap-3 px-3.5 py-4">
				<button
					type="button"
					aria-label={playing ? "Pause voice note" : "Play voice note"}
					onClick={toggle}
					className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-pill bg-primary text-page transition-colors hover:opacity-90"
				>
					{playing ? (
						<Pause size={18} weight="fill" />
					) : (
						<Play size={18} weight="fill" className="translate-x-px" />
					)}
				</button>

				{/* biome-ignore lint/a11y/useKeyWithClickEvents: seek surface; play button is the keyboard path */}
				<div
					className="flex h-12 flex-1 cursor-pointer items-center gap-[2px]"
					onClick={seek}
					role="slider"
					aria-label="Seek"
					aria-valuemin={0}
					aria-valuemax={100}
					aria-valuenow={Math.round(progress * 100)}
					tabIndex={-1}
				>
					{peaks.map((v, i) => (
						<span
							key={i}
							className={clsx(
								"w-full flex-1 rounded-pill transition-colors",
								i / peaks.length <= progress && (playing || progress > 0)
									? "bg-gold"
									: "bg-primary/30",
							)}
							style={{ height: `${Math.max(8, (v / 127) * 100)}%` }}
						/>
					))}
				</div>

				<span className="shrink-0 font-sans text-[12.5px] font-medium tabular-nums text-primary">
					{clock(shown)}
				</span>
			</div>
		</div>
	);
}
