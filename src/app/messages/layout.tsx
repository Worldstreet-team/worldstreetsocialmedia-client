import { LeftSidebar } from "@/components/layout/LeftSidebar";

export default function MessagesLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<div className="max-w-[1600px] mx-auto flex min-h-screen">
			<LeftSidebar />
			<main id="main-content" className="flex-1 min-h-screen border-r border-hairline">
				{children}
			</main>
		</div>
	);
}
