"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { CaretRight } from "@phosphor-icons/react";
import { useT } from "@/i18n/client";
import { getCreatorPostsAction } from "@/lib/creator.actions";
import { PostStats } from "@/components/studio/PostStats";
import ConfirmModalPortal from "@/components/ui/ConfirmModalPortal";
import {
	OverlayHeader,
	OverlayPanel,
	OverlayScrim,
	useOverlayDismiss,
} from "@/components/ui/Overlay";
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

	// Escape AND the body scroll lock now — the local keydown listener that
	// used to sit here left the list scrolling behind the drilldown.
	const closeDrilldown = useCallback(() => setOpenId(null), []);
	useOverlayDismiss(Boolean(openId), closeDrilldown);

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

			{/* A drilldown is a modal, not a page. On the standard grammar it is
			    the `center` plate — widened, because a stats table is not a
			    sentence and two buttons. Ink inside comes from theme tokens: the
			    panel is `glass-frost`, which follows the theme, unlike the
			    fixed-dark chrome the studio list is drawn on. */}
			<ConfirmModalPortal>
				<AnimatePresence>
					{openId && (
						<OverlayScrim
							key="drilldown-scrim"
							onClose={closeDrilldown}
							label={t("studio.back")}
						/>
					)}
					{openId && (
						<OverlayPanel
							key="drilldown-panel"
							variant="center"
							label={
								rows.find((r) => r.id === openId)?.content ||
								t("studio.mediaPost")
							}
							/* The Studio is deliberately fixed-dark in both themes, and
							   PostStats renders #171614 cards. A frost panel put those
							   dark cards on a white sheet in light mode, so this one
							   owns its ground. */
							ground="none"
							className="border border-hairline bg-[#171614] shadow-nav sm:w-[min(880px,94vw)]"
						>
							<OverlayHeader
								title={
									rows.find((r) => r.id === openId)?.content ||
									t("studio.mediaPost")
								}
								onClose={closeDrilldown}
								closeLabel={t("studio.back")}
							/>
							<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-[calc(20px+var(--ws-safe-bottom))]">
								<PostStats id={openId} />
							</div>
						</OverlayPanel>
					)}
				</AnimatePresence>
			</ConfirmModalPortal>

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
