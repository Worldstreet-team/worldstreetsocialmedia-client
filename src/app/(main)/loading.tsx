import { FeedSkeleton } from "@/components/feed/FeedSkeleton";

/**
 * Route-loading state for the whole (main) group.
 *
 * The group layout (rails, sidebars, story strip) stays mounted while a page
 * inside it resolves, so this only stands in for the feed-width column — a
 * navigation paints the app shell instantly and skeletons where the content
 * will land, instead of freezing on the old page until the new one is ready.
 */
export default function MainLoading() {
	return (
		<div className="animate-rise">
			<div className="h-14 border-b border-hairline" />
			<FeedSkeleton count={4} />
		</div>
	);
}
