"use client";

import { useState, useEffect } from "react";
import { PostCard, type PostProps } from "@/components/feed/PostCard";
import { PostComposer } from "@/components/feed/PostComposer";

export default function UserFeed() {
	const [uploadStatus, setUploadStatus] = useState<
		"idle" | "uploading" | "success"
	>("idle");
	const [posts, setPosts] = useState<PostProps[]>([]);
	const [loading, setLoading] = useState(true);
	const [page, setPage] = useState(1);
	const [hasMore, setHasMore] = useState(true);

	useEffect(() => {
		fetchFeed();
	}, []);

	const fetchFeed = async () => {
		try {
			const { getFeedAction } = await import("@/lib/feed.actions");
			const result = await getFeedAction(page);

			if (result.success && result.data) {
				const apiPosts = result.data.posts;
				const mappedPosts: PostProps[] = apiPosts.map((post: any) => ({
					id: post._id,
					author: {
						name:
							post.author.firstName && post.author.lastName
								? `${post.author.firstName} ${post.author.lastName}`
								: post.author.username,
						username: post.author.username,
						avatar:
							post.author.avatar ||
							"https://upload.wikimedia.org/wikipedia/commons/7/7c/Profile_avatar_placeholder_large.png", // Fallback avatar
						isVerified: post.author.isVerified,
					},
					content: post.content,
					timestamp: formatTimeAgo(post.createdAt),
					images: post.images,
					stats: post.stats || { replies: 0, reposts: 0, likes: 0 },
				}));

				setPosts((prev) =>
					page === 1 ? mappedPosts : [...prev, ...mappedPosts],
				);
				setHasMore(result.data.page < result.data.totalPages);
			}
		} catch (error) {
			console.error("Failed to fetch feed:", error);
		} finally {
			setLoading(false);
		}
	};

	const handlePostStart = () => setUploadStatus("uploading");

	const handlePostSuccess = () => {
		setUploadStatus("success");
		// Refresh feed after successful post
		setPage(1);
		fetchFeed();
		setTimeout(() => setUploadStatus("idle"), 3000);
	};

	const formatTimeAgo = (dateString: string) => {
		const date = new Date(dateString);
		const now = new Date();
		const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

		if (seconds < 60) return `${seconds}s`;
		const minutes = Math.floor(seconds / 60);
		if (minutes < 60) return `${minutes}m`;
		const hours = Math.floor(minutes / 60);
		if (hours < 24) return `${hours}h`;
		const days = Math.floor(hours / 24);
		return `${days}d`;
	};

	// Removed mock posts

	return (
		<>
			<header className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-black/10 transition-all duration-300">
				{uploadStatus !== "idle" && (
					<div className="w-full">
						{uploadStatus === "uploading" && (
							<div className="h-1 w-full bg-gray-100 overflow-hidden">
								<div className="h-full bg-primary w-1/3 animate-loading origin-left" />
							</div>
						)}
						{uploadStatus === "success" && (
							<div className="bg-green-500 text-white text-center py-2 text-sm font-medium animate-fade-in shadow-sm">
								Post successfully uploaded
							</div>
						)}
					</div>
				)}
				<div className="flex">
					<button
						type="button"
						className="flex-1 px-4 py-4 hover:bg-hover-gray transition-colors relative"
					>
						<span className="font-semibold text-[15px]">For you</span>
						<div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-14 h-1 bg-primary rounded-full" />
					</button>
					<button
						type="button"
						className="flex-1 px-4 py-4 hover:bg-hover-gray transition-colors"
					>
						<span className="font-semibold text-text-light text-black/50 text-[15px]">
							Following
						</span>
					</button>
				</div>
			</header>
			{/* <StoryRail /> */}
			<PostComposer
				onPostStart={handlePostStart}
				onPostSuccess={handlePostSuccess}
			/>
			<div className="flex flex-col">
				{posts.map((post) => (
					<PostCard key={post.id} post={post} />
				))}
				{loading && (
					<div className="p-4 text-center text-gray-500">Loading posts...</div>
				)}
				{!loading && posts.length === 0 && (
					<div className="p-8 text-center text-gray-500">
						No posts found. Follow some users to see their updates!
					</div>
				)}
				{/* Use hasMore to avoid lint error for now */}
				{hasMore && !loading && posts.length > 0 && (
					<div className="p-4 text-center text-sm text-gray-400">
						Scroll for more
					</div>
				)}
			</div>
		</>
	);
}
