"use client";

import { useState, useRef, useEffect } from "react";
import { Play, Pause } from "lucide-react";
import clsx from "clsx";

interface VoiceMessageProps {
	src: string;
	isMe: boolean;
}

export const VoiceMessage = ({ src, isMe }: VoiceMessageProps) => {
	const [isPlaying, setIsPlaying] = useState(false);
	const [progress, setProgress] = useState(0);
	const [duration, setDuration] = useState(0);
	const [currentTime, setCurrentTime] = useState(0);
	const audioRef = useRef<HTMLAudioElement>(null);
	const requestRef = useRef<number | undefined>(undefined);

	const togglePlay = () => {
		if (!audioRef.current) return;
		if (isPlaying) {
			audioRef.current.pause();
			cancelAnimationFrame(requestRef.current!);
		} else {
			audioRef.current.play();
			requestRef.current = requestAnimationFrame(animate);
		}
		setIsPlaying(!isPlaying);
	};

	const animate = () => {
		if (!audioRef.current) return;
		setCurrentTime(audioRef.current.currentTime);
		if (audioRef.current.duration) {
			setProgress(
				(audioRef.current.currentTime / audioRef.current.duration) * 100,
			);
		}
		requestRef.current = requestAnimationFrame(animate);
	};

	useEffect(() => {
		if (isPlaying) {
			requestRef.current = requestAnimationFrame(animate);
		} else {
			cancelAnimationFrame(requestRef.current!);
		}
		return () => cancelAnimationFrame(requestRef.current!);
	}, [isPlaying]);

	const formatTime = (time: number) => {
		if (isNaN(time)) return "0:00";
		const minutes = Math.floor(time / 60);
		const seconds = Math.floor(time % 60);
		return `${minutes}:${seconds.toString().padStart(2, "0")}`;
	};

	const handleLoadedMetadata = () => {
		if (!audioRef.current) return;
		setDuration(audioRef.current.duration);
	};

	const handleEnded = () => {
		setIsPlaying(false);
		setProgress(0);
		setCurrentTime(0);
		if (audioRef.current) audioRef.current.currentTime = 0;
		cancelAnimationFrame(requestRef.current!);
	};

	const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
		if (!audioRef.current) return;
		const newProgress = Number(e.target.value);
		const newTime = (newProgress / 100) * duration;
		audioRef.current.currentTime = newTime;
		setCurrentTime(newTime);
		setProgress(newProgress);
	};

	return (
		<div
			className={clsx(
				"flex items-center gap-3 p-1 rounded-xl min-w-[200px] select-none",
				isMe ? "text-black" : "text-white",
			)}
		>
			<button onClick={togglePlay} className="shrink-0 outline-none">
				{isPlaying ? (
					<Pause className="w-5 h-5 fill-current" />
				) : (
					<Play className="w-5 h-5 fill-current" />
				)}
			</button>

			<div className="flex-1 flex flex-col justify-center h-full pt-1">
				<input
					type="range"
					min="0"
					max="100"
					value={progress}
					onChange={handleSeek}
					className="w-full h-1 bg-current/20 rounded-lg appearance-none cursor-pointer accent-current"
				/>
			</div>

			<span className="text-xs font-mono tabular-nums opacity-80 shrink-0 min-w-[32px] text-right">
				{formatTime(isPlaying ? currentTime : duration)}
			</span>

			<audio
				ref={audioRef}
				src={src}
				onLoadedMetadata={handleLoadedMetadata}
				onEnded={handleEnded}
				className="hidden"
			/>
		</div>
	);
};
