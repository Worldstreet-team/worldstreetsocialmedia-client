"use client";

import { formatTimeAgo } from "@/lib/utils";

import { useState, useEffect, useMemo, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useAtom, useAtomValue } from "jotai";
import { feedAtom } from "@/store/feed.atom";
import { feedTabAtom, followingIdsAtom } from "@/store/ui.atom";
import { PostCard, PostProps } from "@/components/feed/PostCard";
import { PostComposer } from "@/components/feed/PostComposer";
import { getFeedAction } from "@/lib/feed.actions";
// 03-icons: `plus`, `user-plus` and `arrow-up` are all in the standardized set.
import { ArrowUp, Plus, UserPlus } from "lucide-react";
import { useToast } from "@/components/ui/Toast/ToastContext";
import { PostSkeleton } from "@/components/feed/PostSkeleton";
import { ImpressionSensor } from "@/components/feed/ImpressionSensor";
import { StoriesRail } from "@/components/feed/StoriesRail";
import { EmptyState } from "@/components/ui/EmptyState";
import { DEFAULT_AVATAR } from "@/const";

export default function Feed() {
	const [feedState, setFeedState] = useAtom(feedAtom);
	const tab = useAtomValue(feedTabAtom);
	const followingIds = useAtomValue(followingIdsAtom);
	const [loading, setLoading] = useState(true);
	const [isPosting, setIsPosting] = useState(false);
	const [showBackToTop, setShowBackToTop] = useState(false);
	const { toast } = useToast();

	// First paint gets the orchestrated stagger; after that, new posts
	// (pagination, tab switches, prepends) rise in without queueing delays.
	const introPlayedRef = useRef(false);
	useEffect(() => {
		if (!loading && feedState.posts.length > 0) {
			const timer = setTimeout(() => {
				introPlayedRef.current = true;
			}, 700);
			return () => clearTimeout(timer);
		}
	}, [loading, feedState.posts.length]);

	// Infinite scroll: a sentinel above the "Show more" button auto-loads the
	// next page as it approaches the viewport; the button stays as fallback.
	const loadMoreRef = useRef<HTMLDivElement>(null);
	const fetchingMoreRef = useRef(false);
	const [isFetchingMore, setIsFetchingMore] = useState(false);
	const loadMore = async () => {
		if (fetchingMoreRef.current) return;
		fetchingMoreRef.current = true;
		setIsFetchingMore(true);
		try {
			await fetchFeed();
		} finally {
			fetchingMoreRef.current = false;
			setIsFetchingMore(false);
		}
	};

	// Back-to-top pill once the reader is a couple of screens deep.
	useEffect(() => {
		const onScroll = () => setShowBackToTop(window.scrollY > 800);
		window.addEventListener("scroll", onScroll, { passive: true });
		return () => window.removeEventListener("scroll", onScroll);
	}, []);

	useEffect(() => {
		const node = loadMoreRef.current;
		if (!node) return;
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries[0].isIntersecting) loadMore();
			},
			// Start loading ~one screen before the reader reaches the end.
			{ rootMargin: "600px 0px" },
		);
		observer.observe(node);
		return () => observer.disconnect();
	});

	// "Following" filters the loaded timeline by who this session follows
	// (followingIdsAtom grows as Follow buttons are clicked).
	const visiblePosts = useMemo(
		() =>
			tab === "following"
				? feedState.posts.filter((p) =>
						followingIds.includes(p.author.id),
					)
				: feedState.posts,
		[tab, feedState.posts, followingIds],
	);

	useEffect(() => {
		// Disable browser's automatic scroll restoration to handle it manually
		if (typeof window !== "undefined") {
			window.history.scrollRestoration = "manual";
		}

		if (feedState.posts.length > 0) {
			setLoading(false);
			// Restore scroll position with a slight delay to ensure DOM is ready
			if (feedState.scrollPosition > 0) {
				setTimeout(() => {
					window.scrollTo(0, feedState.scrollPosition);
				}, 10);
			}
		} else {
			fetchFeed();
		}

		// Save scroll position on unmount
		return () => {
			if (typeof window !== "undefined") {
				window.history.scrollRestoration = "auto";
				setFeedState((prev) => ({ ...prev, scrollPosition: window.scrollY }));
			}
		};
	}, []);

	const fetchFeed = async (reset = false) => {
		if (reset) {
			setLoading(true);
		}

		try {
			const currentCursor = reset ? null : feedState.cursor;
			const result = await getFeedAction(currentCursor);

			if (result.success && result.data) {
				const apiPosts = result.data.posts;
				const mappedPosts: PostProps[] = apiPosts.map((post: any) => ({
					id: post._id,
					author: {
						id: post.author._id,
						name:
							post.author.firstName && post.author.lastName
								? `${post.author.firstName} ${post.author.lastName}`
								: post.author.username,
						username: post.author.username,
						avatar: post.author.avatar || DEFAULT_AVATAR,
						isVerified: post.author.isVerified,
					},
					content: post.content,
					timestamp: formatTimeAgo(post.createdAt),
					images: post.images,
					stats: post.stats || { replies: 0, reposts: 0, likes: 0 },
					isLiked: post.isLiked,
					isBookmarked: post.isBookmarked,
					type: post.type,
					live: post.live,
					promoted: Boolean(post.promoted),
				}));

				setFeedState((prev) => {
					// Merge by id. Without this, any repeat fetch of the same
					// page (StrictMode double-effect, remount, retry) appends
					// duplicates and React throws "two children with the same key".
					const merged = reset
						? mappedPosts
						: [...prev.posts, ...mappedPosts];
					const byId = new Map<string, PostProps>();
					for (const post of merged) {
						if (!byId.has(post.id)) byId.set(post.id, post);
					}

					return {
						...prev,
						posts: [...byId.values()],
						cursor: result.data.nextCursor ?? null,
						hasMore: Boolean(result.data.hasMore),
					};
				});
			} else {
				if (result.message) toast(result.message, { type: "error" });
			}
		} catch (error) {
			console.error("Failed to fetch feed:", error);
			toast("Failed to load feed", { type: "error" });
		} finally {
			setLoading(false);
		}
	};

	const handlePostStart = () => {
		setIsPosting(true);
	};

	const handlePostSuccess = async (newPost: any) => {
		if (newPost) {
			const mappedPost: PostProps = {
				id: newPost._id,
				author: {
					id: newPost.author._id,
					name:
						newPost.author.firstName && newPost.author.lastName
							? `${newPost.author.firstName} ${newPost.author.lastName}`
							: newPost.author.username,
					username: newPost.author.username,
					avatar: newPost.author.avatar || DEFAULT_AVATAR,
					isVerified: newPost.author.isVerified,
				},
				content: newPost.content,
				timestamp: "Just now",
				images: newPost.images,
				stats: newPost.stats || { replies: 0, reposts: 0, likes: 0 },
				isLiked: false,
				isBookmarked: false,
			};

			setFeedState((prev) => ({
				...prev,
				posts: [
					mappedPost,
					...prev.posts.filter((p) => p.id !== mappedPost.id),
				],
			}));
			setIsPosting(false);
		} else {
			// Keep isPosting true while fetching
			await fetchFeed(true);
			setIsPosting(false);
		}
	};

	return (
		<div className="w-full min-w-0 pb-nav md:pb-20">
			<AnimatePresence>
				{showBackToTop && (
					<motion.button
						type="button"
						// Enter rises 8px at motion-base; exit is a fast fade (06-motion).
						initial={{ opacity: 0, y: 8, x: "-50%" }}
						animate={{ opacity: 1, y: 0, x: "-50%" }}
						exit={{ opacity: 0, transition: { duration: 0.12 } }}
						transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
						onClick={() =>
							window.scrollTo({ top: 0, behavior: "smooth" })
						}
						// bottom-nav derives from --ws-nav-clearance, so the pill
						// tracks the real bar height + home indicator instead of a
						// guessed 24 (which overlapped it on notched phones).
						className="fixed bottom-nav md:bottom-8 left-1/2 z-sticky flex items-center gap-1.5 h-10 md:h-9 pl-3.5 pr-4 rounded-pill bg-raised border border-hairline shadow-nav font-sans text-[13px] font-medium text-primary hover:bg-track transition-colors cursor-pointer"
					>
						<ArrowUp className="w-[14px] h-[14px]" />
						Top
					</motion.button>
				)}
			</AnimatePresence>

			<div className="animate-rise" style={{ animationDelay: "60ms" }}>
				<StoriesRail />
			</div>

			<div className="animate-rise" style={{ animationDelay: "100ms" }}>
				<PostComposer
					onPostStart={handlePostStart}
					onPostSuccess={handlePostSuccess}
				/>
			</div>

			{/* Keyed by tab so switching timelines replays the rise (no stagger). */}
			<div key={tab}>
				{isPosting && <PostSkeleton />}
				{visiblePosts.map((post, index) => (
					<ImpressionSensor
						key={post.id}
						meta={{
							post: post.id,
							author: post.author.id,
							surface: tab === "following" ? "feed_following" : "feed_foryou",
							position: index,
							mediaType: post.live
								? "live"
								: post.images?.length
									? "image"
									: "text",
							cursorDepth: Math.floor(index / 10),
							promoted: post.promoted,
						}}
						className="animate-rise"
						style={{
							animationDelay: introPlayedRef.current
								? "0ms"
								: `${Math.min(160 + index * 60, 520)}ms`,
						}}
					>
						<PostCard post={post} />
					</ImpressionSensor>
				))}

				{loading && (
					<div className="flex flex-col">
						{[...Array(5)].map((_, i) => (
							<PostSkeleton key={i} hasMedia={i % 2 !== 0} />
						))}
					</div>
				)}

				{!loading &&
					visiblePosts.length === 0 &&
					(tab === "following" ? (
						<EmptyState
							icon={UserPlus}
							title="Nothing here yet"
							caption="Posts from people you follow land here. Follow someone from the suggestions to fill it up."
						/>
					) : (
						<EmptyState
							icon={Plus}
							title="Your timeline is empty"
							caption="Posts from people you follow show up here. Write the first one."
							action={{
								label: "Write a post",
								onClick: () =>
									document
										.querySelector<HTMLTextAreaElement>("#post-composer-input")
										?.focus(),
							}}
						/>
					))}

				{feedState.hasMore && !loading && tab === "foryou" && feedState.posts.length > 0 && (
					<div ref={loadMoreRef} className="flex justify-center py-8">
						{isFetchingMore ? (
							<span className="h-9 flex items-center gap-2 font-sans text-[13px] text-muted">
								<span className="w-4 h-4 rounded-full border-2 border-raised border-t-brand animate-spin" />
								Loading more posts
							</span>
						) : (
							<button
								type="button"
								onClick={loadMore}
								className="h-9 px-4 rounded-pill border border-hairline bg-surface hover:bg-raised font-sans text-[13px] font-medium text-primary transition-colors cursor-pointer"
							>
								Show more posts
							</button>
						)}
					</div>
				)}
			</div>
		</div>
	);
}
