"use client";

import { useBackWithFallback } from "@/lib/nav";
import { useGatewayRead } from "@/hooks/useGateway";
import clsx from "clsx";
import { ImpressionSensor } from "@/components/feed/ImpressionSensor";

import { useState, useCallback, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { PostCard, type PostProps } from "@/components/feed/PostCard";
import { usePostEvents } from "@/hooks/useUserEvents";
import { CommentComposer } from "@/components/feed/CommentComposer";
import { PostSkeleton } from "@/components/feed/PostSkeleton";
import { ArrowLeft, Search } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { mapApiPost } from "@/lib/post-mapper";
import { formatTimeAgo } from "@/lib/utils";
import { useT } from "@/i18n/client";
import { useToast } from "@/components/ui/Toast/ToastContext";
import { useAtom } from "jotai";
import {
	singlePostCacheAtom,
	updateSinglePostCacheAtom,
} from "@/store/postCache";

export default function PostPageScreen() {
  const read = useGatewayRead();
	const params = useParams();
	const router = useRouter();
	const goBack = useBackWithFallback();
	const t = useT();
	const postId = params.id as string;
	const { toast } = useToast();

	const [postCache] = useAtom(singlePostCacheAtom);
	const [, updatePostCache] = useAtom(updateSinglePostCacheAtom);

	// Initialize from cache if available
	const cachedPost = postCache[postId];
	const [post, setPost] = useState<PostProps | null>(cachedPost || null);
	const [comments, setComments] = useState<PostProps[]>([]);
	// The post this one is replying to. Opening a reply used to show it alone,
	// with no sign of what it answered — every notification deep-link and every
	// shared reply URL lost its context. Fetched only when the focused post is
	// itself a reply, so ordinary posts pay nothing.
	const [parent, setParent] = useState<PostProps | null>(null);

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
							verification: raw.author?.verification,
						},
						content: raw.content ?? "",
						timestamp: formatTimeAgo(raw.createdAt),
						createdAt: raw.createdAt,
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

	const toPostProps = useCallback(
		(p: any, isDetail = false): PostProps => ({ ...mapApiPost(p), isDetail }),
		[],
	);

	const fetchPostData = useCallback(async () => {
		try {
			const [postRes, commentsRes] = await Promise.all([
				read(`/api/posts/${postId}`),
				read(`/api/posts/${postId}/comments`),
			]);

			if (postRes.success) {
				const p = postRes.data;

				// One extra request, and only for replies. The id may arrive raw
				// or populated depending on the endpoint, so handle both.
				const parentId =
					p.parentPost && typeof p.parentPost === "object"
						? p.parentPost._id
						: p.parentPost;
				if (parentId) {
					void read(`/api/posts/${String(parentId)}`).then((res) => {
						if (res.success && res.data) setParent(toPostProps(res.data));
					});
				} else {
					setParent(null);
				}

				setPost(toPostProps(p, true));

				// Update Cache
				updatePostCache({ postId: p._id, post: toPostProps(p, true) });
			} else {
				toast("Post not found", { type: "error" });
			}

			if (commentsRes.success) {
				const mappedComments = commentsRes.data.map((c: any) =>
					toPostProps(c),
				);
				setComments(mappedComments);
			}
		} catch (error) {
			console.error("Failed to fetch post data:", error);
			toast("Failed to load post", { type: "error" });
		} finally {
			setLoading(false);
		}
	}, [postId, toast, updatePostCache, toPostProps]);

	useEffect(() => {
		if (postId) {
			fetchPostData();
		}
	}, [postId, fetchPostData]);

	// Arriving via the comment icon (#comments): the browser's native hash
	// scroll fires before the async post has rendered, so it lands at the
	// top. Scroll ourselves once the layout is real (owner 2026-09-03).
	useEffect(() => {
		if (loading || window.location.hash !== "#comments") return;
		const id = window.setTimeout(() => {
			document
				.getElementById("comments")
				?.scrollIntoView({ block: "start", behavior: "smooth" });
		}, 80);
		return () => window.clearTimeout(id);
	}, [loading]);

	if (loading) {
		return (
			<div className="flex flex-col min-h-dvh pb-20">
				<header className="sticky top-0 z-sticky bg-page border-b border-hairline px-4 py-2 flex items-center gap-6">
					<button
						className="rounded-pill h-11 w-11 sm:h-9 sm:w-9 shrink-0 hover:bg-raised flex items-center justify-center transition-colors cursor-pointer text-primary"
						type="button"
						aria-label="Go back"
						onClick={() => goBack("/")}
					>
						<ArrowLeft className="w-5 h-5" />
					</button>
					<h1 className="font-display text-lg font-semibold leading-5 text-primary">
						{t("post.title")}
					</h1>
				</header>
				<div className="p-4">
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
					action={{ label: "Go back", onClick: () => goBack("/") }}
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
					onClick={() => goBack("/")}
				>
					<ArrowLeft className="w-5 h-5" />
				</button>
				<h1 className="font-display text-lg font-semibold leading-5 text-primary">
					{t("post.title")}
				</h1>
			</header>

			{/* Thread ancestry: the post being replied to sits above the focused
			    one, joined by a vertical rule so the two read as one thread
			    rather than two unrelated cards. Muted, because the reply is
			    what the reader came for. */}
			{parent && (
				<div className="relative">
					<PostCard post={parent} />
					<span
						aria-hidden
						className="absolute left-[38px] bottom-0 h-4 w-0.5 translate-y-full bg-hairline"
					/>
				</div>
			)}

			<PostCard post={post} />

			<div id="comments" className="scroll-mt-16">
				<CommentComposer
					postId={postId}
					onCommentStart={handleCommentStart}
					onCommentSuccess={handleCommentSuccess}
				/>
			</div>

			<div className="flex flex-col">
				{isAddingComment && (
					<PostSkeleton />
				)}
				{comments.length > 0
					? comments.map((comment, i) => (
							<div key={comment.id} className="relative">
								{/* No border between replies (owner ruling): hard
								    rules chopped the conversation into a ledger.
								    The thread rail runs the avatar column instead —
								    full height between replies, closing at the
								    last — so the timeline draws as ONE grouped
								    conversation. */}
								<span
									aria-hidden
									className={clsx(
										"absolute left-[38px] top-0 w-0.5 bg-hairline",
										i === comments.length - 1 ? "h-6" : "h-full",
									)}
								/>
								<ImpressionSensor
									meta={{
										post: comment.id,
										author: comment.author?.id ?? "",
										surface: "post_detail",
										position: i,
									}}
								>
									<PostCard
										post={comment}
										replyingTo={post?.author?.username}
									/>
								</ImpressionSensor>
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
