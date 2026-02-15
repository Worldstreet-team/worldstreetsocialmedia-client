import { LeftSidebar } from "@/components/layout/LeftSidebar";
import { RightSidebar } from "@/components/layout/RightSidebar";

export default function MainLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<div className="max-w-[1265px] mx-auto flex justify-center min-h-screen">
			<LeftSidebar />
			<main className="w-full max-w-[600px] border-x border-zinc-800 min-h-screen">
				{children}
			</main>
			<RightSidebar />
		</div>
	);
}
