"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { Image as ImageIcon, Radio, Smile, Send, X, User, Link2 } from "lucide-react";
import { GoLiveSheet } from "@/components/feed/GoLiveSheet";
import { useT } from "@/i18n/client";
import { useUser } from "@clerk/nextjs";
import { createPostAction } from "@/lib/post.actions";
import { useToast } from "@/components/ui/Toast/ToastContext";
import EmojiPicker, { type EmojiClickData, Theme } from "emoji-picker-react";
import { useTheme } from "next-themes";
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

// Same limit PostCard truncates at.
const MAX_LENGTH = 280;

/**
 * Character-budget ring: gold while comfortable, status/warning inside the
 * last 10%, status/danger at/over the limit. Count (tabular) appears only
 * once the warning tier starts — quiet until it matters.
 */
const CharacterRing = ({ length }: { length: number }) => {
	const remaining = MAX_LENGTH - length;
	const pct = Math.min(length / MAX_LENGTH, 1);
	const radius = 8;
	const circumference = 2 * Math.PI * radius;
	const tone =
		remaining < 0
			? "text-danger"
			: remaining <= 28
				? "text-warning"
				: "text-gold";

	if (length === 0) return null;

	return (
		<div className="flex items-center gap-2">
			{remaining <= 28 && (
				<span
					className={clsx(
						"font-sans text-[13px] font-medium tabular-nums",
						tone,
					)}
					aria-live="polite"
				>
					{remaining}
				</span>
			)}
			<svg
				width="20"
				height="20"
				viewBox="0 0 20 20"
				aria-hidden="true"
				className={clsx("-rotate-90", tone)}
			>
				<circle
					cx="10"
					cy="10"
					r={radius}
					fill="none"
					strokeWidth="2"
					stroke="var(--ws-bg-track)"
				/>
				<circle
					cx="10"
					cy="10"
					r={radius}
					fill="none"
					strokeWidth="2"
					stroke="currentColor"
					strokeLinecap="round"
					strokeDasharray={circumference}
					strokeDashoffset={circumference * (1 - pct)}
					className="transition-[stroke-dashoffset]"
				/>
			</svg>
		</div>
	);
};

export const PostComposer = ({
	onPostSuccess,
	onPostStart,
}: PostComposerProps) => {
	const t = useT();
	const [showGoLive, setShowGoLive] = useState(false);
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
	// Picker follows the app theme instead of hardcoding dark.
	const { resolvedTheme } = useTheme();

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

	// Draft persistence — a refresh or accidental navigation shouldn't eat a
	// half-written post. Text only; object URLs can't survive a reload.
	// The clear branch is gated on having SEEN content, so the effect's
	// initial empty-content run (and StrictMode's double-run) can never
	// delete a stored draft before the restore lands.
	const DRAFT_KEY = "ws-social-draft";
	const draftHadContentRef = useRef(false);
	useEffect(() => {
		try {
			const saved = localStorage.getItem(DRAFT_KEY);
			if (saved) setContent((prev) => prev || saved);
		} catch {}
	}, []);
	useEffect(() => {
		try {
			if (content) {
				draftHadContentRef.current = true;
				localStorage.setItem(DRAFT_KEY, content);
			} else if (draftHadContentRef.current) {
				localStorage.removeItem(DRAFT_KEY);
			}
		} catch {}
	}, [content]);

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

	// Paste an image (screenshot, copied file) straight into the composer.
	const handlePaste = (e: React.ClipboardEvent) => {
		const files = Array.from(e.clipboardData.files).filter((f) =>
			f.type.startsWith("image/"),
		);
		if (files.length === 0 || linkPreview) return;
		e.preventDefault();
		const remainingSlots = 4 - mediaItems.length;
		const newItems: MediaItem[] = files
			.slice(0, remainingSlots)
			.map((file) => ({
				url: URL.createObjectURL(file),
				file,
				type: "image",
			}));
		if (newItems.length > 0) {
			setMediaItems((prev) => [...prev, ...newItems]);
			toast(newItems.length > 1 ? "Images attached" : "Image attached", {
				type: "success",
			});
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

	const isOverLimit = content.length > MAX_LENGTH;

	const handleSubmit = async () => {
		if ((!content.trim() && mediaItems.length === 0) || isPosting) return;
		if (isOverLimit) return;

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
		<div className="border-b border-hairline px-4 py-4 sm:p-6 mb-2 relative">
			<div className="flex gap-3 sm:gap-4">
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
				<div className="flex-1 w-full min-w-0">
					<textarea
						id="post-composer-input"
						ref={textareaRef}
						value={content}
						onChange={(e) => setContent(e.target.value)}
						onPaste={handlePaste}
						placeholder="What's moving today?"
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

					{/* Link Preview Card */}
					{linkPreview && mediaItems.length === 0 && (
						<div className="mt-3 mb-2 rounded-xl border border-hairline overflow-hidden bg-surface/50 relative group">
							{/* Reveal-on-hover is unreachable on touch — there is no
							    hover state to enter. Always visible below sm. */}
							<button
								type="button"
								onClick={removeLinkPreview}
								aria-label="Remove link preview"
								className="absolute top-1.5 right-1.5 flex h-10 w-10 items-center justify-center bg-page/60 hover:bg-page/80 rounded-pill text-primary transition-opacity z-10 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
							>
								<X className="w-4 h-4" />
							</button>
							{linkPreview.image && (
								<div className="aspect-video relative w-full bg-surface border-b border-hairline/50">
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
								<h3 className="text-sm font-bold text-primary line-clamp-1 font-sans mb-0.5">
									{linkPreview.title}
								</h3>
								<p className="text-[13px] text-muted line-clamp-2 font-sans mb-1">
									{linkPreview.description}
								</p>
								<div className="flex items-center gap-1 text-[11px] text-muted font-sans">
									<Link2 className="w-3 h-3" />
									<span>{linkPreview.domain}</span>
								</div>
							</div>
						</div>
					)}

					{isFetchingPreview && (
						<div className="mt-3 mb-2 p-4 rounded-xl border border-hairline bg-surface/10 flex items-center justify-center gap-2 text-muted font-sans text-[13px]">
							<div className="w-3 h-3 border-2 border-subtle/30 border-t-subtle rounded-full animate-spin" />
							Fetching preview...
						</div>
					)}

					<div className="flex items-center justify-between mt-2 pt-3 border-t border-hairline/60">
						<div className="flex gap-2 text-gold relative">
							<button
								type="button"
								onClick={() => !linkPreview && fileInputRef.current?.click()}
								aria-label="Attach media"
								className={clsx(
									"flex h-11 w-11 sm:h-10 sm:w-10 items-center justify-center rounded-pill transition-colors relative group",
									linkPreview
										? "opacity-50 cursor-not-allowed bg-raised/50 text-subtle"
										: "hover:bg-brand/10 cursor-pointer",
								)}
							>
								<ImageIcon className="w-5 h-5" />
								{!linkPreview && (
									<span className="hidden sm:block absolute -bottom-8 left-1/2 -translate-x-1/2 text-[10px] bg-raised text-primary px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap font-sans">
										Media
									</span>
								)}
							</button>
							<button
								type="button"
								onClick={() => setShowGoLive(true)}
								aria-label={t("golive.entry")}
								className="flex h-11 w-11 sm:h-10 sm:w-10 items-center justify-center rounded-pill transition-colors relative group hover:bg-danger/10 text-danger cursor-pointer"
							>
								<Radio className="w-5 h-5" />
								<span className="hidden sm:block absolute -bottom-8 left-1/2 -translate-x-1/2 text-[10px] bg-raised text-primary px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap font-sans">
									{t("golive.entry")}
								</span>
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
							{showGoLive && <GoLiveSheet onClose={() => setShowGoLive(false)} />}

							<button
								type="button"
								onClick={() => setShowEmojiPicker(!showEmojiPicker)}
								aria-label="Insert emoji"
								className={clsx(
									"flex h-11 w-11 sm:h-10 sm:w-10 items-center justify-center hover:bg-brand/10 rounded-pill transition-colors relative group cursor-pointer",
									showEmojiPicker && "bg-brand/10",
								)}
							>
								<Smile className="w-5 h-5" />
								<span className="hidden sm:block absolute -bottom-8 left-1/2 -translate-x-1/2 text-[10px] bg-raised text-primary px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap font-sans">
									Emoji
								</span>
							</button>

							{/* Emoji Picker Popover.
							    The picker is a fixed ~320px block anchored 72px in
							    from the viewport edge — on a 320-375px screen that
							    ran straight off the right side. Below sm it centres
							    itself in the viewport instead of anchoring; from sm
							    up it keeps the original under-the-button position. */}
							{showEmojiPicker && (
								<div
									className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 sm:absolute sm:left-0 sm:top-12 sm:translate-x-0 sm:translate-y-0 w-[min(320px,calc(100vw-2rem))] max-h-[70dvh] z-dropdown animate-rise ws-emoji-picker"
									ref={emojiPickerRef}
								>
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
							)}
						</div>

						<div className="flex items-center gap-3">
							<CharacterRing length={content.length} />
							<button
							onClick={handleSubmit}
							disabled={
								(!content.trim() && mediaItems.length === 0) ||
								isPosting ||
								isOverLimit
							}
							type="button"
							className={clsx(
								// h-11 on touch (44px target), the DS's 36px pill from sm up.
								"px-[18px] h-11 sm:h-9 shrink-0 rounded-pill font-semibold text-[13px] font-sans transition-colors flex items-center gap-2 cursor-pointer",
								(!content.trim() && mediaItems.length === 0) ||
									isPosting ||
									isOverLimit
									? "bg-raised text-subtle cursor-not-allowed opacity-50"
									: "bg-brand text-brand-on hover:bg-brand-active",
							)}
						>
							{isPosting ? (
								<div className="w-4 h-4 border-2 border-brand-on/30 border-t-brand-on rounded-full animate-spin" />
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
		</div>
	);
};
