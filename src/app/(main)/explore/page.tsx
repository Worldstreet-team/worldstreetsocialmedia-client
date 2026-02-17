"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { getExploreDataAction } from "@/lib/post.actions";
import { PostCard } from "@/components/feed/PostCard";
import { PostSkeleton } from "@/components/feed/PostSkeleton";
import { useRouter } from "next/navigation";
import { useAtom } from "jotai";
import {
	trendsAtom,
	trendsLoadedAtom,
	popularPostsAtom,
	popularPostsLoadedAtom,
	type TrendingTopic,
} from "@/store/trends.atom";

export default function ExplorePage() {
	const [trends, setTrends] = useAtom(trendsAtom);
	const [isTrendsLoaded, setIsTrendsLoaded] = useAtom(trendsLoadedAtom);
	const [popularPosts, setPopularPosts] = useAtom(popularPostsAtom);
	const [isPopularPostsLoaded, setIsPopularPostsLoaded] = useAtom(
		popularPostsLoadedAtom,
	);

	const [loading, setLoading] = useState(
		!isTrendsLoaded || !isPopularPostsLoaded,
	);
	const router = useRouter();

	useEffect(() => {
		const fetchData = async () => {
			if (isTrendsLoaded && isPopularPostsLoaded) {
				setLoading(false);
				return;
			}

			setLoading(true);
			const res = await getExploreDataAction();
			if (res.success) {
				setTrends(res.data.trendsForYou);
				const mappedPopularPosts = res.data.popularTweets.map((post: any) => ({
					...post,
					id: post._id,
				}));
				setPopularPosts(mappedPopularPosts);
				setIsTrendsLoaded(true);
				setIsPopularPostsLoaded(true);
			}
			setLoading(false);
		};

		fetchData();
	}, [
		isTrendsLoaded,
		isPopularPostsLoaded,
		setTrends,
		setPopularPosts,
		setIsTrendsLoaded,
		setIsPopularPostsLoaded,
	]);

	return (
		<div className="flex flex-col min-h-screen pb-20">
			{/* Search Header */}
			<div className="sticky top-0 z-20 bg-black/80 backdrop-blur-md px-4 py-3 border-b border-zinc-800">
				<div className="relative group">
					<div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-white transition-colors">
						<Search className="w-5 h-5" />
					</div>
					<input
						type="text"
						placeholder="Search WorldStreet"
						className="w-full bg-zinc-900 border border-zinc-800 rounded-full py-2.5 pl-10 pr-4 text-white focus:outline-none focus:border-white focus:ring-1 focus:ring-white placeholder:text-zinc-500 font-sans text-sm transition-all"
					/>
				</div>
			</div>

			{/* Trending Topics */}
			<div className="border-b border-zinc-800 pb-2">
				<h2 className="px-4 py-3 text-xl font-bold font-sans text-white">
					Trends for you
				</h2>
				<div className="flex flex-col">
					{loading ? (
						// Simple skeleton for trends
						[...Array(5)].map((_, i) => (
							<div
								key={i}
								className="px-4 py-3 border-b border-zinc-800/50 last:border-0"
							>
								<div className="h-3 w-24 bg-zinc-800 rounded mb-2 animate-pulse" />
								<div className="h-4 w-40 bg-zinc-800 rounded mb-1 animate-pulse" />
								<div className="h-3 w-16 bg-zinc-800 rounded animate-pulse" />
							</div>
						))
					) : trends.length > 0 ? (
						trends.map((topic, i) => (
							<div
								key={i}
								className="px-4 py-3 hover:bg-zinc-900/50 cursor-pointer transition-colors border-b border-zinc-800/50 last:border-0"
							>
								<div className="flex justify-between items-start">
									<div className="text-xs text-zinc-500 font-sans">
										{topic.category}
									</div>
									{/* <button className="text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-full p-1 -mr-2 transition-colors">
										...
									</button> */}
								</div>
								<div className="font-bold text-[15px] my-0.5 text-white font-sans tracking-tight">
									{topic.title}
								</div>
								<div className="text-xs text-zinc-500 font-sans">
									{topic.posts}
								</div>
							</div>
						))
					) : (
						<div className="px-4 py-8 text-zinc-500 text-center font-sans text-sm">
							No trending topics yet.
						</div>
					)}
				</div>
				{!loading && trends.length > 0 && (
					<div className="px-4 py-3 text-yellow-500 text-[15px] hover:bg-zinc-900/50 cursor-pointer transition-colors text-left font-sans font-bold">
						Show more
					</div>
				)}
			</div>

			{/* Popular Posts */}
			<div className="flex flex-col">
				<h2 className="px-4 py-4 text-xl font-bold border-b border-zinc-800 font-sans text-white">
					Popular
				</h2>
				{loading ? (
					[...Array(3)].map((_, i) => <PostSkeleton key={i} />)
				) : popularPosts.length > 0 ? (
					popularPosts.map((post) => (
						<div key={post.id} className="border-b border-zinc-800">
							<PostCard post={post} />
						</div>
					))
				) : (
					<div className="p-12 text-center text-zinc-500 font-sans text-sm">
						No popular posts found.
					</div>
				)}
			</div>
		</div>
	);
}
