"use client";

import clsx from "clsx";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useAtom, useAtomValue } from "jotai";
import { Clock, Sparkle, Users, UsersThree } from "@phosphor-icons/react";
import { feedTabAtom } from "@/store/ui.atom";
import { userAtom } from "@/store/user.atom";
import { getCommunitiesAction } from "@/lib/community.actions";
import { CATEGORIES, LEGACY_CATEGORY_ALIASES } from "@/data/categories";
import { useT } from "@/i18n/client";
import { SafeAvatar } from "@/components/ui/SafeAvatar";

interface CommunityChip {
	id: string;
	name: string;
	slug: string;
	avatar?: string;
}

const CATEGORY_BY_ID = new Map(CATEGORIES.map((c) => [c.id, c]));

/**
 * The feed bar: rounded chips, the CURRENT tab pinned left and never
 * scrolling away. The scroller behind it carries the other timeline, The
 * Street, Space Voice — then the communities you have actually JOINED
 * (name + avatar, not a generic link) and your interest categories, the
 * same vector the ranking algorithm personalizes on.
 */
export function FeedTabs() {
	const t = useT();
	const [tab, setTab] = useAtom(feedTabAtom);
	const user = useAtomValue(userAtom);
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

	// Interest ids → labels (legacy ids migrated through the alias table).
	const categoryChips = useMemo(() => {
		const seen = new Set<string>();
		const out: { id: string; label: string }[] = [];
		for (const raw of user?.interests ?? []) {
			// Old profiles stored display labels ("Technology"); the alias
			// table keys are lowercase, current ids are lowercase kebab.
			const lower = raw.toLowerCase();
			const id = LEGACY_CATEGORY_ALIASES[lower] ?? lower;
			if (seen.has(id)) continue;
			seen.add(id);
			const cat = CATEGORY_BY_ID.get(id);
			if (cat) out.push({ id: cat.id, label: cat.label });
			if (out.length >= 6) break;
		}
		return out;
	}, [user?.interests]);

	const chip =
		"relative flex items-center gap-1.5 h-9 px-3.5 rounded-pill font-sans text-[13.5px] whitespace-nowrap transition-colors shrink-0";
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
									<span className="text-[9px] font-bold text-subtle font-sans uppercase">
										{c.name.slice(0, 1)}
									</span>
								)}
							</span>
							{c.name}
						</Link>
					))
				) : (
					<Link href="/communities" className={clsx(chip, idle)}>
						<UsersThree size={15} weight="duotone" />
						{t("nav.communities")}
					</Link>
				)}

 {/* Interest categories the algorithm's personalization axes,
				    surfaced. Tap one to explore it. */}
				{categoryChips.length > 0 && (
					<span className="h-5 w-px shrink-0 bg-hairline/60" />
				)}
				{categoryChips.map((c) => (
					<Link
						key={c.id}
						href={`/explore?q=${encodeURIComponent(c.label)}`}
						className={clsx(chip, idle)}
					>
						{c.label}
					</Link>
				))}
			</div>
		</div>
	);
}
