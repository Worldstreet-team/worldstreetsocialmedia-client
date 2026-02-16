import Image from "next/image";
import { currentUser } from "@clerk/nextjs/server";
import Feed from "@/components/feed/Feed";
import { LeftSidebar } from "@/components/layout/LeftSidebar";
import { RightSidebar } from "@/components/layout/RightSidebar";

import { MobileNavigation } from "@/components/layout/MobileNavigation";

export default async function Home() {
	const user = await currentUser();

	return (
		<main className="min-h-screen bg-black text-white">
			<MobileNavigation />
			<div className="max-w-[1265px] mx-auto flex justify-center min-h-screen">
				<LeftSidebar />
				<div className="w-full max-w-[600px] sm:border-x border-zinc-800 min-h-screen pt-14 md:pt-0">
					<Feed />
				</div>
				<RightSidebar />
			</div>
		</main>
	);
}
