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
		<div className="p-6">
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

					{/* action row same 48px gap rhythm as the real card */}
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

// Varied widths so a stack of placeholders reads as different replies, not
// one bar repeated.
const REPLY_WIDTHS = [
	["w-[26%]", "w-[84%]", "w-[52%]"],
	["w-[20%]", "w-[68%]", "w-[40%]"],
	["w-[32%]", "w-[90%]", "w-[58%]"],
	["w-[24%]", "w-[74%]", ""],
] as const;

/**
 * Loading placeholder for one reply row on a post page. Geometry mirrors
 * PostCard's "reply" variant (owner pick A + C, 2026-09-28): 36px avatar,
 * name and time on one line, the text under it, the four small actions, so
 * the real rows land exactly where their placeholders were.
 */
export const ReplySkeleton = ({ i = 0 }: { i?: number }) => {
	const [name, line1, line2] = REPLY_WIDTHS[i % REPLY_WIDTHS.length];
	return (
		<div aria-hidden className="flex gap-3 px-4 py-2.5">
			<div className="skeleton size-9 shrink-0 rounded-pill" />
			<div className="min-w-0 flex-1 pt-1">
				<div className="mb-2.5 flex items-center gap-2">
					<div className={`skeleton h-3 ${name} rounded-sm`} />
					<div className="skeleton h-3 w-[8%] rounded-sm" />
				</div>
				<div className={`skeleton h-3 ${line1} rounded-sm`} />
				{line2 && <div className={`skeleton mt-2 h-3 ${line2} rounded-sm`} />}
				<div className="mt-3.5 flex items-center gap-7">
					<div className="skeleton size-4 rounded-pill" />
					<div className="skeleton size-4 rounded-pill" />
					<div className="skeleton size-4 rounded-pill" />
					<div className="skeleton size-4 rounded-pill" />
				</div>
			</div>
		</div>
	);
};
