import { Skeleton } from "@/components/ui/Skeleton";
import { PostSkeleton } from "@/components/skeletons/PostSkeleton";

export function ProfileSkeleton() {
	return (
		<div className="flex flex-col min-h-screen">
			{/* Header */}
			<div className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-black/5 px-4 py-1 flex items-center gap-6">
				<Skeleton className="w-9 h-9 rounded-full" />
				<div className="flex flex-col gap-1">
					<Skeleton className="h-5 w-32" />
					<Skeleton className="h-3 w-16" />
				</div>
			</div>

			{/* Hero */}
			<div className="relative">
				<Skeleton className="h-[200px] w-full" />
				<div className="absolute -bottom-[70px] left-4 border-4 border-white rounded-full">
					<Skeleton className="w-[134px] h-[134px] rounded-full" />
				</div>
			</div>

			{/* Actions */}
			<div className="flex justify-end px-4 py-3 gap-2 mt-2">
				<Skeleton className="w-9 h-9 rounded-full" />
				<Skeleton className="w-24 h-9 rounded-full" />
			</div>

			{/* Info */}
			<div className="px-4 mt-8 flex flex-col gap-3">
				<div>
					<Skeleton className="h-6 w-48 mb-1" />
					<Skeleton className="h-4 w-24" />
				</div>
				<Skeleton className="h-4 w-full max-w-md" />
				<div className="flex gap-4 mt-2">
					<Skeleton className="h-4 w-24" />
					<Skeleton className="h-4 w-32" />
				</div>
				<div className="flex gap-5 mt-1">
					<Skeleton className="h-4 w-20" />
					<Skeleton className="h-4 w-20" />
				</div>
			</div>

			{/* Tabs */}
			<div className="flex mt-8 border-b border-black/10">
				<div className="flex-1 p-4">
					<Skeleton className="h-4 w-12 mx-auto" />
				</div>
				<div className="flex-1 p-4">
					<Skeleton className="h-4 w-12 mx-auto" />
				</div>
				<div className="flex-1 p-4">
					<Skeleton className="h-4 w-12 mx-auto" />
				</div>
			</div>

			{/* Feed */}
			<div className="flex flex-col">
				{[...Array(3)].map((_, i) => (
					<PostSkeleton key={i} />
				))}
			</div>
		</div>
	);
}
