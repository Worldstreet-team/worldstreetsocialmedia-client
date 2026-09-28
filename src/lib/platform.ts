/**
 * Where a message or a call came from (owner 2026-09-24 and 2026-09-26:
 * "know if someone sends a message from WorldSpace or from Xstream", "if
 * a missed call is from WorldSpace or from Xstream"). The gateway stamps
 * `source` on every message and `platform` on every ring from the
 * `x-ws-platform` header. WorldSpace and its phone app are one home, so
 * nothing is said for those; every other platform is named.
 */
export const PLATFORM_LABELS: Record<string, string> = {
	dashboard: "Dashboard",
	academy: "Academy",
	shop: "Shop",
	xstream: "Xstream",
};

/** "Xstream" for a platform that is not home, else null. */
export function platformName(source: string | null | undefined): string | null {
	return source ? (PLATFORM_LABELS[source] ?? null) : null;
}

/** "via Xstream" for a platform that is not home, else null. */
export function viaLabel(source: string | null | undefined): string | null {
	const name = platformName(source);
	return name ? `via ${name}` : null;
}
