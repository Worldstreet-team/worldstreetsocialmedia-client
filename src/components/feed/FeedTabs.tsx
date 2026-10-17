"use client";

import clsx from "clsx";
import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useAtom } from "jotai";
import { Plus } from "@phosphor-icons/react";
import { feedTabAtom } from "@/store/ui.atom";
import { getCommunitiesAction } from "@/lib/community.actions";
import { useT } from "@/i18n/client";
import { SafeAvatar } from "@/components/ui/SafeAvatar";
import { staggerItem, staggerParentFast } from "@/lib/motion-presets";

/* Once per app session. The chips arrive after a fetch that every visit to
   the feed repeats; they cascade the first time and are simply there after. */
let chipsIntroPlayed = false;

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

	useEffect(() => {
		if (myCommunities.length > 0) chipsIntroPlayed = true;
	}, [myCommunities.length]);

	// The three timelines, in the order they are offered: ranked, then the
	// people you chose, then raw chronological.
	const TABS = [
		{ key: "foryou" as const, label: t("feed.tab.foryou") },
		{ key: "following" as const, label: t("feed.tab.following") },
		{ key: "newest" as const, label: t("feed.tab.newest") },
	];

	// X's grammar (owner 2026-10-16): plain words, the active one bold with a
	// short brand bar under it, a hairline under the row. After the
	// timelines come the communities you have JOINED, by name and picture,
	// and a small + at the end to go and find more.
	const tabCls =
		"relative flex h-full shrink-0 items-center gap-2 px-4 font-sans text-[calc(15px*var(--ws-fs))] whitespace-nowrap transition-colors";
	const bar = (
		<motion.span
			layoutId="feed-tab-bar"
			transition={{ type: "spring", stiffness: 520, damping: 42 }}
			aria-hidden
			className="absolute inset-x-0 bottom-0 mx-auto h-[3px] w-7 rounded-pill bg-brand"
		/>
	);

	return (
		<div className="flex h-full w-full items-stretch">
			<div
				role="tablist"
				aria-label="Timeline"
				className="flex min-w-0 flex-1 items-stretch overflow-x-auto pl-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
			>
				{TABS.map((x) => {
					const on = tab === x.key;
					return (
						<button
							key={x.key}
							type="button"
							role="tab"
							aria-selected={on}
							onClick={() => setTab(x.key)}
							className={clsx(
								tabCls,
								on ? "font-bold text-primary" : "cursor-pointer font-medium text-muted hover:text-primary",
							)}
						>
							{x.label}
							{on && bar}
						</button>
					);
				})}

				<motion.div
					variants={staggerParentFast}
					initial={chipsIntroPlayed ? false : "hidden"}
					animate="show"
					className="contents"
				>
					{myCommunities.map((c) => (
						<motion.div key={c.id} variants={staggerItem} className="flex shrink-0">
							<Link
								href={`/communities/${c.slug}`}
								className={clsx(tabCls, "font-medium text-muted hover:text-primary")}
							>
								<span className="relative flex h-[18px] w-[18px] shrink-0 items-center justify-center overflow-hidden rounded-[6px] bg-raised">
									{c.avatar ? (
										<SafeAvatar src={c.avatar} className="object-cover" />
									) : (
										<span className="font-sans text-[calc(10px*var(--ws-fs))] font-bold uppercase text-subtle">
											{c.name.slice(0, 1)}
										</span>
									)}
								</span>
								{c.name}
							</Link>
						</motion.div>
					))}
				</motion.div>
			</div>

			{/* Pin another feed: for now, find a community to join; joined
			    ones appear in the row above. */}
			<div className="flex shrink-0 items-center px-2">
				<Link
					href="/communities?tab=explore"
					aria-label={t("nav.communities")}
					className="flex h-7 w-7 items-center justify-center rounded-pill bg-primary/[0.07] text-muted transition-colors hover:bg-primary/[0.12] hover:text-primary"
				>
					<Plus size={14} weight="bold" />
				</Link>
			</div>
		</div>
	);
}
