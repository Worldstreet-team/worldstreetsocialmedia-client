"use client";

import Link from "next/link";
import { useState } from "react";
import { Broadcast, MonitorPlay } from "@phosphor-icons/react";
import { useT } from "@/i18n/client";
import { GoLiveSheet } from "@/components/feed/GoLiveSheet";

/** Quick services on the feed header's right edge — the creation features
 *  flexed where the eye already is, instead of buried down a rail. */
export function FeedHeaderActions() {
	const t = useT();
	const [showGoLive, setShowGoLive] = useState(false);
	return (
		<div className="flex items-center gap-2 pr-3 shrink-0">
			<Link
				href="/live"
				aria-label={t("nav.videos")}
				title={t("nav.videos")}
				className="flex h-9 w-9 items-center justify-center rounded-pill text-muted hover:text-primary hover:bg-raised transition-colors"
			>
				<MonitorPlay size={18} weight="duotone" />
			</Link>
			<button
				type="button"
				onClick={() => setShowGoLive(true)}
				className="shine flex items-center gap-1.5 h-8 px-3.5 rounded-pill text-[12px] font-semibold font-sans text-white bg-gradient-to-b from-danger to-[#C22D2D] hover:opacity-90 transition-opacity cursor-pointer"
			>
				<Broadcast size={14} weight="fill" />
				{t("golive.entry")}
			</button>
			{showGoLive && <GoLiveSheet onClose={() => setShowGoLive(false)} />}
		</div>
	);
}
