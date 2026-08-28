import { PostSkeleton } from "@/components/feed/PostSkeleton";

/**
 * The feed column while its first page streams in.
 *
 * Server-renderable on purpose: this is the Suspense fallback around the
 * streamed feed and the (main) group's route-loading state, so it has to be
 * plain markup — no hooks, no stores.
 */
export function FeedSkeleton({ count = 4 }: { count?: number }) {
	return (
		<div className="flex flex-col" aria-busy="true" aria-label="Loading">
			{Array.from({ length: count }, (_, i) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: static placeholder list
				<PostSkeleton key={i} hasMedia={i % 2 !== 0} />
			))}
		</div>
	);
}
