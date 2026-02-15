"use client";

import { useState, useCallback, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { PostCard, type PostProps } from "@/components/feed/PostCard";
import { CommentComposer } from "@/components/feed/CommentComposer";
import { PostSkeleton } from "@/components/feed/PostSkeleton";
import { getPostByIdAction, getPostCommentsAction } from "@/lib/post.actions";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useToast } from "@/components/ui/Toast/ToastContext";

export default function PostPage() {
	const params = useParams();
	const router = useRouter();
	const postId = params.id as string;
	const { toast } = useToast();

	const [post, setPost] = useState<PostProps | null>(null);
	const [comments, setComments] = useState<PostProps[]>([]);
	const [loading, setLoading] = useState(true);

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
							p.author.avatar ||
							"https://upload.wikimedia.org/wikipedia/commons/7/7c/Profile_avatar_placeholder_large.png",
						isVerified: p.author.isVerified,
					},
					content: p.content,
					images: p.images,
					timestamp: new Date(p.createdAt).toLocaleDateString(),
					stats: p.stats,
					isLiked: p.isLiked,
					isBookmarked: p.isBookmarked,
					isDetail: true,
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
							c.author.avatar ||
							"https://upload.wikimedia.org/wikipedia/commons/7/7c/Profile_avatar_placeholder_large.png",
						isVerified: c.author.isVerified,
					},
					content: c.content,
					images: c.images,
					timestamp: new Date(c.createdAt).toLocaleDateString(),
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
	}, [postId, toast]);

	useEffect(() => {
		if (postId) {
			fetchPostData();
		}
	}, [postId, fetchPostData]);

	if (loading) {
		return (
			<div className="flex flex-col min-h-screen pb-20">
				<header className="sticky top-0 z-20 bg-black/80 backdrop-blur-md border-b border-zinc-800 px-4 py-2 flex items-center gap-6">
					<button
						className="rounded-full w-9 h-9 hover:bg-zinc-800 flex items-center justify-center transition-colors cursor-pointer text-white"
						type="button"
						onClick={() => router.back()}
					>
						<ArrowLeft className="w-5 h-5" />
					</button>
					<h1 className="text-lg font-bold leading-5 font-space-mono text-white">
						Post
					</h1>
				</header>
				<div className="p-4 border-b border-zinc-800">
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
			<div className="flex flex-col justify-center items-center h-[50vh] text-zinc-500 font-space-mono">
				<h2 className="text-xl font-bold mb-2 text-white">Post not found</h2>
				<button
					onClick={() => router.back()}
					className="mt-4 text-sm underline hover:text-white cursor-pointer"
				>
					Go back
				</button>
			</div>
		);
	}

	return (
		<div className="flex flex-col min-h-screen pb-20">
			<header className="sticky top-0 z-20 bg-black/80 backdrop-blur-md border-b border-zinc-800 px-4 py-2 flex items-center gap-6">
				<button
					className="rounded-full w-9 h-9 hover:bg-zinc-800 flex items-center justify-center transition-colors cursor-pointer text-white"
					type="button"
					onClick={() => router.back()}
				>
					<ArrowLeft className="w-5 h-5" />
				</button>
				<h1 className="text-lg font-bold leading-5 font-space-mono text-white">
					Post
				</h1>
			</header>

			<div className="border-b border-zinc-800">
				<PostCard post={post} />
			</div>

			<CommentComposer postId={postId} onCommentSuccess={fetchPostData} />

			<div className="flex flex-col">
				{comments.length > 0 ? (
					comments.map((comment) => (
						<div key={comment.id} className="border-b border-zinc-800">
							<PostCard post={comment} />
						</div>
					))
				) : (
					<div className="p-12 text-center text-zinc-500 font-space-mono text-sm">
						No comments yet. Be the first to reply!
					</div>
				)}
			</div>
		</div>
	);
}
