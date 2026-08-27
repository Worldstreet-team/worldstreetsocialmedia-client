import Image from "next/image";
import { currentUser } from "@clerk/nextjs/server";
import Feed from "@/components/feed/Feed";
import { StoriesRail } from "@/components/feed/StoriesRail";
import { FeedTabs } from "@/components/feed/FeedTabs";
import { FeedHeaderActions } from "@/components/feed/FeedHeaderActions";
import { LeftSidebar } from "@/components/layout/LeftSidebar";
import { RightSidebar } from "@/components/layout/RightSidebar";

import { MobileNavigation } from "@/components/layout/MobileNavigation";

export default async function Home() {
	const user = await currentUser();

	return (
		<main className="min-h-dvh bg-page text-primary">
			<MobileNavigation />
			{/* Widths come from tokens: --ws-container-max 1280, --ws-feed-width 620 */}
			<div className="max-w-[var(--ws-container-max)] mx-auto flex justify-center min-h-dvh">
				<LeftSidebar />
				<div className="flex h-dvh w-full min-w-0 max-w-[var(--ws-feed-width)] flex-col sm:border-x border-hairline pt-topbar md:pt-0">
					{/* Stories above everything, fixed: they sit outside the
					    scroll container, same structure as the (main) layout. */}
					<div
						className="shrink-0 animate-rise"
						style={{ animationDelay: "40ms" }}
					>
						<StoriesRail />
					</div>
					<div id="ws-main-scroll" className="min-h-0 flex-1 overflow-y-auto">
						{/* Sticky inside the scroller: the tabs pin under the fixed
						    rail while posts scroll beneath them. */}
						<header
							className="sticky top-0 z-sticky h-14 border-b border-hairline bg-page animate-rise"
							style={{ animationDelay: "70ms" }}
						>
							<h1 className="sr-only">Home</h1>
							<div className="flex items-center h-full">
								<div className="flex-1 h-full min-w-0">
									<FeedTabs />
								</div>
								<FeedHeaderActions />
							</div>
						</header>
						<Feed />
					</div>
				</div>
				<RightSidebar />
			</div>
		</main>
	);
}
