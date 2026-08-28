/** Studio stand-in: rail + stat cards, in the Studio's own fixed-dark inks. */
export default function StudioLoading() {
	return (
		<div className="min-h-dvh bg-[#0F0E0D] p-6" aria-busy="true">
			<div className="mx-auto flex max-w-5xl flex-col gap-4">
				<div className="skeleton h-8 w-48 rounded-md" />
				<div className="grid grid-cols-2 gap-3 md:grid-cols-4">
					{Array.from({ length: 4 }, (_, i) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: static placeholder list
						<div key={i} className="skeleton h-24 rounded-xl" />
					))}
				</div>
				<div className="skeleton h-64 w-full rounded-xl" />
			</div>
		</div>
	);
}
