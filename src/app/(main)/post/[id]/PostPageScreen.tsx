"use client";

import { useBackWithFallback } from "@/lib/nav";
import { useAuth } from "@clerk/nextjs";
import { useGatewayRead } from "@/hooks/useGateway";
import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { ImpressionSensor } from "@/components/feed/ImpressionSensor";

import { useState, useCallback, useEffect, useRef } from "react";
import { PostCard, type PostProps } from "@/components/feed/PostCard";
import { usePostEvents } from "@/hooks/useUserEvents";
import {
	CommentComposer,
	type ReplyTarget,
} from "@/components/feed/CommentComposer";
import { PostSkeleton, ReplySkeleton } from "@/components/feed/PostSkeleton";
import { ArrowLeft, Search } from "@/components/ui/icons";
import { EmptyState } from "@/components/ui/EmptyState";
import { mapApiPost } from "@/lib/post-mapper";
import { takeRepliesJump } from "@/components/feed/PostLayer";
import { formatCompact, formatTimeAgo } from "@/lib/utils";
import {
	collapse,
	press,
	reveal,
	staggerItem,
	staggerParentFast,
	swap,
} from "@/lib/motion-presets";
import { useT } from "@/i18n/client";
import { useToast } from "@/components/ui/Toast/ToastContext";
import { useAtom } from "jotai";
import {
	singlePostCacheAtom,
	updateSinglePostCacheAtom,
} from "@/store/postCache";

export default function PostPageScreen({
	postId,
	onBack,
}: {
	postId: string;
	/** Set by PostLayer: back closes the layer (a history step). */
	onBack?: () => void;
}) {
  const read = useGatewayRead();
	const goBack = useBackWithFallback();
	const t = useT();
	const { toast } = useToast();

	const [postCache] = useAtom(singlePostCacheAtom);
	const [, updatePostCache] = useAtom(updateSinglePostCacheAtom);

	// Initialize from cache if available
	const cachedPost = postCache[postId];
	const [post, setPost] = useState<PostProps | null>(
		cachedPost ? { ...cachedPost, isDetail: true } : null,
	);
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
	// The reply the pinned box is aimed at (null = the post itself), and the
	// last reply that landed under a reply, so that thread reopens with it.
	const [replyTarget, setReplyTarget] = useState<ReplyTarget | null>(null);
	const [landed, setLanded] = useState<{ id: string; n: number } | null>(
		null,
	);
	const aimAt = useCallback(
		(p: PostProps) =>
			setReplyTarget({
				id: p.id,
				name: p.author.name || p.author.username,
				username: p.author.username,
			}),
		[],
	);
	// "No comments yet" waits for the answer. Said while the request is in
	// flight, it would rise in only to be cut by the replies.
	const [commentsLoaded, setCommentsLoaded] = useState(false);
	// A failed read of the replies is said out loud with a retry. It used to
	// land on "No comments yet" under a post that has replies.
	const [commentsFailed, setCommentsFailed] = useState(false);
	// The parent's wrapper clips only while its height is moving: PostCard's
	// menus hang outside the card, and a standing clip would cut them.
	const [settledParentId, setSettledParentId] = useState<string | null>(null);
	// Past the fold nothing cascades on first paint: row 40 must not wait on
	// the 39 before it. A reply that lands later rises wherever it lands.
	const repliesPaintedRef = useRef(false);
	useEffect(() => {
		if (comments.length > 0) repliesPaintedRef.current = true;
	}, [comments.length]);

	// Update local state if cache updates (e.g. from background fetch elsewhere)
	useEffect(() => {
		if (cachedPost) {
			setPost({ ...cachedPost, isDetail: true });
			if (loading) setLoading(false);
		}
	}, [cachedPost]);

	const toPostProps = useCallback(
		(p: any, isDetail = false): PostProps => ({ ...mapApiPost(p), isDetail }),
		[],
	);

	const loadComments = useCallback(async () => {
		setCommentsFailed(false);
		try {
			const commentsRes = await read(`/api/posts/${postId}/comments`);
			if (commentsRes.success && Array.isArray(commentsRes.data)) {
				setComments(commentsRes.data.map((c: any) => toPostProps(c)));
			} else {
				setCommentsFailed(true);
			}
		} catch (error) {
			console.error("Failed to fetch replies:", error);
			setCommentsFailed(true);
		} finally {
			setCommentsLoaded(true);
		}
	}, [postId, read, toPostProps]);

	const fetchPostData = useCallback(async () => {
		// The post and its replies are two independent reads, and each lands
		// the moment it arrives. They used to wait for each other in one
		// Promise.all, so a slow post refresh held back replies that were
		// already here (owner 2026-09-29: "it doesn't even load the
		// comment"). Opened from a card, the post is already on screen.
		const postTask = read(`/api/posts/${postId}`)
			.then((postRes) => {
				if (postRes.success) {
					const p = postRes.data;

					// One extra request, and only for replies. The id may arrive
					// raw or populated depending on the endpoint, so handle both.
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
					updatePostCache({ postId: p._id, post: toPostProps(p, true) });
				} else {
					toast("Post not found", { type: "error" });
				}
			})
			.catch((error) => {
				console.error("Failed to fetch post:", error);
				toast("Failed to load post", { type: "error" });
			})
			.finally(() => setLoading(false));

		await Promise.all([postTask, loadComments()]);
	}, [postId, toast, updatePostCache, toPostProps, read, loadComments]);

	// Wait for Clerk: on a full page load (a shared link, a refresh) the
	// first effect runs before the session is ready, the read has no token
	// and never leaves the browser, and the page said "This post doesn't
	// exist" about a post that does (2026-09-29).
	const { isLoaded: authReady } = useAuth();
	useEffect(() => {
		if (postId && authReady) {
			fetchPostData();
		}
	}, [postId, fetchPostData, authReady]);

	// Arriving via the comment icon (#comments): the browser's native hash
	// scroll fires before the async post has rendered, so it lands at the
	// top. Scroll ourselves once the layout is real (owner 2026-09-03).
	useEffect(() => {
		if (loading) return;
		if (window.location.hash !== "#comments" && !takeRepliesJump(postId))
			return;
		const id = window.setTimeout(() => {
			document
				.getElementById("comments")
				?.scrollIntoView({ block: "start", behavior: "smooth" });
		}, 80);
		return () => window.clearTimeout(id);
	}, [loading]);

	if (loading) {
		return (
			<div className="flex min-h-0 flex-1 flex-col">
				<header className="shrink-0 bg-page border-b border-hairline px-4 py-2 flex items-center gap-6">
					<motion.button
						{...press}
						className="rounded-pill h-11 w-11 sm:h-9 sm:w-9 shrink-0 hover:bg-raised flex items-center justify-center transition-colors cursor-pointer text-primary"
						type="button"
						aria-label="Go back"
						onClick={() => (onBack ? onBack() : goBack("/"))}
					>
						<ArrowLeft className="w-5 h-5" />
					</motion.button>
					<h1 className="font-display text-lg font-semibold leading-5 text-primary">
						{t("post.title")}
					</h1>
				</header>
				<div className="min-h-0 flex-1 overflow-y-auto">
					<div className="p-4">
						<PostSkeleton />
					</div>
					<div className="p-4">
						<PostSkeleton />
						<PostSkeleton />
					</div>
				</div>
			</div>
		);
	}

	if (!post) {
		return (
			<div className="flex min-h-0 flex-1 flex-col items-center justify-center">
				<EmptyState
					icon={Search}
					title="This post doesn't exist"
					caption="It may have been deleted, or the link is wrong."
					action={{ label: "Go back", onClick: () => (onBack ? onBack() : goBack("/")) }}
				/>
			</div>
		);
	}

	const handleCommentStart = (repliedTo: string) => {
		if (repliedTo === postId) setIsAddingComment(true);
	};

	const expectedReplies = post.stats.replies ?? 0;
	const repliesPending =
		!commentsLoaded && !commentsFailed && comments.length === 0 && expectedReplies > 0;

	const handleCommentSuccess = async (repliedTo: string) => {
		if (repliedTo !== postId) {
			setLanded((prev) => ({ id: repliedTo, n: (prev?.n ?? 0) + 1 }));
			return;
		}
		await fetchPostData();
		setIsAddingComment(false);
	};

	return (
		// Header, the thread's own scroller, the reply box: a column, so the
		// box sits at the bottom however short the thread is (owner
		// 2026-09-29: "it hangs at the top"). The phone tab bar is hidden on
		// a post, so only the home indicator is cleared.
		<div className="flex min-h-0 flex-1 flex-col">
			<header className="shrink-0 bg-page border-b border-hairline px-2 sm:px-4 py-2 flex items-center gap-2 sm:gap-6">
				<motion.button
					{...press}
					className="rounded-pill h-11 w-11 sm:h-9 sm:w-9 shrink-0 hover:bg-raised flex items-center justify-center transition-colors cursor-pointer text-primary"
					type="button"
					onClick={() => (onBack ? onBack() : goBack("/"))}
				>
					<ArrowLeft className="w-5 h-5" />
				</motion.button>
				<h1 className="font-display text-lg font-semibold leading-5 text-primary">
					{t("post.title")}
				</h1>
			</header>

			<div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
			{/* Thread ancestry: the post being replied to sits above the focused
			    one, joined by a vertical rule so the two read as one thread
			    rather than two unrelated cards. Muted, because the reply is
			    what the reader came for. */}
			{parent && (
				<div className="relative">
					{/* It arrives after the focused post, so it opens rather than
					    shoving the reply down in one frame. */}
					<motion.div
						key={parent.id}
						{...collapse}
						className={clsx(settledParentId !== parent.id && "overflow-hidden")}
						onAnimationComplete={() => setSettledParentId(parent.id)}
					>
						<ImpressionSensor meta={{ post: parent.id, author: parent.author?.id ?? "", surface: "post_detail", position: 0 }}>
							<PostCard post={parent} />
						</ImpressionSensor>
					</motion.div>
					<span
						aria-hidden
						className="absolute left-[38px] bottom-0 h-4 w-0.5 translate-y-full bg-hairline"
					/>
				</div>
			)}

			<ImpressionSensor meta={{ post: post.id, author: post.author?.id ?? "", surface: "post_detail", position: 0 }}>
				<PostCard post={post} />
			</ImpressionSensor>

			<div id="comments" className="scroll-mt-16" />

			<div className="flex flex-1 flex-col">
				<AnimatePresence>
					{isAddingComment && (
						<motion.div
							key="pending-reply"
							{...collapse}
							className="overflow-hidden"
						>
							<ReplySkeleton />
						</motion.div>
					)}
				</AnimatePresence>
				{/* Mounted WITH its first rows, so the cascade plays once, on
				    first load. A refetch keeps the keys and replays nothing; a
				    reply that lands later rises alone. */}
				{(comments.length > 0 || repliesPending) && (
					// The Instagram lead line (owner pick A + C, 2026-09-28).
					// Shown while the replies load too, with the count the card
					// already carried, so nothing below the post jumps.
					<div className="flex items-baseline justify-between px-4 pb-1 pt-3">
						<h2 className="font-sans text-[calc(13px*var(--ws-fs))] font-semibold text-primary">
							Comments
						</h2>
						<span className="font-sans text-[calc(13px*var(--ws-fs))] tabular-nums text-subtle">
							{formatCompact(Math.max(post.stats.replies ?? 0, comments.length))}
						</span>
					</div>
				)}
				{/* The replies are loading: rows shaped like the real ones, as many
				    as the post says it has (up to four), never a blank space
				    (owner 2026-09-29: "the comments don't show loading skeleton").
				    A post the card says has no replies gets no fake rows. */}
				{repliesPending && (
					<div role="status" aria-label="Loading replies" className="flex flex-col">
						{Array.from({ length: Math.min(expectedReplies, 4) }, (_, i) => (
							<ReplySkeleton key={i} i={i} />
						))}
					</div>
				)}
				{commentsFailed && comments.length === 0 && (
					<div className="flex items-center justify-center gap-3 px-4 py-10 font-sans text-[calc(14px*var(--ws-fs))] text-muted">
						<span>Couldn't load the replies.</span>
						<button
							type="button"
							onClick={() => void loadComments()}
							className="flex h-10 cursor-pointer items-center rounded-pill bg-primary/5 px-4 font-semibold text-primary transition-colors hover:bg-primary/10"
						>
							Try again
						</button>
					</div>
				)}
				{comments.length > 0 && (
					<motion.div
						variants={staggerParentFast}
						initial="hidden"
						animate="show"
						className="flex flex-col"
					>
						{comments.map((comment, i) => (
							<motion.div
								key={comment.id}
								variants={staggerItem}
								initial={
									!repliesPaintedRef.current && i >= 9 ? false : undefined
								}
								className="relative"
							>
								{/* No lines between or under replies (owner rulings
								    2026-09-03 and 2026-09-28): the replies read as one
								    conversation by spacing and indent alone. */}
								<ReplyThread
									reply={comment}
									position={i}
									onReply={aimAt}
									landed={landed}
								/>
							</motion.div>
						))}
					</motion.div>
				)}
				<AnimatePresence>
					{commentsLoaded && !commentsFailed && comments.length === 0 && !isAddingComment && (
						<motion.div
							key="no-comments"
							{...reveal(0)}
							exit={swap.exit}
							className="p-12 text-center text-muted font-sans text-sm"
						>
							No comments yet. Be the first to reply!
						</motion.div>
					)}
				</AnimatePresence>
			</div>

			</div>

			{/* The reply box is the foot of the column (owner 2026-09-28):
			    always in reach, the thread scrolling above it. */}
			<div className="shrink-0 border-t border-hairline bg-page pb-[var(--ws-safe-bottom)]">
			<CommentComposer
				postId={postId}
				target={replyTarget}
				onClearTarget={() => setReplyTarget(null)}
				onCommentStart={handleCommentStart}
				onCommentSuccess={handleCommentSuccess}
			/>
			</div>
		</div>
	);
}

/**
 * One reply and the answers under it, the comments layout the owner picked
 * (A + C, 2026-09-28, https://claude.ai/artifact/R5uguMNcQHA2t3gQo3E6QE):
 * Threads' compact row (A) with Instagram's fold (C). Answers stay behind
 * "View N replies" until asked for, load from the reply's own comments,
 * oldest first so they read as a conversation, and sit one indent in. An
 * answer to an answer joins the same indent rather than stepping further
 * right, so a long exchange never runs out of column.
 */
function ReplyThread({
	reply,
	position,
	onReply,
	landed,
	nested = false,
}: {
	reply: PostProps;
	position: number;
	onReply: (p: PostProps) => void;
	landed: { id: string; n: number } | null;
	nested?: boolean;
}) {
	const read = useGatewayRead();
	const [open, setOpen] = useState(false);
	const [items, setItems] = useState<PostProps[] | null>(null);
	const [loading, setLoading] = useState(false);
	const [failed, setFailed] = useState(false);
	// Clip only while the height moves: a row's menus hang outside it.
	const [settled, setSettled] = useState(false);

	const load = useCallback(async () => {
		setLoading(true);
		setFailed(false);
		const res = await read(`/api/posts/${reply.id}/comments`);
		if (res.success) {
			const rows = Array.isArray(res.data) ? (res.data as any[]) : [];
			setItems(rows.map((p) => mapApiPost(p)).reverse());
		} else {
			setFailed(true);
		}
		setLoading(false);
	}, [read, reply.id]);

	// A reply just posted to this one: open the fold with it in place. Keyed
	// on the landing alone, so a new `load` identity can never re-fire it.
	const loadRef = useRef(load);
	loadRef.current = load;
	useEffect(() => {
		if (!landed || landed.id !== reply.id) return;
		void loadRef.current().then(() => setOpen(true));
	}, [landed, reply.id]);

	const n = Math.max(reply.stats.replies ?? 0, items?.length ?? 0);

	return (
		<>
			<ImpressionSensor
				meta={{
					post: reply.id,
					author: reply.author?.id ?? "",
					surface: "post_detail",
					position,
				}}
			>
				<PostCard post={reply} variant="reply" onReply={onReply} />
			</ImpressionSensor>
			{n > 0 && (
				<button
					type="button"
					aria-expanded={open}
					disabled={loading}
					onClick={() => {
						if (failed) {
							setOpen(true);
							void load();
							return;
						}
						if (open) {
							setSettled(false);
							setOpen(false);
							return;
						}
						setOpen(true);
						if (items === null) void load();
					}}
					// Lines up with the row's text column: 16px gutter, 36px
					// avatar, 12px gap.
					className="-mt-1 flex h-9 cursor-pointer items-center gap-2.5 pl-16 font-sans text-[calc(13px*var(--ws-fs))] font-semibold text-muted transition-colors hover:text-primary"
				>
					<span aria-hidden className="h-px w-6 bg-subtle" />
					{failed
						? "Couldn't load the replies. Try again"
						: open
							? "Hide replies"
							: `View ${formatCompact(n)} ${n === 1 ? "reply" : "replies"}`}
				</button>
			)}
			{/* Opening: rows shaped like the answers, where they will land. */}
			{open && loading && items === null && (
				<div
					role="status"
					aria-label="Loading replies"
					className={nested ? undefined : "pl-12"}
				>
					{Array.from({ length: Math.min(n, 3) }, (_, i) => (
						<ReplySkeleton key={i} i={i + 1} />
					))}
				</div>
			)}
			<AnimatePresence initial={false}>
				{open && items && items.length > 0 && (
					<motion.div
						key="answers"
						{...collapse}
						className={clsx(!settled && "overflow-hidden")}
						onAnimationComplete={() => setSettled(true)}
					>
						<div className={nested ? undefined : "pl-12"}>
							{items.map((c, i) => (
								<ReplyThread
									key={c.id}
									reply={c}
									position={i}
									onReply={onReply}
									landed={landed}
									nested
								/>
							))}
						</div>
					</motion.div>
				)}
			</AnimatePresence>
		</>
	);
}
