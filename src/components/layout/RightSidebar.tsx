"use client";

import { useEffect, useState } from "react";
import { getWhoToFollowAction, followUserAction } from "@/lib/user.actions";
import Link from "next/link";
import Image from "next/image";
import { Search, MoreHorizontal } from "lucide-react";
import { useToast } from "@/components/ui/Toast/ToastContext";
import clsx from "clsx";
import { useAtom } from "jotai";
import {
	suggestionsAtom,
	suggestionsLoadedAtom,
	type UserSuggestion,
} from "@/store/suggestions.atom";
import {
	trendsAtom,
	trendsLoadedAtom,
	type TrendingTopic,
} from "@/store/trends.atom";
import { getExploreDataAction } from "@/lib/post.actions";

export function RightSidebar() {
	const [suggestions, setSuggestions] = useAtom(suggestionsAtom);
	const [isSuggestionsLoaded, setIsSuggestionsLoaded] = useAtom(
		suggestionsLoadedAtom,
	);
	const [trends, setTrends] = useAtom(trendsAtom);
	const [isTrendsLoaded, setIsTrendsLoaded] = useAtom(trendsLoadedAtom);

	// Loading is true if either is not loaded
	const [loading, setLoading] = useState(
		!isSuggestionsLoaded || !isTrendsLoaded,
	);
	const { toast } = useToast();
	const [followedIds, setFollowedIds] = useState<string[]>([]);

	useEffect(() => {
		const fetchData = async () => {
			// Fetch Suggestions if needed
			if (!isSuggestionsLoaded) {
				const res = await getWhoToFollowAction();
				if (res.success && Array.isArray(res.data)) {
					setSuggestions(res.data);
					setIsSuggestionsLoaded(true);
				}
			}

			// Fetch Trends if needed
			if (!isTrendsLoaded) {
				try {
					const res = await getExploreDataAction();
					if (res.success) {
						setTrends(res.data.trendsForYou);
					}
				} catch (error) {
					console.error("Failed to fetch trends", error);
				} finally {
					setIsTrendsLoaded(true);
				}
			}
			setLoading(false);
		};
		fetchData();
	}, [
		isSuggestionsLoaded,
		setSuggestions,
		setIsSuggestionsLoaded,
		isTrendsLoaded,
		setTrends,
		setIsTrendsLoaded,
	]);

	const handleFollow = async (userId: string) => {
		// Optimistic update
		setFollowedIds((prev) => [...prev, userId]);
		toast("Following user", { type: "success" });

		const res = await followUserAction(userId);
		if (!res.success) {
			setFollowedIds((prev) => prev.filter((id) => id !== userId));
			toast("Failed to follow", { type: "error" });
		}
	};

	// Filter out followed users from display
	const visibleSuggestions = suggestions.filter(
		(u) => !followedIds.includes(u._id),
	);

	return (
		<aside className="w-[350px] hidden lg:flex flex-col gap-6 sticky top-0 h-screen p-4 pl-8 overflow-y-auto no-scrollbar">
			{/* Search Bar - Pill Shaped */}
			<div className="relative group mt-2">
				<Search className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-500 w-5 h-5 group-focus-within:text-yellow-500 transition-colors" />
				<input
					type="text"
					placeholder="Search Feed..."
					className="w-full bg-zinc-900 border-none text-white rounded-full py-3.5 pl-14 pr-6 font-sans text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500/50 transition-all placeholder:text-zinc-600 shadow-inner"
				/>
			</div>

			{/* Trending Section - Card */}
			<section className="bg-zinc-900 rounded-3xl overflow-hidden p-2">
				<h3 className="font-black text-white px-4 py-4 font-sans text-lg">
					What's happening
				</h3>
				<div className="flex flex-col gap-1">
					{!isTrendsLoaded ? (
						// Shimmer Loading State
						[1, 2, 3].map((i) => (
							<div key={i} className="px-4 py-3 animate-pulse">
								<div className="flex justify-between mb-1">
									<div className="h-3 bg-zinc-800 rounded w-24" />
								</div>
								<div className="h-4 bg-zinc-800 rounded w-3/4 mb-1.5" />
								<div className="h-3 bg-zinc-800 rounded w-12" />
							</div>
						))
					) : trends.length > 0 ? (
						trends.slice(0, 3).map((trend, i) => (
							<Link
								href={`/explore?q=${trend.title.replace("#", "")}`}
								key={i}
								className="px-4 py-3 hover:bg-zinc-800 rounded-2xl transition-all cursor-pointer group block"
							>
								<div className="flex justify-between text-[11px] text-zinc-500 font-sans mb-1">
									<span>{trend.category} · Trending</span>
									<MoreHorizontal className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
								</div>
								<p className="font-bold text-white text-[15px] mb-0.5">
									{trend.title}
								</p>
								<p className="text-[11px] text-zinc-500 font-sans">
									{trend.posts}
								</p>
							</Link>
						))
					) : (
						<div className="px-4 py-3 text-sm text-zinc-500 font-sans">
							No trends available
						</div>
					)}
					<Link
						href="/explore"
						className="text-pink-500 text-xs font-bold font-sans hover:underline px-4 py-3 text-left block"
					>
						Show more
					</Link>
				</div>
			</section>

			{/* Who to Follow Section - Card */}
			<section className="bg-zinc-900 rounded-3xl overflow-hidden p-2">
				<h3 className="font-black text-white px-4 py-4 font-sans text-lg">
					Who to follow
				</h3>
				<div className="flex flex-col gap-2 -mt-1.5">
					{loading && visibleSuggestions.length === 0 ? (
						<div className="flex flex-col gap-4 p-4">
							{[1, 2, 3].map((i) => (
								<div key={i} className="flex gap-3 animate-pulse">
									<div className="w-10 h-10 bg-zinc-800 rounded-full" />
									<div className="flex-1 space-y-2 py-1">
										<div className="h-3 bg-zinc-800 rounded w-24" />
										<div className="h-2 bg-zinc-800 rounded w-16" />
									</div>
								</div>
							))}
						</div>
					) : visibleSuggestions.length === 0 ? (
						<div className="px-5 py-6 text-center text-zinc-500 text-sm font-sans">
							No suggestions available
						</div>
					) : (
						visibleSuggestions.slice(0, 3).map((user) => (
							<Link
								href={`/profile/${user.username}`}
								key={user._id}
								className="flex items-center gap-3 px-3 py-2.5 hover:bg-zinc-800 rounded-2xl transition-all cursor-pointer group"
							>
								<div className="relative w-10 h-10 rounded-full overflow-hidden border border-zinc-800 shrink-0">
									<Image
										src={
											user.avatar ||
											`https://ui-avatars.com/api/?name=${user.firstName}+${user.lastName}&background=random`
										}
										alt={user.username}
										fill
										className="object-cover"
									/>
								</div>
								<div className="flex flex-col flex-1 min-w-0">
									<span className="font-bold text-white text-sm truncate group-hover:text-yellow-500 transition-colors">
										{user.firstName} {user.lastName}
									</span>
									<span className="text-zinc-600 text-[11px] truncate font-sans group-hover:text-zinc-500">
										@{user.username}
									</span>
								</div>
								<button
									onClick={(e) => {
										e.preventDefault();
										e.stopPropagation();
										handleFollow(user._id);
									}}
									className="px-4 py-2 bg-white text-black text-xs font-bold rounded-full font-sans hover:scale-105 active:scale-95 transition-all shadow-lg hover:shadow-xl"
									type="button"
								>
									Follow
								</button>
							</Link>
						))
					)}
				</div>
			</section>

			<footer className="px-4 mt-2">
				<nav className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-zinc-600 font-sans">
					{[
						"Terms",
						"Privacy",
						"Cookies",
						"More",
						"© 2026 WorldStreet Group",
					].map((item) => (
						<a
							key={item}
							href="#"
							className="hover:text-zinc-400 transition-colors"
						>
							{item}
						</a>
					))}
				</nav>
			</footer>
		</aside>
	);
}
