"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Broadcast } from "@phosphor-icons/react";
import { useAtomValue } from "jotai";
import clsx from "clsx";
import { useT } from "@/i18n/client";
import {
	GoLiveSheet,
	type GoLivePreset,
} from "@/components/feed/GoLiveSheet";
import { listPresetsAction } from "@/lib/creator.actions";
import { liveSessionAtom } from "@/store/live.atom";
import { pop, press } from "@/lib/motion-presets";

/** Go Live. Two homes, split at md so they never both render: the feed bar on
 *  desktop, and the mobile top bar (`compact`) — where it sits beside the
 *  brand mark instead of eating the tab scroller's width.
 *
 *  While a native broadcast is running the button flips to a disabled LIVE
 *  state — the floating dock is the studio, a second stream makes no sense. */
export function FeedHeaderActions({ compact = false }: { compact?: boolean }) {
	const t = useT();
	const [showGoLive, setShowGoLive] = useState(false);
	const [preset, setPreset] = useState<GoLivePreset | null>(null);
	const live = useAtomValue(liveSessionAtom);
	// The LIVE badge pops only when the stream starts while this is on
	// screen. Already live at mount (a route change, a reload) is not news.
	const mountedLive = useRef(Boolean(live));

	useEffect(() => {
		(async () => {
			const res = await listPresetsAction();
			if (!res.success) return;
			const def =
				res.presets.find((p: any) => p.isDefault) ?? res.presets[0];
			if (def)
				setPreset({
					category: def.category,
					source: def.source,
					notifyFollowers: def.notifyFollowers,
				});
		})();
	}, []);

	const wrap = compact
		? "flex md:hidden items-center shrink-0"
		: "hidden md:flex items-center pl-3 pr-2 shrink-0";

	if (live) {
		return (
			<div className={wrap}>
				<motion.span
					{...pop}
					initial={mountedLive.current ? false : pop.initial}
					className={clsx(
						"flex items-center gap-1.5 h-8 rounded-pill text-[calc(12px*var(--ws-fs))] font-bold font-sans text-danger border border-danger/40 bg-danger/10 select-none",
						compact ? "px-2.5" : "px-3.5",
					)}
				>
					<span className="relative flex h-1.5 w-1.5">
						<span className="absolute inline-flex h-full w-full rounded-pill bg-danger opacity-70 animate-ping" />
						<span className="relative inline-flex h-1.5 w-1.5 rounded-pill bg-danger" />
					</span>
					{t("dock.liveBadge")}
				</motion.span>
			</div>
		);
	}

	return (
		<div className={wrap}>
			{/* Flat danger, no gradient: #C22D2D was off-token, and in light
			    mode it made the pill get lighter toward the bottom. */}
			<motion.button
				{...press}
				type="button"
				onClick={() => setShowGoLive(true)}
				aria-label={t("golive.entry")}
				className={clsx(
					"shine flex items-center justify-center gap-1.5 rounded-pill text-[calc(12px*var(--ws-fs))] font-semibold font-sans text-white bg-danger hover:opacity-90 transition-opacity cursor-pointer",
					compact ? "h-9 w-9" : "h-8 px-3.5",
				)}
			>
				<Broadcast size={16} weight="fill" className="shrink-0" />
				{/* Icon-only in the mobile bar. The centred lockup animates its
				    wordmark in, which needs the width a label would take — and
				    a red broadcast pill reads as "go live" without one. The
				    aria-label carries the name for assistive tech. */}
				{!compact && <span>{t("golive.entry")}</span>}
			</motion.button>
			{showGoLive && (
				<GoLiveSheet
					preset={preset}
					onClose={() => setShowGoLive(false)}
				/>
			)}
		</div>
	);
}
