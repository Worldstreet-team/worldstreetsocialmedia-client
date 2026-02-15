import Image from "next/image";
import { currentUser } from "@clerk/nextjs/server";
import Feed from "@/components/feed/Feed";
import { LeftSidebar } from "@/components/layout/LeftSidebar";
import { RightSidebar } from "@/components/layout/RightSidebar";

export default async function Home() {
	const user = await currentUser();

	return (
		<main className="min-h-screen bg-black text-white">
			<div className="max-w-[1265px] mx-auto flex justify-center min-h-screen">
				<LeftSidebar />
				<div className="w-full max-w-[600px] border-x border-zinc-800 min-h-screen">
					<Feed />
				</div>
				<RightSidebar />
			</div>
		</main>
	);
}
