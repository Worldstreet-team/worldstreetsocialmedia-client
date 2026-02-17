"use client";

import { useState, useEffect } from "react";
import { useAtom } from "jotai";
import { feedAtom } from "@/store/feed.atom";
import { PostCard, PostProps } from "@/components/feed/PostCard";
import { PostComposer } from "@/components/feed/PostComposer";
import { getFeedAction } from "@/lib/feed.actions";
import { Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/Toast/ToastContext";
import { PostSkeleton } from "@/components/feed/PostSkeleton";

export default function Feed() {
	const [feedState, setFeedState] = useAtom(feedAtom);
	const [loading, setLoading] = useState(true);
	const [isPosting, setIsPosting] = useState(false);
	const { toast } = useToast();

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
			const currentPage = reset ? 1 : feedState.page;
			const result = await getFeedAction(currentPage);

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
						avatar:
							post.author.avatar ||
							"https://ui-avatars.com/api/?name=User&background=random",
						isVerified: post.author.isVerified,
					},
					content: post.content,
					timestamp: formatTimeAgo(post.createdAt),
					images: post.images,
					stats: post.stats || { replies: 0, reposts: 0, likes: 0 },
					isLiked: post.isLiked,
					isBookmarked: post.isBookmarked,
				}));

				setFeedState((prev) => ({
					...prev,
					posts: reset ? mappedPosts : [...prev.posts, ...mappedPosts],
					page: reset ? 2 : prev.page + 1,
					hasMore: result.data.page < result.data.totalPages,
				}));
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

	const handlePostSuccess = (newPost: any) => {
		setIsPosting(false);
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
					avatar:
						newPost.author.avatar ||
						"https://ui-avatars.com/api/?name=User&background=random",
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
				posts: [mappedPost, ...prev.posts],
			}));
		} else {
			fetchFeed(true);
		}
	};

	const formatTimeAgo = (dateString: string) => {
		try {
			const date = new Date(dateString);
			const now = new Date();
			const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

			if (diffInSeconds < 60) return `${Math.max(0, diffInSeconds)}s`;

			const diffInMinutes = Math.floor(diffInSeconds / 60);
			if (diffInMinutes < 60) return `${diffInMinutes}m`;

			const diffInHours = Math.floor(diffInMinutes / 60);
			if (diffInHours < 24) return `${diffInHours}h`;

			const diffInDays = Math.floor(diffInHours / 24);
			return `${diffInDays}d`;
		} catch (e) {
			return "now";
		}
	};

	return (
		<div className="w-full pb-20">
			<PostComposer
				onPostStart={handlePostStart}
				onPostSuccess={handlePostSuccess}
			/>

			<div className="">
				{isPosting && <PostSkeleton />}
				{feedState.posts.map((post) => (
					<PostCard key={post.id} post={post} />
				))}

				{loading && (
					<div className="flex flex-col">
						{[...Array(5)].map((_, i) => (
							<PostSkeleton key={i} hasMedia={i % 2 !== 0} />
						))}
					</div>
				)}

				{!loading && feedState.posts.length === 0 && (
					<div className="text-center py-12">
						<p className="text-zinc-500 font-sans">
							No posts yet. Be the first to post!
						</p>
					</div>
				)}

				{feedState.hasMore && !loading && feedState.posts.length > 0 && (
					<div className="flex justify-center py-8">
						<button
							onClick={() => fetchFeed()}
							className="text-zinc-500 hover:text-white font-sans text-sm underline decoration-dotted underline-offset-4"
						>
							Load more
						</button>
					</div>
				)}
			</div>
		</div>
	);
}
