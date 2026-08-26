"use client";

import { useCallback, useEffect, useState } from "react";
import { getWhoToFollowAction, followUserAction } from "@/lib/user.actions";
import { getStoriesAction } from "@/lib/stories.actions";
import Link from "next/link";
import Image from "next/image";
import { MagnifyingGlass } from "@phosphor-icons/react";
import { StoriesRail } from "@/components/feed/StoriesRail";
import { SectionHead } from "@/components/layout/SectionHead";
import { SpacesRail } from "@/components/layout/SpacesRail";
import { useToast } from "@/components/ui/Toast/ToastContext";
import { useAtom } from "jotai";
import {
	suggestionsAtom,
	suggestionsLoadedAtom,
} from "@/store/suggestions.atom";
import { trendsAtom, trendsLoadedAtom } from "@/store/trends.atom";
import { commandPaletteOpenAtom, followingIdsAtom } from "@/store/ui.atom";
import { getExploreDataAction } from "@/lib/post.actions";
import { DEFAULT_AVATAR, XSTREAM_WEB_URL } from "@/const";
import { useT } from "@/i18n/client";
import VerifiedIcon from "@/assets/icons/VerifiedIcon";
import { SafeAvatar } from "@/components/ui/SafeAvatar";
import clsx from "clsx";

interface LiveEntry {
	authorId: string;
	username: string;
	avatar: string;
	title?: string;
	streamRef?: string;
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
	const [category, setCategory] = useState<string>("all");
	const [failed, setFailed] = useState(false);
	const { toast } = useToast();
	// Shared with the feed's "Following" tab, so a follow here shows up there.
	const [followedIds, setFollowedIds] = useAtom(followingIdsAtom);
	const setPaletteOpen = useAtom(commandPaletteOpenAtom)[1];

	// A failed fetch marks the section loaded-with-error and offers a retry —
	// skeletons must never be a terminal state.
	const fetchAll = useCallback(async () => {
		setFailed(false);
		const [who, explore] = await Promise.allSettled([
			isSuggestionsLoaded ? null : getWhoToFollowAction(),
			isTrendsLoaded ? null : getExploreDataAction(),
		]);
		if (who.status === "fulfilled" && who.value) {
			if (who.value.success && Array.isArray(who.value.data)) {
				setSuggestions(who.value.data);
			} else setFailed(true);
			setIsSuggestionsLoaded(true);
		}
		if (explore.status === "fulfilled" && explore.value) {
			if (explore.value.success) {
				setTrends(explore.value.data?.trendsForYou ?? []);
			} else setFailed(true);
			setIsTrendsLoaded(true);
		}
	}, [
		isSuggestionsLoaded,
		isTrendsLoaded,
		setSuggestions,
		setIsSuggestionsLoaded,
		setTrends,
		setIsTrendsLoaded,
	]);

	useEffect(() => {
		void fetchAll();
	}, [fetchAll]);

	// Live now — the stories rail already knows who is live. The section is
	// absent when nobody is.
	useEffect(() => {
		let cancelled = false;
		(async () => {
			const res = await getStoriesAction();
			if (cancelled || !res.success || !res.data?.rail) return;
			const entries: LiveEntry[] = res.data.rail
				.filter((e: any) => e.isLive)
				.map((e: any) => {
					const liveStory = e.stories.find((s: any) => s.origin === "live");
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
	const categories = [
		"all",
		...Array.from(
			new Set(trends.map((tr: any) => tr.category).filter(Boolean)),
		).slice(0, 3),
	];
	const visibleTrends =
		category === "all"
			? trends
			: trends.filter((tr: any) => tr.category === category);

	return (
		<aside className="w-[350px] shrink-0 hidden lg:flex flex-col gap-7 sticky top-0 h-dvh py-4 pl-8 pr-4 overflow-y-auto no-scrollbar">
			{/* Search opens the Ctrl/Cmd+K command palette. */}
			<button
				type="button"
				onClick={() => setPaletteOpen(true)}
				style={{ animationDelay: "60ms" }}
				className="relative mt-2 shrink-0 flex items-center w-full h-10 bg-chip rounded-pill pl-[42px] pr-3 font-sans text-sm text-subtle hover:text-muted transition-colors cursor-pointer animate-rise"
			>
				<MagnifyingGlass
					size={16}
					className="absolute left-4 top-1/2 -translate-y-1/2 text-subtle pointer-events-none"
				/>
				<span className="flex-1 text-left">{t("rail.search")}</span>
				<kbd className="flex items-center gap-1 rounded-sm bg-raised px-1.5 h-5 text-[10px] text-subtle">
					Ctrl K
				</kbd>
			</button>

			{/* Stories moved here from the feed top: rings on the rail,
			    the feed column stays pure timeline. */}
			<section
				className="shrink-0 animate-rise"
				style={{ animationDelay: "120ms" }}
			>
				<SectionHead label={t("rail.stories")} />
				<StoriesRail />
			</section>

			{/* Live rings the red ring grammar, above Happening now. Click a
			    ring to watch in-app; See all opens the live directory. */}
			{liveNow.length > 0 && (
				<section className="animate-rise" style={{ animationDelay: "180ms" }}>
					<SectionHead
						label={t("rail.liveNow")}
						live
						trailing={
							<Link
								href="/live-now"
								className="font-sans text-[11px] font-semibold text-gold hover:underline"
							>
								{t("rail.seeAll")}
							</Link>
						}
					/>
					<div className="flex gap-3 overflow-x-auto px-3 py-1 [scrollbar-width:none]">
						{liveNow.map((entry) => (
							<Link
								key={entry.authorId}
								href={
									entry.streamRef
										? `/stream/${entry.streamRef}`
										: "/live-now"
								}
								className="flex flex-col items-center gap-1 shrink-0"
							>
								<span className="relative w-14 h-14 rounded-pill p-[2px] bg-danger">
									<span className="relative block w-full h-full rounded-pill overflow-hidden border-2 border-page bg-raised">
										<SafeAvatar src={entry.avatar} />
									</span>
									<span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-[4px] bg-danger px-1 py-px text-[8px] font-bold tracking-wide text-white font-sans">
										{t("live.badge")}
									</span>
								</span>
								<span className="text-[11px] text-muted font-sans truncate max-w-14">
									@{entry.username}
								</span>
							</Link>
						))}
					</div>
				</section>
			)}

			{/* Street Voice — live audio rooms, then what's scheduled next.
			    Directly under Live now so everything happening right now is
			    one block of the column. */}
			<SpacesRail />

			{/* Happening now ranked topics, category chips, no hashtag framing. */}
			<section className="animate-rise" style={{ animationDelay: "240ms" }}>
				<SectionHead
					label={t("rail.happening")}
					trailing={
						<span className="text-[10px] font-semibold uppercase tracking-wider text-gold font-sans">
							{t("rail.scope")}
						</span>
					}
				/>
				{categories.length > 2 && (
					<div className="flex gap-1.5 px-3 pb-2 flex-wrap">
						{categories.map((c) => (
							<button
								key={c}
								type="button"
								onClick={() => setCategory(c)}
								className={clsx(
									"px-2.5 h-6 rounded-pill text-[11px] font-medium font-sans transition-colors cursor-pointer capitalize",
									category === c
										? "bg-primary text-page"
										: "bg-raised text-muted hover:text-primary",
								)}
							>
								{c}
							</button>
						))}
					</div>
				)}
				<div className="flex flex-col">
					{!isTrendsLoaded ? (
						[1, 2, 3].map((i) => (
							<div key={i} className="px-3 py-2.5">
								<div className="h-3 skeleton rounded w-16 mb-1.5" />
								<div className="h-4 skeleton rounded w-3/4" />
							</div>
						))
					) : visibleTrends.length > 0 ? (
						visibleTrends.slice(0, 5).map((trend: any, i: number) => (
							<Link
								href={`/explore?q=${encodeURIComponent(
									trend.title.replace(/^#/, ""),
								)}`}
								key={trend.title}
								className="flex items-start gap-3.5 px-3 py-2.5 rounded-xl hover:bg-surface transition-colors"
							>
								<span className="pt-0.5 font-mono text-[13px] text-gold tabular-nums select-none">
									{String(i + 1).padStart(2, "0")}
								</span>
								<span className="flex flex-col min-w-0">
									<span className="font-semibold text-primary text-[15px] truncate leading-snug">
										{trend.title.replace(/^#/, "")}
									</span>
									<span className="text-[12px] text-subtle font-sans tabular-nums">
										{trend.category ? `${trend.category} · ` : ""}
										{trend.posts}
									</span>
								</span>
							</Link>
						))
					) : failed ? (
						<button
							type="button"
							onClick={() => {
								setIsTrendsLoaded(false);
								setIsSuggestionsLoaded(false);
								void fetchAll();
							}}
							className="mx-3 my-2 px-3 py-2 rounded-pill bg-raised text-sm text-primary font-sans hover:bg-chip transition-colors cursor-pointer"
						>
							{t("rail.retry")}
						</button>
					) : (
						<p className="px-3 py-2 text-sm text-subtle font-sans">
							{t("rail.noTrends")}
						</p>
					)}
					<Link
						href="/explore"
						className="text-gold text-[13px] font-medium font-sans hover:underline px-3 py-2.5 block"
					>
						{t("rail.showMore")}
					</Link>
				</div>
			</section>

			{/* Suggested for you names always resolve (username fallback). */}
			<section className="animate-rise" style={{ animationDelay: "300ms" }}>
				<SectionHead label={t("rail.suggested")} />
				<div className="flex flex-col">
					{!isSuggestionsLoaded ? (
						<div className="flex flex-col gap-4 p-3">
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
						<p className="px-3 py-3 text-sm text-subtle font-sans">
							{t("rail.noSuggestions")}
						</p>
					) : (
						visibleSuggestions.slice(0, 3).map((user) => {
							const displayName =
								[user.firstName, user.lastName]
									.filter(Boolean)
									.join(" ") || `@${user.username}`;
							const showHandle = displayName !== `@${user.username}`;
							return (
								<div
									key={user._id}
									className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-surface transition-colors group"
								>
									<Link
										href={`/profile/${user.username}`}
										className="flex items-center gap-3 flex-1 min-w-0"
									>
										<div className="relative w-10 h-10 rounded-pill overflow-hidden shrink-0 bg-raised">
											<SafeAvatar src={user.avatar} />
										</div>
										<div className="flex flex-col flex-1 min-w-0">
											<span className="flex items-center gap-1 min-w-0">
												<span className="font-semibold text-primary text-sm truncate font-sans">
													{displayName}
												</span>
												{(user as any).isVerified && (
													<span className="shrink-0 flex">
														<VerifiedIcon
															size={{ width: "14", height: "14" }}
														/>
													</span>
												)}
											</span>
											{showHandle && (
												<span className="text-subtle text-[12px] truncate font-sans">
													@{user.username}
												</span>
											)}
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
							);
						})
					)}
				</div>
			</section>

			<footer className="px-3 mt-auto pb-2">
				<p className="text-[10px] text-subtle font-sans">
					© 2026 WorldStreet Group
				</p>
			</footer>
		</aside>
	);
}
