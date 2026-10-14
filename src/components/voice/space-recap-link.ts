/**
 * Where a space recap opens. A recap is a sheet over a page, never a page of
 * its own (a drilldown is a modal), so the link is a page plus `?recap=<id>`
 * and `SpaceRecapDeepLink` on that page opens the sheet.
 *
 * Kept apart from SpaceRecapSheet so a notification row can build the link
 * without pulling the sheet into its bundle.
 */
export const RECAP_PARAM = "recap";

/** `/notifications?recap=<id>` by default; pass "/voice" once the voice page
 *  mounts `SpaceRecapDeepLink` too. */
export function spaceRecapHref(spaceId: string, base = "/notifications") {
  return `${base}?${RECAP_PARAM}=${encodeURIComponent(spaceId)}`;
}

/** A recap id from a query string value, or null when it is not one. */
export function recapIdFrom(value: string | null | undefined): string | null {
  return value && /^[0-9a-f]{24}$/i.test(value) ? value : null;
}
