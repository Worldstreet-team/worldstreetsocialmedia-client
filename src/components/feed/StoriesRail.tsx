"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAtomValue } from "jotai";
import { storyStudioSignalAtom } from "@/store/ui.atom";
import clsx from "clsx";
import { Plus } from "lucide-react";
import { DEFAULT_AVATAR } from "@/const";
import { useT } from "@/i18n/client";
import { useLiveEvents } from "@/hooks/useLiveNow";
import { useFeedEvents } from "@/hooks/useUserEvents";
import { getStoriesAction } from "@/lib/stories.actions";
import { StoryViewer, type RailEntry } from "@/components/feed/StoryViewer";
import StoryCreateSheet, {
	type StoryKind,
} from "@/components/story/StoryCreateSheet";
import StoryStudio from "@/components/story/StoryStudio";

/* The rail now mounts twice — RightSidebar (lg+) and the feed column
   (below lg) — so a create signal fired before the visible instance mounted
   (the FAB navigating home from another route) must survive until a rail can
   act on it. Module scope outlives the mounts. */
let consumedStorySignal: number | null = null;

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
	// draw), which owns its own picker, preview and posting state. The plus
	// first opens the frosted create sheet, which picks the studio's lane
	// (photo/video, text, or voice).
	const [createOpen, setCreateOpen] = useState(false);
	const [studioKind, setStudioKind] = useState<StoryKind>("media");
	const [studioOpen, setStudioOpen] = useState(false);

	// Only the instance the user can see may react to signals or fetch —
	// the other one sits inside a display:none subtree.
	const rootRef = useRef<HTMLDivElement>(null);
	const isVisible = () =>
		!!rootRef.current && rootRef.current.getClientRects().length > 0;

	// The create FAB can't reach this component's state, so it bumps a counter
	// and the visible rail opens its own create sheet (keeping the
	// reload-after-post wiring). Comparing against the module-level mark (not
	// a per-instance ref) lets a signal fired mid-navigation still open the
	// sheet once the rail mounts on the home feed.
	const storySignal = useAtomValue(storyStudioSignalAtom);
	useEffect(() => {
		if (!isVisible()) return;
		if (consumedStorySignal === null) consumedStorySignal = 0;
		if (storySignal !== consumedStorySignal) {
			consumedStorySignal = storySignal;
			setCreateOpen(true);
		}
	}, [storySignal]);

	const load = async () => {
		const res = await getStoriesAction();
		if (res.success && res.data?.rail) setRail(res.data.rail);
	};

	useEffect(() => {
		if (!isVisible()) return;
		void load();
	}, []);

	// Live rings are presence: they must appear and disappear with the
	// broadcast, not with a page refresh.
	useLiveEvents(() => {
		if (isVisible()) void load();
	});

	// A story posted anywhere shows up as a ring here immediately.
	useFeedEvents((event) => {
		if (event === "story" && isVisible()) void load();
	});

	const self = rail.find((r) => r.isSelf);
	const others = rail.filter((r) => !r.isSelf);

	return (
		<div
			ref={rootRef}
			className="flex gap-3 overflow-x-auto px-3 py-1.5 [scrollbar-width:none]"
		>
			{/* self / add */}
			<button
				type="button"
				onClick={() =>
					self && self.stories.length > 0
						? setOpen(self)
						: setCreateOpen(true)
				}
				className="flex flex-col items-center gap-1.5 shrink-0 cursor-pointer group"
				aria-label={t("story.add")}
			>
				<span
					className={clsx(
						"relative w-14 h-14 p-[2px]",
						self?.hasUnseen ? "bg-brand" : "bg-raised",
					)}
					// Flat top and bottom, circular left and right: the small
					// horizontal radius keeps the top/bottom edges straight while
					// the 50% vertical radius bows each side into one full curve.
					style={{ borderRadius: "12px / 50%" }}
				>
					{/* The posting state lives in the Story Studio now it holds
					    the sheet open with its own spinner until the post lands. */}
					<span
						className="relative block w-full h-full overflow-hidden border-2 border-page"
						style={{ borderRadius: "10px / 48%" }}
					>
						<Image
							src={self?.author.avatar || DEFAULT_AVATAR}
							alt={t("story.yours")}
							fill
							className="object-cover"
						/>
					</span>
					{/* The plus badge always opens the create sheet, even when the
					    avatar itself opens the viewer for existing stories. */}
					<span
						role="button"
						tabIndex={-1}
						aria-hidden="true"
						onClick={(e) => {
							e.stopPropagation();
							setCreateOpen(true);
						}}
						className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-pill bg-brand text-brand-on border-2 border-page"
					>
						<Plus className="w-3 h-3" strokeWidth={3} />
					</span>
				</span>
				<span className="text-[11px] text-muted font-sans truncate max-w-14">
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
								window.location.assign(
									`/live?tab=live&s=${liveStory.streamRef}`,
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
								"relative w-14 h-14 p-[2px]",
								entry.isLive
									? "bg-danger"
									: entry.hasUnseen
										? "bg-brand"
										: "bg-raised",
							)}
							style={{ borderRadius: "12px / 50%" }}
						>
							<span
						className="relative block w-full h-full overflow-hidden border-2 border-page"
						style={{ borderRadius: "10px / 48%" }}
					>
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
						<span className="text-[11px] text-muted font-sans truncate max-w-14">
							@{name}
						</span>
					</button>
				);
			})}

			{/* Portaled to body: these are fixed inset-0 overlays, and
			    position:fixed cannot escape a display:none ancestor — rendered
			    in place they were invisible whenever THIS rail instance was the
			    hidden one (the original below-lg "FAB → Story does nothing" bug). */}
			{open &&
				createPortal(
					<StoryViewer entry={open} onClose={() => setOpen(null)} />,
					document.body,
				)}
			{createOpen &&
				createPortal(
					<StoryCreateSheet
						onClose={() => setCreateOpen(false)}
						onPick={(picked) => {
							setCreateOpen(false);
							setStudioKind(picked);
							setStudioOpen(true);
						}}
					/>,
					document.body,
				)}
			{studioOpen &&
				createPortal(
					<StoryStudio
						key={studioKind}
						initialKind={studioKind}
						onClose={() => setStudioOpen(false)}
						onPosted={() => void load()}
					/>,
					document.body,
				)}
		</div>
	);
}
