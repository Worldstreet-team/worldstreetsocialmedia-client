import { Suspense } from "react";
import { headers } from "next/headers";
import Feed, { type FeedSeed } from "@/components/feed/Feed";
import { FeedSkeleton } from "@/components/feed/FeedSkeleton";
import { StoriesRail } from "@/components/feed/StoriesRail";
import { FeedTabs } from "@/components/feed/FeedTabs";
import { FeedHeaderActions } from "@/components/feed/FeedHeaderActions";
import { LeftSidebar } from "@/components/layout/LeftSidebar";
import { RightSidebar } from "@/components/layout/RightSidebar";
import { MobileNavigation } from "@/components/layout/MobileNavigation";
import { getFeedAction } from "@/lib/feed.actions";
import { mapApiPost } from "@/lib/post-mapper";

/**
 * The first For-You page, fetched during SSR and streamed.
 *
 * This is what turns "shell → download JS → hydrate → fetch → render" into
 * "shell paints, posts stream in behind it": the fetch happens on the server
 * in parallel with the browser downloading the bundle, and the posts arrive
 * as HTML. `Feed` seeds its atom from the same data, so hydration asks the
 * network for nothing.
 *
 * Soft navigations and link prefetches re-run this server component with the
 * `RSC` header set. The client keeps its timeline in `feedAtom` across
 * navigations and would discard whatever this fetched, so skip the gateway
 * round trip entirely there — it is the most expensive request the gateway
 * serves, and burning it on every hover-prefetch of the Home link would be
 * real load for zero rendered posts.
 */
async function StreamedFeed() {
	const h = await headers();
	const soft = h.get("rsc") === "1" || h.get("next-router-prefetch") === "1";
	if (soft) return <Feed />;

	let initialData: FeedSeed | null = null;
	try {
		const result = await getFeedAction(null, 10, "foryou");
		if (result.success && result.data?.posts) {
			initialData = {
				posts: result.data.posts.map(mapApiPost),
				cursor: result.data.nextCursor ?? null,
				hasMore: Boolean(result.data.hasMore),
			};
		}
	} catch {
		// A failed server fetch must not take the page down — the client path
		// (snapshot, then fetch) still works exactly as before the seed existed.
	}
	return <Feed initialData={initialData} />;
}

export default function Home() {
	return (
		<main className="min-h-dvh bg-page text-primary">
			<MobileNavigation />
			{/* Widths come from tokens: --ws-container-max 1280, --ws-feed-width 620 */}
			<div className="max-w-[var(--ws-container-max)] mx-auto flex justify-center min-h-dvh">
				<LeftSidebar />
				<div className="flex h-dvh w-full min-w-0 max-w-[var(--ws-feed-width)] flex-col sm:border-x border-hairline pt-topbar md:pt-0">
					{/* Stories above everything, fixed: they sit outside the
					    scroll container, same structure as the (main) layout. */}
					<div
						className="shrink-0 animate-rise"
						style={{ animationDelay: "40ms" }}
					>
						<StoriesRail />
					</div>
					<div id="ws-main-scroll" className="min-h-0 flex-1 overflow-y-auto">
						{/* Sticky inside the scroller: the tabs pin under the fixed
						    rail while posts scroll beneath them. */}
						<header
							className="sticky top-0 z-sticky h-14 border-b border-hairline bg-page animate-rise"
							style={{ animationDelay: "70ms" }}
						>
							<h1 className="sr-only">Home</h1>
							<div className="flex items-center h-full">
								<div className="flex-1 h-full min-w-0">
									<FeedTabs />
								</div>
								<FeedHeaderActions />
							</div>
						</header>
						{/* The shell above streams immediately; the feed fills in
						    when the gateway answers. Without this boundary the
						    whole page would wait on the slowest request. */}
						<Suspense fallback={<FeedSkeleton count={5} />}>
							<StreamedFeed />
						</Suspense>
					</div>
				</div>
				<RightSidebar />
			</div>
		</main>
	);
}
