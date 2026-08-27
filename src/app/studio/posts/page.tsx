"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CaretRight } from "@phosphor-icons/react";
import { useT } from "@/i18n/client";
import { getCreatorPostsAction } from "@/lib/creator.actions";
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

			<div className="glass-panel backdrop-blur-xl backdrop-saturate-150 border glass-divider rounded-2xl overflow-hidden">
				<div className="hidden sm:grid grid-cols-[1fr_repeat(4,72px)_28px] gap-2 px-4 py-2.5 border-b glass-divider glass-eyebrow font-sans">
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
						<Link
							key={row.id}
							href={`/studio/posts/${row.id}`}
							className="grid grid-cols-[1fr_28px] sm:grid-cols-[1fr_repeat(4,72px)_28px] items-center gap-2 px-4 py-3 border-b glass-divider last:border-0 hover:bg-[#fafaf9]/[0.06] transition-colors"
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
						</Link>
					))
				)}
			</div>

			{cursor && (
				<button
					type="button"
					onClick={() => load(cursor)}
					className="mt-4 h-9 px-4 rounded-pill glass-chip backdrop-blur-md font-sans text-[13px] font-medium transition-colors cursor-pointer"
				>
					{t("rail.showMore")}
				</button>
			)}
		</div>
	);
}
