"use client";

import { useEffect } from "react";
import { PostCard, type PostProps } from "@/components/feed/PostCard";
import { PostSkeleton } from "@/components/feed/PostSkeleton";
import { getBookmarksAction } from "@/lib/post.actions";
import { useAtom, useAtomValue } from "jotai";
import { userAtom } from "@/store/user.atom";
import { bookmarksAtom, bookmarksLoadedAtom } from "@/store/bookmarks.atom";
import { Bookmark } from "lucide-react";

export default function BookmarksPage() {
	const [bookmarks, setBookmarks] = useAtom(bookmarksAtom);
	const [isLoaded, setIsLoaded] = useAtom(bookmarksLoadedAtom);
	const user = useAtomValue(userAtom);

	useEffect(() => {
		if (isLoaded) return;

		const fetchBookmarks = async () => {
			try {
				const res = await getBookmarksAction();
				if (res.success) {
					setBookmarks(res.data);
					setIsLoaded(true);
				}
			} catch (error) {
				console.error("Failed to fetch bookmarks:", error);
			}
		};

		fetchBookmarks();
	}, [isLoaded, setBookmarks, setIsLoaded]);

	return (
		<div className="flex flex-col min-h-screen pb-20">
			<header className="sticky top-0 z-20 bg-black/80 backdrop-blur-md border-b border-zinc-800">
				<div className="px-4 py-3">
					<h1 className="text-xl font-bold font-sans text-white">
						Bookmarks
					</h1>
					<div className="text-zinc-500 text-[13px] font-sans">
						@{user?.username}
					</div>
				</div>
			</header>

			<div className="flex flex-col">
				{!isLoaded ? (
					<div className="flex flex-col">
						{[...Array(5)].map((_, i) => (
							<PostSkeleton key={i} />
						))}
					</div>
				) : bookmarks.length > 0 ? (
					bookmarks.map((post) => (
						<div key={post.id} className="border-b border-zinc-800">
							<PostCard post={post} />
						</div>
					))
				) : (
					<div className="p-12 text-center flex flex-col items-center justify-center">
						<div className="w-16 h-16 bg-zinc-900 rounded-full flex items-center justify-center mb-4">
							<Bookmark className="w-8 h-8 text-zinc-500" />
						</div>
						<h2 className="text-xl font-bold mb-2 text-white font-sans">
							Save posts for later
						</h2>
						<p className="text-zinc-500 text-sm max-w-sm font-sans">
							Bookmark posts to easily find them again in the future.
						</p>
					</div>
				)}
			</div>
		</div>
	);
}
