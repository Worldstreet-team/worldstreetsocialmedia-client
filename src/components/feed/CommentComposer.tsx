"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { Image as ImageIcon, Smile, Send, X, User } from "lucide-react";
import { useUser } from "@clerk/nextjs";
import { replyToPostAction } from "@/lib/post.actions";
import { useToast } from "@/components/ui/Toast/ToastContext";
import EmojiPicker, { type EmojiClickData, Theme } from "emoji-picker-react";
import { useTheme } from "next-themes";
import clsx from "clsx";

interface CommentComposerProps {
	postId: string;
	onCommentSuccess?: () => void;
	onCommentStart?: () => void;
}

interface MediaItem {
	url: string;
	file: File;
	type: "image" | "video";
}

export const CommentComposer = ({
	postId,
	onCommentSuccess,
	onCommentStart,
}: CommentComposerProps) => {
	const { user } = useUser();
	const [content, setContent] = useState("");
	const [isPosting, setIsPosting] = useState(false);
	const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
	const [showEmojiPicker, setShowEmojiPicker] = useState(false);

	const fileInputRef = useRef<HTMLInputElement>(null);
	const emojiPickerRef = useRef<HTMLDivElement>(null);
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const { toast } = useToast();
	// Picker follows the app theme instead of hardcoding dark.
	const { resolvedTheme } = useTheme();

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

	const onEmojiClick = (emojiData: EmojiClickData) => {
		setContent((prev) => prev + emojiData.emoji);
	};

	const handleSubmit = async () => {
		if ((!content.trim() && mediaItems.length === 0) || isPosting) return;

		onCommentStart?.();
		setIsPosting(true);
		try {
			// currently replyToPostAction only supports text content in the signature
			// TODO: Update backend/action to support images in replies if needed
			// For now, we'll just send text content.

			if (mediaItems.length > 0) {
				toast("Image replies are not fully supported yet", { type: "info" });
			}

			const result = await replyToPostAction(postId, content);

			if (result.success) {
				setContent("");
				setMediaItems([]);
				setShowEmojiPicker(false);
				toast("Reply posted!", { type: "success" });
				onCommentSuccess?.();
			} else {
				toast(result.message || "Failed to post reply", { type: "error" });
			}
		} catch (error) {
			toast("Something went wrong", { type: "error" });
		} finally {
			setIsPosting(false);
		}
	};

	return (
		<div className="border-b border-hairline p-6 mb-2 relative">
			<div className="flex gap-4">
				<div className="shrink-0">
					{user ? (
						<div className="relative w-10 h-10 rounded-full overflow-hidden border border-hairline">
							<Image
								src={user.imageUrl}
								alt={user.username || "User"}
								fill
								className="object-cover"
							/>
						</div>
					) : (
						<div className="w-10 h-10 rounded-pill bg-raised border items-center justify-center flex border-hairline overflow-hidden">
							<User className="w-5 h-5 text-subtle" />
						</div>
					)}
				</div>
				<div className="flex-1 w-full">
					<textarea
						ref={textareaRef}
						value={content}
						onChange={(e) => setContent(e.target.value)}
						placeholder="Post your reply"
						className="w-full bg-transparent text-lg text-primary placeholder:text-subtle outline-none resize-none min-h-[60px] font-medium leading-relaxed overflow-hidden font-sans"
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
										"relative bg-surface border border-hairline",
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
										className="absolute top-2 right-2 p-1 bg-page/50 hover:bg-page/80 rounded-full text-primary transition-colors"
									>
										<X className="w-4 h-4" />
									</button>
								</div>
							))}
						</div>
					)}

					<div className="flex items-center justify-between mt-2 pt-2">
						<div className="flex gap-2 text-gold relative">
							<button
								onClick={() => fileInputRef.current?.click()}
								className="flex h-10 w-10 items-center justify-center hover:bg-brand/10 rounded-pill transition-colors relative group cursor-pointer"
							>
								<ImageIcon className="w-5 h-5" />
								<span className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-[10px] bg-raised text-primary px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap font-sans">
									Media
								</span>
							</button>
							<input
								type="file"
								ref={fileInputRef}
								className="hidden"
								accept="image/*"
								multiple
								onChange={handleImageSelect}
								disabled={isPosting || mediaItems.length >= 4}
							/>

							<button
								onClick={() => setShowEmojiPicker(!showEmojiPicker)}
								className={clsx(
									"flex h-10 w-10 items-center justify-center hover:bg-brand/10 rounded-pill transition-colors relative group cursor-pointer",
									showEmojiPicker && "bg-brand/10",
								)}
							>
								<Smile className="w-5 h-5" />
								<span className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-[10px] bg-raised text-primary px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap font-sans">
									Emoji
								</span>
							</button>

							{/* Emoji Picker Popover */}
							{showEmojiPicker && (
								<div
									className="absolute top-12 left-0 z-dropdown animate-rise ws-emoji-picker"
									ref={emojiPickerRef}
								>
									<EmojiPicker
										onEmojiClick={onEmojiClick}
										theme={
											resolvedTheme === "light"
												? Theme.LIGHT
												: Theme.DARK
										}
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
								"px-[18px] h-9 rounded-pill font-semibold text-[13px] font-sans transition-colors flex items-center gap-2 cursor-pointer",
								(!content.trim() && mediaItems.length === 0) || isPosting
									? "bg-raised text-subtle cursor-not-allowed opacity-50"
									: "bg-brand text-brand-on hover:bg-brand-active",
							)}
						>
							{isPosting ? (
								<div className="w-4 h-4 border-2 border-brand-on/30 border-t-brand-on rounded-full animate-spin" />
							) : (
								<>
									<span className="uppercase">Reply</span>
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
