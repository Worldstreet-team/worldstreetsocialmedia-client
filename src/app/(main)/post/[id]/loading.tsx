import { PostSkeleton } from "@/components/feed/PostSkeleton";

/**
 * Only for a post reached by its URL; a post opened from a card never
 * waits on the route (see PostLayer). Same frame as the page, so nothing
 * moves when it lands.
 */
export default function PostLoading() {
	return (
		<div className="absolute inset-0 flex flex-col bg-page">
			<div className="h-[57px] shrink-0 border-b border-hairline" />
			<div className="p-4">
				<PostSkeleton />
			</div>
		</div>
	);
}
