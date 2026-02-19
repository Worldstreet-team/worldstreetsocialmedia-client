"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { searchUsersAction } from "@/lib/user.actions";
import { getExploreDataAction } from "@/lib/post.actions";
import { PostCard, type PostProps } from "@/components/feed/PostCard";
import { PostSkeleton } from "@/components/feed/PostSkeleton";
import Image from "next/image";
import Link from "next/link";
import VerifiedIcon from "@/assets/icons/VerifiedIcon";
import { Search } from "lucide-react";
import { LeftSidebar } from "@/components/layout/LeftSidebar";
import { RightSidebar } from "@/components/layout/RightSidebar";
import { MobileNavigation } from "@/components/layout/MobileNavigation";
import { useAtom } from "jotai";
import {
	trendsAtom,
	trendsLoadedAtom,
	popularPostsAtom,
	popularPostsLoadedAtom,
	type TrendingTopic,
} from "@/store/trends.atom";

interface UserResult {
	userId: string;
	username: string;
	firstName: string;
	lastName: string;
	avatar: string;
	isVerified: boolean;
	isFollowing: boolean;
}

interface ExploreClientProps {
	initialResults: UserResult[];
	initialQuery: string;
	currentUserId: string;
}

export default function ExploreClient({
	initialResults,
	initialQuery,
	currentUserId,
}: ExploreClientProps) {
	const router = useRouter();
	const [query, setQuery] = useState(initialQuery);
	const [results, setResults] = useState<UserResult[]>(initialResults);
	const [searchLoading, setSearchLoading] = useState(false);

	// Explore data (trends + popular posts)
	const [trends, setTrends] = useAtom(trendsAtom);
	const [isTrendsLoaded, setIsTrendsLoaded] = useAtom(trendsLoadedAtom);
	const [popularPosts, setPopularPosts] = useAtom(popularPostsAtom);
	const [isPopularPostsLoaded, setIsPopularPostsLoaded] = useAtom(
		popularPostsLoadedAtom,
	);
	const [exploreLoading, setExploreLoading] = useState(
		!isTrendsLoaded || !isPopularPostsLoaded,
	);

	// Manual debounce for search
	const [debouncedQuery, setDebouncedQuery] = useState(query);

	useEffect(() => {
		const handler = setTimeout(() => {
			setDebouncedQuery(query);
		}, 500);

		return () => {
			clearTimeout(handler);
		};
	}, [query]);

	// Sync state with props when navigating via URL (e.g. clicking trend)
	useEffect(() => {
		setQuery(initialQuery);
		setDebouncedQuery(initialQuery);
		setResults(initialResults);
	}, [initialQuery, initialResults]);

	// Fetch explore data (trends + popular posts)
	useEffect(() => {
		const fetchExploreData = async () => {
			if (isTrendsLoaded && isPopularPostsLoaded) {
				setExploreLoading(false);
				return;
			}

			setExploreLoading(true);
			const res = await getExploreDataAction();
			if (res.success) {
				setTrends(res.data.trendsForYou);
				const mappedPopularPosts = res.data.popularTweets.map(
					(post: any) => ({
						...post,
						id: post._id,
					}),
				);
				setPopularPosts(mappedPopularPosts);
				setIsTrendsLoaded(true);
				setIsPopularPostsLoaded(true);
			}
			setExploreLoading(false);
		};

		fetchExploreData();
	}, [
		isTrendsLoaded,
		isPopularPostsLoaded,
		setTrends,
		setPopularPosts,
		setIsTrendsLoaded,
		setIsPopularPostsLoaded,
	]);

	const handleSearch = async (q: string) => {
		if (!q) {
			setResults([]);
			return;
		}
		setSearchLoading(true);
		const res = await searchUsersAction(q);
		if (res.success) {
			setResults(res.data);
		}
		setSearchLoading(false);
	};

	// Update URL on debounce
	useEffect(() => {
		if (debouncedQuery !== initialQuery) {
			const params = new URLSearchParams();
			if (debouncedQuery) {
				params.set("q", debouncedQuery);
				router.replace(`/explore?${params.toString()}`);
				handleSearch(debouncedQuery);
			} else {
				router.replace("/explore");
				setResults([]);
			}
		}
	}, [debouncedQuery, router, initialQuery]);

	const isSearching = query.length > 0;

	return (
		<main className="min-h-screen bg-black text-white">
			<MobileNavigation />
			<div className="max-w-[1265px] mx-auto flex justify-center min-h-screen">
				<LeftSidebar />

				<div className="w-full max-w-[600px] sm:border-x border-zinc-800 min-h-screen pt-4 md:pt-0">
					{/* Search Header */}
					<div className="p-4 border-b border-zinc-800 sticky top-0 bg-black/80 backdrop-blur-md z-10">
						<div className="relative group">
							<div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
								<Search className="h-5 w-5 text-zinc-500 group-focus-within:text-primary transition-colors" />
							</div>
							<input
								type="text"
								className="block w-full pl-10 pr-3 py-3 rounded-full bg-zinc-900 border-none text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all font-sans"
								placeholder="Search WorldStreet"
								value={query}
								onChange={(e) => setQuery(e.target.value)}
							/>
						</div>
					</div>

					{isSearching ? (
						/* ── Search Results View ── */
						<div className="flex flex-col">
							{searchLoading && (
								<div className="p-8 text-center text-zinc-500">
									Searching...
								</div>
							)}

							{!searchLoading && results.length === 0 && query && (
								<div className="p-8 text-center flex flex-col items-center">
									<span className="text-zinc-500 mb-2">
										No results for &quot;{query}&quot;
									</span>
									<span className="text-zinc-600 text-sm">
										Try searching for people or topics
									</span>
								</div>
							)}

							{results.map((user) => (
								<Link
									key={user.userId}
									href={`/profile/${user.username}`}
									className="flex items-center gap-3 px-4 py-4 hover:bg-zinc-900/50 transition-colors border-b border-zinc-800/50"
								>
									<div className="relative w-10 h-10 rounded-full overflow-hidden shrink-0 bg-zinc-800">
										<Image
											src={
												user.avatar ||
												"https://upload.wikimedia.org/wikipedia/commons/7/7c/Profile_avatar_placeholder_large.png"
											}
											alt={user.username}
											fill
											className="object-cover"
										/>
									</div>
									<div className="flex flex-col">
										<div className="flex items-center gap-1">
											<span className="font-bold text-white text-[15px] hover:underline font-sans">
												{user.firstName} {user.lastName}
											</span>
											{user.isVerified && (
												<VerifiedIcon color="blue" />
											)}
										</div>
										<span className="text-zinc-500 text-[14px] leading-4">
											@{user.username}
										</span>
									</div>
								</Link>
							))}
						</div>
					) : (
						/* ── Default Explore View: Trends + Popular Posts ── */
						<div className="flex flex-col">
							{/* Trending Topics */}
							<div className="border-b border-zinc-800 pb-2">
								<h2 className="px-4 py-3 text-xl font-bold font-sans text-white">
									Trends for you
								</h2>
								<div className="flex flex-col">
									{exploreLoading ? (
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
												onClick={() =>
													setQuery(
														topic.title.replace(
															"#",
															"",
														),
													)
												}
												onKeyDown={(e) => {
													if (e.key === "Enter")
														setQuery(
															topic.title.replace(
																"#",
																"",
															),
														);
												}}
												role="button"
												tabIndex={0}
											>
												<div className="flex justify-between items-start">
													<div className="text-xs text-zinc-500 font-sans">
														{topic.category}
													</div>
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
								{!exploreLoading && trends.length > 0 && (
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
								{exploreLoading ? (
									[...Array(3)].map((_, i) => (
										<PostSkeleton key={i} />
									))
								) : popularPosts.length > 0 ? (
									popularPosts.map((post) => (
										<div
											key={post.id}
											className="border-b border-zinc-800"
										>
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
					)}
				</div>

				<RightSidebar />
			</div>
		</main>
	);
}
