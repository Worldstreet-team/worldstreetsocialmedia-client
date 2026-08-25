"use client";

import { createPortal } from "react-dom";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import { X } from "@phosphor-icons/react";
import { useT } from "@/i18n/client";
import { quotePostAction } from "@/lib/post.actions";
import { useToast } from "@/components/ui/Toast/ToastContext";
import { DEFAULT_AVATAR } from "@/const";

export interface QuoteTarget {
	id: string;
	authorName: string;
	username: string;
	avatar: string;
	content: string;
	timestamp: string;
}

/** Quote composer: your take on top, the original pinned beneath. Portaled
 *  so no card can clip it. */
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
	const [busy, setBusy] = useState(false);

	const submit = async () => {
		if (busy || !content.trim()) return;
		setBusy(true);
		try {
			const res = await quotePostAction(target.id, content.trim());
			if (res.success) {
				toast(t("quote.posted"), { type: "success" });
				onClose();
			} else if (res.message) toast(res.message, { type: "error" });
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
				transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
				className="fixed inset-0 z-modal bg-black/75 flex items-end sm:items-center justify-center"
				onClick={onClose}
			>
				<motion.div
					initial={{ opacity: 0, y: 12, scale: 0.98 }}
					animate={{ opacity: 1, y: 0, scale: 1 }}
					exit={{ opacity: 0, y: 12, scale: 0.98 }}
					transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
					className="w-full sm:w-[480px] card-depth rounded-t-2xl sm:rounded-2xl p-5"
					onClick={(e) => e.stopPropagation()}
				>
					<div className="flex items-center justify-between mb-3">
						<h2 className="font-display font-semibold text-lg text-primary">
							{t("post.quote")}
						</h2>
						<button
							type="button"
							onClick={onClose}
							aria-label="Close"
							className="flex h-9 w-9 items-center justify-center rounded-pill text-muted hover:text-primary hover:bg-raised transition-colors cursor-pointer"
						>
							<X size={16} />
						</button>
					</div>

					<textarea
						value={content}
						onChange={(e) => setContent(e.target.value)}
						maxLength={280}
						placeholder={t("quote.placeholder")}
						autoFocus
						className="w-full bg-transparent text-[16px] text-primary font-sans placeholder:text-subtle outline-none resize-none min-h-[72px]"
					/>

					{/* the original, pinned */}
					<div className="rounded-xl border border-hairline/70 p-3 mb-4">
						<div className="flex items-center gap-2 mb-1">
							<span className="relative w-5 h-5 rounded-pill overflow-hidden shrink-0">
								<Image
									src={target.avatar || DEFAULT_AVATAR}
									alt=""
									fill
									className="object-cover"
								/>
							</span>
							<span className="text-[13px] font-semibold text-primary font-sans truncate">
								{target.authorName}
							</span>
							<span className="text-[12px] text-subtle font-sans truncate">
								@{target.username} · {target.timestamp}
							</span>
						</div>
						<p className="text-[14px] text-muted font-sans line-clamp-3 whitespace-pre-wrap">
							{target.content}
						</p>
					</div>

					<button
						type="button"
						disabled={busy || !content.trim()}
						onClick={submit}
						className="w-full h-11 rounded-pill bg-brand text-brand-on font-semibold text-[15px] font-sans hover:bg-brand-active transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
					>
						{t("composer.post")}
					</button>
				</motion.div>
			</motion.div>
		</AnimatePresence>,
		document.body,
	);
}
