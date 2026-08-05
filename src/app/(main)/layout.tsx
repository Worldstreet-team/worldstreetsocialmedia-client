import { LeftSidebar } from "@/components/layout/LeftSidebar";
import { RightSidebar } from "@/components/layout/RightSidebar";

export default function MainLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		// Same width tokens as app/page.tsx (--ws-container-max 1280 /
		// --ws-feed-width 620) so the feed column doesn't jump between routes.
		// min-h-dvh, not min-h-screen: 100vh on mobile is the *expanded* viewport,
		// so the column jumps by the address-bar height as it collapses.
		<div className="max-w-[var(--ws-container-max)] mx-auto flex justify-center min-h-dvh">
			<LeftSidebar />
			<main
				id="main-content"
				// min-w-0 so long words / wide children shrink inside the flex row
				// instead of forcing the page wider than the viewport.
				className="w-full min-w-0 max-w-[var(--ws-feed-width)] sm:border-x border-hairline min-h-dvh"
			>
				{children}
			</main>
			<RightSidebar />
		</div>
	);
}
