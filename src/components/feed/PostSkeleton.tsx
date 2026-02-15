import clsx from "clsx";

interface PostSkeletonProps {
	hasMedia?: boolean;
}

export const PostSkeleton = ({ hasMedia = false }: PostSkeletonProps) => {
	return (
		<div className="p-6 border-b border-zinc-800 animate-pulse">
			<div className="flex gap-4">
				{/* Avatar Skeleton */}
				<div className="shrink-0">
					<div className="w-12 h-12 rounded-full bg-zinc-800" />
				</div>

				<div className="flex-1 min-w-0">
					{/* Header Skeleton */}
					<div className="flex items-center gap-2 mb-2">
						<div className="h-4 w-24 bg-zinc-800 rounded" />
						<div className="h-3 w-16 bg-zinc-800 rounded" />
					</div>

					{/* Content Skeleton */}
					<div className="space-y-2 mb-4">
						<div className="h-4 w-full bg-zinc-800 rounded" />
						<div className="h-4 w-3/4 bg-zinc-800 rounded" />
					</div>

					{/* Media Skeleton (Optional appearance) */}
					{hasMedia && (
						<div className="w-full aspect-video bg-zinc-800 rounded-xl mb-4" />
					)}

					{/* Actions Skeleton */}
					<div className="flex items-center justify-between max-w-md mt-2">
						<div className="h-8 w-8 bg-zinc-800 rounded-full" />
						<div className="h-8 w-8 bg-zinc-800 rounded-full" />
						<div className="h-8 w-8 bg-zinc-800 rounded-full" />
						<div className="h-8 w-8 bg-zinc-800 rounded-full" />
					</div>
				</div>
			</div>
		</div>
	);
};
