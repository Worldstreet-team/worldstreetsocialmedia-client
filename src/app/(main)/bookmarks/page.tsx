"use client";

import { useEffect, useState } from "react";
import { PostCard, type PostProps } from "@/components/feed/PostCard";
import { getBookmarksAction } from "@/lib/post.actions";
import { useAtomValue } from "jotai";
import { userAtom } from "@/store/user.atom";

export default function BookmarksPage() {
	const [bookmarks, setBookmarks] = useState<PostProps[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const user = useAtomValue(userAtom);

	useEffect(() => {
		const fetchBookmarks = async () => {
			try {
				const res = await getBookmarksAction();
				if (res.success) {
					setBookmarks(res.data);
				}
			} catch (error) {
				console.error("Failed to fetch bookmarks:", error);
			} finally {
				setIsLoading(false);
			}
		};

		fetchBookmarks();
	}, []);

	return (
		<div className="flex flex-col min-h-screen">
			<header className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-black/10">
				<div className="px-4 py-3">
					<h1 className="text-xl font-bold">Bookmarks</h1>
					<div className="text-text-light text-[13px]">@{user?.username}</div>
				</div>
			</header>

			<div className="flex flex-col">
				{isLoading ? (
					<div className="flex justify-center p-8">
						<svg
							className="animate-spin h-6 w-6 text-text-light"
							xmlns="http://www.w3.org/2000/svg"
							fill="none"
							viewBox="0 0 24 24"
						>
							<title>Icon</title>
							<circle
								className="opacity-25"
								cx="12"
								cy="12"
								r="10"
								stroke="currentColor"
								strokeWidth="4"
							/>
							<path
								className="opacity-75"
								fill="currentColor"
								d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
							/>
						</svg>
					</div>
				) : bookmarks.length > 0 ? (
					bookmarks.map((post) => <PostCard key={post.id} post={post} />)
				) : (
					<div className="p-8 text-center">
						<h2 className="text-2xl font-bold mb-2">Save posts for later</h2>
						<p className="text-text-light">
							Bookmark posts to easily find them again in the future.
						</p>
					</div>
				)}
			</div>
		</div>
	);
}
