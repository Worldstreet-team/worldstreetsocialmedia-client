"use client";

import { useState, useCallback, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { PostCard, type PostProps } from "@/components/feed/PostCard";
import { usePostEvents } from "@/hooks/useUserEvents";
import { CommentComposer } from "@/components/feed/CommentComposer";
import { PostSkeleton } from "@/components/feed/PostSkeleton";
import { getPostByIdAction, getPostCommentsAction } from "@/lib/post.actions";
import { ArrowLeft, Search } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatTimeAgo } from "@/lib/utils";
import { useT } from "@/i18n/client";
import { DEFAULT_AVATAR } from "@/const";
import { useToast } from "@/components/ui/Toast/ToastContext";
import { useAtom } from "jotai";
import {
	singlePostCacheAtom,
	updateSinglePostCacheAtom,
} from "@/store/postCache";

export default function PostPageScreen() {
	const params = useParams();
	const router = useRouter();
	const t = useT();
	const postId = params.id as string;
	const { toast } = useToast();

	const [postCache] = useAtom(singlePostCacheAtom);
	const [, updatePostCache] = useAtom(updateSinglePostCacheAtom);

	// Initialize from cache if available
	const cachedPost = postCache[postId];
	const [post, setPost] = useState<PostProps | null>(cachedPost || null);
	const [comments, setComments] = useState<PostProps[]>([]);

	// An open thread should grow as people reply, and its counts should track
	// what everyone else is doing, without a refresh.
	usePostEvents(postId, (event, data) => {
		if (event === "like") {
			setPost((prev) =>
				prev
					? {
							...prev,
							stats: {
								...prev.stats,
								likes: Number(data.likes ?? prev.stats.likes),
							},
						}
					: prev,
			);
		}
		if (event === "repost") {
			setPost((prev) =>
				prev
					? {
							...prev,
							stats: {
								...prev.stats,
								reposts: Number(data.reposts ?? prev.stats.reposts),
							},
						}
					: prev,
			);
		}
		if (event === "reply") {
			setPost((prev) =>
				prev
					? {
							...prev,
							stats: {
								...prev.stats,
								replies: Number(data.replies ?? prev.stats.replies),
							},
						}
					: prev,
			);
			const raw = data.reply as any;
			if (!raw?._id) return;
			setComments((prev) => {
				if (prev.some((c) => c.id === raw._id)) return prev;
				return [
					...prev,
					{
						id: raw._id,
						author: {
							id: raw.author?._id ?? "",
							name:
								raw.author?.firstName && raw.author?.lastName
									? `${raw.author.firstName} ${raw.author.lastName}`
									: (raw.author?.username ?? ""),
							username: raw.author?.username ?? "",
							avatar: raw.author?.avatar ?? "",
							isVerified: raw.author?.isVerified,
						},
						content: raw.content ?? "",
						timestamp: formatTimeAgo(raw.createdAt),
						images: raw.images ?? [],
						stats: raw.stats || { replies: 0, reposts: 0, likes: 0 },
						isLiked: Boolean(raw.isLiked),
						isBookmarked: Boolean(raw.isBookmarked),
					} as PostProps,
				];
			});
		}
	});
	const [loading, setLoading] = useState(!cachedPost);
	const [isAddingComment, setIsAddingComment] = useState(false);

	// Update local state if cache updates (e.g. from background fetch elsewhere)
	useEffect(() => {
		if (cachedPost) {
			setPost(cachedPost);
			if (loading) setLoading(false);
		}
	}, [cachedPost]);

	const fetchPostData = useCallback(async () => {
		try {
			const [postRes, commentsRes] = await Promise.all([
				getPostByIdAction(postId),
				getPostCommentsAction(postId),
			]);

			if (postRes.success) {
				const p = postRes.data;
				setPost({
					id: p._id,
					author: {
						id: p.author._id || p.author.userId,
						name:
							p.author.firstName && p.author.lastName
								? `${p.author.firstName} ${p.author.lastName}`
								: p.author.username || "Unknown",
						username: p.author.username,
						avatar:
							p.author.avatar || DEFAULT_AVATAR,
						isVerified: p.author.isVerified,
					},
					content: p.content,
					mentions: p.mentions,
					images: p.images,
					videos: p.videos,
					timestamp: formatTimeAgo(p.createdAt),
					stats: p.stats,
					isLiked: p.isLiked,
					isBookmarked: p.isBookmarked,
					isDetail: true,
				});

				// Update Cache
				updatePostCache({
					postId: p._id,
					post: {
						id: p._id,
						author: {
							id: p.author._id || p.author.userId,
							name:
								p.author.firstName && p.author.lastName
									? `${p.author.firstName} ${p.author.lastName}`
									: p.author.username || "Unknown",
							username: p.author.username,
							avatar:
								p.author.avatar || DEFAULT_AVATAR,
							isVerified: p.author.isVerified,
						},
						content: p.content,
						mentions: p.mentions,
						images: p.images,
						videos: p.videos,
						timestamp: formatTimeAgo(p.createdAt),
						stats: p.stats,
						isLiked: p.isLiked,
						isBookmarked: p.isBookmarked,
						isDetail: true,
					},
				});
			} else {
				toast("Post not found", { type: "error" });
			}

			if (commentsRes.success) {
				const mappedComments = commentsRes.data.map((c: any) => ({
					id: c._id,
					author: {
						id: c.author._id || c.author.userId,
						name:
							c.author.firstName && c.author.lastName
								? `${c.author.firstName} ${c.author.lastName}`
								: c.author.username || "Unknown",
						username: c.author.username,
						avatar:
							c.author.avatar || DEFAULT_AVATAR,
						isVerified: c.author.isVerified,
					},
					content: c.content,
					mentions: c.mentions,
					images: c.images,
					videos: c.videos,
					timestamp: formatTimeAgo(c.createdAt),
					stats: c.stats || { replies: 0, reposts: 0, likes: 0 },
					isLiked: c.isLiked,
					isBookmarked: c.isBookmarked,
				}));
				setComments(mappedComments);
			}
		} catch (error) {
			console.error("Failed to fetch post data:", error);
			toast("Failed to load post", { type: "error" });
		} finally {
			setLoading(false);
		}
	}, [postId, toast, updatePostCache]);

	useEffect(() => {
		if (postId) {
			fetchPostData();
		}
	}, [postId, fetchPostData]);

	if (loading) {
		return (
			<div className="flex flex-col min-h-dvh pb-20">
				<header className="sticky top-0 z-sticky bg-page border-b border-hairline px-4 py-2 flex items-center gap-6">
					<button
						className="rounded-pill h-11 w-11 sm:h-9 sm:w-9 shrink-0 hover:bg-raised flex items-center justify-center transition-colors cursor-pointer text-primary"
						type="button"
						aria-label="Go back"
						onClick={() => router.back()}
					>
						<ArrowLeft className="w-5 h-5" />
					</button>
					<h1 className="font-display text-lg font-semibold leading-5 text-primary">
						{t("post.title")}
					</h1>
				</header>
				<div className="p-4 border-b border-hairline">
					<PostSkeleton />
				</div>
				<div className="p-4">
					<PostSkeleton />
					<PostSkeleton />
				</div>
			</div>
		);
	}

	if (!post) {
		return (
			<div className="flex flex-col justify-center items-center min-h-[50dvh]">
				<EmptyState
					icon={Search}
					title="This post doesn't exist"
					caption="It may have been deleted, or the link is wrong."
					action={{ label: "Go back", onClick: () => router.back() }}
				/>
			</div>
		);
	}

	const handleCommentStart = () => {
		setIsAddingComment(true);
	};

	const handleCommentSuccess = async () => {
		await fetchPostData();
		setIsAddingComment(false);
	};

	return (
		<div className="flex flex-col min-h-dvh pb-20">
			<header className="sticky top-0 z-sticky bg-page border-b border-hairline px-2 sm:px-4 py-2 flex items-center gap-2 sm:gap-6">
				<button
					className="rounded-pill h-11 w-11 sm:h-9 sm:w-9 shrink-0 hover:bg-raised flex items-center justify-center transition-colors cursor-pointer text-primary"
					type="button"
					onClick={() => router.back()}
				>
					<ArrowLeft className="w-5 h-5" />
				</button>
				<h1 className="font-display text-lg font-semibold leading-5 text-primary">
					{t("post.title")}
				</h1>
			</header>

			<div className="border-b border-hairline">
				<PostCard post={post} />
			</div>

			<CommentComposer
				postId={postId}
				onCommentStart={handleCommentStart}
				onCommentSuccess={handleCommentSuccess}
			/>

			<div className="flex flex-col">
				{isAddingComment && (
					<div className="border-b border-hairline">
						<PostSkeleton />
					</div>
				)}
				{comments.length > 0
					? comments.map((comment) => (
							<div key={comment.id} className="border-b border-hairline">
								<PostCard post={comment} />
							</div>
						))
					: !isAddingComment && (
							<div className="p-12 text-center text-muted font-sans text-sm">
								No comments yet. Be the first to reply!
							</div>
						)}
			</div>
		</div>
	);
}
