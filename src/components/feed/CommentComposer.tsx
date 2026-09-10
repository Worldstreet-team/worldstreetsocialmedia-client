"use client";

import { useCallback, useState, useRef, useEffect } from "react";
import Image from "next/image";
import { AnimatePresence } from "framer-motion";
import { SafeAvatar } from "@/components/ui/SafeAvatar";
import {
	RiImageLine,
	RiEmotionLine,
	RiSendPlane2Fill,
	RiCloseLine,
} from "@remixicon/react";
import { useUser } from "@clerk/nextjs";
import { useAtomValue } from "jotai";
import { userAtom } from "@/store/user.atom";
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
	/** Who this box answers — named above the input so it feels like a reply. */
	replyingTo?: string;
	onCommentSuccess?: () => void;
	onCommentStart?: () => void;
	/**
	 * Phones only: sit inline where the thread puts it, then dock to the
	 * bottom of the screen once the reader scrolls past it (owner
	 * 2026-09-09). Desktop keeps the inline box — there is no bottom bar
	 * to dock to and the column never runs out of room.
	 */
	dockOnScroll?: boolean;
}

interface MediaItem {
	url: string;
	file: File;
	type: "image" | "video";
}

export const CommentComposer = ({
	replyingTo,
	postId,
	onCommentSuccess,
	onCommentStart,
	dockOnScroll = false,
}: CommentComposerProps) => {
	const { user } = useUser();
	// The APP profile's picture, same shared atom as everywhere — Clerk's
	// image only as pre-hydration fallback. Same enforcement as the post
	// composer; this one was still reading Clerk directly.
	const profileUser = useAtomValue(userAtom);
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

	/* ---- Dock to the bottom once it scrolls past (phones only) ---- */
	const hostRef = useRef<HTMLDivElement>(null);
	const barRef = useRef<HTMLDivElement>(null);
	const [docked, setDocked] = useState(false);
	// The bar's natural height, held by the host while the bar is fixed, so
	// the thread does not jump by ~90px at the moment it docks.
	const [hostH, setHostH] = useState<number | undefined>(undefined);
	// How much of the screen the on-screen keyboard is covering. A fixed
	// element sits UNDER the iOS keyboard otherwise, which would hide the
	// box the moment it is tapped.
	const [keyboard, setKeyboard] = useState(0);

	useEffect(() => {
		if (!dockOnScroll) return;
		const host = hostRef.current;
		if (!host) return;

		const phone = window.matchMedia("(max-width: 767px)");
		// The (main) column scrolls inside itself, so the window is NOT the
		// scroller — observing against the viewport root would never fire.
		const root = document.getElementById("ws-main-scroll");

		let observer: IntersectionObserver | null = null;
		const start = () => {
			observer?.disconnect();
			if (!phone.matches) {
				setDocked(false);
				return;
			}
			observer = new IntersectionObserver(
				([entry]) => {
					// Only dock when it has left through the TOP. Off the
					// bottom means the reader has not reached it yet, and a
					// bar that arrives before its own place in the thread
					// would just be a second composer.
					const top = entry.rootBounds?.top ?? 0;
					const past =
						!entry.isIntersecting &&
						entry.boundingClientRect.bottom <= top;
					if (!past) {
						const h = barRef.current?.offsetHeight;
						if (h) setHostH(h);
					}
					setDocked(past);
				},
				{ root, threshold: 0 },
			);
			observer.observe(host);
		};

		start();
		phone.addEventListener("change", start);
		return () => {
			observer?.disconnect();
			phone.removeEventListener("change", start);
		};
	}, [dockOnScroll]);

	// Ride above the keyboard while docked.
	useEffect(() => {
		if (!docked) return;
		const vv = window.visualViewport;
		if (!vv) return;
		const sync = () => {
			setKeyboard(
				Math.max(0, window.innerHeight - vv.height - vv.offsetTop),
			);
		};
		sync();
		vv.addEventListener("resize", sync);
		vv.addEventListener("scroll", sync);
		return () => {
			vv.removeEventListener("resize", sync);
			vv.removeEventListener("scroll", sync);
			setKeyboard(0);
		};
	}, [docked]);

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
		// The host holds the bar's place in the thread while it is docked.
		<div ref={hostRef} style={docked ? { height: hostH } : undefined}>
		<div
			ref={barRef}
			className={clsx(
				"relative px-4 py-3.5",
				docked &&
					// The bar stacks on top of the tab bar, or on the keyboard
					// when one is open. Solid page ink + a hairline, never a
					// blur: the tab bar underneath is the one sanctioned glass
					// down here, and two blurred panes would stack.
					"fixed inset-x-0 z-sticky border-t border-hairline bg-page animate-dock md:static md:border-0",
			)}
			style={
				docked
					? {
							bottom:
								keyboard > 0
									? keyboard
									: "calc(var(--ws-mobile-nav-h) + var(--ws-safe-bottom) + var(--ws-nav-float))",
						}
					: undefined
			}
		>
			{replyingTo && (
				<p className="mb-2 pl-[52px] font-sans text-[calc(12.5px*var(--ws-fs))] text-muted">
					Replying to <span className="font-medium text-gold">@{replyingTo}</span>
				</p>
			)}
			<div className="flex gap-3">
				<div className="shrink-0">
					<div className="relative h-10 w-10 overflow-hidden rounded-pill bg-raised">
						<SafeAvatar
							src={(profileUser as any)?.avatar || user?.imageUrl}
							eager
						/>
					</div>
				</div>
				<div className="flex-1 w-full min-w-0">
					<textarea
						ref={textareaRef}
						value={content}
						onChange={(e) => setContent(e.target.value)}
						placeholder="Post your reply"
						className="w-full resize-none overflow-hidden bg-transparent pt-2 font-sans text-[calc(16px*var(--ws-fs))] leading-relaxed text-primary outline-none placeholder:text-subtle"
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
										<RiCloseLine className="w-4 h-4" />
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
								<RiImageLine className="h-[18px] w-[18px]" />
								<span className="hidden sm:block absolute -bottom-8 left-1/2 -translate-x-1/2 text-[calc(10px*var(--ws-fs))] bg-raised text-primary px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap font-sans">
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
								<RiEmotionLine className="h-[18px] w-[18px]" />
								<span className="hidden sm:block absolute -bottom-8 left-1/2 -translate-x-1/2 text-[calc(10px*var(--ws-fs))] bg-raised text-primary px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap font-sans">
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
												dragClose={closeEmoji} variant="anchored"
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
								"flex h-9 shrink-0 cursor-pointer items-center gap-2 rounded-pill px-[18px] font-sans text-[calc(13px*var(--ws-fs))] font-semibold transition-colors",
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
									<RiSendPlane2Fill className="w-3 h-3" />
								</>
							)}
						</button>
					</div>
				</div>
			</div>
		</div>
		</div>
	);
};
