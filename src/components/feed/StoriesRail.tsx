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
 * Collapse the rail while the reader is moving down the column and bring it
 * back the moment they head up — the same grammar as a hiding top bar, so the
 * feed gains a rail's worth of height without the rail ever being unreachable.
 *
 * Reads the shared `#ws-main-scroll` container rather than the window: the
 * column scrolls inside itself, so window scroll never moves.
 */
function useCollapseOnScrollDown() {
	const [collapsed, setCollapsed] = useState(false);

	useEffect(() => {
		const scroller = document.getElementById("ws-main-scroll");
		if (!scroller) return;

		let last = scroller.scrollTop;
		const onScroll = () => {
			const y = scroller.scrollTop;
			const dy = y - last;
			// Deadband: sub-pixel and rubber-band deltas would otherwise flip
			// the rail open and shut while the reader holds still.
			if (Math.abs(dy) < 6) return;
			last = y;
			// Near the top the rail is always available, whatever the direction.
			setCollapsed(y > 64 && dy > 0);
		};

		scroller.addEventListener("scroll", onScroll, { passive: true });
		return () => scroller.removeEventListener("scroll", onScroll);
	}, []);

	return collapsed;
}

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
	const selfCover =
		(self?.stories.find((s) => !s.seen) ?? self?.stories[0])?.media;
	const others = rail.filter((r) => !r.isSelf);
	const collapsed = useCollapseOnScrollDown();

	return (
		<>
		{/* grid-rows 1fr -> 0fr is the height transition: it animates to the
		    content's own height, so nothing has to know how tall the rail is
		    (and the two shapes are different heights). The border and padding
		    live inside, so a collapsed rail leaves no stray hairline behind. */}
		<div
			className={clsx(
				"grid transition-[grid-template-rows,opacity]",
				collapsed ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr] opacity-100",
			)}
			aria-hidden={collapsed}
		>
			<div className="min-h-0 overflow-hidden">
				<div className="border-b border-hairline py-2">
					<div
						ref={rootRef}
						className="flex gap-3 overflow-x-auto px-3 py-1.5 [scrollbar-width:none]"
					>
			{/* self / add.
			    Two shapes, one markup: a ringed circle with the name beneath it
			    below sm, the tall cover card from sm up. The pieces that only
			    belong to one shape carry the breakpoint. */}
			<button
				type="button"
				onClick={() =>
					self && self.stories.length > 0
						? setOpen(self)
						: setCreateOpen(true)
				}
				className="flex w-[68px] shrink-0 cursor-pointer flex-col items-center gap-1.5 sm:w-[100px] sm:gap-0"
				aria-label={t("story.add")}
			>
				<span
					className={clsx(
						"relative block h-16 w-16 rounded-pill p-[3px] sm:h-[152px] sm:w-[100px] sm:rounded-xl sm:p-0",
						self?.hasUnseen ? "ring-2 ring-brand" : "ring-1 ring-hairline",
					)}
				>
					<span className="relative block h-full w-full overflow-hidden rounded-pill bg-sunken sm:rounded-xl">
						{selfCover?.type === "video" ? (
							// eslint-disable-next-line jsx-a11y/media-has-caption
							<video
								src={`${selfCover.url}#t=0.1`}
								className="absolute inset-0 h-full w-full object-cover"
								muted
								playsInline
								preload="metadata"
							/>
						) : selfCover?.url ? (
							// eslint-disable-next-line @next/next/no-img-element
							<img
								src={selfCover.url}
								alt=""
								className="absolute inset-0 h-full w-full object-cover"
								draggable={false}
							/>
						) : (
							// No story yet: your own avatar. Dimmed only on the card,
							// where an avatar-as-cover would otherwise read as a story.
							<Image
								src={self?.author.avatar || DEFAULT_AVATAR}
								alt={t("story.yours")}
								fill
								className="object-cover sm:opacity-40"
							/>
						)}

						{/* Card-only: veils so the white ink below holds on any cover. */}
						<span className="absolute inset-0 hidden bg-[#0c0a09]/30 sm:block" />
						<span className="absolute inset-x-0 bottom-0 hidden h-14 bg-[#0c0a09]/55 sm:block" />

						{/* Card-only: avatar top left. */}
						<span className="absolute left-2 top-2 hidden h-9 w-9 overflow-hidden rounded-pill ring-2 ring-white/90 sm:block">
							<Image
								src={self?.author.avatar || DEFAULT_AVATAR}
								alt=""
								fill
								className="object-cover"
							/>
						</span>

						{/* Card-only: name over the cover. */}
						<span className="absolute inset-x-2 bottom-2 hidden truncate text-left font-sans text-[12px] font-semibold text-white sm:block">
							{t("story.yours")}
						</span>
					</span>

					{/* Always opens the create sheet, even when the tile itself
					    opens the viewer for existing stories. */}
					<span
						role="button"
						tabIndex={-1}
						aria-hidden="true"
						onClick={(e) => {
							e.stopPropagation();
							setCreateOpen(true);
						}}
						className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-pill border-2 border-page bg-brand text-brand-on sm:bottom-auto sm:right-auto sm:left-[26px] sm:top-[26px] sm:h-[18px] sm:w-[18px]"
					>
						<Plus className="h-2.5 w-2.5" strokeWidth={3} />
					</span>
				</span>

				{/* Circle-only: name beneath. */}
				<span className="block w-full truncate text-center font-sans text-[12px] font-medium text-muted sm:hidden">
					{t("story.yours")}
				</span>
			</button>

			{others.map((entry) => {
				const name = entry.author.username;
				const liveStory = entry.stories.find((s) => s.origin === "live");
				// The card wears the story it is offering. First unseen if there
				// is one, so the cover matches what tapping actually opens.
				const cover =
					(entry.stories.find((s) => !s.seen) ?? entry.stories[0])?.media;
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
						className="flex w-[68px] shrink-0 cursor-pointer flex-col items-center gap-1.5 sm:w-[100px] sm:gap-0"
						aria-label={name}
					>
						<span
							className={clsx(
								"relative block h-16 w-16 rounded-pill p-[3px] sm:h-[152px] sm:w-[100px] sm:rounded-xl sm:p-0",
								// The ring is the unseen state; live outranks it.
								entry.isLive
									? "ring-2 ring-danger"
									: entry.hasUnseen
										? "ring-2 ring-brand"
										: "ring-1 ring-hairline",
							)}
						>
							<span className="relative block h-full w-full overflow-hidden rounded-pill bg-sunken sm:rounded-xl">
								{cover?.type === "video" ? (
									// eslint-disable-next-line jsx-a11y/media-has-caption
									<video
										src={`${cover.url}#t=0.1`}
										className="absolute inset-0 h-full w-full object-cover"
										muted
										playsInline
										preload="metadata"
									/>
								) : (
									// Falls back to the avatar: a circle wearing a blank
									// cover is indistinguishable from a broken image.
									<Image
										src={cover?.url || entry.author.avatar || DEFAULT_AVATAR}
										alt={name}
										fill
										className="object-cover"
									/>
								)}

								{/* Card-only: veils so the white ink below holds. */}
								<span className="absolute inset-0 hidden bg-[#0c0a09]/30 sm:block" />
								<span className="absolute inset-x-0 bottom-0 hidden h-14 bg-[#0c0a09]/55 sm:block" />

								{/* Card-only: avatar top left. */}
								<span className="absolute left-2 top-2 hidden h-9 w-9 overflow-hidden rounded-pill ring-2 ring-white/90 sm:block">
									<Image
										src={entry.author.avatar || DEFAULT_AVATAR}
										alt=""
										fill
										className="object-cover"
									/>
								</span>

								{/* Card-only: name over the cover. */}
								<span className="absolute inset-x-2 bottom-2 hidden truncate text-left font-sans text-[12px] font-semibold text-white sm:block">
									@{name}
								</span>
							</span>

							{entry.isLive && (
								<span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-[4px] bg-danger px-1.5 py-px font-sans text-[9px] font-bold tracking-wide text-white sm:bottom-auto sm:left-auto sm:right-2 sm:top-2 sm:translate-x-0">
									{t("live.badge")}
								</span>
							)}
						</span>

						{/* Circle-only: name beneath. */}
						<span className="block w-full truncate text-center font-sans text-[12px] font-medium text-muted sm:hidden">
							@{name}
						</span>
					</button>
				);
			})}
					</div>
				</div>
			</div>
		</div>

			{/* Portaled to body: these are fixed inset-0 overlays, and
			    position:fixed cannot escape a display:none ancestor — rendered
			    in place they were invisible whenever THIS rail instance was the
			    hidden one (the original below-lg "FAB → Story does nothing" bug).
			    They sit outside the collapsing wrapper so a collapsed rail never
			    puts an open viewer inside an aria-hidden subtree. */}
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
		</>
	);
}
