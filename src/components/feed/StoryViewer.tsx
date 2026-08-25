"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { DEFAULT_AVATAR } from "@/const";
import { viewStoryAction } from "@/lib/stories.actions";

export interface RailStory {
	id: string;
	media: { url: string; type: "image" | "video" };
	caption?: string;
	origin: "upload" | "live";
	streamRef?: string;
	createdAt: string;
	seen: boolean;
}

export interface RailEntry {
	author: {
		_id: string;
		username: string;
		avatar?: string;
		firstName?: string;
		lastName?: string;
	};
	stories: RailStory[];
	hasUnseen: boolean;
	isLive: boolean;
	isSelf: boolean;
}

const STORY_MS = 5_000;

/**
 * Full-screen story playback for one author. Left third = previous, the rest
 * = next; the progress segments up top mirror position. Each story is marked
 * viewed the moment it shows.
 */
export function StoryViewer({
	entry,
	onClose,
}: {
	entry: RailEntry;
	onClose: () => void;
}) {
	const [index, setIndex] = useState(() =>
		Math.max(
			0,
			entry.stories.findIndex((s) => !s.seen),
		),
	);
	const story = entry.stories[index];
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const advance = useCallback(
		(dir: 1 | -1) => {
			setIndex((i) => {
				const next = i + dir;
				if (next < 0) return 0;
				if (next >= entry.stories.length) {
					onClose();
					return i;
				}
				return next;
			});
		},
		[entry.stories.length, onClose],
	);

	useEffect(() => {
		if (!story) return;
		void viewStoryAction(story.id);
		if (story.media.type === "image") {
			timerRef.current = setTimeout(() => advance(1), STORY_MS);
			return () => {
				if (timerRef.current) clearTimeout(timerRef.current);
			};
		}
	}, [story, advance]);

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose();
			if (e.key === "ArrowRight") advance(1);
			if (e.key === "ArrowLeft") advance(-1);
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [advance, onClose]);

	if (!story) return null;
	const name =
		entry.author.firstName || entry.author.lastName
			? `${entry.author.firstName ?? ""} ${entry.author.lastName ?? ""}`.trim()
			: entry.author.username;

	return (
		<AnimatePresence>
			<motion.div
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				exit={{ opacity: 0 }}
				transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
				className="fixed inset-0 z-modal bg-scrim flex items-center justify-center"
				onClick={onClose}
			>
				<div
					className="relative w-full h-full sm:w-[420px] sm:h-[86vh] sm:rounded-xl overflow-hidden bg-page"
					onClick={(e) => e.stopPropagation()}
				>
					{/* progress segments */}
					<div className="absolute top-0 inset-x-0 z-20 flex gap-1 p-2">
						{entry.stories.map((s, i) => (
							<div
								key={s.id}
								className="h-0.5 flex-1 rounded-pill bg-raised overflow-hidden"
							>
								<div
									className="h-full bg-brand"
									style={{
										width: i < index ? "100%" : i > index ? "0%" : undefined,
										animation:
											i === index && story.media.type === "image"
												? `ws-story-fill ${STORY_MS}ms linear forwards`
												: undefined,
									}}
								/>
							</div>
						))}
					</div>

					{/* header */}
					<div className="absolute top-4 inset-x-0 z-20 flex items-center gap-2 px-3">
						<div className="relative w-8 h-8 rounded-pill overflow-hidden shrink-0">
							<Image
								src={entry.author.avatar || DEFAULT_AVATAR}
								alt={entry.author.username}
								fill
								className="object-cover"
							/>
						</div>
						<span className="text-sm font-semibold text-primary font-sans truncate">
							{name}
						</span>
						<button
							type="button"
							onClick={onClose}
							aria-label="Close"
							className="ml-auto flex h-10 w-10 items-center justify-center rounded-pill text-primary hover:bg-raised transition-colors cursor-pointer"
						>
							<X className="w-5 h-5" />
						</button>
					</div>

					{/* media */}
					{story.media.type === "video" ? (
						<video
							key={story.id}
							src={story.media.url}
							className="absolute inset-0 w-full h-full object-contain"
							autoPlay
							playsInline
							muted
							onEnded={() => advance(1)}
						/>
					) : (
						// eslint-disable-next-line @next/next/no-img-element
						<img
							key={story.id}
							src={story.media.url}
							alt={story.caption ?? ""}
							className="absolute inset-0 w-full h-full object-contain"
						/>
					)}

					{story.caption && (
						<div className="absolute bottom-6 inset-x-0 z-20 px-4">
							<p className="text-center text-sm text-primary font-sans bg-page/70 rounded-lg px-3 py-2">
								{story.caption}
							</p>
						</div>
					)}

					{/* tap zones */}
					<button
						type="button"
						aria-label="Previous story"
						className="absolute inset-y-0 left-0 w-1/3 z-10 cursor-pointer"
						onClick={() => advance(-1)}
					/>
					<button
						type="button"
						aria-label="Next story"
						className="absolute inset-y-0 right-0 w-2/3 z-10 cursor-pointer"
						onClick={() => advance(1)}
					/>
				</div>
				<style>{`@keyframes ws-story-fill { from { width: 0% } to { width: 100% } }`}</style>
			</motion.div>
		</AnimatePresence>
	);
}
