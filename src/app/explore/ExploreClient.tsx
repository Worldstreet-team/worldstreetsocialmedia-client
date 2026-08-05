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
import { EmptyState } from "@/components/ui/EmptyState";
import { formatTimeAgo } from "@/lib/utils";
import { DEFAULT_AVATAR } from "@/const";
import { LeftSidebar } from "@/components/layout/LeftSidebar";
import { RightSidebar } from "@/components/layout/RightSidebar";
import { useAtom } from "jotai";
import {
	trendsAtom,
	trendsLoadedAtom,
	popularPostsAtom,
	popularPostsLoadedAtom,
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
				const mappedPopularPosts = (res.data.popularTweets ?? []).map(
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
							post.author.avatar || DEFAULT_AVATAR,
						isVerified: post.author.isVerified,
					},
					content: post.content,
					images: post.images,
					timestamp: formatTimeAgo(post.createdAt),
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
		<main className="min-h-dvh bg-page text-primary">
			<div className="max-w-[1265px] mx-auto flex justify-center min-h-dvh">
				<LeftSidebar />

				{/* pb-nav: /explore has no mobile header but the fixed bottom nav is
				    on screen here, so the last row needs clearance to be reachable. */}
				<div className="w-full min-w-0 max-w-[600px] sm:border-x border-hairline min-h-dvh pt-4 md:pt-0 pb-nav md:pb-0">
					{/* Search Header */}
					<div className="sticky top-0 bg-page z-sticky">
						<div className="p-4 border-b border-hairline">
							<div className="relative group">
								<div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
									<Search className="h-5 w-5 text-subtle group-focus-within:text-primary transition-colors" />
								</div>
								<input
									type="text"
									// text-base (16px) on mobile: anything smaller makes iOS
									// Safari zoom the whole page in on focus. Desktop keeps 15.
									className="block w-full pl-10 pr-3 py-3 rounded-pill bg-surface border border-hairline text-primary placeholder:text-subtle focus:outline-none focus:border-brand/60 transition-colors font-sans text-base sm:text-[15px]"
									placeholder="Search WorldStreet"
									value={query}
									onChange={(e) => setQuery(e.target.value)}
								/>
							</div>
						</div>

						{/* Tabs - only show when searching */}
						{isSearching && (
							<div className="flex border-b border-hairline">
								<button
									onClick={() => setActiveTab("users")}
									className={`flex-1 py-3 text-sm font-bold font-sans transition-colors relative cursor-pointer ${
										activeTab === "users"
											? "text-primary"
											: "text-muted hover:text-primary hover:bg-surface"
									}`}
								>
									Users
									{activeTab === "users" && (
										<div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-14 h-0.5 bg-brand rounded-pill" />
									)}
								</button>
								<button
									onClick={() => setActiveTab("posts")}
									className={`flex-1 py-3 text-sm font-bold font-sans transition-colors relative cursor-pointer ${
										activeTab === "posts"
											? "text-primary"
											: "text-muted hover:text-primary hover:bg-surface"
									}`}
								>
									Posts
									{activeTab === "posts" && (
										<div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-14 h-0.5 bg-brand rounded-pill" />
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
										<div className="p-8 text-center text-muted font-sans">
											Searching users...
										</div>
									)}

									{!usersLoading &&
										userResults.length === 0 &&
										query.trim() && (
											<EmptyState
												icon={Search}
												title={`No people match "${query.trim()}"`}
												caption="Check the spelling, or try a name or username."
											/>
										)}

									{!usersLoading &&
										userResults.map((user) => (
											<Link
												key={user.userId}
												href={`/profile/${user.username}`}
												className="flex items-center gap-3 px-4 py-4 hover:bg-surface transition-colors border-b border-hairline/50"
											>
												<div className="relative w-10 h-10 rounded-full overflow-hidden shrink-0 bg-raised">
													<Image
														src={
															user.avatar ||
															DEFAULT_AVATAR
														}
														alt={user.username}
														fill
														className="object-cover"
													/>
												</div>
												<div className="flex flex-col min-w-0">
													<div className="flex items-center gap-1 min-w-0">
														<span className="font-semibold text-primary text-[15px] hover:underline font-sans truncate">
															{user.firstName}{" "}
															{user.lastName}
														</span>
														{user.isVerified && (
															<span className="shrink-0">
																<VerifiedIcon size={{ width: "16", height: "16" }} />
															</span>
														)}
													</div>
													<span className="text-muted text-[14px] leading-4 truncate">
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
											<EmptyState
												icon={Search}
												title={`No posts match "${query.trim()}"`}
												caption="Try different keywords, a $ticker or a #hashtag."
											/>
										)}

									{!postsLoading &&
										postResults.map((post) => (
											<div
												key={post.id}
												className="border-b border-hairline"
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
							<div className="border-b border-hairline pb-2">
								<h2 className="px-4 py-3 font-display text-lg font-semibold text-primary">
									Trends for you
								</h2>
								<div className="flex flex-col">
									{exploreLoading ? (
										[...Array(5)].map((_, i) => (
											<div
												key={i}
												className="px-4 py-3 border-b border-hairline/50 last:border-0"
											>
												<div className="h-3 w-24 skeleton rounded-sm mb-2" />
												<div className="h-4 w-40 skeleton rounded-sm mb-1" />
												<div className="h-3 w-16 skeleton rounded-sm" />
											</div>
										))
									) : trends.length > 0 ? (
										trends.map((topic, i) => (
											<Link
												href={`/explore?q=${topic.title.replace("#", "")}`}
												key={i}
												className="px-4 py-3 hover:bg-surface cursor-pointer transition-colors border-b border-hairline/50 last:border-0"
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
													<div className="text-xs text-muted font-sans">
														{topic.category}
													</div>
												</div>
												<div className="font-semibold text-[15px] my-0.5 text-primary font-sans tracking-tight">
													{topic.title}
												</div>
												<div className="text-xs text-muted font-sans">
													{topic.posts}
												</div>
											</Link>
										))
									) : (
										<div className="px-4 py-8 text-muted text-center font-sans text-sm">
											No trending topics yet.
										</div>
									)}
								</div>
							</div>

							{/* Popular Posts */}
							<div className="flex flex-col">
								<h2 className="px-4 py-4 font-display text-lg font-semibold border-b border-hairline text-primary">
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
											className="border-b border-hairline"
										>
											<PostCard post={post} />
										</div>
									))
								) : (
									<div className="p-12 text-center text-muted font-sans text-sm">
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
