"use client";

import clsx from "clsx";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useAtom } from "jotai";
import { Clock, Sparkle, Users, UsersThree } from "@phosphor-icons/react";
import { feedTabAtom } from "@/store/ui.atom";
import { getCommunitiesAction } from "@/lib/community.actions";
import { useT } from "@/i18n/client";
import { SafeAvatar } from "@/components/ui/SafeAvatar";

interface CommunityChip {
	id: string;
	name: string;
	slug: string;
	avatar?: string;
}

/**
 * The feed bar: rounded chips, the CURRENT tab pinned left and never
 * scrolling away. The scroller behind it carries the other two timelines and
 * then the communities you have actually JOINED (name + avatar, not a generic
 * link). Nothing else — destinations and topic browsing both belong
 * elsewhere, and anything extra here buries the communities.
 */
export function FeedTabs() {
	const t = useT();
	const [tab, setTab] = useAtom(feedTabAtom);
	const [myCommunities, setMyCommunities] = useState<CommunityChip[]>([]);

	useEffect(() => {
		let cancelled = false;
		(async () => {
			const res = await getCommunitiesAction();
			if (cancelled || !res.success) return;
			setMyCommunities(
				(res.communities ?? [])
					.filter((c: any) => c.joined)
					.slice(0, 8)
					.map((c: any) => ({
						id: String(c.id),
						name: c.name,
						slug: c.slug,
						avatar: c.avatar || undefined,
					})),
			);
		})();
		return () => {
			cancelled = true;
		};
	}, []);

	const chip =
		"relative flex items-center gap-2 h-11 px-4 rounded-pill font-sans text-[15.5px] whitespace-nowrap transition-colors shrink-0";
	const idle = "font-medium text-muted hover:text-primary hover:bg-raised/50";

	// The three timelines, in the order they are offered: ranked, then the
	// people you chose, then raw chronological. "Newest" is the escape hatch —
	// somewhere to go when the ranked feed feels stale, without it having to
	// re-rank For You into a recency list.
	const TABS = [
		{ key: "foryou" as const, label: t("feed.tab.foryou"), Icon: Sparkle },
		{ key: "following" as const, label: t("feed.tab.following"), Icon: Users },
		{ key: "newest" as const, label: t("feed.tab.newest"), Icon: Clock },
	];
	const active = TABS.find((x) => x.key === tab) ?? TABS[0];
	const rest = TABS.filter((x) => x.key !== active.key);

	return (
		<div
			role="tablist"
			aria-label="Timeline"
			className="flex h-full w-full items-center gap-2 pl-3 pr-1"
		>
			{/* Pinned the tab you are on is always in reach. */}
			<button
				type="button"
				role="tab"
				aria-selected="true"
				className={clsx(chip, "bg-raised font-semibold text-primary")}
			>
				<AnimatePresence mode="wait" initial={false}>
					<motion.span
						key={active.key}
						initial={{ opacity: 0, y: 4 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, transition: { duration: 0.12 } }}
						transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
						className="flex items-center gap-1.5"
					>
						<active.Icon size={15} weight="fill" className="text-gold" />
						{active.label}
					</motion.span>
				</AnimatePresence>
			</button>

			<span className="h-5 w-px shrink-0 bg-hairline" />

 {/* Scroller masked on the right so it reads as "more this way". */}
			<div className="flex-1 min-w-0 flex items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [mask-image:linear-gradient(to_right,black_calc(100%-28px),transparent)]">
				{rest.map((x) => (
					<button
						key={x.key}
						type="button"
						role="tab"
						aria-selected="false"
						onClick={() => setTab(x.key)}
						className={clsx(chip, idle, "cursor-pointer")}
					>
						<x.Icon size={15} weight="duotone" />
						{x.label}
					</button>
				))}
				{/* The Street (/live) and Space (/voice) used to sit here. They
				    are destinations, not timelines — mixing them into the
				    timeline row made every tab press feel like it might navigate
				    away. Both still live in the nav rails. */}

				{/* YOUR communities, by name. The generic link only appears when
				    you haven't joined any yet. */}
				{myCommunities.length > 0 ? (
					myCommunities.map((c) => (
						<Link
							key={c.id}
							href={`/communities/${c.slug}`}
							className={clsx(chip, idle)}
						>
							<span className="relative w-[18px] h-[18px] rounded-pill overflow-hidden bg-raised shrink-0 flex items-center justify-center">
								{c.avatar ? (
									<SafeAvatar src={c.avatar} className="object-cover" />
								) : (
									<span className="text-[10px] font-bold text-subtle font-sans uppercase">
										{c.name.slice(0, 1)}
									</span>
								)}
							</span>
							{c.name}
						</Link>
					))
				) : (
					<Link href="/communities" className={clsx(chip, idle)}>
						<UsersThree size={14} weight="duotone" />
						{t("nav.communities")}
					</Link>
				)}

				{/* Interest-category chips used to trail the communities here.
				    They made the row long enough to always need scrolling and
				    pushed the communities — the thing people actually navigate
				    to — out of sight. Browsing by topic still lives on Explore,
				    where it belongs. */}
			</div>
		</div>
	);
}
