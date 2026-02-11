import { LeftSidebar } from "@/components/layout/LeftSidebar";
import { RightSidebar } from "@/components/layout/RightSidebar";
import { Metadata, Viewport } from "next";

export const metadata: Metadata = {
	title: "WorldStreet",
	description: "Connect with the world on WorldStreet.",
	openGraph: {
		title: "WorldStreet",
		description: "Connect with the world on WorldStreet.",
		siteName: "WorldStreet",
	},
	keywords: ["WorldStreet", "Social Media", "Connect", "Posts", "Trends"],
	applicationName: "WorldStreet",
};

export const viewport: Viewport = {
	themeColor: "#ffffff",
	initialScale: 1,
	width: "device-width",
	maximumScale: 1,
};

export default function MainLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<div className="max-w-[1265px] mx-auto flex justify-center min-h-screen">
			<LeftSidebar />
			<main className="w-full max-w-[600px] border-x border-black/10 min-h-screen">
				{children}
			</main>
			<RightSidebar />
		</div>
	);
}
