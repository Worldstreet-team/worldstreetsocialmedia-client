"use client";

import { usePathname } from "next/navigation";
import { splitLocalePath } from "@/i18n/config";

/**
 * `usePathname()` with the locale prefix stripped — the route as app code
 * thinks of it.
 *
 * Every nav surface compares the pathname against bare hrefs ("/", "/live"),
 * but proxy.ts serves the same app under a locale prefix, so on /es the raw
 * pathname is "/es" and NOTHING matched: no tab ever rendered active, and the
 * bottom nav's hide-on-/post/-and-/live guards never fired either. Route
 * checks belong on this value; `Link href` stays bare (the proxy re-adds the
 * prefix on the response).
 */
export function useAppPathname(): string {
	return splitLocalePath(usePathname() || "/").pathname;
}
