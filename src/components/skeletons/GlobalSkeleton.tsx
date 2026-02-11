import { Skeleton } from "@/components/ui/Skeleton";
import { PostSkeleton } from "@/components/skeletons/PostSkeleton";

export function GlobalSkeleton() {
	return (
		<div className="max-w-[1265px] mx-auto flex justify-center min-h-screen">
			{/* Left Sidebar Skeleton */}
			<div className="w-[275px] hidden md:flex flex-col sticky top-0 h-screen px-2 py-4 gap-4">
				<div className="flex items-center justify-center py-4 mb-4">
					<Skeleton className="h-8 w-32" />
				</div>
				{/* Nav Items */}
				{[...Array(6)].map((_, i) => (
					<div key={i} className="flex items-center gap-4 px-4 py-3">
						<Skeleton className="w-7 h-7 rounded-full" />
						<Skeleton className="h-5 w-24 rounded-full" />
					</div>
				))}
				{/* User Profile at bottom */}
				<div className="mt-auto flex items-center gap-3 p-3">
					<Skeleton className="w-10 h-10 rounded-full" />
					<div className="flex flex-col gap-2">
						<Skeleton className="h-4 w-24" />
						<Skeleton className="h-3 w-16" />
					</div>
				</div>
			</div>

			{/* Main Feed Skeleton */}
			<main className="w-full max-w-[600px] border-x border-black/10 min-h-screen flex flex-col">
				{/* Header */}
				<div className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-black/10 h-[53px] flex items-center px-4">
					<Skeleton className="h-6 w-32" />
				</div>
				{/* Composer */}
				<div className="p-4 border-b border-black/10 flex gap-4">
					<Skeleton className="w-10 h-10 rounded-full" />
					<div className="flex-1 flex flex-col gap-2">
						<Skeleton className="h-20 w-full rounded-xl" />
						<div className="flex justify-between items-center mt-2">
							<div className="flex gap-2">
								<Skeleton className="w-6 h-6" />
								<Skeleton className="w-6 h-6" />
							</div>
							<Skeleton className="w-20 h-8 rounded-full" />
						</div>
					</div>
				</div>
				{/* Posts */}
				<div className="flex flex-col">
					{[...Array(5)].map((_, i) => (
						<PostSkeleton key={i} />
					))}
				</div>
			</main>

			{/* Right Sidebar Skeleton */}
			<div className="w-[350px] hidden lg:flex flex-col gap-4 p-3 sticky top-0 h-screen">
				{/* Search */}
				<Skeleton className="h-12 w-full rounded-full mb-4" />

				{/* What's Happening */}
				<div className="bg-[#f7f9fa] rounded-2xl p-4 flex flex-col gap-4">
					<Skeleton className="h-6 w-40 mb-2" />
					{[...Array(4)].map((_, i) => (
						<div key={i} className="flex flex-col gap-2">
							<Skeleton className="h-3 w-24" />
							<Skeleton className="h-4 w-32" />
						</div>
					))}
				</div>

				{/* Who to follow */}
				<div className="bg-[#f7f9fa] rounded-2xl p-4 flex flex-col gap-4">
					<Skeleton className="h-6 w-32 mb-2" />
					{[...Array(3)].map((_, i) => (
						<div key={i} className="flex items-center gap-3">
							<Skeleton className="w-10 h-10 rounded-full" />
							<div className="flex flex-col gap-1 flex-1">
								<Skeleton className="h-4 w-24" />
								<Skeleton className="h-3 w-16" />
							</div>
							<Skeleton className="w-16 h-8 rounded-full" />
						</div>
					))}
				</div>
			</div>
		</div>
	);
}
