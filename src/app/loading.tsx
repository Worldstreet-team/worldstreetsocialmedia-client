import { FeedSkeleton } from "@/components/feed/FeedSkeleton";

/**
 * Root loading state — the home page's own await lives inside a Suspense
 * boundary, so this mostly covers the first document paint: the three-column
 * proportions render as placeholders so the page does not arrive as a blank
 * wall and then jump into shape.
 */
export default function RootLoading() {
	return (
		<main className="min-h-dvh bg-page text-primary">
			<div className="max-w-[var(--ws-container-max)] mx-auto flex justify-center min-h-dvh">
				{/* left rail stand-in */}
				<div className="hidden md:flex w-[240px] shrink-0 flex-col gap-3 px-4 py-6">
					<div className="skeleton h-7 w-32 rounded-md" />
					{Array.from({ length: 6 }, (_, i) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: static placeholder list
						<div key={i} className="skeleton h-9 w-40 rounded-pill" />
					))}
				</div>
				<div className="w-full max-w-[var(--ws-feed-width)] sm:border-x border-hairline">
					<div className="h-14 border-b border-hairline" />
					<FeedSkeleton count={4} />
				</div>
				{/* right rail stand-in */}
				<div className="hidden lg:flex w-[320px] shrink-0 flex-col gap-4 px-6 py-6">
					<div className="skeleton h-10 w-full rounded-pill" />
					<div className="skeleton h-40 w-full rounded-xl" />
					<div className="skeleton h-56 w-full rounded-xl" />
				</div>
			</div>
		</main>
	);
}
