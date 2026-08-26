import {
	CATEGORIES,
	LEGACY_CATEGORY_ALIASES,
	type ContentCategory,
} from "@/data/categories";

const CATEGORY_BY_ID = new Map(CATEGORIES.map((c) => [c.id, c]));

/**
 * Interest ids as stored on a profile, resolved to live categories.
 *
 * Old profiles stored display labels ("Technology") rather than ids, so the
 * alias table migrates them on read. Unknown ids are dropped rather than
 * rendered raw: a retired category should disappear, not show as a slug.
 */
export function resolveCategories(
	raw: string[] | undefined | null,
	limit = Number.POSITIVE_INFINITY,
): ContentCategory[] {
	const seen = new Set<string>();
	const out: ContentCategory[] = [];
	for (const value of raw ?? []) {
		const lower = String(value).toLowerCase();
		const id = LEGACY_CATEGORY_ALIASES[lower] ?? lower;
		if (seen.has(id)) continue;
		seen.add(id);
		const cat = CATEGORY_BY_ID.get(id);
		if (cat) out.push(cat);
		if (out.length >= limit) break;
	}
	return out;
}

/**
 * A gateway-supplied category string rendered as a taxonomy label. Unknown
 * values pass through unchanged, so a trend the algorithm invented still
 * reads sensibly.
 */
export function resolveCategoryLabel(value: string | undefined | null): string {
	if (!value) return "";
	const lower = String(value).toLowerCase();
	const id = LEGACY_CATEGORY_ALIASES[lower] ?? lower;
	return CATEGORY_BY_ID.get(id)?.label ?? value;
}

/**
 * Interest ids as stored, normalized to current ids.
 *
 * Same migration as resolveCategories, but returning ids rather than category
 * objects, for the paths that persist the list back to the gateway. Ids are
 * the permanent algorithm key, so this is what must cross the wire.
 */
export function normalizeCategoryIds(
	raw: string[] | undefined | null,
): string[] {
	return resolveCategories(raw).map((c) => c.id);
}
