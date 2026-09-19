import { LeftSidebar } from "@/components/layout/LeftSidebar";
import { RightSidebar } from "@/components/layout/RightSidebar";
import { MessagesFeatureTour } from "@/components/messages/MessagesFeatureTour";

export default function MessagesLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<div className="max-w-[1600px] mx-auto flex min-h-dvh">
			<LeftSidebar />
			<main
				id="main-content"
				className="flex-1 min-w-0 min-h-dvh"
			>
				{children}
			</main>
			{/* The SAME discovery rail the rest of the app uses (owner
			    2026-09-19), not a second one built for this surface. */}
			<RightSidebar />
			<MessagesFeatureTour />
		</div>
	);
}
