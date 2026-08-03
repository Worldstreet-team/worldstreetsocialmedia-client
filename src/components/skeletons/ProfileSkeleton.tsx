export const ProfileSkeleton = () => {
	return (
		<div className="flex flex-col w-full">
			<div className="h-[200px] w-full skeleton" />
			<div className="px-4 relative mb-4">
				<div className="w-[134px] h-[134px] rounded-full border-4 border-page skeleton -mt-[67px] relative" />
			</div>
			<div className="px-4 space-y-4">
				<div className="space-y-2">
					<div className="h-6 w-48 skeleton rounded-sm" />
					<div className="h-4 w-32 skeleton rounded-sm" />
				</div>
				<div className="space-y-2">
					<div className="h-4 w-full max-w-md skeleton rounded-sm" />
					<div className="h-4 w-3/4 max-w-md skeleton rounded-sm" />
				</div>
				<div className="flex gap-4">
					<div className="h-4 w-24 skeleton rounded-sm" />
					<div className="h-4 w-24 skeleton rounded-sm" />
				</div>
				<div className="flex gap-6 pt-2">
					<div className="h-5 w-20 skeleton rounded-sm" />
					<div className="h-5 w-20 skeleton rounded-sm" />
				</div>
			</div>
			<div className="mt-6 border-b border-hairline flex">
				<div className="flex-1 h-12 skeleton" />
				<div className="flex-1 h-12 skeleton" />
				<div className="flex-1 h-12 skeleton" />
			</div>
			<div className="divide-y divide-hairline">
				{[1, 2, 3].map((i) => (
					<div key={i} className="p-4 space-y-4">
						<div className="flex gap-4">
							<div className="w-12 h-12 rounded-full skeleton" />
							<div className="space-y-2 flex-1">
								<div className="h-4 w-32 skeleton rounded-sm" />
								<div className="h-3 w-24 skeleton rounded-sm" />
							</div>
						</div>
						<div className="h-24 w-full skeleton rounded-md" />
					</div>
				))}
			</div>
		</div>
	);
};
