"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import clsx from "clsx";
import { Plus } from "lucide-react";
import { DEFAULT_AVATAR, XSTREAM_WEB_URL } from "@/const";
import { useT } from "@/i18n/client";
import { getStoriesAction } from "@/lib/stories.actions";
import { StoryViewer, type RailEntry } from "@/components/feed/StoryViewer";
import StoryStudio from "@/components/story/StoryStudio";

/**
 * The stories rail doubles as live discovery: a going-live auto-story gets a
 * danger-red ring and jumps the queue (self → live → unseen → affinity, the
 * order the gateway returns). Tapping a live ring goes straight to the
 * stream; everything else opens the viewer.
 */
export function StoriesRail() {
	const t = useT();
	const [rail, setRail] = useState<RailEntry[]>([]);
	const [open, setOpen] = useState<RailEntry | null>(null);
	// Posting now runs through the Story Studio (crop/filters/text/stickers/
	// draw), which owns its own picker, preview and posting state.
	const [studioOpen, setStudioOpen] = useState(false);

	const load = async () => {
		const res = await getStoriesAction();
		if (res.success && res.data?.rail) setRail(res.data.rail);
	};

	useEffect(() => {
		void load();
	}, []);

	const self = rail.find((r) => r.isSelf);
	const others = rail.filter((r) => !r.isSelf);

	return (
		<div className="flex gap-4 overflow-x-auto px-4 py-3 border-b border-raised/60 [scrollbar-width:none]">
			{/* self / add */}
			<button
				type="button"
				onClick={() =>
					self && self.stories.length > 0
						? setOpen(self)
						: setStudioOpen(true)
				}
				className="flex flex-col items-center gap-1.5 shrink-0 cursor-pointer group"
				aria-label={t("story.add")}
			>
				<span
					className={clsx(
						"relative w-16 h-16 rounded-pill p-[2px]",
						self?.hasUnseen ? "bg-brand" : "bg-raised",
					)}
				>
					{/* The posting state lives in the Story Studio now — it holds
					    the sheet open with its own spinner until the post lands. */}
					<span className="relative block w-full h-full rounded-pill overflow-hidden border-2 border-page">
						<Image
							src={self?.author.avatar || DEFAULT_AVATAR}
							alt={t("story.yours")}
							fill
							className="object-cover"
						/>
					</span>
					<span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-pill bg-brand text-brand-on border-2 border-page">
						<Plus className="w-3 h-3" strokeWidth={3} />
					</span>
				</span>
				<span className="text-[11px] text-muted font-sans truncate max-w-16">
					{t("story.yours")}
				</span>
			</button>

			{others.map((entry) => {
				const name = entry.author.username;
				const liveStory = entry.stories.find((s) => s.origin === "live");
				return (
					<button
						key={entry.author._id}
						type="button"
						onClick={() => {
							if (entry.isLive && liveStory?.streamRef) {
								window.open(
									`${XSTREAM_WEB_URL}/stream/${liveStory.streamRef}`,
									"_blank",
									"noopener",
								);
								return;
							}
							setOpen(entry);
						}}
						className="flex flex-col items-center gap-1.5 shrink-0 cursor-pointer"
						aria-label={name}
					>
						<span
							className={clsx(
								"relative w-16 h-16 rounded-pill p-[2px]",
								entry.isLive
									? "bg-danger"
									: entry.hasUnseen
										? "bg-brand"
										: "bg-raised",
							)}
						>
							<span className="relative block w-full h-full rounded-pill overflow-hidden border-2 border-page">
								<Image
									src={entry.author.avatar || DEFAULT_AVATAR}
									alt={name}
									fill
									className="object-cover"
								/>
							</span>
							{entry.isLive && (
								<span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-[4px] bg-danger px-1.5 py-px text-[9px] font-bold tracking-wide text-white font-sans">
									{t("live.badge")}
								</span>
							)}
						</span>
						<span className="text-[11px] text-muted font-sans truncate max-w-16">
							@{name}
						</span>
					</button>
				);
			})}

			{open && <StoryViewer entry={open} onClose={() => setOpen(null)} />}
			{studioOpen && (
				<StoryStudio
					onClose={() => setStudioOpen(false)}
					onPosted={() => void load()}
				/>
			)}
		</div>
	);
}
