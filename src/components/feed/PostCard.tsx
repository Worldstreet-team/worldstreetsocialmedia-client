"use client";

import EllipsisIcon from "@/assets/icons/EllipsisIcon";
import VerifiedIcon from "@/assets/icons/VerifiedIcon";

import {
	likePostAction,
	unlikePostAction,
	bookmarkPostAction,
	unbookmarkPostAction,
} from "@/lib/post.actions";
import { useSetAtom } from "jotai";

import Link from "next/link";

export interface PostProps {
	author: {
		id: string; // Added ID for ownership check
		name?: string;
		firstName: string;
		lastName: string;
		username: string;
		avatar: string;
		isVerified?: boolean;
	};
	content: string;
	timestamp: string;
	stats: {
		replies: number;
		reposts: number;
		likes: number;
	};
	images?: string[];
	videos?: string[];
	id: string;
	isLiked?: boolean; // Optional: If server checks for us
	isBookmarked?: boolean;
}

import { useState, useRef, useEffect } from "react";
import { useAtomValue } from "jotai";
import { userAtom } from "@/store/user.atom";
import { motion, AnimatePresence } from "framer-motion";
import ChatIcon from "@/assets/icons/ChatIcon";
import ShareIcon from "@/assets/icons/ShareIcon";
import Heart2Icon from "@/assets/icons/Heart2Icon";
import Bookmark2Icon from "@/assets/icons/Bookmark2Icon";
import HeartFill2Icon from "@/assets/icons/HeartFill2Icon";

import ConfirmModal from "@/components/ui/ConfirmModal";
import { deletePostAction } from "@/lib/post.actions";
import { useRouter, usePathname } from "next/navigation";

export function PostCard({ post }: { post: PostProps }) {
	const images = post.images || [];
	const [isMenuOpen, setIsMenuOpen] = useState(false);
	const menuRef = useRef<HTMLDivElement>(null);
	const currentUser = useAtomValue(userAtom);
	const router = useRouter();
	const pathname = usePathname();

	// Use _id from userAtom (which maps to Mongo ID) or userId if that's what we use for comparison
	const isOwnPost = currentUser?._id === post.author.id;
	const setUser = useSetAtom(userAtom);

	const [isLiked, setIsLiked] = useState(post.isLiked || false);
	const [likesCount, setLikesCount] = useState(post.stats.likes);
	// Prefer server-side isBookmarked if available, otherwise fall back to client-side check
	const [isBookmarked, setIsBookmarked] = useState(
		post.isBookmarked ?? (currentUser?.bookmarks?.includes(post.id) || false),
	);

	// Delete Modal State
	const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
	const [isDeleting, setIsDeleting] = useState(false);
	const [isDeleted, setIsDeleted] = useState(false);

	const handleLike = async (e: React.MouseEvent) => {
		e.stopPropagation();
		if (!currentUser) return; // Or trigger auth modal

		// Optimistic update
		const newIsLiked = !isLiked;
		setIsLiked(newIsLiked);
		setLikesCount((prev) => (newIsLiked ? prev + 1 : Math.max(0, prev - 1)));

		if (newIsLiked) {
			await likePostAction(post.id);
		} else {
			await unlikePostAction(post.id);
		}
	};

	const handleBookmark = async (e: React.MouseEvent) => {
		e.stopPropagation();
		if (!currentUser) return;

		// Optimistic update
		const newIsBookmarked = !isBookmarked;
		setIsBookmarked(newIsBookmarked);

		// Also update global user atom so other instances reflect change if needed (though local state takes precedence)
		if (newIsBookmarked) {
			setUser((prev) =>
				prev
					? { ...prev, bookmarks: [...(prev.bookmarks || []), post.id] }
					: null,
			);
			await bookmarkPostAction(post.id);
		} else {
			setUser((prev) =>
				prev
					? {
							...prev,
							bookmarks: (prev.bookmarks || []).filter((id) => id !== post.id),
						}
					: null,
			);
			await unbookmarkPostAction(post.id);
		}
	};

	const handleDelete = async () => {
		setIsDeleting(true);
		try {
			const res = await deletePostAction(post.id);
			if (res.success) {
				setIsDeleted(true);

				// If we are on the post detail page, redirect to home
				if (pathname === `/post/${post.id}`) {
					router.push("/");
				}
			} else {
				console.error("Failed to delete post");
			}
		} catch (err) {
			console.error(err);
		} finally {
			setIsDeleting(false);
		}
	};

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

	const handleMenuAction = (action: string) => {
		console.log(`Action triggered: ${action} on post ${post.id}`);
		setIsMenuOpen(false);

		if (action === "delete") {
			setIsDeleteModalOpen(true);
		} else if (action === "copy_link") {
			const url = `${window.location.origin}/post/${post.id}`;
			navigator.clipboard
				.writeText(url)
				.then(() => {
					// Optional: Show toast or feedback
					console.log("Link copied to clipboard");
				})
				.catch((err) => {
					console.error("Failed to copy link: ", err);
				});
		}
	};

	const getImageGridClass = (count: number) => {
		switch (count) {
			case 1:
				return "grid-cols-1 grid-rows-1 h-auto aspect-[16/9]";
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

	const handlePostClick = () => {
		// Navigate to post detail
		router.push(`/post/${post.id}`);
	};

	if (isDeleted) return null;

	return (
		// biome-ignore lint/a11y/useSemanticElements: Card is complex and contains other interactive elements
		<div
			className="p-4 border-b border-black/10 cursor-pointer transition-colors relative hover:bg-black/5"
			onClick={handlePostClick}
			onKeyDown={(e) => {
				if (e.key === "Enter" || e.key === " ") {
					handlePostClick();
				}
			}}
			role="button"
			tabIndex={0}
		>
			<ConfirmModal
				isOpen={isDeleteModalOpen}
				onClose={() => setIsDeleteModalOpen(false)}
				onConfirm={handleDelete}
				title="Delete Post?"
				message="This can’t be undone and it will be removed from your profile, the timeline of any accounts that follow you, and from search results."
				confirmText={isDeleting ? "Deleting..." : "Delete"}
				isDestructive={true}
			/>

			<article className="flex gap-3">
				<div
					className="w-10 h-10 rounded-full bg-cover bg-center shrink-0"
					style={{ backgroundImage: `url('${post.author.avatar}')` }}
				/>
				<div className="flex-1 min-w-0">
					<div className="flex items-center gap-1 relative">
						<Link
							href={`/profile/${post.author.username}`}
							onClick={(e) => e.stopPropagation()}
							className="font-bold hover:underline text-inherit decoration-inherit"
						>
							{post.author.name ||
								`${post.author.firstName} ${post.author.lastName}`}
						</Link>
						{post.author.isVerified && <VerifiedIcon />}
						<span className="text-text-light font-semibold text-sm truncate">
							@{post.author.username} · {post.timestamp}
						</span>

						<div className="ml-auto relative" ref={menuRef}>
							<button
								type="button"
								onClick={(e) => {
									e.stopPropagation();
									setIsMenuOpen(!isMenuOpen);
								}}
								className="text-text-light hover:text-primary hover:bg-primary/10 rounded-full p-1 hover:bg-black/5 transition-all ease-in-out duration-300 cursor-pointer border-black/10 border-[0.5px]"
							>
								<EllipsisIcon />
							</button>

							<AnimatePresence>
								{isMenuOpen && (
									<motion.div
										initial={{ opacity: 0, scale: 0.95, y: -10 }}
										animate={{ opacity: 1, scale: 1, y: 0 }}
										exit={{ opacity: 0, scale: 0.95, y: -10 }}
										transition={{ duration: 0.2, ease: "easeOut" }}
										className="absolute right-0 top-8 w-64 bg-white rounded-xl shadow-[0_0_10px_rgba(0,0,0,0.1)] border border-black/5 z-50 overflow-hidden py-2"
										onClick={(e) => e.stopPropagation()}
										role="menu"
									>
										{isOwnPost ? (
											<>
												<button
													type="button"
													onClick={(e) => {
														e.stopPropagation();
														handleMenuAction("copy_link");
													}}
													className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center gap-3 font-semibold text-[15px]"
												>
													<span className="material-symbols-outlined text-[20px]!">
														link
													</span>
													Copy link
												</button>
												<button
													type="button"
													onClick={(e) => {
														e.stopPropagation();
														handleMenuAction("pin");
													}}
													className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center gap-3 font-semibold text-[15px]"
												>
													<span className="material-symbols-outlined text-[20px]!">
														push_pin
													</span>
													Pin to profile
												</button>
												<button
													type="button"
													onClick={(e) => {
														e.stopPropagation();
														handleMenuAction("activity");
													}}
													className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center gap-3 font-semibold text-[15px]"
												>
													<span className="material-symbols-outlined text-[20px]!">
														bar_chart
													</span>
													View post activity
												</button>
												<button
													type="button"
													onClick={(e) => {
														e.stopPropagation();
														handleMenuAction("delete");
													}}
													className="w-full text-left px-4 py-3 hover:bg-red-50 text-red-600 flex items-center gap-3 font-semibold text-[15px]"
												>
													<span className="material-symbols-outlined text-[20px]!">
														delete
													</span>
													Delete
												</button>
											</>
										) : (
											<>
												<button
													type="button"
													onClick={(e) => {
														e.stopPropagation();
														handleMenuAction("not_interested");
													}}
													className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center gap-3 font-semibold text-[15px]"
												>
													<span className="material-symbols-outlined text-[20px]!">
														sentiment_dissatisfied
													</span>
													Not interested in this post
												</button>
												<button
													type="button"
													onClick={(e) => {
														e.stopPropagation();
														handleMenuAction("copy_link");
													}}
													className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center gap-3 font-semibold text-[15px]"
												>
													<span className="material-symbols-outlined text-[20px]!">
														link
													</span>
													Copy link
												</button>
												<button
													type="button"
													onClick={(e) => {
														e.stopPropagation();
														handleMenuAction("block");
													}}
													className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center gap-3 font-semibold text-[15px]"
												>
													<span className="material-symbols-outlined text-[20px]!">
														block
													</span>
													Block @{post.author.username}
												</button>
												<button
													type="button"
													onClick={(e) => {
														e.stopPropagation();
														handleMenuAction("report");
													}}
													className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center gap-3 font-semibold text-[15px]"
												>
													<span className="material-symbols-outlined text-[20px]!">
														flag
													</span>
													Report post
												</button>
											</>
										)}
									</motion.div>
								)}
							</AnimatePresence>
						</div>
					</div>
					<p className="text-[14px] text-black/75 font-semibold leading-normal mb-3 whitespace-pre-wrap">
						{post.content}
					</p>

					{images.length > 0 && (
						<div
							className={`grid gap-0.5 rounded-2xl overflow-hidden mb-3 w-full border border-black/10 ${getImageGridClass(images.length)}`}
						>
							{images.slice(0, 4).map((src, index) => (
								<button
									key={src}
									type="button"
									className={`relative w-full h-full bg-cover bg-center ${getImageStyle(index, images.length)} cursor-pointer outline-none focus:opacity-80 transition-opacity`}
									style={{ backgroundImage: `url('${src}')` }}
									onClick={(e) => {
										e.stopPropagation();
										// Handle image click (e.g. open lightbox)
									}}
								/>
							))}
						</div>
					)}

					{post.videos && post.videos.length > 0 && (
						<div className="rounded-2xl overflow-hidden mb-3 w-full border border-black/10 bg-black aspect-video">
							<video
								src={post.videos[0]}
								controls
								className="w-full h-full object-contain"
								controlsList="nodownload"
								poster={post.images?.[0]} // Optional: use first image as poster if available
								onClick={(e) => e.stopPropagation()}
							/>
						</div>
					)}

					<div className="flex items-center justify-between text-text-light max-w-md mt-2">
						<button
							type="button"
							className="flex items-center gap-1 group cursor-pointer bg-transparent border-none outline-none p-0"
							onClick={(e) => e.stopPropagation()}
						>
							<div className="p-2 group-hover:bg-primary/10 group-hover:text-primary rounded-full transition-colors">
								<ChatIcon />
							</div>
							<span className="text-[13px] group-hover:text-primary">
								{post.stats.replies !== 0 && post.stats.replies}
							</span>
						</button>
						{/* <button
							type="button"
							className="flex items-center gap-1 group cursor-pointer bg-transparent border-none outline-none p-0"
							onClick={(e) => e.stopPropagation()}
						>
							<div className="p-2 group-hover:bg-green-500/10 group-hover:text-green-500 rounded-full transition-colors">
								<ShareIcon />
							</div>
							<span className="text-[13px] group-hover:text-green-500">
								{post.stats.reposts !== 0 && post.stats.reposts}
							</span>
						</button> */}
						<motion.button
							className="flex items-center gap-1 group"
							onClick={handleLike}
							whileTap={{ scale: 0.8 }}
						>
							<div
								className={`
									p-2 rounded-full transition-colors relative cursor-pointer
									${
										isLiked
											? "text-pink-600"
											: "text-text-light group-hover:bg-pink-50 group-hover:text-pink-500"
									}
								`}
							>
								{isLiked ? <HeartFill2Icon color="red" /> : <Heart2Icon />}
							</div>
							<span
								className={`text-[13px] ${
									isLiked
										? "text-pink-600"
										: "text-text-light group-hover:text-pink-500"
								}`}
							>
								{likesCount !== 0 && likesCount}
							</span>
						</motion.button>
						<motion.button
							className="flex items-center gap-1 group"
							onClick={handleBookmark}
							whileTap={{ scale: 0.8 }}
						>
							<div
								className={`
									p-2 rounded-full transition-colors relative cursor-pointer
									${
										isBookmarked
											? ""
											: "text-text-light group-hover:bg-blue-50 group-hover:text-blue-500"
									}
								`}
							>
								{isBookmarked ? (
									<Bookmark2Icon isActive={true} />
								) : (
									<Bookmark2Icon />
								)}
							</div>
						</motion.button>
					</div>
				</div>
			</article>
		</div>
	);
}
