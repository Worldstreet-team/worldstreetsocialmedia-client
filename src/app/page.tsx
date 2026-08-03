import Image from "next/image";
import { currentUser } from "@clerk/nextjs/server";
import Feed from "@/components/feed/Feed";
import { FeedTabs } from "@/components/feed/FeedTabs";
import { LeftSidebar } from "@/components/layout/LeftSidebar";
import { RightSidebar } from "@/components/layout/RightSidebar";

import { MobileNavigation } from "@/components/layout/MobileNavigation";

export default async function Home() {
	const user = await currentUser();

	return (
		<main className="min-h-screen bg-page text-primary">
			<MobileNavigation />
			{/* Widths come from tokens: --ws-container-max 1280, --ws-feed-width 620 */}
			<div className="max-w-[var(--ws-container-max)] mx-auto flex justify-center min-h-screen">
				<LeftSidebar />
				<div className="w-full max-w-[var(--ws-feed-width)] sm:border-x border-hairline min-h-screen pt-14 md:pt-0">
					{/* Sticky column header — keeps the feed anchored while scrolling.
					    Translucent page fill + blur so posts read through it. */}
					<header
						className="sticky top-14 md:top-0 z-sticky h-14 border-b border-hairline bg-page animate-rise"
						style={{ animationDelay: "40ms" }}
					>
						<h1 className="sr-only">Home</h1>
						<FeedTabs />
					</header>
					<Feed />
				</div>
				<RightSidebar />
			</div>
		</main>
	);
}
