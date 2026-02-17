"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { Image as ImageIcon, Smile, Send, X, User, Link2 } from "lucide-react";
import { useUser } from "@clerk/nextjs";
import { createPostAction } from "@/lib/post.actions";
import { useToast } from "@/components/ui/Toast/ToastContext";
import EmojiPicker, { type EmojiClickData, Theme } from "emoji-picker-react";
import clsx from "clsx";

interface PostComposerProps {
	onPostSuccess?: (post?: any) => void;
	onPostStart?: () => void;
}

interface MediaItem {
	url: string;
	file: File;
	type: "image" | "video";
}

export const PostComposer = ({
	onPostSuccess,
	onPostStart,
}: PostComposerProps) => {
	const { user } = useUser();
	const [content, setContent] = useState("");
	const [isPosting, setIsPosting] = useState(false);
	const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
	const [showEmojiPicker, setShowEmojiPicker] = useState(false);

	// Link Preview State
	const [linkPreview, setLinkPreview] = useState<any>(null);
	const [isFetchingPreview, setIsFetchingPreview] = useState(false);
	const lastCheckedUrl = useRef<string | null>(null);

	const fileInputRef = useRef<HTMLInputElement>(null);
	const emojiPickerRef = useRef<HTMLDivElement>(null);
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const { toast } = useToast();

	// Detect links in content
	useEffect(() => {
		if (mediaItems.length > 0) {
			setLinkPreview(null);
			return;
		}

		const urlRegex = /(https?:\/\/[^\s]+)/g;
		const match = content.match(urlRegex);

		if (match && match[0]) {
			const url = match[0];
			if (url !== lastCheckedUrl.current) {
				lastCheckedUrl.current = url;
				fetchPreview(url);
			}
		} else {
			setLinkPreview(null);
			lastCheckedUrl.current = null;
		}
	}, [content, mediaItems.length]);

	const fetchPreview = async (url: string) => {
		setIsFetchingPreview(true);
		try {
			// Dynamically import action to avoid server-client issues if not handled
			const { getLinkPreviewAction } = await import("@/lib/post.actions");
			const res = await getLinkPreviewAction(url);
			if (res.success && res.data.title) {
				setLinkPreview(res.data);
			}
		} catch (error) {
			console.error("Failed to fetch preview", error);
		} finally {
			setIsFetchingPreview(false);
		}
	};

	// Close emoji picker when clicking outside
	useEffect(() => {
		function handleClickOutside(event: MouseEvent) {
			if (
				emojiPickerRef.current &&
				!emojiPickerRef.current.contains(event.target as Node)
			) {
				setShowEmojiPicker(false);
			}
		}
		document.addEventListener("mousedown", handleClickOutside);
		return () => {
			document.removeEventListener("mousedown", handleClickOutside);
		};
	}, []);

	// Auto-resize textarea
	useEffect(() => {
		if (textareaRef.current) {
			textareaRef.current.style.height = "auto";
			textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
		}
	}, [content]);

	const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
		// Disable if link preview exists
		if (linkPreview) return;

		if (e.target.files) {
			const files = Array.from(e.target.files);
			const remainingSlots = 4 - mediaItems.length;
			const filesToProcess = files.slice(0, remainingSlots);

			const newItems: MediaItem[] = filesToProcess.map((file) => ({
				url: URL.createObjectURL(file),
				file: file,
				type: "image",
			}));

			setMediaItems((prev) => [...prev, ...newItems]);
			if (fileInputRef.current) fileInputRef.current.value = "";
		}
	};

	const removeMedia = (index: number) => {
		setMediaItems((prev) => {
			const newItems = [...prev];
			URL.revokeObjectURL(newItems[index].url);
			newItems.splice(index, 1);
			return newItems;
		});
	};

	const removeLinkPreview = () => {
		setLinkPreview(null);
		lastCheckedUrl.current = "IGNORE"; // Helper to prevent re-fetching immediately if URL is still there
	};

	const onEmojiClick = (emojiData: EmojiClickData) => {
		setContent((prev) => prev + emojiData.emoji);
	};

	const handleSubmit = async () => {
		if ((!content.trim() && mediaItems.length === 0) || isPosting) return;

		onPostStart?.();
		setIsPosting(true);
		try {
			const formData = new FormData();
			formData.append("content", content);

			mediaItems.forEach((item) => {
				if (item.type === "image") {
					formData.append("images", item.file);
				}
			});

			if (linkPreview && mediaItems.length === 0) {
				formData.append("linkPreview", JSON.stringify(linkPreview));
			}

			const result = await createPostAction(formData);

			if (result.success) {
				setContent("");
				setMediaItems([]);
				setLinkPreview(null);
				lastCheckedUrl.current = null;
				setShowEmojiPicker(false);
				toast("Post published!", { type: "success" });
				toast("Post published!", { type: "success" });
				onPostSuccess?.(result.data);
			} else {
				toast(result.message || "Failed to post", { type: "error" });
			}
		} catch (error) {
			toast("Something went wrong", { type: "error" });
		} finally {
			setIsPosting(false);
		}
	};

	return (
		<div className="border-b border-zinc-800 p-6 mb-2 relative">
			<div className="flex gap-4">
				<div className="shrink-0">
					{user ? (
						<div className="relative w-10 h-10 rounded-full overflow-hidden border border-zinc-700">
							<Image
								src={user.imageUrl}
								alt={user.username || "User"}
								fill
								className="object-cover"
							/>
						</div>
					) : (
						<div className="w-12 h-12 rounded-full bg-zinc-800 border items-center justify-center flex border-zinc-700 overflow-hidden">
							<User className="w-6 h-6 text-zinc-500" />
						</div>
					)}
				</div>
				<div className="flex-1 w-full">
					<textarea
						ref={textareaRef}
						value={content}
						onChange={(e) => setContent(e.target.value)}
						placeholder="What's happening?"
						className="w-full bg-transparent text-lg text-white placeholder:text-zinc-600 outline-none resize-none min-h-[60px] font-medium leading-relaxed overflow-hidden font-sans"
						rows={1}
					/>

					{/* Media Preview Grid */}
					{mediaItems.length > 0 && (
						<div
							className={clsx(
								"grid gap-2 mt-3 mb-2 rounded-xl overflow-hidden relative",
								mediaItems.length === 1 ? "grid-cols-1" : "grid-cols-2",
							)}
						>
							{mediaItems.map((item, index) => (
								<div
									key={item.url}
									className={clsx(
										"relative bg-zinc-900 border border-zinc-800",
										mediaItems.length > 1 ? "aspect-square" : "aspect-video",
									)}
								>
									<Image
										src={item.url}
										alt="Preview"
										fill
										className="object-cover"
									/>
									<button
										onClick={() => removeMedia(index)}
										className="absolute top-2 right-2 p-1 bg-black/50 hover:bg-black/80 rounded-full text-white transition-colors"
									>
										<X className="w-4 h-4" />
									</button>
								</div>
							))}
						</div>
					)}

					{/* Link Preview Card */}
					{linkPreview && mediaItems.length === 0 && (
						<div className="mt-3 mb-2 rounded-xl border border-zinc-800 overflow-hidden bg-zinc-900/50 relative group">
							<button
								onClick={removeLinkPreview}
								className="absolute top-2 right-2 p-1 bg-black/50 hover:bg-black/80 rounded-full text-white transition-colors z-10 opacity-0 group-hover:opacity-100"
							>
								<X className="w-4 h-4" />
							</button>
							{linkPreview.image && (
								<div className="aspect-video relative w-full bg-zinc-900 border-b border-zinc-800/50">
									<img
										src={linkPreview.image}
										alt={linkPreview.title}
										className="absolute inset-0 w-full h-full object-cover"
										onError={(e) => {
											e.currentTarget.style.display = "none";
										}}
									/>
								</div>
							)}
							<div className="p-3">
								<h3 className="text-sm font-bold text-zinc-200 line-clamp-1 font-sans mb-0.5">
									{linkPreview.title}
								</h3>
								<p className="text-xs text-zinc-500 line-clamp-2 font-sans mb-1">
									{linkPreview.description}
								</p>
								<div className="flex items-center gap-1 text-[10px] text-zinc-600 font-sans">
									<Link2 className="w-3 h-3" />
									<span>{linkPreview.domain}</span>
								</div>
							</div>
						</div>
					)}

					{isFetchingPreview && (
						<div className="mt-3 mb-2 p-4 rounded-xl border border-zinc-800 bg-zinc-900/10 flex items-center justify-center gap-2 text-zinc-500 font-sans text-xs">
							<div className="w-3 h-3 border-2 border-zinc-500/30 border-t-zinc-500 rounded-full animate-spin" />
							Fetching preview...
						</div>
					)}

					<div className="flex items-center justify-between mt-2 pt-2">
						<div className="flex gap-2 text-yellow-500 relative">
							<button
								onClick={() => !linkPreview && fileInputRef.current?.click()}
								className={clsx(
									"p-2 rounded-full transition-colors relative group",
									linkPreview
										? "opacity-50 cursor-not-allowed bg-zinc-800/50 text-zinc-600"
										: "hover:bg-yellow-500/10 cursor-pointer",
								)}
							>
								<ImageIcon className="w-5 h-5" />
								{!linkPreview && (
									<span className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-[10px] bg-zinc-800 text-white px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap font-sans">
										Media
									</span>
								)}
							</button>
							<input
								type="file"
								ref={fileInputRef}
								className="hidden"
								accept="image/*"
								multiple
								onChange={handleImageSelect}
								disabled={isPosting || mediaItems.length >= 4 || !!linkPreview}
							/>

							<button
								onClick={() => setShowEmojiPicker(!showEmojiPicker)}
								className={clsx(
									"p-2 hover:bg-yellow-500/10 rounded-full transition-colors relative group cursor-pointer",
									showEmojiPicker && "bg-yellow-500/10",
								)}
							>
								<Smile className="w-5 h-5" />
								<span className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-[10px] bg-zinc-800 text-white px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap font-sans">
									Emoji
								</span>
							</button>

							{/* Emoji Picker Popover */}
							{showEmojiPicker && (
								<div
									className="absolute top-12 left-0 z-50 animate-in fade-in zoom-in-95 duration-200"
									ref={emojiPickerRef}
								>
									<EmojiPicker
										onEmojiClick={onEmojiClick}
										theme={Theme.DARK}
										width={320}
										height={400}
										lazyLoadEmojis={true}
									/>
								</div>
							)}
						</div>

						<button
							onClick={handleSubmit}
							disabled={
								(!content.trim() && mediaItems.length === 0) || isPosting
							}
							className={clsx(
								"px-6 py-2 rounded-full font-bold text-sm font-sans transition-all flex items-center gap-2 cursor-pointer",
								(!content.trim() && mediaItems.length === 0) || isPosting
									? "bg-zinc-800 text-zinc-500 cursor-not-allowed opacity-50"
									: "bg-white text-black hover:bg-yellow-500 hover:scale-105 active:scale-95 shadow-[2px_2px_0px_rgba(255,255,255,0.2)] hover:shadow-none",
							)}
						>
							{isPosting ? (
								<div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
							) : (
								<>
									<span className="uppercase">Post</span>
									<Send className="w-3 h-3" />
								</>
							)}
						</button>
					</div>
				</div>
			</div>
		</div>
	);
};
