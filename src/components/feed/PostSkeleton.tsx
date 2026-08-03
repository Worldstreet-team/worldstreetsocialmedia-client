interface PostSkeletonProps {
	hasMedia?: boolean;
}

/**
 * Loading placeholder for a post.
 *
 * 04-components "Skeleton": fill bg/raised, Line height 12 radius 4 (widths
 * varied 40-90%), Card radius 13, white @4% shimmer sweep. The `skeleton`
 * utility (globals.css) carries the fill + sweep and goes static under
 * prefers-reduced-motion.
 *
 * Geometry mirrors PostCard exactly — 42px avatar, same gaps, 4 action slots —
 * so nothing shifts when the real post swaps in.
 */
export const PostSkeleton = ({ hasMedia = false }: PostSkeletonProps) => {
	return (
		<div className="p-6 border-b border-hairline">
			<div className="flex gap-4">
				<div className="shrink-0">
					<div className="skeleton w-[42px] h-[42px] rounded-pill" />
				</div>

				<div className="flex-1 min-w-0">
					{/* name + handle */}
					<div className="flex items-center gap-2 mb-2.5">
						<div className="skeleton h-3 w-[28%] rounded-sm" />
						<div className="skeleton h-3 w-[18%] rounded-sm" />
					</div>

					{/* body lines */}
					<div className="space-y-2 mb-4">
						<div className="skeleton h-3 w-[90%] rounded-sm" />
						<div className="skeleton h-3 w-[62%] rounded-sm" />
					</div>

					{hasMedia && (
						<div className="skeleton w-full aspect-video rounded-xl mb-4" />
					)}

					{/* action row — same 48px gap rhythm as the real card */}
					<div className="flex items-center gap-12 mt-3">
						<div className="skeleton h-5 w-5 rounded-pill" />
						<div className="skeleton h-5 w-5 rounded-pill" />
						<div className="skeleton h-5 w-5 rounded-pill" />
						<div className="skeleton h-5 w-5 rounded-pill" />
					</div>
				</div>
			</div>
		</div>
	);
};
