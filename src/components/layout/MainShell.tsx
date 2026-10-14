"use client";

import { LeftSidebar } from "@/components/layout/LeftSidebar";
import { MobileNavigation } from "@/components/layout/MobileNavigation";
import { RightSidebar } from "@/components/layout/RightSidebar";
import { StoriesRail } from "@/components/feed/StoriesRail";
import { PostLayer, PostLayerContext } from "@/components/feed/PostLayer";
import { useAppPathname } from "@/i18n/useAppPathname";
import clsx from "clsx";

/**
 * The (main) three-column shell, made route-aware.
 *
 * Every route in the group is Left rail + a 620px feed column + the 350px
 * discovery rail, with the stories rail fixed on top. Two surfaces want the
 * whole canvas instead, so on them the shell hands over the width the
 * discovery rail would have taken and drops the stories rail:
 *
 * - Settings runs its own two-pane (a section list beside the open section),
 *   and a settings screen is not a place you browse stories from.
 * - Space Voice (owner 2026-10-14, "let the space voice take over the entire
 *   rails but the right as well") splits into Now and Later side by side:
 *   what you can join this minute, and a timeline of what starts next. The
 *   Later column sits where the discovery rail was, and that rail would only
 *   have repeated the same rooms in its Spaces carousel.
 *
 * Only Settings turns the post layer off; a post opened from a room's share
 * on /voice still opens over the column like anywhere else.
 *
 * It lives in a client component only to read the path; the sidebars were
 * already client, so nothing new hydrates.
 */
export function MainShell({ children }: { children: React.ReactNode }) {
	const pathname = useAppPathname();
	const onSettings = pathname.startsWith("/settings");
	const onVoice = pathname === "/voice" || pathname.startsWith("/voice/");
	const fullCanvas = onSettings || onVoice;

	return (
		<PostLayerContext.Provider value={!onSettings}>
		<div className="max-w-[var(--ws-container-max)] mx-auto flex justify-center min-h-dvh">
			<MobileNavigation />
			<LeftSidebar />
			<main
				id="main-content"
				className={clsx(
					"flex h-dvh w-full min-w-0 flex-col sm:border-x border-hairline pt-topbar md:pt-0",
					// Settings and Space Voice fill the canvas the discovery
					// rail leaves behind; every other route keeps the fixed
					// feed width so the column never jumps between routes.
					fullCanvas ? "max-w-none" : "max-w-[var(--ws-feed-width)]",
				)}
			>
				{!fullCanvas && (
					<div className="shrink-0">
						<StoriesRail />
					</div>
				)}
				{/* The column and the post layer share one box: a post opens
				    OVER the column, which stays mounted beneath it (see
				    PostLayer). Absolute, so neither depends on a percentage
				    height resolving inside a flex item. */}
				<div className="relative min-h-0 flex-1">
					<div
						id="ws-main-scroll"
						className="absolute inset-0 overflow-y-auto overscroll-y-contain"
					>
						{children}
					</div>
					{!onSettings && <PostLayer />}
				</div>
			</main>
			{!fullCanvas && <RightSidebar />}
		</div>
		</PostLayerContext.Provider>
	);
}
