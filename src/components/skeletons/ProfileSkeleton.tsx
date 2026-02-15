export const ProfileSkeleton = () => {
	return (
		<div className="flex flex-col w-full animate-pulse">
			<div className="h-[200px] w-full bg-zinc-900" />
			<div className="px-4 relative mb-4">
				<div className="w-[134px] h-[134px] rounded-full border-4 border-black bg-zinc-800 -mt-[67px] relative" />
			</div>
			<div className="px-4 space-y-4">
				<div className="space-y-2">
					<div className="h-6 w-48 bg-zinc-800 rounded" />
					<div className="h-4 w-32 bg-zinc-900 rounded" />
				</div>
				<div className="space-y-2">
					<div className="h-4 w-full max-w-md bg-zinc-900 rounded" />
					<div className="h-4 w-3/4 max-w-md bg-zinc-900 rounded" />
				</div>
				<div className="flex gap-4">
					<div className="h-4 w-24 bg-zinc-900 rounded" />
					<div className="h-4 w-24 bg-zinc-900 rounded" />
				</div>
				<div className="flex gap-6 pt-2">
					<div className="h-5 w-20 bg-zinc-900 rounded" />
					<div className="h-5 w-20 bg-zinc-900 rounded" />
				</div>
			</div>
			<div className="mt-6 border-b border-zinc-900 flex">
				<div className="flex-1 h-12 bg-zinc-900/50" />
				<div className="flex-1 h-12 bg-zinc-900/50" />
				<div className="flex-1 h-12 bg-zinc-900/50" />
			</div>
			<div className="divide-y divide-zinc-900">
				{[1, 2, 3].map((i) => (
					<div key={i} className="p-4 space-y-4">
						<div className="flex gap-4">
							<div className="w-12 h-12 rounded-full bg-zinc-900" />
							<div className="space-y-2 flex-1">
								<div className="h-4 w-32 bg-zinc-900 rounded" />
								<div className="h-3 w-24 bg-zinc-900 rounded" />
							</div>
						</div>
						<div className="h-24 w-full bg-zinc-900 rounded" />
					</div>
				))}
			</div>
		</div>
	);
};
