/** Conversation list / thread stand-in while the messages route resolves. */
export default function MessagesLoading() {
	return (
		<div className="flex h-dvh items-stretch bg-page" aria-busy="true">
			<div className="w-full md:w-[360px] shrink-0 md:bg-surface/40 p-4 flex flex-col gap-3">
				<div className="skeleton h-9 w-40 rounded-md" />
				{Array.from({ length: 7 }, (_, i) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: static placeholder list
					<div key={i} className="flex items-center gap-3">
						<div className="skeleton h-11 w-11 shrink-0 rounded-pill" />
						<div className="flex-1 space-y-2">
							<div className="skeleton h-3 w-2/5 rounded" />
							<div className="skeleton h-3 w-4/5 rounded" />
						</div>
					</div>
				))}
			</div>
			<div className="hidden md:block flex-1" />
		</div>
	);
}
