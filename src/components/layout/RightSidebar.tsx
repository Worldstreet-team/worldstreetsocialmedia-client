"use client";

import { useCallback, useEffect, useState } from "react";
import { getWhoToFollowAction, followUserAction } from "@/lib/user.actions";
import { useLiveNow } from "@/hooks/useLiveNow";
import Link from "next/link";
import Image from "next/image";
import { Aperture, Broadcast, Fire, MagnifyingGlass, UserPlus } from "@phosphor-icons/react";
import { PromoBanners } from "@/components/feed/PromoBanners";
import { SidebarWallet } from "@/components/layout/SidebarWallet";
import { SectionHead } from "@/components/layout/SectionHead";
import { SpacesRail } from "@/components/layout/SpacesRail";
import { useAppPathname } from "@/i18n/useAppPathname";
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
import { SafeAvatar } from "@/components/ui/SafeAvatar";
import { UserBadges } from "@/components/ui/UserBadges";
import { resolveCategoryLabel } from "@/lib/categories";
import clsx from "clsx";


export function RightSidebar() {
	const t = useT();
	// Explore IS the discovery page: trends and people-to-follow are its main
	// content. The rail keeps what Explore does not show (wallet, promos, live,
	// spaces) and drops the two sections that would otherwise be duplicated
	// side by side on the same screen.
	const onExplore = useAppPathname().startsWith("/explore");
	const [suggestions, setSuggestions] = useAtom(suggestionsAtom);
	const [isSuggestionsLoaded, setIsSuggestionsLoaded] = useAtom(
		suggestionsLoadedAtom,
	);
	const [trends, setTrends] = useAtom(trendsAtom);
	const [isTrendsLoaded, setIsTrendsLoaded] = useAtom(trendsLoadedAtom);
	// Live presence is realtime (Ably) and sourced from Xstream, so your own
	// broadcast shows here the moment it starts.
	const { entries: liveNow } = useLiveNow();
	const [category, setCategory] = useState<string>("all");
	const [failed, setFailed] = useState(false);
	const { toast } = useToast();
	// Shared with the feed's "Following" tab, so a follow here shows up there.
	const [followedIds, setFollowedIds] = useAtom(followingIdsAtom);
	const [trendsExpanded, setTrendsExpanded] = useState(false);
	const [suggestionsExpanded, setSuggestionsExpanded] = useState(false);
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
		// The whole aside is hidden below lg — don't spend three requests on
		// markup nobody can see (the feed column has its own stories rail).
		if (!window.matchMedia("(min-width: 1024px)").matches) return;
		void fetchAll();
	}, [fetchAll]);

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

			{/* Balance first: it is the one number on this rail that is about
			    you rather than about other people. */}
			<section
				className="shrink-0 animate-rise"
				style={{ animationDelay: "90ms" }}
			>
				<SidebarWallet />
			</section>

			<section
				className="shrink-0 animate-rise"
				style={{ animationDelay: "120ms" }}
			>
				<PromoBanners />
			</section>

			{/* Live rings the red ring grammar, above Happening now. Click a
			    ring to watch in-app; See all opens the live directory. */}
			{liveNow.length > 0 && (
				<section className="animate-rise" style={{ animationDelay: "180ms" }}>
					<SectionHead
						icon={<Broadcast size={13} weight="duotone" />}
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
								key={entry.id}
								href={`/live?tab=live&s=${entry.id}`}
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

			{/* Space Voice — live audio rooms, then what's scheduled next.
			    Directly under Live now so everything happening right now is
			    one block of the column. */}
			<SpacesRail />

			{/* Happening now ranked topics, category chips, no hashtag framing.
			    Shown on every page including Explore: the rail is trending's one
			    home, which is why Explore's own column no longer repeats it. */}
			<section className="animate-rise" style={{ animationDelay: "240ms" }}>
				<SectionHead
					icon={<Fire size={13} weight="fill" />}
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
									"px-2.5 h-6 rounded-pill text-[11px] font-medium font-sans transition-colors cursor-pointer",
									category === c
										? "bg-primary text-page"
										: "bg-raised text-muted hover:text-primary",
								)}
							>
								{resolveCategoryLabel(c)}
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
						visibleTrends
							.slice(0, trendsExpanded ? 8 : 5)
							.map((trend: any, i: number) => (
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
									<span className="flex flex-col min-w-0 flex-1">
										<span className="font-semibold text-primary text-[15px] truncate leading-snug">
											{trend.title.replace(/^#/, "")}
										</span>
										<span className="text-[12px] text-subtle font-sans tabular-nums">
											{trend.category ? `${resolveCategoryLabel(trend.category)} · ` : ""}
											{trend.posts}
										</span>
									</span>

									{/* Who is actually posting into this tag. A trend with five
									    real faces behind it reads very differently from a bare
									    count, which is the whole reason the gateway dedupes
									    authors per hashtag. */}
									{trend.people?.length > 0 && (
										<span className="flex shrink-0 items-center self-center pl-1">
											{trend.people
												.slice(0, 5)
												.map((person: any, pi: number) => (
													<span
														key={person.username}
														title={`@${person.username}`}
														className="relative -ml-2 h-6 w-6 shrink-0 overflow-hidden rounded-pill bg-raised ring-2 ring-page first:ml-0"
														// Intra-row stacking only, far below the
														// z-sticky floor. Earlier faces sit on top so
														// the pile reads left-to-right.
														style={{ zIndex: 5 - pi }}
													>
														<SafeAvatar src={person.avatar} />
													</span>
												))}
											{(trend.peopleCount ?? 0) > 5 && (
												<span className="relative -ml-2 flex h-6 shrink-0 items-center rounded-pill bg-raised px-1.5 font-sans text-[10px] font-bold tabular-nums text-muted ring-2 ring-page">
													+{trend.peopleCount - 5}
												</span>
											)}
										</span>
									)}
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

					{/* Reveals the rest in place. It used to navigate to /explore,
					    which lost your scroll position to show five more rows. */}
					{visibleTrends.length > 5 && (
						<button
							type="button"
							onClick={() => setTrendsExpanded((v) => !v)}
							className="px-3 py-2.5 text-left text-gold text-[13px] font-medium font-sans hover:underline cursor-pointer"
						>
							{trendsExpanded ? t("rail.showLess") : t("rail.showMore")}
						</button>
					)}
				</div>
			</section>

			{/* Suggested for you names always resolve (username fallback).
			    Hidden on Explore, which lists People to follow in its own column. */}
			{!onExplore && (
				<section className="animate-rise" style={{ animationDelay: "300ms" }}>
				<SectionHead
					icon={<UserPlus size={13} weight="duotone" />}
					label={t("rail.suggested")}
				/>
				<div className="flex flex-col">
					{!isSuggestionsLoaded ? (
						<div className="flex flex-col gap-4 p-3">
							{[1, 2, 3].map((i) => (
								<div key={i} className="flex gap-3">
									<div className="w-10 h-10 skeleton rounded-pill" />
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
						visibleSuggestions
							.slice(0, suggestionsExpanded ? visibleSuggestions.length : 3)
							.map((user: any) => {
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
													<UserBadges
														isVerified={user.isVerified}
																verification={(user as any).verification}
														badges={user.badges}
														size={14}
													/>
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

					{visibleSuggestions.length > 3 && (
						<button
							type="button"
							onClick={() => setSuggestionsExpanded((v) => !v)}
							className="px-3 py-2.5 text-left text-gold text-[13px] font-medium font-sans hover:underline cursor-pointer"
						>
							{suggestionsExpanded
								? t("rail.showLess")
								: t("rail.showMore")}
						</button>
					)}
				</div>
				</section>
			)}

			<footer className="px-3 mt-auto pb-2">
				<p className="text-[10px] text-subtle font-sans">
					© 2026 WorldStreet Group
				</p>
			</footer>
		</aside>
	);
}
