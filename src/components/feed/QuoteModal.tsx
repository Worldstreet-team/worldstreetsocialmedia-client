"use client";

import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import clsx from "clsx";
import { ImageSquare, VideoCamera, X } from "@phosphor-icons/react";
import { useT } from "@/i18n/client";
import { quotePostAction } from "@/lib/post.actions";
import { useToast } from "@/components/ui/Toast/ToastContext";

import { SafeAvatar } from "@/components/ui/SafeAvatar";

const EASE = [0.2, 0, 0, 1] as const;
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
 * Portaled so no card can clip it.
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
	const reduce = useReducedMotion();

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

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
		document.addEventListener("keydown", onKey);
		return () => document.removeEventListener("keydown", onKey);
	}, [onClose]);

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
			<motion.div
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				exit={{ opacity: 0 }}
				transition={{ duration: 0.2, ease: EASE }}
				className="fixed inset-0 z-modal flex items-end justify-center glass-veil-sheer backdrop-blur-md backdrop-saturate-150 sm:items-center sm:p-6"
				onClick={onClose}
			>
				<motion.div
					initial={reduce ? { opacity: 0 } : { opacity: 0, y: 20, scale: 0.985 }}
					animate={{ opacity: 1, y: 0, scale: 1 }}
					exit={reduce ? { opacity: 0 } : { opacity: 0, y: 20, scale: 0.985 }}
					transition={{ duration: 0.32, ease: EASE }}
					role="dialog"
					aria-modal="true"
					aria-label={t("post.quote")}
					className="max-h-[92dvh] w-full overflow-y-auto rounded-t-2xl glass-dock backdrop-blur-xl backdrop-saturate-150 glass-ink p-5 pb-safe sm:max-w-[460px] sm:rounded-2xl sm:p-6"
					onClick={(e) => e.stopPropagation()}
				>
					<div className="mb-4 flex items-start justify-between gap-3">
						<h2 className="font-display text-[19px] font-semibold leading-tight">
							{t("post.quote")}
						</h2>
						<button
							type="button"
							onClick={onClose}
							aria-label={t("common.close")}
							className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-pill glass-chip transition-colors"
						>
							<X size={15} weight="bold" />
						</button>
					</div>

					<textarea
						value={content}
						onChange={(e) =>
							setContent(e.target.value.slice(0, MAX_CHARS))
						}
						placeholder={t("quote.placeholder")}
						autoFocus
						rows={3}
						className="w-full resize-none rounded-xl glass-input px-3.5 py-3 font-sans text-[15px] glass-ink outline-none placeholder:text-[#fafaf9]/35"
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
									className="relative overflow-hidden rounded-xl glass-card"
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
					<div className="mt-3 rounded-xl glass-card p-3">
						<div className="mb-1 flex items-center gap-2">
							<span className="relative h-5 w-5 shrink-0 overflow-hidden rounded-pill">
								<SafeAvatar src={target.avatar} className="object-cover" />
							</span>
							<span className="truncate font-sans text-[13px] font-semibold glass-ink">
								{target.authorName}
							</span>
							<span className="truncate font-sans text-[12px] glass-ink-faint">
								@{target.username} · {target.timestamp}
							</span>
						</div>
						<p className="line-clamp-3 whitespace-pre-wrap font-sans text-[14px] glass-ink-dim">
							{target.content}
						</p>
					</div>

					<div className="mt-4 flex items-center justify-between gap-3">
						<div className="flex items-center gap-1">
							<button
								type="button"
								onClick={() => imageInputRef.current?.click()}
								disabled={hasVideo || imageCount >= MAX_IMAGES}
								aria-label={t("composer.media")}
								className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-pill glass-chip transition-colors disabled:cursor-not-allowed disabled:opacity-40"
							>
								<ImageSquare size={17} />
							</button>
							<button
								type="button"
								onClick={() => videoInputRef.current?.click()}
								disabled={imageCount > 0}
								aria-label={t("composer.video")}
								className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-pill glass-chip transition-colors disabled:cursor-not-allowed disabled:opacity-40"
							>
								<VideoCamera size={17} />
							</button>
							<span
								className={clsx(
									"ml-1.5 font-sans text-[12px] tabular-nums",
									remaining <= 28 ? "glass-ink" : "glass-ink-faint",
								)}
							>
								{remaining}
							</span>
						</div>

						{/* White CTA: gold never sits on a blurred backdrop. */}
						<button
							type="button"
							disabled={!canPost}
							onClick={submit}
							className="h-10 cursor-pointer rounded-pill glass-cta px-6 font-sans text-[14px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40"
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
				</motion.div>
			</motion.div>
		</AnimatePresence>,
		document.body,
	);
}
