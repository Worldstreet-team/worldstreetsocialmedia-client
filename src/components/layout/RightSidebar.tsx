"use client";

import { useEffect, useState } from "react";
import { getWhoToFollowAction, followUserAction } from "@/lib/user.actions";
import { getStoriesAction } from "@/lib/stories.actions";
import Link from "next/link";
import Image from "next/image";
import { Search } from "lucide-react";
import { useToast } from "@/components/ui/Toast/ToastContext";
import { useAtom } from "jotai";
import {
	suggestionsAtom,
	suggestionsLoadedAtom,
} from "@/store/suggestions.atom";
import {
	trendsAtom,
	trendsLoadedAtom,
} from "@/store/trends.atom";
import { commandPaletteOpenAtom, followingIdsAtom } from "@/store/ui.atom";
import { getExploreDataAction } from "@/lib/post.actions";
import { DEFAULT_AVATAR, XSTREAM_WEB_URL } from "@/const";
import { useT } from "@/i18n/client";
import VerifiedIcon from "@/assets/icons/VerifiedIcon";

interface LiveEntry {
	authorId: string;
	username: string;
	avatar: string;
	title?: string;
	streamRef?: string;
}

/* Module shell: one card grammar for the whole rail — title row with an
   optional live dot, tight list, single gold "show more" tail. */
function Module({
	title,
	live,
	delay,
	children,
}: {
	title: string;
	live?: boolean;
	delay: number;
	children: React.ReactNode;
}) {
	return (
		<section
			className="bg-surface border border-hairline rounded-xl overflow-hidden shrink-0 animate-rise"
			style={{ animationDelay: `${delay}ms` }}
		>
			<div className="flex items-center gap-2 px-4 pt-4 pb-2">
				{live && (
					<span className="relative flex h-2 w-2">
						<span className="absolute inline-flex h-full w-full rounded-pill bg-danger opacity-60 animate-ping" />
						<span className="relative inline-flex h-2 w-2 rounded-pill bg-danger" />
					</span>
				)}
				<h3 className="font-sans font-semibold text-primary text-[15px]">
					{title}
				</h3>
			</div>
			{children}
		</section>
	);
}

export function RightSidebar() {
	const t = useT();
	const [suggestions, setSuggestions] = useAtom(suggestionsAtom);
	const [isSuggestionsLoaded, setIsSuggestionsLoaded] = useAtom(
		suggestionsLoadedAtom,
	);
	const [trends, setTrends] = useAtom(trendsAtom);
	const [isTrendsLoaded, setIsTrendsLoaded] = useAtom(trendsLoadedAtom);
	const [liveNow, setLiveNow] = useState<LiveEntry[]>([]);
	const [loading, setLoading] = useState(
		!isSuggestionsLoaded || !isTrendsLoaded,
	);
	const { toast } = useToast();
	// Shared with the feed's "Following" tab, so a follow here shows up there.
	const [followedIds, setFollowedIds] = useAtom(followingIdsAtom);
	const setPaletteOpen = useAtom(commandPaletteOpenAtom)[1];

	useEffect(() => {
		const fetchData = async () => {
			if (!isSuggestionsLoaded) {
				const res = await getWhoToFollowAction();
				if (res.success && Array.isArray(res.data)) {
					setSuggestions(res.data);
					setIsSuggestionsLoaded(true);
				}
			}
			if (!isTrendsLoaded) {
				try {
					const res = await getExploreDataAction();
					if (res.success) {
						setTrends(res.data.trendsForYou ?? []);
					}
				} catch (error) {
					console.error("Failed to fetch trends", error);
				} finally {
					setIsTrendsLoaded(true);
				}
			}
			setLoading(false);
		};
		fetchData();
	}, [
		isSuggestionsLoaded,
		setSuggestions,
		setIsSuggestionsLoaded,
		isTrendsLoaded,
		setTrends,
		setIsTrendsLoaded,
	]);

	// Live now — the stories rail already knows who is live; the module
	// disappears entirely when nobody is (an empty "live" box is worse than
	// none).
	useEffect(() => {
		let cancelled = false;
		(async () => {
			const res = await getStoriesAction();
			if (cancelled || !res.success || !res.data?.rail) return;
			const entries: LiveEntry[] = res.data.rail
				.filter((e: any) => e.isLive)
				.map((e: any) => {
					const liveStory = e.stories.find(
						(s: any) => s.origin === "live",
					);
					return {
						authorId: e.author._id,
						username: e.author.username,
						avatar: e.author.avatar || DEFAULT_AVATAR,
						title: liveStory?.caption,
						streamRef: liveStory?.streamRef,
					};
				});
			setLiveNow(entries.slice(0, 3));
		})();
		return () => {
			cancelled = true;
		};
	}, []);

	const handleFollow = async (userId: string) => {
		// Optimistic update
		setFollowedIds((prev) => [...prev, userId]);
		toast(t("rail.following"), { type: "success" });

		const res = await followUserAction(userId);
		if (!res.success) {
			setFollowedIds((prev) => prev.filter((id) => id !== userId));
			toast(t("rail.followFailed"), { type: "error" });
		}
	};

	const visibleSuggestions = suggestions.filter(
		(u) => !followedIds.includes(u._id),
	);

	return (
		<aside className="w-[350px] shrink-0 hidden lg:flex flex-col gap-5 sticky top-0 h-dvh p-4 pl-8 overflow-y-auto no-scrollbar">
			{/* Search — opens the Ctrl/Cmd+K command palette. */}
			<button
				type="button"
				onClick={() => setPaletteOpen(true)}
				style={{ animationDelay: "60ms" }}
				className="relative mt-2 shrink-0 flex items-center w-full h-10 bg-chip rounded-pill border-[1.5px] border-transparent pl-[42px] pr-3 font-sans text-sm text-subtle hover:text-muted hover:border-hairline transition-colors cursor-pointer animate-rise"
			>
				<Search className="absolute left-4 top-1/2 -translate-y-1/2 text-subtle w-4 h-4 pointer-events-none" />
				<span className="flex-1 text-left">{t("rail.search")}</span>
				<kbd className="flex items-center gap-1 rounded-sm border border-hairline bg-raised px-1.5 h-5 text-[10px] text-subtle">
					Ctrl K
				</kbd>
			</button>

			{/* Live now — real streams, red ring grammar shared with the
			    stories rail. Whole module absent when nobody is live. */}
			{liveNow.length > 0 && (
				<Module title={t("rail.liveNow")} live delay={140}>
					<div className="flex flex-col pb-2">
						{liveNow.map((entry) => (
							<a
								key={entry.authorId}
								href={
									entry.streamRef
										? `${XSTREAM_WEB_URL}/stream/${entry.streamRef}`
										: XSTREAM_WEB_URL
								}
								target="_blank"
								rel="noopener noreferrer"
								className="flex items-center gap-3 px-3 py-2.5 mx-1 rounded-lg hover:bg-raised transition-colors group"
							>
								<span className="relative w-10 h-10 rounded-pill p-[2px] bg-danger shrink-0">
									<span className="relative block w-full h-full rounded-pill overflow-hidden border-2 border-surface">
										<Image
											src={entry.avatar}
											alt={entry.username}
											fill
											className="object-cover"
										/>
									</span>
								</span>
								<span className="flex flex-col flex-1 min-w-0">
									<span className="font-semibold text-primary text-sm truncate font-sans">
										@{entry.username}
									</span>
									{entry.title && (
										<span className="text-subtle text-[12px] truncate font-sans">
											{entry.title}
										</span>
									)}
								</span>
								<span className="shrink-0 rounded-pill bg-danger px-3 h-7 flex items-center text-[12px] font-semibold text-white font-sans opacity-90 group-hover:opacity-100 transition-opacity">
									{t("rail.watch")}
								</span>
							</a>
						))}
					</div>
				</Module>
			)}

			{/* Happening now — ranked topics, no hashtag framing. The mono
			    rank digits are the module's only ornament. */}
			<Module title={t("rail.happening")} delay={220}>
				<div className="flex flex-col pb-1">
					{!isTrendsLoaded ? (
						[1, 2, 3].map((i) => (
							<div key={i} className="px-4 py-3">
								<div className="h-3 skeleton rounded w-16 mb-1.5" />
								<div className="h-4 skeleton rounded w-3/4 mb-1" />
								<div className="h-3 skeleton rounded w-12" />
							</div>
						))
					) : trends.length > 0 ? (
						trends.slice(0, 4).map((trend, i) => (
							<Link
								href={`/explore?q=${encodeURIComponent(
									trend.title.replace(/^#/, ""),
								)}`}
								key={trend.title}
								className="flex items-start gap-3.5 px-4 py-2.5 mx-1 rounded-lg hover:bg-raised transition-colors"
							>
								<span className="pt-0.5 font-mono text-[13px] text-gold tabular-nums select-none">
									{String(i + 1).padStart(2, "0")}
								</span>
								<span className="flex flex-col min-w-0">
									<span className="text-[10.5px] uppercase tracking-[0.1em] text-subtle font-sans font-semibold">
										{trend.category}
									</span>
									<span className="font-semibold text-primary text-[15px] truncate leading-snug">
										{trend.title.replace(/^#/, "")}
									</span>
									<span className="text-[12px] text-subtle font-sans tabular-nums">
										{trend.posts}
									</span>
								</span>
							</Link>
						))
					) : (
						<div className="px-4 py-3 text-sm text-subtle font-sans">
							{t("rail.noTrends")}
						</div>
					)}
					<Link
						href="/explore"
						className="text-gold text-[13px] font-medium font-sans hover:underline px-4 py-2.5 block"
					>
						{t("rail.showMore")}
					</Link>
				</div>
			</Module>

			{/* Suggested for you */}
			<Module title={t("rail.suggested")} delay={300}>
				<div className="flex flex-col pb-2">
					{loading && visibleSuggestions.length === 0 ? (
						<div className="flex flex-col gap-4 p-4">
							{[1, 2, 3].map((i) => (
								<div key={i} className="flex gap-3">
									<div className="w-10 h-10 skeleton rounded-full" />
									<div className="flex-1 space-y-2 py-1">
										<div className="h-3 skeleton rounded w-24" />
										<div className="h-2 skeleton rounded w-16" />
									</div>
								</div>
							))}
						</div>
					) : visibleSuggestions.length === 0 ? (
						<div className="px-5 py-5 text-center text-subtle text-sm font-sans">
							{t("rail.noSuggestions")}
						</div>
					) : (
						visibleSuggestions.slice(0, 3).map((user) => (
							<div
								key={user._id}
								className="flex items-center gap-3 px-3 py-2 mx-1 rounded-lg hover:bg-raised transition-colors group"
							>
								<Link
									href={`/profile/${user.username}`}
									className="flex items-center gap-3 flex-1 min-w-0"
								>
									<div className="relative w-10 h-10 rounded-pill overflow-hidden border border-hairline shrink-0">
										<Image
											src={user.avatar || DEFAULT_AVATAR}
											alt={user.username}
											fill
											className="object-cover"
										/>
									</div>
									<div className="flex flex-col flex-1 min-w-0">
										<span className="flex items-center gap-1 min-w-0">
											<span className="font-semibold text-primary text-sm truncate font-sans">
												{user.firstName} {user.lastName}
											</span>
											{(user as any).isVerified && (
												<span className="shrink-0 flex">
													<VerifiedIcon
														size={{ width: "14", height: "14" }}
													/>
												</span>
											)}
										</span>
										<span className="text-subtle text-[12px] truncate font-sans">
											@{user.username}
										</span>
									</div>
								</Link>
								<button
									onClick={() => handleFollow(user._id)}
									className="px-4 h-8 bg-primary text-page text-[13px] font-semibold rounded-pill font-sans hover:bg-muted transition-colors shrink-0 cursor-pointer"
									type="button"
								>
									{t("rail.follow")}
								</button>
							</div>
						))
					)}
				</div>
			</Module>

			{/* Legal links return when real worldstreetgold.com URLs exist —
			    no href="#" dead links shipped as content. */}
			<footer className="px-4 mt-1">
				<p className="text-[10px] text-subtle font-sans">
					© 2026 WorldStreet Group
				</p>
			</footer>
		</aside>
	);
}
