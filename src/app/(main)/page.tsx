import { Suspense } from "react";
import { headers } from "next/headers";
import Feed, { type FeedSeed } from "@/components/feed/Feed";
import { FeedFallback } from "@/components/feed/FeedFallback";
import { FeedTabs } from "@/components/feed/FeedTabs";
import { FeedHeaderActions } from "@/components/feed/FeedHeaderActions";
import { getFeedAction } from "@/lib/feed.actions";
import { mapApiPost } from "@/lib/post-mapper";

/** How long SSR will wait for page one before handing the job to the client. */
const SEED_TIMEOUT_MS = 2_500;

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
	// The middleware already tried the gateway this request and it did not
	// answer. Asking again only stacks a second timeout onto a page that is
	// already late, and adds load to something that is evidently struggling.
	if (h.get("x-gateway-degraded") === "1") return <Feed />;

	let initialData: FeedSeed | null = null;
	try {
		// Bounded, and this bound is the whole safety of doing it here at all.
		//
		// Rendering waits on this, so without a cap the page waits exactly as
		// long as the gateway takes — and the gateway is a free instance that
		// sleeps when idle and needs 20-30s to wake. That turned one cold start
		// into every page hanging, where before the shell painted immediately
		// and only the feed column waited.
		//
		// Losing the race is not a failure: `Feed` falls back to its snapshot
		// and fetches client-side, which is precisely how it behaved before the
		// seed existed. The seed is an optimisation, so it gets a deadline.
		const result = await Promise.race([
			getFeedAction(null, 10, "foryou"),
			new Promise<null>((resolve) =>
				setTimeout(() => resolve(null), SEED_TIMEOUT_MS),
			),
		]);
		if (result?.success && result.data?.posts) {
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

/**
 * Home, now INSIDE the (main) group — the same shell instance as post
 * detail, profile and bookmarks. It used to be a self-contained duplicate
 * of the group layout, so every hop between / and /post remounted both
 * rails, the story strip and the scroller in BOTH directions (and left a
 * ghost #ws-main-scroll behind). The column below is the only thing that
 * swaps now, which is most of what "native back" means. (Nav audit
 * 2026-09-02, finding 4.)
 */
export default function Home() {
	return (
		<>
			{/* Sticky inside the group scroller: the tabs pin under the fixed
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
			{/* The shell streams immediately; the feed fills in when the
			    gateway answers. Without this boundary the whole page would
			    wait on the slowest request. */}
			<Suspense fallback={<FeedFallback />}>
				<StreamedFeed />
			</Suspense>
		</>
	);
}
