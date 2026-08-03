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
		<div className="max-w-[var(--ws-container-max)] mx-auto flex justify-center min-h-screen">
			<LeftSidebar />
			<main
				id="main-content"
				className="w-full max-w-[var(--ws-feed-width)] sm:border-x border-hairline min-h-screen"
			>
				{children}
			</main>
			<RightSidebar />
		</div>
	);
}
