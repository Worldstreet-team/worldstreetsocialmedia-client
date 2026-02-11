"use client";

import { PostCard, type PostProps } from "@/components/feed/PostCard";
import { CommentBox } from "@/components/feed/CommentBox";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { getPostByIdAction, getPostCommentsAction } from "@/lib/post.actions";
import { GlobalLoader } from "@/components/ui/GlobalLoader";

export default function PostDetail() {
	const params = useParams();
	const postId = params.id as string;

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
						id: p.author.userId,
						firstName: p.author.firstName,
						lastName: p.author.lastName,
						username: p.author.username,
						avatar: p.author.avatar,
						isVerified: p.author.isVerified,
					},
					content: p.content,
					images: p.images,
					timestamp: new Date(p.createdAt).toLocaleDateString(),
					stats: p.stats,
					isLiked: p.isLiked,
					isBookmarked: p.isBookmarked,
				});
			}

			if (commentsRes.success) {
				const mappedComments = commentsRes.data.map((c: any) => ({
					id: c._id,
					author: {
						id: c.author.userId,
						firstName: c.author.firstName,
						lastName: c.author.lastName,
						username: c.author.username,
						avatar: c.author.avatar,
						isVerified: c.author.isVerified,
					},
					content: c.content,
					images: c.images,
					timestamp: new Date(c.createdAt).toLocaleDateString(),
					stats: c.stats,
					isLiked: c.isLiked,
					isBookmarked: c.isBookmarked,
				}));
				setComments(mappedComments);
			}
		} catch (error) {
			console.error("Failed to fetch post data:", error);
		} finally {
			setLoading(false);
		}
	}, [postId]);

	useEffect(() => {
		if (postId) {
			fetchPostData();
		}
	}, [postId, fetchPostData]);

	if (loading) {
		return <GlobalLoader />;
	}

	if (!post) {
		return (
			<div className="flex flex-col items-center justify-center min-h-[50vh]">
				<h2 className="text-xl font-bold">Post not found</h2>
				<Link href="/" className="text-primary hover:underline mt-2">
					Go back home
				</Link>
			</div>
		);
	}

	return (
		<div className="flex flex-col min-h-screen">
			<header className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-black/10 px-4 py-3 flex items-center gap-4">
				<Link
					href="/"
					className="w-12 h-12 flex items-center justify-center -ml-2 hover:bg-black/10 rounded-full transition-colors"
				>
					<span className="material-symbols-outlined text-[20px]!">
						arrow_back
					</span>
				</Link>
				<h2 className="text-xl font-bold">Post</h2>
			</header>

			<div className="">
				<PostCard post={post} />
			</div>

			<CommentBox postId={postId} onCommentAdded={fetchPostData} />

			<div className="pb-20">
				{comments.map((comment) => (
					<PostCard key={comment.id} post={comment} />
				))}
			</div>
		</div>
	);
}
