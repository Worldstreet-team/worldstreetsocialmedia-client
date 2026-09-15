"use client";

import { LeftSidebar } from "@/components/layout/LeftSidebar";
import { MobileNavigation } from "@/components/layout/MobileNavigation";
import { RightSidebar } from "@/components/layout/RightSidebar";
import { StoriesRail } from "@/components/feed/StoriesRail";
import { useAppPathname } from "@/i18n/useAppPathname";
import clsx from "clsx";

/**
 * The (main) three-column shell, made route-aware.
 *
 * Every route in the group is Left rail + a 620px feed column + the 350px
 * discovery rail, with the stories rail fixed on top. Settings is the one
 * surface that wants the whole canvas: it runs its own two-pane (a section
 * list beside the open section), so on /settings the shell hands it the
 * width the discovery rail would have taken, and drops the stories rail
 * (a settings screen is not a place you browse stories from).
 *
 * It lives in a client component only to read the path; the sidebars were
 * already client, so nothing new hydrates.
 */
export function MainShell({ children }: { children: React.ReactNode }) {
	const onSettings = useAppPathname().startsWith("/settings");

	return (
		<div className="max-w-[var(--ws-container-max)] mx-auto flex justify-center min-h-dvh">
			<MobileNavigation />
			<LeftSidebar />
			<main
				id="main-content"
				className={clsx(
					"flex h-dvh w-full min-w-0 flex-col sm:border-x border-hairline pt-topbar md:pt-0",
					// Settings fills the canvas the discovery rail leaves behind
					// and runs its own two-pane; every other route keeps the
					// fixed feed width so the column never jumps between routes.
					onSettings ? "max-w-none" : "max-w-[var(--ws-feed-width)]",
				)}
			>
				{!onSettings && (
					<div className="shrink-0">
						<StoriesRail />
					</div>
				)}
				<div
					id="ws-main-scroll"
					className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain"
				>
					{children}
				</div>
			</main>
			{!onSettings && <RightSidebar />}
		</div>
	);
}
