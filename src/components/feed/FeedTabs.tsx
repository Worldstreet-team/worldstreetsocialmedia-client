"use client";

import clsx from "clsx";
import Link from "next/link";
import { motion } from "framer-motion";
import { useAtom } from "jotai";
import {
	RoadHorizon,
	Sparkle,
	Users,
	UsersThree,
} from "@phosphor-icons/react";
import { feedTabAtom } from "@/store/ui.atom";
import { useT } from "@/i18n/client";

/**
 * The feed's top bar: the two timeline tabs plus the surfaces that grew out
 * of them — The Street and Communities ride the same row as destinations.
 * Each item carries its glyph (duotone at rest, filled when current); the
 * gold underline still slides between the two true tabs.
 */
export function FeedTabs() {
	const t = useT();
	const [tab, setTab] = useAtom(feedTabAtom);

	const base =
		"relative h-full flex items-center justify-center gap-1.5 px-4 font-sans text-sm whitespace-nowrap transition-colors cursor-pointer shrink-0";

	return (
		<div
			role="tablist"
			aria-label="Timeline"
			className="flex h-full w-full overflow-x-auto [scrollbar-width:none]"
		>
			<button
				type="button"
				role="tab"
				aria-selected={tab === "foryou"}
				onClick={() => setTab("foryou")}
				className={clsx(
					base,
					tab === "foryou"
						? "font-semibold text-primary"
						: "font-medium text-muted hover:text-primary hover:bg-raised/40",
				)}
			>
				<Sparkle size={16} weight={tab === "foryou" ? "fill" : "duotone"} />
				{t("feed.tab.foryou")}
				{tab === "foryou" && (
					<motion.span
						layoutId="feed-tab-underline"
						transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
						className="absolute bottom-0 h-0.5 w-12 rounded-pill bg-brand"
					/>
				)}
			</button>

			<button
				type="button"
				role="tab"
				aria-selected={tab === "following"}
				onClick={() => setTab("following")}
				className={clsx(
					base,
					tab === "following"
						? "font-semibold text-primary"
						: "font-medium text-muted hover:text-primary hover:bg-raised/40",
				)}
			>
				<Users size={16} weight={tab === "following" ? "fill" : "duotone"} />
				{t("feed.tab.following")}
				{tab === "following" && (
					<motion.span
						layoutId="feed-tab-underline"
						transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
						className="absolute bottom-0 h-0.5 w-12 rounded-pill bg-brand"
					/>
				)}
			</button>

			<Link
				href="/live"
				className={clsx(base, "font-medium text-muted hover:text-primary hover:bg-raised/40")}
			>
				<RoadHorizon size={16} weight="duotone" />
				{t("nav.videos")}
			</Link>

			<Link
				href="/communities"
				className={clsx(base, "font-medium text-muted hover:text-primary hover:bg-raised/40")}
			>
				<UsersThree size={16} weight="duotone" />
				{t("nav.communities")}
			</Link>
		</div>
	);
}
