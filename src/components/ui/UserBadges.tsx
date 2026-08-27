"use client";

import clsx from "clsx";
import VerifiedIcon, { type VerifiedTier } from "@/assets/icons/VerifiedIcon";
import WolfIcon from "@/assets/icons/WolfIcon";
import TeamIcon from "@/assets/icons/TeamIcon";

export interface ProfileBadge {
	type: "wolf" | "developer";
	tier?: "champion" | "finalist" | "contender";
	season?: string;
}

/**
 * Everything that renders after a display name.
 *
 * One component rather than a VerifiedIcon dropped in by hand at fourteen call
 * sites, each with its own px size: adding a second mark to a name meant
 * editing all fourteen, and they had already drifted apart. Order is fixed
 * (verification, then earned marks) so a name reads the same everywhere.
 */
export function UserBadges({
	isVerified,
	verification,
	badges,
	size = 13,
	className,
}: {
	isVerified?: boolean;
	/** Membership provenance from the profile; its `tier` colours the tick. */
	verification?: { tier?: VerifiedTier } | null;
	badges?: ProfileBadge[];
	size?: number;
	className?: string;
}) {
	const wolf = badges?.find((b) => b.type === "wolf");
	const dev = badges?.find((b) => b.type === "developer");
	if (!isVerified && !wolf && !dev) return null;

	return (
		<span className={clsx("inline-flex shrink-0 items-center gap-0.5", className)}>
			{isVerified && (
				<VerifiedIcon
					size={{ width: String(size), height: String(size) }}
					tier={verification?.tier}
				/>
			)}
			{dev && <TeamIcon size={size + 1} />}
			{wolf && (
				<WolfIcon
					size={size + 1}
					tier={wolf.tier}
					title={
						wolf.tier === "champion"
							? "Wolf of WorldStreet"
							: wolf.tier === "finalist"
								? "Wolf of WorldStreet finalist"
								: "Wolf of WorldStreet contender"
					}
				/>
			)}
		</span>
	);
}
