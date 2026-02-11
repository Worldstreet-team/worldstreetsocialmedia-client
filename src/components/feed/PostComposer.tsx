"use client";

import { useRef, useState, useEffect } from "react";
import EmojiPicker, { type EmojiClickData } from "emoji-picker-react";
import { createPostAction } from "@/lib/post.actions";
import ImageIcon from "@/assets/icons/ImageIcon";
import GifIcon from "@/assets/icons/GifIcon";
import EmojiIcon from "@/assets/icons/EmojiIcon";
import NoteIcon from "@/assets/icons/NoteIcon";

interface MediaItem {
	url: string;
	file: File;
}

interface PostComposerProps {
	onPostStart?: () => void;
	onPostSuccess?: () => void;
}

export function PostComposer({
	onPostStart,
	onPostSuccess,
}: PostComposerProps) {
	const [content, setContent] = useState("");
	const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
	const [showEmojiPicker, setShowEmojiPicker] = useState(false);
	const [loading, setLoading] = useState(false);

	const fileInputRef = useRef<HTMLInputElement>(null);
	const emojiPickerRef = useRef<HTMLDivElement>(null);
	const textareaRef = useRef<HTMLTextAreaElement>(null);

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

	const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
		if (e.target.files) {
			const files = Array.from(e.target.files);
			const remainingSlots = 4 - mediaItems.length;
			const filesToProcess = files.slice(0, remainingSlots);

			const newItems = filesToProcess.map((file) => ({
				url: URL.createObjectURL(file),
				file: file,
			}));

			setMediaItems((prev) => [...prev, ...newItems]);

			// Reset input so same file can be selected again if removed
			if (fileInputRef.current) {
				fileInputRef.current.value = "";
			}
		}
	};

	const removeImage = (index: number) => {
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

	const handlePost = async () => {
		if (!content && mediaItems.length === 0) return;
		if (loading) return;

		setLoading(true);
		if (onPostStart) onPostStart();

		const formData = new FormData();
		formData.append("content", content);

		mediaItems.forEach((item) => {
			formData.append("images", item.file);
		});

		try {
			const result = await createPostAction(formData);

			if (result.success) {
				setContent("");
				setMediaItems([]);
				if (onPostSuccess) onPostSuccess();
				// Ideally, trigger a feed refresh here using a callback or context
			} else {
				alert(result.message || "Failed to post");
			}
		} catch (error) {
			console.error("Post error:", error);
			alert("An error occurred");
		} finally {
			setLoading(false);
		}
	};

	const getImageGridClass = (count: number) => {
		switch (count) {
			case 1:
				return "grid-cols-1 grid-rows-1";
			case 2:
				return "grid-cols-2 grid-rows-1";
			case 3:
				return "grid-cols-2 grid-rows-2";
			case 4:
				return "grid-cols-2 grid-rows-2";
			default:
				return "grid-cols-1";
		}
	};

	const getImageStyle = (index: number, total: number) => {
		if (total === 3) {
			if (index === 0) return "row-span-2"; // First image takes full height on left
		}
		return "";
	};

	return (
		<div className="px-4 py-3 border-b border-black/5">
			<div className="flex gap-3">
				<div
					className="w-9 h-9 mt-2 rounded-full bg-cover bg-center shrink-0"
					style={{
						backgroundImage:
							"url('https://lh3.googleusercontent.com/aida-public/AB6AXuDd-evzsvivS30hlWWhs8NK4GS34z0MFLA5ys1E3Xi1Ze3ANPr33B0eo21EVy-ojF_5DOaAZE0B3oFNEkrr_Mg7yUw5MjBFBPl9K0FqUaqfg7kRqt7THyQOFiT-26kEOsmd3DLbSysRcKBwH-ceObCR6X9heUYmSw5DotEK-maSeeV0OdOCRtH8RLjgLjOwwYcT5GKk3JH4tOlCxbirUsuCk5Kikl9XBPwJXR8-J_VDkcTSowSNq6G-XXTq53J7jarGjNf4ml9v8hFW')",
					}}
				/>
				<div className="flex-1 flex flex-col relative">
					<textarea
						ref={textareaRef}
						value={content}
						onChange={(e) => setContent(e.target.value)}
						className="w-full border-none focus:ring-0 text-base text-black tracking-tight font-medium placeholder-text-light resize-none py-2 min-h-[40px] overflow-hidden bg-transparent focus:outline-none"
						placeholder="Happening now!"
						rows={2}
						disabled={loading}
					/>

					{/* Image Grid */}
					{mediaItems.length > 0 && (
						<div
							className={`grid gap-3 mt-3 w-full rounded-2xl overflow-hidden ${getImageGridClass(mediaItems.length)} h-[290px]`}
						>
							{mediaItems.map((item, index) => (
								<div
									key={item.url}
									className={`relative w-full h-full bg-cover bg-center ${getImageStyle(index, mediaItems.length)}`}
									style={{ backgroundImage: `url(${item.url})` }}
								>
									<button
										type="button"
										onClick={() => removeImage(index)}
										className="absolute top-2 right-2 bg-black/70 hover:bg-black/80 text-white rounded-full p-1 transition-colors"
										disabled={loading}
									>
										<span className="material-symbols-outlined text-[18px]!">
											close
										</span>
									</button>
								</div>
							))}
						</div>
					)}

					<div className="flex items-center justify-between pt-3 border-t border-black/5 mt-2">
						<div className="flex gap-2 relative">
							<input
								type="file"
								ref={fileInputRef}
								className="hidden"
								accept="image/*"
								multiple
								onChange={handleImageSelect}
								disabled={loading}
							/>
							<button
								type="button"
								onClick={() => fileInputRef.current?.click()}
								disabled={mediaItems.length >= 4 || loading}
								className={`p-2 rounded-full transition-colors ${mediaItems.length >= 4 || loading ? "text-primary/50 cursor-not-allowed" : "text-primary hover:bg-primary/10"} cursor-pointer`}
							>
								<ImageIcon />
							</button>
							<button
								type="button"
								className="p-2 text-primary hover:bg-primary/10 rounded-full transition-colors cursor-pointer"
								disabled={loading}
							>
								<GifIcon />
							</button>
							<button
								type="button"
								className="p-2 text-primary hover:bg-primary/10 rounded-full transition-colors cursor-pointer"
								disabled={loading}
							>
								<NoteIcon />
							</button>
							<button
								type="button"
								onClick={() => setShowEmojiPicker(!showEmojiPicker)}
								className="p-2 text-primary hover:bg-primary/10 rounded-full transition-colors cursor-pointer"
								disabled={loading}
							>
								<EmojiIcon />
							</button>
							{showEmojiPicker && (
								<div
									className="absolute top-10 left-0 z-50"
									ref={emojiPickerRef}
								>
									<EmojiPicker
										onEmojiClick={onEmojiClick}
										width={350}
										height={400}
									/>
								</div>
							)}
						</div>
						<button
							type="button"
							onClick={handlePost}
							disabled={(!content && mediaItems.length === 0) || loading}
							className={`bg-black px-8 py-2 text-white font-bold rounded-full text-[15px] transition-opacity ${(!content && mediaItems.length === 0) || loading ? "opacity-35 cursor-not-allowed" : "opacity-100 hover:bg-primary-dark cursor-pointer"}`}
						>
							{loading ? "Posting..." : "Post"}
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}
