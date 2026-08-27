import { LeftSidebar } from "@/components/layout/LeftSidebar";
import { MobileNavigation } from "@/components/layout/MobileNavigation";
import { RightSidebar } from "@/components/layout/RightSidebar";
import { StoriesRail } from "@/components/feed/StoriesRail";

export default function MainLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		// Same width tokens as app/page.tsx (--ws-container-max 1280 /
		// --ws-feed-width 620) so the feed column doesn't jump between routes.
		// min-h-dvh, not min-h-screen: 100vh on mobile is the *expanded* viewport,
		// so the column jumps by the address-bar height as it collapses.
		<div className="max-w-[var(--ws-container-max)] mx-auto flex justify-center min-h-dvh">
			{/* The avatar top bar + drawer used to exist only on the home feed,
			    which stranded every other mobile route without navigation —
			    mounted here so the whole (main) group gets it. Pages pad with
			    pt-topbar and pin their sticky headers at top-topbar. */}
			<MobileNavigation />
			<LeftSidebar />
			<main
				id="main-content"
				// min-w-0 so long words / wide children shrink inside the flex row
				// instead of forcing the page wider than the viewport.
				// h-dvh + inner scroll: the column scrolls inside itself so the
				// story rail above the scroller is genuinely fixed, with no
				// per-page offset arithmetic anywhere.
				className="flex h-dvh w-full min-w-0 max-w-[var(--ws-feed-width)] flex-col sm:border-x border-hairline pt-topbar md:pt-0"
			>
				{/* Stories head every column in the group and never scroll away:
				    they sit outside the scroll container, which is what "fixed"
				    means here rather than a sticky offset stack. */}
				{/* The rail owns its own border and padding so both collapse
				    with it when the reader scrolls down. */}
				<div className="shrink-0">
					<StoriesRail />
				</div>
				<div id="ws-main-scroll" className="min-h-0 flex-1 overflow-y-auto">
					{children}
				</div>
			</main>
			<RightSidebar />
		</div>
	);
}
