"use client";

import { useEffect } from "react";
import { AnimatePresence, motion, useIsPresent } from "framer-motion";
import { PostCard, type PostProps } from "@/components/feed/PostCard";
import { ImpressionSensor } from "@/components/feed/ImpressionSensor";
import { PostSkeleton } from "@/components/feed/PostSkeleton";
import { useGatewayRead } from "@/hooks/useGateway";
import { useAtom, useAtomValue } from "jotai";
import { userAtom } from "@/store/user.atom";
import { bookmarksAtom, bookmarksLoadedAtom } from "@/store/bookmarks.atom";
import { Bookmark } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { useT } from "@/i18n/client";
import { collapse } from "@/lib/motion-presets";

/**
 * One saved post. Un-bookmarking drops it from the atom, so without this the
 * card vanished and everything under it jumped up. It folds shut on the way
 * out. The clip is on only while leaving: a resting card must not crop its
 * own menus and hover cards.
 */
function SavedRow({ children }: { children: React.ReactNode }) {
	const present = useIsPresent();
	return (
		<motion.div
			exit={collapse.exit}
			className={present ? undefined : "overflow-hidden"}
		>
			{children}
		</motion.div>
	);
}

export default function BookmarksPage() {
	const t = useT();
	const [bookmarks, setBookmarks] = useAtom(bookmarksAtom);
	const [isLoaded, setIsLoaded] = useAtom(bookmarksLoadedAtom);
	const user = useAtomValue(userAtom);
	const read = useGatewayRead();

	useEffect(() => {
		if (isLoaded) return;

		const fetchBookmarks = async () => {
			try {
				const res = await read("/api/posts/bookmarks");
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
		<div className="flex flex-col min-h-dvh pb-nav md:pb-20">
			<header className="sticky top-0 z-sticky bg-page border-b border-hairline">
				<div className="px-4 py-3">
					<h1 className="font-display text-lg font-semibold text-primary">
						{t("nav.bookmarks")}
					</h1>
					<div className="text-muted text-[calc(13px*var(--ws-fs))] font-sans">
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
					<div className="animate-content-in flex flex-col">
						<AnimatePresence initial={false}>
							{bookmarks.map((post, i) => (
								<SavedRow key={post.id}>
									<ImpressionSensor meta={{ post: post.id, author: post.author?.id ?? "", surface: "bookmarks", position: i }}>
										<PostCard post={post} />
									</ImpressionSensor>
								</SavedRow>
							))}
						</AnimatePresence>
					</div>
				) : (
					<div className="py-10">
						<EmptyState
							icon={Bookmark}
							title="Save posts for later"
 caption="Tap the bookmark on any post and it lands here only you can see your bookmarks."
						/>
					</div>
				)}
			</div>
		</div>
	);
}
