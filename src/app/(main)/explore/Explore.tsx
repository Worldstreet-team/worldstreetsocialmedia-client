"use client";

import SearchIcon from "@/assets/icons/SearchIcon";
import { useEffect, useState } from "react";
import { getExploreDataAction } from "@/lib/post.actions";
import { PostSkeleton } from "@/components/skeletons/PostSkeleton";
import { PostCard } from "@/components/feed/PostCard";

interface TrendingTopic {
	category: string;
	title: string;
	posts: string;
}

export default function ExplorePage() {
	const [loading, setLoading] = useState(true);
	const [trends, setTrends] = useState<TrendingTopic[]>([]);
	const [popularPosts, setPopularPosts] = useState<any[]>([]);

	useEffect(() => {
		const fetchData = async () => {
			setLoading(true);
			const res = await getExploreDataAction();
			if (res.success) {
				setTrends(res.data.trendsForYou);
				setPopularPosts(res.data.popularTweets);
			}
			setLoading(false);
		};

		fetchData();
	}, []);

	return (
		<div className="flex flex-col min-h-screen">
			{/* Search Header */}
			<div className="sticky top-0 z-20 bg-white/80 backdrop-blur-md px-4 py-2 border-b border-black/10">
				<div className="relative group">
					<div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-primary transition-colors">
						<SearchIcon
							size={{ width: "20", height: "20" }}
							color="currentColor"
						/>
					</div>
					<input
						type="text"
						placeholder="Search WorldStreet"
						className="w-full bg-input-bg border-none rounded-full py-2 pl-10 pr-4 text-black focus:ring-1 focus:ring-primary focus:bg-white placeholder-text-light"
					/>
				</div>
			</div>

			{/* Trending Topics */}
			<div className="py-3 border-b border-black/10">
				<h2 className="px-4 py-2 text-xl font-extrabold">Trends for you</h2>
				<div className="flex flex-col">
					{loading ? (
						// Simple skeleton for trends
						[...Array(5)].map((_, i) => (
							<div
								key={i}
								className="px-4 py-3 border-b border-black/5 last:border-0"
							>
								<div className="h-3 w-24 bg-gray-200 rounded mb-2 animate-pulse" />
								<div className="h-4 w-40 bg-gray-200 rounded mb-1 animate-pulse" />
								<div className="h-3 w-16 bg-gray-200 rounded animate-pulse" />
							</div>
						))
					) : trends.length > 0 ? (
						trends.map((topic, i) => (
							<div
								key={i}
								className="px-4 py-3 hover:bg-black/5 cursor-pointer transition-colors"
							>
								<div className="flex justify-between items-start">
									<div className="text-xs text-text-light">
										{topic.category}
									</div>
									<span className="material-symbols-outlined text-text-light text-sm hover:text-primary hover:bg-primary/10 rounded-full p-1 -mr-2">
										more_horiz
									</span>
								</div>
								<div className="font-bold text-[15px] my-0.5">
									{topic.title}
								</div>
								<div className="text-xs text-text-light">{topic.posts}</div>
							</div>
						))
					) : (
						<div className="px-4 py-4 text-text-light text-center">
							No trending topics yet.
						</div>
					)}
				</div>
				<div className="px-4 py-3 text-primary text-[15px] hover:bg-black/5 cursor-pointer transition-colors text-left">
					Show more
				</div>
			</div>

			{/* Posts Feed for Explore */}
			<div className="flex flex-col">
				<h2 className="px-4 py-4 text-xl font-extrabold border-b border-black/10">
					Popular Tweets
				</h2>
				{loading ? (
					[...Array(3)].map((_, i) => <PostSkeleton key={i} />)
				) : popularPosts.length > 0 ? (
					popularPosts.map((post) => <PostCard key={post._id} post={post} />)
				) : (
					<div className="p-8 text-center text-text-light">
						No popular posts found.
					</div>
				)}
			</div>
		</div>
	);
}
