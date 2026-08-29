"use client";

import { useId } from "react";
import type { IconProps } from "@/app/types";

/** The three membership levels a tick can represent. */
export type VerifiedTier = "bronze" | "silver" | "gold";

/**
 * Metal per tier, as gradient stops rather than one flat colour. A single
 * hex read as yellow paint, not gold — metal is banding: a bright face at
 * the top falling to a deep shadow at the bottom edge. All literal values, not tokens: this
 * is the *material* of a membership mark and must read the same in light
 * and dark, however the brand colour moves (gold once rode the brand token
 * and turned blue in the rebrand — never again).
 */
const TIER_STOPS: Record<VerifiedTier, [string, string][]> = {
	gold: [
		["0%", "#FFF6C9"],
		["30%", "#FDE047"],
		["58%", "#EAB308"],
		["82%", "#C88A06"],
		["100%", "#A16207"],
	],
	silver: [
		["0%", "#FFFFFF"],
		["30%", "#E5E7EB"],
		["58%", "#B8BCC4"],
		["82%", "#8B919C"],
		["100%", "#6B7280"],
	],
	bronze: [
		["0%", "#F5CFA0"],
		["30%", "#D9975C"],
		["58%", "#B87333"],
		["82%", "#96581F"],
		["100%", "#7C4A1E"],
	],
};

/** Phosphor SealCheck, fill weight — the scalloped seal with the check
 *  knocked out. Inlined so the fill can be a gradient; a Phosphor component
 *  only takes currentColor. */
const SEAL_PATH =
	"M225.86,102.82c-3.77-3.94-7.67-8-9.14-11.57-1.36-3.27-1.44-8.69-1.52-13.94-.15-9.76-.31-20.82-8-28.51s-18.75-7.85-28.51-8c-5.25-.08-10.67-.16-13.94-1.52-3.56-1.47-7.63-5.37-11.57-9.14C146.28,23.51,138.44,16,128,16s-18.27,7.51-25.18,14.14c-3.94,3.77-8,7.67-11.57,9.14C88,40.64,82.56,40.72,77.31,40.8c-9.76.15-20.82.31-28.51,8S41,67.55,40.8,77.31c-.08,5.25-.16,10.67-1.52,13.94-1.47,3.56-5.37,7.63-9.14,11.57C23.51,109.72,16,117.56,16,128s7.51,18.27,14.14,25.18c3.77,3.94,7.67,8,9.14,11.57,1.36,3.27,1.44,8.69,1.52,13.94.15,9.76.31,20.82,8,28.51s18.75,7.85,28.51,8c5.25.08,10.67.16,13.94,1.52,3.56,1.47,7.63,5.37,11.57,9.14C109.72,232.49,117.56,240,128,240s18.27-7.51,25.18-14.14c3.94-3.77,8-7.67,11.57-9.14,3.27-1.36,8.69-1.44,13.94-1.52,9.76-.15,20.82-.31,28.51-8s7.85-18.75,8-28.51c.08-5.25.16-10.67,1.52-13.94,1.47-3.56,5.37-7.63,9.14-11.57C232.49,146.28,240,138.44,240,128S232.49,109.73,225.86,102.82Zm-52.2,6.84-56,56a8,8,0,0,1-11.32,0l-24-24a8,8,0,0,1,11.32-11.32L112,148.69l50.34-50.35a8,8,0,0,1,11.32,11.32Z";

/**
 * Verified badge — the scalloped seal reads as "verified" instantly; its
 * metal says which membership paid for it. The fill is a diagonal banded
 * gradient (the metal) with a soft white gloss falling off the top edge
 * (the chrome). Defaults to gold so the hundreds of existing call sites
 * that pass no tier are unchanged. `color` is accepted for old call sites
 * but ignored — a tick is never blue.
 */
const VerifiedIcon = ({
	size,
	tier = "gold",
}: IconProps & { tier?: VerifiedTier }) => {
	const px = size?.width ? Number.parseInt(size.width, 10) : 18;
	// Per-instance gradient ids: shared ids break when the first SVG that
	// defined them unmounts or sits in a hidden subtree.
	const uid = useId();
	const metal = `vm-${uid}`;
	const gloss = `vg-${uid}`;
	const stops = TIER_STOPS[tier] ?? TIER_STOPS.gold;

	return (
		<svg
			width={px}
			height={px}
			viewBox="0 0 256 256"
			className="shrink-0"
			role="img"
			aria-label={tier === "gold" ? "Verified" : `Verified, ${tier}`}
		>
			<defs>
				<linearGradient id={metal} x1="0.15" y1="0" x2="0.6" y2="1">
					{stops.map(([offset, color]) => (
						<stop key={offset} offset={offset} stopColor={color} />
					))}
				</linearGradient>
				<linearGradient id={gloss} x1="0" y1="0" x2="0" y2="1">
					<stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.55" />
					<stop offset="45%" stopColor="#FFFFFF" stopOpacity="0.08" />
					<stop offset="60%" stopColor="#FFFFFF" stopOpacity="0" />
				</linearGradient>
			</defs>
			<path d={SEAL_PATH} fill={`url(#${metal})`} />
			<path d={SEAL_PATH} fill={`url(#${gloss})`} />
		</svg>
	);
};

export default VerifiedIcon;
