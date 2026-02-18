"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { searchUsersAction } from "@/lib/user.actions";
import Image from "next/image";
import Link from "next/link";
import VerifiedIcon from "@/assets/icons/VerifiedIcon";
import { Search } from "lucide-react";
import { LeftSidebar } from "@/components/layout/LeftSidebar";
import { RightSidebar } from "@/components/layout/RightSidebar";
import { MobileNavigation } from "@/components/layout/MobileNavigation";

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
	const [loading, setLoading] = useState(false);

	// Manual debounce to avoid external dependency issues
	const [debouncedQuery, setDebouncedQuery] = useState(query);

	useEffect(() => {
		const handler = setTimeout(() => {
			setDebouncedQuery(query);
		}, 500);

		return () => {
			clearTimeout(handler);
		};
	}, [query]);

	const handleSearch = async (q: string) => {
		if (!q) {
			setResults([]);
			return;
		}
		setLoading(true);
		const res = await searchUsersAction(q);
		if (res.success) {
			setResults(res.data);
		}
		setLoading(false);
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

					{/* Results */}
					<div className="flex flex-col">
						{loading && (
							<div className="p-8 text-center text-zinc-500">Searching...</div>
						)}

						{!loading && results.length === 0 && query && (
							<div className="p-8 text-center flex flex-col items-center">
								<span className="text-zinc-500 mb-2">
									No results for "{query}"
								</span>
								<span className="text-zinc-600 text-sm">
									Try searching for people or topics
								</span>
							</div>
						)}

						{!loading && results.length === 0 && !query && (
							<div className="p-12 text-center flex flex-col items-center">
								<h2 className="text-xl font-bold mb-2 font-sans">
									Explore WorldStreet
								</h2>
								<p className="text-zinc-500">
									Search for users, friends, and more.
								</p>
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
										{user.isVerified && <VerifiedIcon color="blue" />}
									</div>
									<span className="text-zinc-500 text-[14px] leading-4">
										@{user.username}
									</span>
								</div>
							</Link>
						))}
					</div>
				</div>

				<RightSidebar />
			</div>
		</main>
	);
}
