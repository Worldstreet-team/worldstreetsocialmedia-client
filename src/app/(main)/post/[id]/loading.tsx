import { PostSkeleton } from "@/components/feed/PostSkeleton";
import { Skeleton } from "@/components/ui/Skeleton";

/**
 * Post-shaped, not feed-shaped: without this file the group-level
 * loading.tsx fronted navigation with a header + four feed cards, the wrong
 * silhouette for a single post, so every cold open looked like the feed
 * reloading. One post, then quiet reply rows.
 */
export default function PostLoading() {
	return (
		<div className="flex min-h-dvh flex-col">
			<div className="sticky top-0 z-sticky flex items-center gap-4 border-b border-hairline bg-page px-4 py-3">
				<Skeleton className="h-9 w-9 rounded-pill" />
				<Skeleton className="h-5 w-16 rounded-sm" />
			</div>
			<PostSkeleton />
			<div className="border-t border-hairline">
				{[0, 1, 2].map((i) => (
					<div key={i} className="flex gap-3 border-b border-hairline px-4 py-3.5">
						<Skeleton className="h-9 w-9 shrink-0 rounded-pill" />
						<div className="flex w-full flex-col gap-2">
							<Skeleton className="h-3 w-[30%] rounded-sm" />
							<Skeleton className="h-3 w-[80%] rounded-sm" />
						</div>
					</div>
				))}
			</div>
		</div>
	);
}
