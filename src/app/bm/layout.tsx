import type { Metadata } from "next";
import { LeftSidebar } from "@/components/layout/LeftSidebar";

export const metadata: Metadata = { title: "Business" };

/**
 * Same shell as Messages, on purpose: BM lived inside the (main) feed
 * column and two panes crushed into 620px is most of what made it ugly.
 * A deal room deserves the width a chat room gets.
 */
export default function BmLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<div className="max-w-[1600px] mx-auto flex min-h-dvh">
			<LeftSidebar />
			<main
				id="main-content"
				className="flex-1 min-w-0 min-h-dvh border-r border-hairline"
			>
				{children}
			</main>
		</div>
	);
}
