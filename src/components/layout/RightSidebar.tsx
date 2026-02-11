"use client";

import { useEffect, useState } from "react";
import { getWhoToFollowAction, followUserAction } from "@/lib/user.actions";
import Link from "next/link";

interface UserSuggestion {
	_id: string;
	firstName: string;
	lastName: string;
	username: string;
	avatar: string;
}

export function RightSidebar() {
	const [suggestions, setSuggestions] = useState<UserSuggestion[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		const fetchSuggestions = async () => {
			const res = await getWhoToFollowAction();
			if (res.success && Array.isArray(res.data)) {
				setSuggestions(res.data);
			}
			setLoading(false);
		};
		fetchSuggestions();
	}, []);

	const handleFollow = async (userId: string) => {
		// Optimistic update: remove from list
		setSuggestions((prev) => prev.filter((u) => u._id !== userId));

		const res = await followUserAction(userId);
		if (!res.success) {
			// Re-fetch or specific error handling if needed, but for sidebar simply ignoring is often acceptable or simple toast
			console.error("Failed to follow user");
		}
	};

	return (
		<aside className="w-[350px] hidden lg:flex flex-col gap-4 p-3 sticky top-0 h-screen overflow-y-auto no-scrollbar">
			{/* <div className="sticky top-0 bg-white pb-2 z-10">
				<div className="relative group">
					<span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-text-light !text-[20px] group-focus-within:text-primary">
						search
					</span>
					<input
						className="w-full bg-[#eff3f4] border-none rounded-full py-3 pl-12 pr-4 focus:ring-1 focus:ring-primary focus:bg-white transition-all text-[15px]"
						placeholder="Search"
						type="text"
					/>
				</div>
			</div> */}
			<section className="bg-[#f7f9fa] rounded-2xl overflow-hidden">
				<h3 className="text-[17px] font-extrabold px-4 py-3">
					What's happening
				</h3>
				<div className="flex flex-col">
					<div className="px-4 py-3 hover:bg-black/3 transition-colors cursor-pointer">
						<div className="flex justify-between text-[13px] text-text-light">
							<span>Trending in Technology</span>
							<span className="material-symbols-outlined text-[18px]!">
								more_horiz
							</span>
						</div>
						<p className="font-bold text-[15px]">#WebDev2024</p>
						<p className="text-[13px] text-text-light">12.5K posts</p>
					</div>
					<div className="px-4 py-3 hover:bg-black/3 transition-colors cursor-pointer">
						<div className="flex justify-between text-[13px] text-text-light">
							<span>Design · Trending</span>
							<span className="material-symbols-outlined !text-[18px]">
								more_horiz
							</span>
						</div>
						<p className="font-bold text-[15px]">Figma AI</p>
						<p className="text-[13px] text-text-light">5,821 posts</p>
					</div>
					<button
						className="text-primary text-[15px] p-4 text-left hover:bg-black/3 transition-colors"
						type="button"
					>
						Show more
					</button>
				</div>
			</section>

			{/* Who to Follow Section */}
			<section className="bg-[#f7f9fa] rounded-2xl overflow-hidden">
				<h3 className="text-[17px] font-extrabold px-4 py-3">Who to follow</h3>
				<div className="flex flex-col">
					{loading ? (
						<div className="px-4 py-4 text-center text-text-light text-sm">
							Loading suggestions...
						</div>
					) : suggestions.length === 0 ? (
						<div className="px-4 py-4 text-center text-text-light text-sm">
							No suggestions available
						</div>
					) : (
						suggestions.slice(0, 3).map((user) => (
							<Link
								href={`/profile/${user.username}`}
								key={user._id}
								className="flex items-center gap-3 px-4 py-3 hover:bg-black/3 transition-colors cursor-pointer"
							>
								<div
									className="w-8 h-8 rounded-full bg-cover bg-center shrink-0"
									style={{
										backgroundImage: `url('${user.avatar || "https://upload.wikimedia.org/wikipedia/commons/7/7c/Profile_avatar_placeholder_large.png"}')`,
									}}
								/>
								<div className="flex flex-col flex-1 min-w-0">
									<span className="font-bold truncate text-[14px] hover:underline">
										{user.firstName && user.lastName
											? `${user.firstName} ${user.lastName}`
											: user.username}
									</span>
									<span className="text-text-light text-[12px] truncate">
										@{user.username}
									</span>
								</div>
								<button
									className="bg-black text-white px-4 py-1.5 rounded-full text-[14px] font-bold hover:bg-black/80 transition-colors z-10"
									onClick={(e) => {
										e.preventDefault();
										e.stopPropagation();
										handleFollow(user._id);
									}}
									type="button"
								>
									Follow
								</button>
							</Link>
						))
					)}
					{/* <button
						className="text-primary text-[15px] p-4 text-left hover:bg-black/3 transition-colors"
						type="button"
					>
						Show more
					</button> */}
				</div>
			</section>
			<footer className="flex flex-col gap-y-3 px-6 py-8 text-[14px] text-zinc-500 w-fit">
				<nav className="flex flex-col gap-y-2">
					<a
						href="https://dashboard.worldstreetgold.com/"
						className="hover:text-zinc-900 transition-colors duration-200"
					>
						WorldStreet Gold
					</a>
					<a
						href="https://academy.worldstreetgold.com/"
						className="hover:text-zinc-900 transition-colors duration-200"
					>
						Academy
					</a>
					<a
						href="https://shop.worldstreetgold.com/"
						className="hover:text-zinc-900 transition-colors duration-200"
					>
						Shop
					</a>
					<a
						href="https://xtreme.worldstreetgold.com/"
						className="hover:text-zinc-900 transition-colors duration-200"
					>
						XTreme
					</a>
				</nav>

				<div className="mt-4 pt-4 border-t border-zinc-100 text-[12px] text-zinc-400">
					© 2026 World Street Group
				</div>
			</footer>
		</aside>
	);
}
