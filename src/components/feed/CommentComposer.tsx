"use client";

import { useCallback, useState, useRef, useEffect } from "react";
import Image from "next/image";
import { AnimatePresence } from "framer-motion";
import { SafeAvatar } from "@/components/ui/SafeAvatar";
import { Image as ImageIcon, Smile, Send, X, User } from "lucide-react";
import { useUser } from "@clerk/nextjs";
import ConfirmModalPortal from "@/components/ui/ConfirmModalPortal";
import {
	OverlayHeader,
	OverlayPanel,
	OverlayScrim,
	useOverlayDismiss,
} from "@/components/ui/Overlay";
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
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const { toast } = useToast();
	// Picker follows the app theme instead of hardcoding dark.
	const { resolvedTheme } = useTheme();

	// The overlay scrim is the click-catcher now; Esc and the scroll lock
	// come from the shared dismiss hook.
	const closeEmoji = useCallback(() => setShowEmojiPicker(false), []);
	useOverlayDismiss(showEmojiPicker, closeEmoji);

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
		<div className="relative border-b border-hairline px-4 py-3.5">
			<div className="flex gap-3">
				<div className="shrink-0">
					{user ? (
						<div className="relative h-10 w-10 overflow-hidden rounded-pill bg-raised">
							<SafeAvatar src={user.imageUrl} />
						</div>
					) : (
						<div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-pill bg-raised">
							<User className="w-5 h-5 text-subtle" />
						</div>
					)}
				</div>
				<div className="flex-1 w-full min-w-0">
					<textarea
						ref={textareaRef}
						value={content}
						onChange={(e) => setContent(e.target.value)}
						placeholder="Post your reply"
						className="w-full resize-none overflow-hidden bg-transparent pt-2 font-sans text-[16px] leading-relaxed text-primary outline-none placeholder:text-subtle"
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
										type="button"
										onClick={() => removeMedia(index)}
										aria-label="Remove attachment"
										className="absolute top-1.5 right-1.5 flex h-10 w-10 items-center justify-center bg-page/60 hover:bg-page/80 rounded-pill text-primary transition-colors"
									>
										<X className="w-4 h-4" />
									</button>
								</div>
							))}
						</div>
					)}

					<div className="relative mt-1 flex items-center justify-between">
						<div className="relative flex gap-1">
							<button
								type="button"
								onClick={() => fileInputRef.current?.click()}
								aria-label="Attach media"
								className="group relative flex h-10 w-10 cursor-pointer items-center justify-center rounded-pill text-muted transition-colors hover:bg-raised hover:text-primary"
							>
								<ImageIcon className="h-[18px] w-[18px]" />
								<span className="hidden sm:block absolute -bottom-8 left-1/2 -translate-x-1/2 text-[10px] bg-raised text-primary px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap font-sans">
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
								type="button"
								onClick={() => setShowEmojiPicker(!showEmojiPicker)}
								aria-label="Insert emoji"
								className={clsx(
									"group relative flex h-10 w-10 cursor-pointer items-center justify-center rounded-pill transition-colors",
									showEmojiPicker
										? "bg-raised text-primary"
										: "text-muted hover:bg-raised hover:text-primary",
								)}
							>
								<Smile className="h-[18px] w-[18px]" />
								<span className="hidden sm:block absolute -bottom-8 left-1/2 -translate-x-1/2 text-[10px] bg-raised text-primary px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap font-sans">
									Emoji
								</span>
							</button>

							{/* A picker, not a modal: bottom sheet on a phone,
							    floating card on desktop, and the page behind
							    stays undimmed there. */}
							<ConfirmModalPortal>
								<AnimatePresence>
									{showEmojiPicker && (
										<>
											<OverlayScrim
												key="emoji-scrim"
												onClose={closeEmoji}
												dim={false}
												label="Close"
											/>
											<OverlayPanel
												key="emoji-panel"
												variant="anchored"
												label="Emoji"
											>
												<OverlayHeader
													title="Emoji"
													onClose={closeEmoji}
												/>
												<div className="ws-emoji-picker min-h-0 flex-1 overflow-hidden px-2 pb-[calc(8px+var(--ws-safe-bottom))]">
													<EmojiPicker
														onEmojiClick={onEmojiClick}
														theme={
															resolvedTheme === "light"
																? Theme.LIGHT
																: Theme.DARK
														}
														width="100%"
														height={360}
														lazyLoadEmojis={true}
													/>
												</div>
											</OverlayPanel>
										</>
									)}
								</AnimatePresence>
							</ConfirmModalPortal>
						</div>

						<button
							type="button"
							onClick={handleSubmit}
							disabled={
								(!content.trim() && mediaItems.length === 0) || isPosting
							}
							className={clsx(
								"flex h-9 shrink-0 cursor-pointer items-center gap-2 rounded-pill px-[18px] font-sans text-[13px] font-semibold transition-colors",
								(!content.trim() && mediaItems.length === 0) || isPosting
									? "bg-raised text-subtle cursor-not-allowed opacity-50"
									: "bg-brand text-brand-on hover:bg-brand-active",
							)}
						>
							{isPosting ? (
								<div className="w-4 h-4 border-2 border-brand-on/30 border-t-brand-on rounded-full animate-spin" />
							) : (
								<>
									<span>Reply</span>
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
