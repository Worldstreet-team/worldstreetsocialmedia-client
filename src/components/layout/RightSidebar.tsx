"use client";

import { useEffect, useState } from "react";
import { getWhoToFollowAction, followUserAction } from "@/lib/user.actions";
import Link from "next/link";
import Image from "next/image";
import { Search, MoreHorizontal, TrendingUp } from "lucide-react";
import { useToast } from "@/components/ui/Toast/ToastContext";
import { useAtom } from "jotai";
import {
    suggestionsAtom,
    suggestionsLoadedAtom,
    type UserSuggestion,
} from "@/store/suggestions.atom";
import {
    trendsAtom,
    trendsLoadedAtom,
    type TrendingTopic,
} from "@/store/trends.atom";
import { commandPaletteOpenAtom, followingIdsAtom } from "@/store/ui.atom";
import { getExploreDataAction } from "@/lib/post.actions";
import { DEFAULT_AVATAR } from "@/const";

export function RightSidebar() {
    const [suggestions, setSuggestions] = useAtom(suggestionsAtom);
    const [isSuggestionsLoaded, setIsSuggestionsLoaded] = useAtom(
        suggestionsLoadedAtom,
    );
    const [trends, setTrends] = useAtom(trendsAtom);
    const [isTrendsLoaded, setIsTrendsLoaded] = useAtom(trendsLoadedAtom);

    // Loading is true if either is not loaded
    const [loading, setLoading] = useState(
        !isSuggestionsLoaded || !isTrendsLoaded,
    );
    const { toast } = useToast();
    // Shared with the feed's "Following" tab, so a follow here shows up there.
    const [followedIds, setFollowedIds] = useAtom(followingIdsAtom);
    const setPaletteOpen = useAtom(commandPaletteOpenAtom)[1];

    useEffect(() => {
        const fetchData = async () => {
            // Fetch Suggestions if needed
            if (!isSuggestionsLoaded) {
                const res = await getWhoToFollowAction();
                if (res.success && Array.isArray(res.data)) {
                    setSuggestions(res.data);
                    setIsSuggestionsLoaded(true);
                }
            }

            // Fetch Trends if needed
            if (!isTrendsLoaded) {
                try {
                    const res = await getExploreDataAction();
                    if (res.success) {
                        setTrends(res.data.trendsForYou);
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

    const handleFollow = async (userId: string) => {
        // Optimistic update
        setFollowedIds((prev) => [...prev, userId]);
        toast("Following user", { type: "success" });

        const res = await followUserAction(userId);
        if (!res.success) {
            setFollowedIds((prev) => prev.filter((id) => id !== userId));
            toast("Failed to follow", { type: "error" });
        }
    };

    // Filter out followed users from display
    const visibleSuggestions = suggestions.filter(
        (u) => !followedIds.includes(u._id),
    );

    return (
        <aside className="w-[350px] shrink-0 hidden lg:flex flex-col gap-6 sticky top-0 h-dvh p-4 pl-8 overflow-y-auto no-scrollbar">
            {/* Search — opens the Ctrl/Cmd+K command palette. */}
            <button
                type="button"
                onClick={() => setPaletteOpen(true)}
                style={{ animationDelay: "60ms" }}
                className="relative mt-2 shrink-0 flex items-center w-full h-10 bg-chip rounded-pill border-[1.5px] border-transparent pl-[42px] pr-3 font-sans text-sm text-subtle hover:text-muted hover:border-hairline transition-colors cursor-pointer animate-rise"
            >
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-subtle w-4 h-4 pointer-events-none" />
                <span className="flex-1 text-left">Search WorldStreet</span>
                <kbd className="flex items-center gap-1 rounded-sm border border-hairline bg-raised px-1.5 h-5 text-[10px] text-subtle">
                    Ctrl K
                </kbd>
            </button>

            {/* Trending Section - Card */}
            <section
                className="bg-surface border border-hairline rounded-xl overflow-hidden p-2 shrink-0 animate-rise"
                style={{ animationDelay: "220ms" }}
            >
                {/* UI/Title (Public Sans SemiBold 16) — card titles aren't display type. */}
                <h3 className="font-sans font-semibold text-primary px-4 py-3.5 text-base">
                    What's happening
                </h3>
                <div className="flex flex-col gap-1">
                    {!isTrendsLoaded ? (
                        // DS Skeleton (04-components): bg/raised + shimmer sweep.
                        [1, 2, 3].map((i) => (
                            <div key={i} className="px-4 py-3">
                                <div className="flex justify-between mb-1">
                                    <div className="h-3 skeleton rounded w-24" />
                                </div>
                                <div className="h-4 skeleton rounded w-3/4 mb-1.5" />
                                <div className="h-3 skeleton rounded w-12" />
                            </div>
                        ))
                    ) : trends.length > 0 ? (
                        trends.slice(0, 3).map((trend, i) => (
                            <Link
                                href={`/explore?q=${trend.title.replace("#", "")}`}
                                key={i}
                                className="flex items-center gap-3 px-3 py-3 hover:bg-raised rounded-md transition-colors cursor-pointer group"
                            >
                                {/* 03-icons accent-chip rule: icon in the accent
                                    color on the same accent @13% wash. */}
                                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-accent-social/[0.13]">
                                    <TrendingUp className="w-4 h-4 text-accent-social" />
                                </span>
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between text-[11px] text-subtle font-sans mb-0.5">
                                        <span>{trend.category} · Trending</span>
                                        <MoreHorizontal className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                    <p className="font-bold text-primary text-[15px] mb-0.5 truncate">
                                        {trend.title}
                                    </p>
                                    <p className="text-[11px] text-subtle font-sans tabular-nums">
                                        {trend.posts}
                                    </p>
                                </div>
                            </Link>
                        ))
                    ) : (
                        <div className="px-4 py-3 text-sm text-subtle font-sans">
                            No trends available
                        </div>
                    )}
                    <Link
                        href="/explore"
                        className="text-gold text-[13px] font-medium font-sans hover:underline px-4 py-3 text-left block"
                    >
                        Show more
                    </Link>
                </div>
            </section>

            {/* Who to Follow Section - Card */}
            <section
                className="bg-surface border border-hairline rounded-xl overflow-hidden p-2 shrink-0 animate-rise"
                style={{ animationDelay: "300ms" }}
            >
                <h3 className="font-sans font-semibold text-primary px-4 py-3.5 text-base">
                    Who to follow
                </h3>
                <div className="flex flex-col gap-2 -mt-1.5">
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
                        <div className="px-5 py-6 text-center text-subtle text-sm font-sans">
                            No suggestions available
                        </div>
                    ) : (
                        visibleSuggestions.slice(0, 3).map((user) => (
                            <div
                                key={user._id}
                                className="flex items-center gap-3 px-3 py-2.5 hover:bg-raised rounded-md transition-colors group"
                            >
                                <Link
                                    href={`/profile/${user.username}`}
                                    className="flex items-center gap-3 flex-1 min-w-0"
                                >
                                    <div className="relative w-10 h-10 rounded-full overflow-hidden border border-hairline shrink-0">
                                        <Image
                                            src={user.avatar || DEFAULT_AVATAR}
                                            alt={user.username}
                                            fill
                                            className="object-cover"
                                        />
                                    </div>
                                    <div className="flex flex-col flex-1 min-w-0">
                                        <span className="font-bold text-primary text-sm truncate group-hover:text-gold transition-colors">
                                            {user.firstName} {user.lastName}
                                        </span>
                                        <span className="text-subtle text-[11px] truncate font-sans group-hover:text-subtle">
                                            @{user.username}
                                        </span>
                                    </div>
                                </Link>
                                <button
                                    onClick={() => handleFollow(user._id)}
                                    className="px-[18px] h-8 bg-primary text-page text-[13px] font-semibold rounded-pill font-sans hover:bg-muted transition-colors shrink-0"
                                    type="button"
                                >
                                    Follow
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </section>

            {/* Legal links return when real worldstreetgold.com URLs exist —
                no href="#" dead links shipped as content. */}
            <footer className="px-4 mt-2">
                <p className="text-[10px] text-subtle font-sans">
                    © 2026 WorldStreet Group
                </p>
            </footer>
        </aside>
    );
}
