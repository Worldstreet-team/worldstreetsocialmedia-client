"use client";

import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import clsx from "clsx";
import { ImageSquare, VideoCamera, X } from "@phosphor-icons/react";
import { useT } from "@/i18n/client";
import { quotePostAction } from "@/lib/post.actions";
import { useToast } from "@/components/ui/Toast/ToastContext";
import {
	OverlayHeader,
	OverlayPanel,
	OverlayScrim,
	useOverlayDismiss,
} from "@/components/ui/Overlay";

import { SafeAvatar } from "@/components/ui/SafeAvatar";

const MAX_CHARS = 280;
const MAX_IMAGES = 4;

export interface QuoteTarget {
	id: string;
	authorName: string;
	username: string;
	avatar: string;
	content: string;
	timestamp: string;
}

type Attachment = { file: File; url: string; kind: "image" | "video" };

/**
 * Quote composer: your take on top, the original pinned beneath.
 *
 * It is a composer, not a text box — a quote is a post, so it takes images and
 * video like one. The old version accepted text alone and the action only ever
 * sent `{ content }`, so there was nothing to attach media to.
 *
 * On the standard overlay grammar (`sheet` — it is a form), portaled so no
 * card can clip it.
 */
export function QuoteModal({
	target,
	onClose,
}: {
	target: QuoteTarget;
	onClose: () => void;
}) {
	const t = useT();
	const { toast } = useToast();

	const [content, setContent] = useState("");
	const [attachments, setAttachments] = useState<Attachment[]>([]);
	const [busy, setBusy] = useState(false);
	const imageInputRef = useRef<HTMLInputElement>(null);
	const videoInputRef = useRef<HTMLInputElement>(null);

	// Object URLs are revoked on unmount or every preview leaks for the life
	// of the tab.
	useEffect(
		() => () => {
			for (const a of attachments) URL.revokeObjectURL(a.url);
		},
		[attachments],
	);

	// Esc + body scroll lock. Mounted only while open, so `open` is constant.
	useOverlayDismiss(true, onClose);

	const hasVideo = attachments.some((a) => a.kind === "video");
	const imageCount = attachments.filter((a) => a.kind === "image").length;
	const remaining = MAX_CHARS - content.length;
	const canPost = (content.trim().length > 0 || attachments.length > 0) && !busy;

	const addFiles = (files: FileList | null, kind: "image" | "video") => {
		if (!files?.length) return;
		// One video or up to four images, never both — the same rule the feed
		// composer follows.
		if (kind === "video") {
			for (const a of attachments) URL.revokeObjectURL(a.url);
			const file = files[0];
			setAttachments([
				{ file, url: URL.createObjectURL(file), kind: "video" },
			]);
			return;
		}
		const room = MAX_IMAGES - imageCount;
		const picked = Array.from(files).slice(0, Math.max(0, room));
		const next = picked.map((file) => ({
			file,
			url: URL.createObjectURL(file),
			kind: "image" as const,
		}));
		setAttachments((prev) => [...prev.filter((a) => a.kind === "image"), ...next]);
	};

	const removeAt = (index: number) => {
		setAttachments((prev) => {
			const target = prev[index];
			if (target) URL.revokeObjectURL(target.url);
			return prev.filter((_, i) => i !== index);
		});
	};

	const submit = async () => {
		if (!canPost) return;
		setBusy(true);
		try {
			const body = new FormData();
			body.append("content", content.trim());
			for (const a of attachments) {
				body.append(a.kind === "video" ? "video" : "images", a.file);
			}
			const res = await quotePostAction(target.id, body);
			if (res.success) {
				toast(t("quote.posted"), { type: "success" });
				onClose();
			} else if (res.message) {
				toast(res.message, { type: "error" });
			}
		} finally {
			setBusy(false);
		}
	};

	if (typeof document === "undefined") return null;

	return createPortal(
		<AnimatePresence>
			<OverlayScrim key="quote-scrim" onClose={onClose} label={t("common.close")} />
			<OverlayPanel key="quote-panel" dragClose={onClose} variant="sheet" label={t("post.quote")}>
				<OverlayHeader
					title={t("post.quote")}
					onClose={onClose}
					closeLabel={t("common.close")}
				/>

				<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-1">
					<textarea
						value={content}
						onChange={(e) =>
							setContent(e.target.value.slice(0, MAX_CHARS))
						}
						placeholder={t("quote.placeholder")}
						autoFocus
						rows={3}
						className="w-full resize-none rounded-xl bg-sunken px-3.5 py-3 font-sans text-base text-primary outline-none transition-colors placeholder:text-subtle focus:bg-raised sm:text-[15px]"
					/>

					{attachments.length > 0 && (
						<div
							className={clsx(
								"mt-3 grid gap-2",
								attachments.length === 1 ? "grid-cols-1" : "grid-cols-2",
							)}
						>
							{attachments.map((a, i) => (
								<div
									key={a.url}
									className="relative overflow-hidden rounded-xl bg-chip"
								>
									{a.kind === "video" ? (
										// eslint-disable-next-line jsx-a11y/media-has-caption
										<video
											src={a.url}
											className="aspect-video w-full object-cover"
											muted
											playsInline
										/>
									) : (
										<img
											src={a.url}
											alt=""
											className="aspect-square w-full object-cover"
										/>
									)}
									{/* Sits ON the artwork, so it keeps the fixed-dark
									    canvas chip rather than a theme tint. */}
									<button
										type="button"
										onClick={() => removeAt(i)}
										aria-label={t("common.close")}
										className="absolute right-1.5 top-1.5 flex h-7 w-7 cursor-pointer items-center justify-center rounded-pill glass-chip-canvas transition-colors"
									>
										<X size={12} weight="bold" />
									</button>
								</div>
							))}
						</div>
					)}

					{/* the original, pinned */}
					<div className="mt-3 rounded-xl bg-chip p-3">
						<div className="mb-1 flex items-center gap-2">
							<span className="relative h-5 w-5 shrink-0 overflow-hidden rounded-pill">
								<SafeAvatar src={target.avatar} className="object-cover" />
							</span>
							<span className="truncate font-sans text-[13px] font-semibold text-primary">
								{target.authorName}
							</span>
							<span className="truncate font-sans text-[12px] text-subtle">
								@{target.username} · {target.timestamp}
							</span>
						</div>
						<p className="line-clamp-3 whitespace-pre-wrap font-sans text-[14px] text-muted">
							{target.content}
						</p>
					</div>
				</div>

				<div className="flex shrink-0 items-center justify-between gap-3 px-4 pb-[calc(16px+var(--ws-safe-bottom))] pt-3">
					<div className="flex items-center gap-1">
						<button
							type="button"
							onClick={() => imageInputRef.current?.click()}
							disabled={hasVideo || imageCount >= MAX_IMAGES}
							aria-label={t("composer.media")}
							className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-pill bg-chip text-muted transition-colors hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
						>
							<ImageSquare size={17} />
						</button>
						<button
							type="button"
							onClick={() => videoInputRef.current?.click()}
							disabled={imageCount > 0}
							aria-label={t("composer.video")}
							className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-pill bg-chip text-muted transition-colors hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
						>
							<VideoCamera size={17} />
						</button>
						<span
							className={clsx(
								"ml-1.5 font-sans text-[12px] tabular-nums",
								remaining <= 28 ? "text-primary" : "text-subtle",
							)}
						>
							{remaining}
						</span>
					</div>

					<button
						type="button"
						disabled={!canPost}
						onClick={submit}
						className="h-10 cursor-pointer rounded-pill bg-brand px-6 font-sans text-[14px] font-semibold text-brand-on transition-colors hover:bg-brand-active disabled:cursor-not-allowed disabled:opacity-40"
					>
						{busy ? t("quote.posting") : t("composer.post")}
					</button>
				</div>

				<input
					ref={imageInputRef}
					type="file"
					accept="image/*"
					multiple
					className="hidden"
					onChange={(e) => {
						addFiles(e.target.files, "image");
						e.target.value = "";
					}}
				/>
				<input
					ref={videoInputRef}
					type="file"
					accept="video/*"
					className="hidden"
					onChange={(e) => {
						addFiles(e.target.files, "video");
						e.target.value = "";
					}}
				/>
			</OverlayPanel>
		</AnimatePresence>,
		document.body,
	);
}
