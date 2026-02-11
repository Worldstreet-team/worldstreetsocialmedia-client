import { Skeleton } from "@/components/ui/Skeleton";

export function PostSkeleton() {
	return (
		<div className="p-4 border-b border-black/10">
			<article className="flex gap-3">
				<Skeleton className="w-10 h-10 rounded-full shrink-0" />
				<div className="flex-1 min-w-0 space-y-2">
					<div className="flex items-center gap-2">
						<Skeleton className="h-4 w-24" />
						<Skeleton className="h-4 w-16" />
					</div>
					<div className="space-y-1">
						<Skeleton className="h-4 w-full" />
						<Skeleton className="h-4 w-[90%]" />
						<Skeleton className="h-4 w-[60%]" />
					</div>
					<div className="flex justify-between max-w-md pt-2">
						<Skeleton className="h-8 w-8 rounded-full" />
						<Skeleton className="h-8 w-8 rounded-full" />
						<Skeleton className="h-8 w-8 rounded-full" />
						<Skeleton className="h-8 w-8 rounded-full" />
					</div>
				</div>
			</article>
		</div>
	);
}
