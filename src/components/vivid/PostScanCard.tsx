"use client";

import { AnimatePresence, motion } from "framer-motion";
import { SafeAvatar } from "@/components/ui/SafeAvatar";
import { DUR, EASE_OUT_EXPO } from "@/lib/motion-presets";
import type { VividPostRef } from "@/lib/vivid.client";
import s from "./vivid-scan.module.css";

/**
 * A post sent to Vivid, drawn as the person's own message: author, text and
 * picture, compact. While Vivid reads it (`scanning`: no words yet) a band
 * sweeps down the card inside four viewfinder corners; when the answer
 * starts, the scan fades away and the card stays as the record of what was
 * asked about.
 */
export function PostScanCard({ post, scanning }: { post: VividPostRef; scanning: boolean }) {
	return (
		<div className="relative w-[min(320px,84%)] overflow-hidden rounded-[20px] bg-surface ring-1 ring-primary/[0.08]">
			<div className="flex items-center gap-2 px-3.5 pt-3">
				<span className="relative h-6 w-6 shrink-0 overflow-hidden rounded-full bg-raised">
					<SafeAvatar src={post.avatar} className="object-cover" eager />
				</span>
				<span className="truncate font-sans text-[calc(13.5px*var(--ws-fs))] font-semibold text-primary">{post.authorName}</span>
				<span className="shrink-0 truncate font-sans text-[calc(12.5px*var(--ws-fs))] text-subtle">@{post.author}</span>
			</div>
			{post.text && (
				// Padding on the wrapper: overflow clips at the padding edge, so
				// padding on the clamped line itself let a fifth line peek out.
				<div className="px-3.5 pt-1.5 pb-3">
					<p className="line-clamp-4 whitespace-pre-wrap break-words font-sans text-[calc(14px*var(--ws-fs))] leading-relaxed text-primary">
						{post.text}
					</p>
				</div>
			)}
			{post.image && (
				// biome-ignore lint/performance/noImgElement: a presigned media URL, drawn as is
				<img src={post.image} alt="" className="block aspect-[16/10] w-full object-cover" loading="lazy" />
			)}
			{!post.text && !post.image && <div className="h-3" />}

			<ScanOverlay scanning={scanning} label="Vivid is reading this post" />
		</div>
	);
}

/**
 * The scan itself, laid over any card Vivid is reading (a post, a file):
 * viewfinder corners and a band of the brand colour sweeping down, fading
 * away when the answer starts.
 */
export function ScanOverlay({ scanning, label }: { scanning: boolean; label: string }) {
	return (
		<AnimatePresence>
			{scanning && (
				<motion.div
					key="scan"
					aria-label={label}
					role="status"
					initial={{ opacity: 0 }}
					animate={{ opacity: 1, transition: { duration: DUR.base } }}
					exit={{ opacity: 0, transition: { duration: DUR.slow } }}
					className={`pointer-events-none absolute inset-0 ${s.scan}`}
				>
					<span className={s.band} />
					{(["tl", "tr", "bl", "br"] as const).map((c, i) => (
						<motion.span
							key={c}
							initial={{ opacity: 0, scale: 0.6 }}
							animate={{ opacity: 1, scale: 1, transition: { duration: 0.34, ease: EASE_OUT_EXPO, delay: i * 0.03 } }}
							className={[
								"absolute h-4 w-4 border-[color:var(--ws-brand-primary)]",
								c === "tl" && "top-2 left-2 rounded-tl-[7px] border-t-2 border-l-2",
								c === "tr" && "top-2 right-2 rounded-tr-[7px] border-t-2 border-r-2",
								c === "bl" && "bottom-2 left-2 rounded-bl-[7px] border-b-2 border-l-2",
								c === "br" && "right-2 bottom-2 rounded-br-[7px] border-r-2 border-b-2",
							]
								.filter(Boolean)
								.join(" ")}
						/>
					))}
				</motion.div>
			)}
		</AnimatePresence>
	);
}
