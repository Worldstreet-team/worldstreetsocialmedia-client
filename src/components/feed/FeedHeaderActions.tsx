"use client";

import { useState } from "react";
import { Broadcast } from "@phosphor-icons/react";
import { useT } from "@/i18n/client";
import { GoLiveSheet } from "@/components/feed/GoLiveSheet";

/** The one Go Live entry point — pinned on the bar, never scrolling with
 *  the tabs. */
export function FeedHeaderActions() {
	const t = useT();
	const [showGoLive, setShowGoLive] = useState(false);
	return (
		<div className="flex items-center pl-3 pr-2 shrink-0">
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
