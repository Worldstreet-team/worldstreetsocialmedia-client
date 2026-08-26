"use client";

/**
 * The WorldStreet mark, worn as a badge by the people who build the platform.
 *
 * Same polygon pair as BrandRitual, so the badge and the sidebar lockup are
 * literally the same geometry rather than two drawings that drift apart. The
 * PNG is not used here: at 13px it would be mush, and this scales.
 *
 * The two halves carry slightly different golds, which is what keeps the fold
 * down the centre readable once it is this small.
 */
export function TeamIcon({
	size = 14,
	title = "WorldStreet team",
}: {
	size?: number;
	title?: string;
}) {
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 435.32 245.73"
			role="img"
			aria-label={title}
			className="shrink-0"
			// The mark is far wider than it is tall; the box keeps it optically
			// the same weight as the round seal beside it.
			style={{ height: size * 0.72, width: size }}
		>
			<title>{title}</title>
			<polygon points="0,0 159.68,0 217.66,102.5 139.01,245.73" fill="#F5CE4E" />
			<polygon
				points="435.32,0 275.64,0 217.66,102.5 296.32,245.73"
				fill="#C99A0C"
			/>
		</svg>
	);
}

export default TeamIcon;
