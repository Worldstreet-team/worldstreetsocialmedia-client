"use client";

import { useEffect, useState } from "react";
import { CaretRight } from "@phosphor-icons/react";
import { useT } from "@/i18n/client";
import { getCreatorPostsAction } from "@/lib/creator.actions";
import { PostStats } from "@/components/studio/PostStats";
import { X } from "@phosphor-icons/react";
import { PageHead, fmt } from "@/components/studio/studio-ui";
import { formatTimeAgo } from "@/lib/utils";

interface Row {
	id: string;
	content: string;
	hasMedia: boolean;
	type: string;
	stats: { likes: number; reposts: number; replies: number; views?: number };
	createdAt: string;
}

/** Your posts with their numbers — click through for the drilldown. */
export default function StudioPosts() {
	const t = useT();
	const [rows, setRows] = useState<Row[]>([]);
	// A drilldown is "see more", not a destination — it opens over the list.
	// /studio/posts/[id] still exists for deep links.
	const [openId, setOpenId] = useState<string | null>(null);

	useEffect(() => {
		if (!openId) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") setOpenId(null);
		};
		document.addEventListener("keydown", onKey);
		return () => document.removeEventListener("keydown", onKey);
	}, [openId]);
	const [cursor, setCursor] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);

	const load = async (before?: string) => {
		const res = await getCreatorPostsAction(before);
		if (res.success) {
			setRows((prev) => (before ? [...prev, ...res.posts] : res.posts));
			setCursor(res.nextCursor);
		}
		setLoading(false);
	};

	useEffect(() => {
		void load();
	}, []);

	return (
		<div>
			<PageHead title={t("studio.nav.posts")} />

			<div className="rounded-2xl bg-[#171614] overflow-hidden">
				<div className="hidden sm:grid grid-cols-[1fr_repeat(4,72px)_28px] gap-2 px-4 py-2.5 border-b border-[#fafaf9]/[0.05] glass-eyebrow font-sans">
					<span>{t("studio.col.post")}</span>
					<span className="text-right">{t("studio.impressions")}</span>
					<span className="text-right">{t("post.like")}</span>
					<span className="text-right">{t("post.reply")}</span>
					<span className="text-right">{t("post.repost")}</span>
					<span />
				</div>
				{loading ? (
					<div className="p-4 space-y-3">
						{[1, 2, 3].map((i) => (
							<div key={i} className="h-10 rounded-lg bg-[#fafaf9]/[0.05] animate-pulse" />
						))}
					</div>
				) : rows.length === 0 ? (
					<p className="px-4 py-10 text-center font-sans text-sm glass-ink-faint">
						{t("studio.noPosts")}
					</p>
				) : (
					rows.map((row) => (
						<button
							type="button"
							key={row.id}
							onClick={() => setOpenId(row.id)}
							className="grid w-full grid-cols-[1fr_28px] sm:grid-cols-[1fr_repeat(4,72px)_28px] items-center gap-2 px-4 py-3 border-b border-[#fafaf9]/[0.05] last:border-0 hover:bg-[#fafaf9]/[0.06] transition-colors text-left cursor-pointer"
						>
							<span className="min-w-0">
								<span className="block font-sans text-[14px] glass-ink truncate">
 {row.content || (row.hasMedia ? t("studio.mediaPost") : "")}
								</span>
								<span className="block font-sans text-[12px] glass-ink-faint tabular-nums">
									{formatTimeAgo(row.createdAt)}
									{row.type === "live" ? ` · ${t("live.badge")}` : ""}
								</span>
							</span>
							<span className="hidden sm:block text-right font-sans text-[13px] glass-ink-dim tabular-nums">
								{fmt(row.stats.views ?? 0)}
							</span>
							<span className="hidden sm:block text-right font-sans text-[13px] glass-ink-dim tabular-nums">
								{fmt(row.stats.likes)}
							</span>
							<span className="hidden sm:block text-right font-sans text-[13px] glass-ink-dim tabular-nums">
								{fmt(row.stats.replies)}
							</span>
							<span className="hidden sm:block text-right font-sans text-[13px] glass-ink-dim tabular-nums">
								{fmt(row.stats.reposts)}
							</span>
							<CaretRight size={14} className="glass-ink-faint justify-self-end" />
						</button>
					))
				)}
			</div>

			{openId && (
				<div
					className="fixed inset-0 z-modal flex items-start justify-center overflow-y-auto bg-black/60 p-4 sm:p-8"
					onClick={() => setOpenId(null)}
				>
					<div
						role="dialog"
						aria-modal="true"
						className="w-full max-w-4xl rounded-2xl bg-[#0F0E0D] p-5"
						onClick={(e) => e.stopPropagation()}
					>
						<div className="mb-4 flex items-center justify-between gap-3">
							<h2 className="min-w-0 truncate font-sans text-[15px] font-semibold glass-ink">
								{rows.find((r) => r.id === openId)?.content ||
									t("studio.mediaPost")}
							</h2>
							<button
								type="button"
								onClick={() => setOpenId(null)}
								aria-label={t("studio.back")}
								className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-pill bg-[#fafaf9]/[0.06] glass-ink-dim transition-colors hover:glass-ink hover:bg-[#fafaf9]/[0.1]"
							>
								<X size={15} weight="bold" />
							</button>
						</div>
						<PostStats id={openId} />
					</div>
				</div>
			)}

			{cursor && (
				<button
					type="button"
					onClick={() => load(cursor)}
					className="mt-4 h-9 px-4 rounded-pill bg-[#fafaf9]/[0.06] glass-ink-dim hover:glass-ink hover:bg-[#fafaf9]/[0.1] font-sans text-[13px] font-medium transition-colors cursor-pointer"
				>
					{t("rail.showMore")}
				</button>
			)}
		</div>
	);
}
