import Link from "next/link";
import Image from "next/image";
import {
	Heart,
	MessageSquare,
	Repeat,
	Bookmark,
	MoreHorizontal,
	Trash2,
	Link2,
	Flag,
	Ban,
	BarChart2,
	Pin,
} from "lucide-react";
import clsx from "clsx";
import { useState, useRef, useEffect } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { motion, AnimatePresence } from "framer-motion";
import { userAtom } from "@/store/user.atom";
import { bookmarksAtom } from "@/store/bookmarks.atom";
import {
	deletePostAction,
	likePostAction,
	unlikePostAction,
	bookmarkPostAction,
	unbookmarkPostAction,
} from "@/lib/post.actions";
import ConfirmModal from "@/components/ui/ConfirmModal";
import { useToast } from "@/components/ui/Toast/ToastContext";
import ImageModal from "@/components/ui/ImageModal";

export interface PostProps {
	id: string;
	author: {
		id: string;
		name: string;
		username: string;
		avatar: string;
		isVerified?: boolean;
	};
	content: string;
	timestamp: string;
	images?: string[];
	stats: {
		replies: number;
		reposts: number;
		likes: number;
	};
	isLiked?: boolean;
	isBookmarked?: boolean;
	isDetail?: boolean;
	linkPreview?: {
		url: string;
		title: string;
		description: string;
		image: string;
		domain: string;
	};
}

export const PostCard = ({ post }: { post: PostProps }) => {
	// ... existing state hooks ...
	const [isLiked, setIsLiked] = useState(post.isLiked);
	const [likeCount, setLikeCount] = useState(post.stats.likes);
	const [isBookmarked, setIsBookmarked] = useState(post.isBookmarked);

	const currentUser = useAtomValue(userAtom);
	const setUser = useSetAtom(userAtom);
	const setBookmarks = useSetAtom(bookmarksAtom);
	const { toast } = useToast();

	// Menu State
	const [isMenuOpen, setIsMenuOpen] = useState(false);
	const menuRef = useRef<HTMLDivElement>(null);

	// Delete State
	const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
	const [isDeleting, setIsDeleting] = useState(false);
	const [isDeleted, setIsDeleted] = useState(false);

	// Image Modal State
	const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(
		null,
	);

	const isOwnPost =
		currentUser?.userId === post.author.id ||
		currentUser?._id === post.author.id;

	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
				setIsMenuOpen(false);
			}
		};

		if (isMenuOpen) {
			document.addEventListener("mousedown", handleClickOutside);
		}
		return () => {
			document.removeEventListener("mousedown", handleClickOutside);
		};
	}, [isMenuOpen]);

	const handleLike = async () => {
		if (!currentUser) {
			toast("Please login to like posts", { type: "error" });
			return;
		}

		// Optimistic update
		const newIsLiked = !isLiked;
		setIsLiked(newIsLiked);
		setLikeCount((prev) => (newIsLiked ? prev + 1 : Math.max(0, prev - 1)));

		try {
			if (newIsLiked) {
				await likePostAction(post.id);
			} else {
				await unlikePostAction(post.id);
			}
		} catch (error) {
			console.error("Like error:", error);
			// Revert on error
			setIsLiked(!newIsLiked);
			setLikeCount((prev) => (newIsLiked ? prev - 1 : prev + 1));
			toast("Failed to update like", { type: "error" });
		}
	};

	const handleBookmark = async () => {
		if (!currentUser) {
			toast("Please login to bookmark posts", { type: "error" });
			return;
		}

		// Optimistic update
		const newIsBookmarked = !isBookmarked;
		setIsBookmarked(newIsBookmarked);

		try {
			if (newIsBookmarked) {
				// Update user atom for global consistency
				setUser((prev) =>
					prev
						? { ...prev, bookmarks: [...(prev.bookmarks || []), post.id] }
						: null,
				);
				// Update bookmarks atom
				setBookmarks((prev) => [{ ...post, isBookmarked: true }, ...prev]);

				await bookmarkPostAction(post.id);
				toast("Post added to bookmarks", { type: "success" });
			} else {
				setUser((prev) =>
					prev
						? {
								...prev,
								bookmarks: (prev.bookmarks || []).filter(
									(id) => id !== post.id,
								),
							}
						: null,
				);
				// Update bookmarks atom
				setBookmarks((prev) => prev.filter((p) => p.id !== post.id));

				await unbookmarkPostAction(post.id);
				toast("Post removed from bookmarks", { type: "success" });
			}
		} catch (error) {
			console.error("Bookmark error:", error);
			// Revert
			setIsBookmarked(!newIsBookmarked);
			// Revert atom changes if necessary (complex, skipping for simple optimistic UI)
			toast("Failed to update bookmark", { type: "error" });
		}
	};

	const handleDelete = async () => {
		setIsDeleting(true);
		try {
			const res = await deletePostAction(post.id);
			if (res.success) {
				setIsDeleted(true);
				toast("Post deleted successfully", { type: "success" });
			} else {
				console.error("Failed to delete post");
				toast("Failed to delete post", { type: "error" });
			}
		} catch (err) {
			console.error(err);
			toast("Something went wrong", { type: "error" });
		} finally {
			setIsDeleting(false);
		}
	};

	const handleMenuAction = (action: string) => {
		setIsMenuOpen(false);

		if (action === "delete") {
			setIsDeleteModalOpen(true);
		} else if (action === "copy_link") {
			const url = `${window.location.origin}/post/${post.id}`;
			navigator.clipboard
				.writeText(url)
				.then(() => {
					toast("Link copied to clipboard", { type: "success" });
				})
				.catch((err) => {
					console.error("Failed to copy link: ", err);
					toast("Failed to copy link", { type: "error" });
				});
		}
	};

	const MAX_LENGTH = 280;
	const shouldTruncate = !post.isDetail && post.content.length > MAX_LENGTH;
	const displayedContent = shouldTruncate
		? post.content.slice(0, MAX_LENGTH)
		: post.content;

	const formatContent = (text: string) => {
		const urlRegex = /(https?:\/\/[^\s]+)/g;
		return text.split(urlRegex).map((part, index) => {
			if (part.match(urlRegex)) {
				return (
					<a
						key={index}
						href={part}
						target="_blank"
						rel="noopener noreferrer"
						className="text-yellow-500 hover:underline relative z-10 pointer-events-auto"
						onClick={(e) => e.stopPropagation()}
					>
						{part}
					</a>
				);
			}
			return part;
		});
	};

	const getImageGridClass = (count: number) => {
		switch (count) {
			case 1:
				return "grid-cols-1 grid-rows-1 h-auto aspect-video"; // Default fallback if needed
			case 2:
				return "grid-cols-2 grid-rows-1 h-[290px]";
			case 3:
				return "grid-cols-2 grid-rows-2 h-[290px]";
			case 4:
				return "grid-cols-2 grid-rows-2 h-[290px]";
			default:
				return "grid-cols-1";
		}
	};

	const getImageStyle = (index: number, total: number) => {
		if (total === 3) {
			if (index === 0) return "row-span-2";
		}
		return "";
	};

	if (isDeleted) return null;

	return (
		<article className="relative block p-6 border-b border-zinc-800 hover:bg-zinc-900/30 transition-colors">
			{/* Overlay Link for the entire card */}
			<Link
				href={`/post/${post.id}`}
				className="absolute inset-0 z-0"
				aria-label="View post"
			/>

			<ConfirmModal
				isOpen={isDeleteModalOpen}
				onClose={() => setIsDeleteModalOpen(false)}
				onConfirm={handleDelete}
				title="Delete Post?"
				message="This can't be undone and it will be removed from your profile, the timeline of any accounts that follow you, and from search results."
				confirmText={isDeleting ? "Deleting..." : "Delete"}
				isDestructive={true}
			/>

			<ImageModal
				isOpen={selectedImageIndex !== null}
				onClose={() => setSelectedImageIndex(null)}
				images={post.images || []}
				initialIndex={selectedImageIndex || 0}
			/>

			<div className="flex gap-4 relative z-10 pointer-events-none">
				<div className="shrink-0 pointer-events-auto mt-1">
					<Link
						href={`/profile/${post.author.username}`}
						className="relative block w-10 h-10 rounded-full overflow-hidden border border-zinc-700 hover:border-yellow-500 transition-colors"
					>
						<Image
							src={post.author.avatar}
							alt={post.author.username}
							fill
							className="object-cover"
						/>
					</Link>
				</div>
				<div className="flex-1 min-w-0">
					<div className="flex items-center justify-between mb-1">
						<div className="flex items-center gap-2 overflow-hidden pointer-events-auto">
							<Link
								href={`/profile/${post.author.username}`}
								className="font-bold text-white truncate font-space-mono hover:underline decoration-yellow-500 underline-offset-4"
							>
								{post.author.name}
							</Link>
							<Link
								href={`/profile/${post.author.username}`}
								className="text-zinc-500 text-sm truncate font-space-mono hover:text-zinc-300"
							>
								@{post.author.username}
							</Link>
							<span className="text-zinc-700 text-xs">•</span>
							<span className="text-zinc-500 text-sm font-space-mono hover:text-zinc-400">
								{post.timestamp}
							</span>
						</div>

						<div className="relative pointer-events-auto" ref={menuRef}>
							<button
								onClick={(e) => {
									e.stopPropagation();
									setIsMenuOpen(!isMenuOpen);
								}}
								className={clsx(
									"text-zinc-600 hover:text-yellow-500 transition-colors p-1.5 rounded-full hover:bg-yellow-500/10 cursor-pointer",
									isMenuOpen && "text-yellow-500 bg-yellow-500/10",
								)}
							>
								<MoreHorizontal className="w-5 h-5" />
							</button>

							<AnimatePresence>
								{isMenuOpen && (
									<motion.div
										initial={{ opacity: 0, scale: 0.95, y: -10, x: 10 }}
										animate={{ opacity: 1, scale: 1, y: 0, x: 0 }}
										exit={{ opacity: 0, scale: 0.95, y: -10, x: 10 }}
										transition={{ duration: 0.15, ease: "easeOut" }}
										className="absolute right-0 top-8 w-56 bg-zinc-900 rounded-xl border border-zinc-800 shadow-2xl z-50 overflow-hidden py-1"
										onClick={(e) => e.stopPropagation()}
									>
										{isOwnPost ? (
											<>
												<button
													onClick={(e) => {
														e.stopPropagation();
														handleMenuAction("copy_link");
													}}
													className="w-full text-left px-4 py-3 hover:bg-zinc-800 flex items-center gap-3 text-sm text-zinc-300 hover:text-white transition-colors font-space-mono"
												>
													<Link2 className="w-4 h-4" />
													Copy link
												</button>
												<button
													onClick={(e) => {
														e.stopPropagation();
														handleMenuAction("pin");
													}}
													className="w-full text-left px-4 py-3 hover:bg-zinc-800 flex items-center gap-3 text-sm text-zinc-300 hover:text-white transition-colors font-space-mono"
												>
													<Pin className="w-4 h-4" />
													Pin to profile
												</button>
												<button
													onClick={(e) => {
														e.stopPropagation();
														handleMenuAction("activity");
													}}
													className="w-full text-left px-4 py-3 hover:bg-zinc-800 flex items-center gap-3 text-sm text-zinc-300 hover:text-white transition-colors font-space-mono"
												>
													<BarChart2 className="w-4 h-4" />
													View activity
												</button>
												<div className="my-1 border-t border-zinc-800" />
												<button
													onClick={(e) => {
														e.stopPropagation();
														handleMenuAction("delete");
													}}
													className="w-full text-left px-4 py-3 hover:bg-red-500/10 text-red-500 flex items-center gap-3 text-sm transition-colors font-space-mono font-bold"
												>
													<Trash2 className="w-4 h-4" />
													Delete post
												</button>
											</>
										) : (
											<>
												<button
													onClick={(e) => {
														e.stopPropagation();
														handleMenuAction("not_interested");
													}}
													className="w-full text-left px-4 py-3 hover:bg-zinc-800 flex items-center gap-3 text-sm text-zinc-300 hover:text-white transition-colors font-space-mono"
												>
													<Ban className="w-4 h-4" />
													Not interested
												</button>
												<button
													onClick={(e) => {
														e.stopPropagation();
														handleMenuAction("copy_link");
													}}
													className="w-full text-left px-4 py-3 hover:bg-zinc-800 flex items-center gap-3 text-sm text-zinc-300 hover:text-white transition-colors font-space-mono"
												>
													<Link2 className="w-4 h-4" />
													Copy link
												</button>
												<div className="my-1 border-t border-zinc-800" />
												<button
													onClick={(e) => {
														e.stopPropagation();
														handleMenuAction("block");
													}}
													className="w-full text-left px-4 py-3 hover:bg-zinc-800 flex items-center gap-3 text-sm text-zinc-300 hover:text-white transition-colors font-space-mono"
												>
													<Ban className="w-4 h-4" />
													Block @{post.author.username}
												</button>
												<button
													onClick={(e) => {
														e.stopPropagation();
														handleMenuAction("report");
													}}
													className="w-full text-left px-4 py-3 hover:bg-zinc-800 flex items-center gap-3 text-sm text-zinc-300 hover:text-white transition-colors font-space-mono"
												>
													<Flag className="w-4 h-4" />
													Report post
												</button>
											</>
										)}
									</motion.div>
								)}
							</AnimatePresence>
						</div>
					</div>
					{/* Post Content - Text is clickable via overlay, but interaction passes through due to pointer-events-none */}
					<p className="text-zinc-100 whitespace-pre-wrap mb-4 font-normal leading-relaxed text-[14px] font-space-mono tracking-tight pointer-events-none">
						{formatContent(displayedContent)}
						{shouldTruncate && (
							<span className="text-zinc-500 pointer-events-auto">
								...{" "}
								<Link
									href={`/post/${post.id}`}
									className="text-yellow-500 hover:underline font-medium relative z-20"
								>
									See more
								</Link>
							</span>
						)}
					</p>

					{/* Link Preview */}
					{post.linkPreview && !post.images?.length && (
						<a
							href={post.linkPreview.url}
							target="_blank"
							rel="noopener noreferrer"
							className="block mt-2 mb-3 rounded-xl border border-zinc-800 overflow-hidden bg-zinc-900/50 hover:bg-zinc-900 transition-colors pointer-events-auto group"
						>
							{post.linkPreview.image && (
								<div className="aspect-video relative w-full bg-zinc-900 border-b border-zinc-800/50">
									<img
										src={post.linkPreview.image}
										alt={post.linkPreview.title}
										className="absolute inset-0 w-full h-full object-cover"
										onError={(e) => {
											e.currentTarget.style.display = "none";
										}}
									/>
								</div>
							)}
							<div className="p-3">
								<h3 className="text-sm font-bold text-zinc-200 line-clamp-1 font-space-mono mb-0.5 group-hover:text-yellow-500 transition-colors">
									{post.linkPreview.title}
								</h3>
								<p className="text-xs text-zinc-500 line-clamp-2 font-space-mono mb-1">
									{post.linkPreview.description}
								</p>
								<div className="flex items-center gap-1 text-[10px] text-zinc-600 font-space-mono">
									<Link2 className="w-3 h-3" />
									<span>{post.linkPreview.domain}</span>
								</div>
							</div>
						</a>
					)}

					{post.images && post.images.length === 1 && (
						<div className="mb-3 w-full">
							<img
								src={post.images[0]}
								alt="Post attachment"
								className="block h-auto w-auto max-w-full max-h-[500px] object-cover rounded-xl border border-zinc-800 cursor-zoom-in hover:opacity-95 transition-all relative z-10"
								onClick={(e) => {
									e.stopPropagation();
									e.preventDefault();
									setSelectedImageIndex(0);
								}}
							/>
						</div>
					)}
					{post.images && post.images.length > 1 && (
						<div
							className={clsx(
								"grid gap-0.5 rounded-xl overflow-hidden mb-3 w-full border border-zinc-800 pointer-events-auto",
								getImageGridClass(post.images.length),
							)}
						>
							{post.images.slice(0, 4).map((src, i) => (
								<div
									key={i}
									className={clsx(
										"relative z-10 w-full h-full bg-cover bg-center cursor-zoom-in hover:opacity-95 transition-opacity",
										getImageStyle(i, post.images!.length),
									)}
									style={{ backgroundImage: `url('${src}')` }}
									onClick={(e) => {
										e.stopPropagation();
										e.preventDefault();
										setSelectedImageIndex(i);
									}}
								/>
							))}
						</div>
					)}
					<div className="flex items-center justify-between text-zinc-500 mt-2 max-w-md pointer-events-auto">
						<button
							onClick={(e) => e.stopPropagation()}
							className="flex items-center gap-2 hover:text-blue-400 transition-colors group cursor-pointer"
						>
							<div className="p-2 rounded-full group-hover:bg-blue-400/10 transition-colors">
								<MessageSquare className="w-4 h-4" />
							</div>
							<span className="text-xs font-space-mono group-hover:text-blue-400">
								{post.stats.replies || ""}
							</span>
						</button>
						<button
							onClick={(e) => e.stopPropagation()}
							className="flex items-center gap-2 hover:text-green-400 transition-colors group cursor-pointer"
						>
							<div className="p-2 rounded-full group-hover:bg-green-400/10 transition-colors">
								<Repeat className="w-4 h-4" />
							</div>
							<span className="text-xs font-space-mono group-hover:text-green-400">
								{post.stats.reposts || ""}
							</span>
						</button>
						<button
							onClick={(e) => {
								e.stopPropagation();
								handleLike();
							}}
							className={clsx(
								"flex items-center gap-2 transition-colors group cursor-pointer",
								isLiked ? "text-pink-500" : "hover:text-pink-500",
							)}
						>
							<div className="p-2 rounded-full group-hover:bg-pink-500/10 transition-colors">
								<Heart className={clsx("w-4 h-4", isLiked && "fill-current")} />
							</div>
							<span
								className={clsx(
									"text-xs font-space-mono",
									isLiked && "text-pink-500",
									"group-hover:text-pink-500",
								)}
							>
								{likeCount || ""}
							</span>
						</button>
						<button
							onClick={(e) => {
								e.stopPropagation();
								handleBookmark();
							}}
							className={clsx(
								"flex items-center gap-2 transition-colors group cursor-pointer",
								isBookmarked ? "text-blue-500" : "hover:text-blue-500",
							)}
						>
							<div className="p-2 rounded-full group-hover:bg-blue-500/10 transition-colors">
								<Bookmark
									className={clsx("w-4 h-4", isBookmarked && "fill-current")}
								/>
							</div>
						</button>
					</div>
				</div>
			</div>
		</article>
	);
};
