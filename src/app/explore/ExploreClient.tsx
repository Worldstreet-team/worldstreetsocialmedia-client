"use client";

import { useState, useEffect, useCallback } from "react";
import { searchUsersAction } from "@/lib/user.actions";
import {
	getExploreDataAction,
	searchPostsAction,
} from "@/lib/post.actions";
import { PostCard, type PostProps } from "@/components/feed/PostCard";
import { PostSkeleton } from "@/components/feed/PostSkeleton";
import Image from "next/image";
import Link from "next/link";
import VerifiedIcon from "@/assets/icons/VerifiedIcon";
import { Search } from "lucide-react";
import { LeftSidebar } from "@/components/layout/LeftSidebar";
import { RightSidebar } from "@/components/layout/RightSidebar";
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

type SearchTab = "users" | "posts";

export default function ExploreClient({
	initialResults,
	initialQuery,
	currentUserId,
}: ExploreClientProps) {
	const [query, setQuery] = useState(initialQuery);
	const [activeTab, setActiveTab] = useState<SearchTab>("users");

	// User search state
	const [userResults, setUserResults] = useState<UserResult[]>(initialResults);
	const [usersLoading, setUsersLoading] = useState(false);

	// Post search state
	const [postResults, setPostResults] = useState<PostProps[]>([]);
	const [postsLoading, setPostsLoading] = useState(false);

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

	// Search functions
	const searchUsers = useCallback(async (q: string) => {
		setUsersLoading(true);
		try {
			const res = await searchUsersAction(q);
			if (res.success) {
				setUserResults(res.data);
			} else {
				setUserResults([]);
			}
		} catch {
			setUserResults([]);
		} finally {
			setUsersLoading(false);
		}
	}, []);

	const searchPosts = useCallback(async (q: string) => {
		setPostsLoading(true);
		try {
			const res = await searchPostsAction(q);
			if (res.success) {
				const mapped = res.data.map((post: any) => ({
					id: post._id,
					author: {
						id: post.author._id || post.author.userId,
						name:
							post.author.firstName && post.author.lastName
								? `${post.author.firstName} ${post.author.lastName}`
								: post.author.username || "Unknown",
						username: post.author.username,
						avatar:
							post.author.avatar ||
							"https://upload.wikimedia.org/wikipedia/commons/7/7c/Profile_avatar_placeholder_large.png",
						isVerified: post.author.isVerified,
					},
					content: post.content,
					images: post.images,
					timestamp: new Date(post.createdAt).toLocaleDateString(),
					stats: post.stats,
					isLiked: post.isLiked,
					isBookmarked: post.isBookmarked,
				}));
				setPostResults(mapped);
			} else {
				setPostResults([]);
			}
		} catch {
			setPostResults([]);
		} finally {
			setPostsLoading(false);
		}
	}, []);

	// Debounced search: fires both user + post searches
	useEffect(() => {
		const trimmed = query.trim();

		if (!trimmed) {
			setUserResults([]);
			setPostResults([]);
			setUsersLoading(false);
			setPostsLoading(false);
			window.history.replaceState(null, "", "/explore");
			return;
		}

		setUsersLoading(true);
		setPostsLoading(true);

		const handler = setTimeout(() => {
			window.history.replaceState(
				null,
				"",
				`/explore?q=${encodeURIComponent(trimmed)}`,
			);
			searchUsers(trimmed);
			searchPosts(trimmed);
		}, 400);

		return () => {
			clearTimeout(handler);
		};
	}, [query, searchUsers, searchPosts]);

	const isSearching = query.trim().length > 0;

	return (
		<main className="min-h-screen bg-black text-white">
			<div className="max-w-[1265px] mx-auto flex justify-center min-h-screen">
				<LeftSidebar />

				<div className="w-full max-w-[600px] sm:border-x border-zinc-800 min-h-screen pt-4 md:pt-0">
					{/* Search Header */}
					<div className="sticky top-0 bg-black/80 backdrop-blur-md z-10">
						<div className="p-4 border-b border-zinc-800">
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

						{/* Tabs - only show when searching */}
						{isSearching && (
							<div className="flex border-b border-zinc-800">
								<button
									onClick={() => setActiveTab("users")}
									className={`flex-1 py-3 text-sm font-bold font-sans transition-colors relative cursor-pointer ${
										activeTab === "users"
											? "text-white"
											: "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/50"
									}`}
								>
									Users
									{activeTab === "users" && (
										<div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-14 h-1 bg-yellow-500 rounded-full" />
									)}
								</button>
								<button
									onClick={() => setActiveTab("posts")}
									className={`flex-1 py-3 text-sm font-bold font-sans transition-colors relative cursor-pointer ${
										activeTab === "posts"
											? "text-white"
											: "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/50"
									}`}
								>
									Posts
									{activeTab === "posts" && (
										<div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-14 h-1 bg-yellow-500 rounded-full" />
									)}
								</button>
							</div>
						)}
					</div>

					{isSearching ? (
						/* ── Search Results View ── */
						<div className="flex flex-col">
							{activeTab === "users" ? (
								/* Users Tab */
								<>
									{usersLoading && (
										<div className="p-8 text-center text-zinc-500 font-sans">
											Searching users...
										</div>
									)}

									{!usersLoading &&
										userResults.length === 0 &&
										query.trim() && (
											<div className="p-8 text-center flex flex-col items-center">
												<span className="text-zinc-500 mb-2 font-sans">
													No users found for &quot;{query.trim()}&quot;
												</span>
												<span className="text-zinc-600 text-sm font-sans">
													Try a different name or username
												</span>
											</div>
										)}

									{!usersLoading &&
										userResults.map((user) => (
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
															{user.firstName}{" "}
															{user.lastName}
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
								</>
							) : (
								/* Posts Tab */
								<>
									{postsLoading && (
										<div className="flex flex-col">
											{[...Array(3)].map((_, i) => (
												<PostSkeleton key={i} />
											))}
										</div>
									)}

									{!postsLoading &&
										postResults.length === 0 &&
										query.trim() && (
											<div className="p-8 text-center flex flex-col items-center">
												<span className="text-zinc-500 mb-2 font-sans">
													No posts found for &quot;{query.trim()}&quot;
												</span>
												<span className="text-zinc-600 text-sm font-sans">
													Try different keywords
												</span>
											</div>
										)}

									{!postsLoading &&
										postResults.map((post) => (
											<div
												key={post.id}
												className="border-b border-zinc-800"
											>
												<PostCard post={post} />
											</div>
										))}
								</>
							)}
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
											<Link
												href={`/explore?q=${topic.title.replace("#", "")}`}
												key={i}
												className="px-4 py-3 hover:bg-zinc-900/50 cursor-pointer transition-colors border-b border-zinc-800/50 last:border-0"
												onClick={(e) => {
													e.preventDefault();
													setQuery(
														topic.title.replace(
															"#",
															"",
														),
													);
													setActiveTab("posts");
												}}
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
											</Link>
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
