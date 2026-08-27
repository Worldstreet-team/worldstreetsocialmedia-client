"use client";

import { SealCheck } from "@phosphor-icons/react";
import type { IconProps } from "@/app/types";

/** The three membership levels a tick can represent. */
export type VerifiedTier = "bronze" | "silver" | "gold";

/**
 * Metal per tier. All three are literal values rather than tokens: they are
 * the *material* of a membership mark, not theme colours, and they must read
 * the same in light and dark.
 *
 * Gold used to ride the brand token. When the brand moved to blue the ladder
 * rendered "bronze, silver, blue", which is not a ladder. It is pinned now,
 * and it must stay pinned however the brand colour moves next.
 */
const TIER_CLASS: Record<VerifiedTier, string> = {
	bronze: "text-[#B87333]",
	silver: "text-[#B8BCC4]",
	gold: "text-[#EAB308]",
};

/**
 * Verified badge — Phosphor SealCheck (filled). The scalloped seal reads as
 * "verified" instantly; its metal says which membership paid for it. Defaults
 * to gold so the hundreds of existing call sites that pass no tier are
 * unchanged. `color` is accepted for old call sites but ignored — a tick is
 * never blue.
 */
const VerifiedIcon = ({
	size,
	tier = "gold",
}: IconProps & { tier?: VerifiedTier }) => {
	const px = size?.width ? Number.parseInt(size.width, 10) : 18;
	return (
		<SealCheck
			size={px}
			weight="fill"
			className={`${TIER_CLASS[tier] ?? TIER_CLASS.gold} shrink-0`}
			aria-label={tier === "gold" ? "Verified" : `Verified, ${tier}`}
		/>
	);
};

export default VerifiedIcon;
