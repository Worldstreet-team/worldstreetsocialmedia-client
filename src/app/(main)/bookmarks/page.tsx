"use client";

import { useEffect } from "react";
import { PostCard, type PostProps } from "@/components/feed/PostCard";
import { PostSkeleton } from "@/components/feed/PostSkeleton";
import { getBookmarksAction } from "@/lib/post.actions";
import { useAtom, useAtomValue } from "jotai";
import { userAtom } from "@/store/user.atom";
import { bookmarksAtom, bookmarksLoadedAtom } from "@/store/bookmarks.atom";
import { Bookmark } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";

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
			<header className="sticky top-0 z-sticky bg-page border-b border-hairline">
				<div className="px-4 py-3">
					<h1 className="font-display text-lg font-semibold text-primary">
						Bookmarks
					</h1>
					<div className="text-muted text-[13px] font-sans">
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
						<PostCard key={post.id} post={post} />
					))
				) : (
					<div className="py-10">
						<EmptyState
							icon={Bookmark}
							title="Save posts for later"
							caption="Tap the bookmark on any post and it lands here — only you can see your bookmarks."
						/>
					</div>
				)}
			</div>
		</div>
	);
}
