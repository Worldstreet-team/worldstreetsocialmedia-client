/**
 * Helpers over the content taxonomy in `@/data/categories`.
 *
 * Pure functions, no I/O — safe in server components, client components and
 * server actions alike. Anything that talks to the gateway belongs in a
 * `*.actions.ts` file; this module only shapes and matches the vocabulary.
 */

import {
	CATEGORIES,
	type ContentCategory,
	type ContentRegion,
	type ContentVertical,
	LEGACY_CATEGORY_ALIASES,
	MAX_INTERESTS,
	REGIONS,
	type RegionId,
	VERTICALS,
	type VerticalId,
} from "@/data/categories";

// ── Lookups ──────────────────────────────────────────────────────────────

export const CATEGORY_BY_ID: ReadonlyMap<string, ContentCategory> = new Map(
	CATEGORIES.map((c) => [c.id, c]),
);

export const VERTICAL_BY_ID: ReadonlyMap<VerticalId, ContentVertical> = new Map(
	VERTICALS.map((v) => [v.id, v]),
);

export const REGION_BY_ID: ReadonlyMap<RegionId, ContentRegion> = new Map(
	REGIONS.map((r) => [r.id, r]),
);

export function getCategory(id: string): ContentCategory | undefined {
	return CATEGORY_BY_ID.get(id);
}

/** Display label for an id; falls back to the id so UI never renders blank. */
export function getCategoryLabel(id: string): string {
	return CATEGORY_BY_ID.get(id)?.label ?? id;
}

export function isCategoryId(value: string): boolean {
	return CATEGORY_BY_ID.has(value);
}

/** Verticals paired with their categories, in declaration order. */
export function categoriesByVertical(): {
	vertical: ContentVertical;
	categories: ContentCategory[];
}[] {
	return VERTICALS.map((vertical) => ({
		vertical,
		categories: CATEGORIES.filter((c) => c.vertical === vertical.id),
	}));
}

export function categoriesIn(vertical: VerticalId): ContentCategory[] {
	return CATEGORIES.filter((c) => c.vertical === vertical);
}

/**
 * The default "For You" candidate pool: everything except opt-in categories.
 * Pass the user's own interests so their explicit picks are never filtered out.
 */
export function defaultCategoryIds(userInterests: string[] = []): string[] {
	const opted = new Set(normalizeCategoryIds(userInterests));
	return CATEGORIES.filter((c) => !c.sensitive || opted.has(c.id)).map(
		(c) => c.id,
	);
}

/** Video-feed ordering hint: short-form-native categories first. */
export function videoCategoryIds(): string[] {
	return [
		...CATEGORIES.filter((c) => c.videoFirst).map((c) => c.id),
		...CATEGORIES.filter((c) => !c.videoFirst).map((c) => c.id),
	];
}

/**
 * Interest ids as stored on a profile, resolved to live categories.
 *
 * Old profiles stored display labels ("Technology") rather than ids, so the
 * alias table migrates them on read. Unknown ids are dropped rather than
 * rendered raw: a retired category should disappear, not show as a slug.
 * Same key normalization as `normalizeCategoryIds`, but returns the resolved
 * objects and takes an arbitrary display limit instead of `MAX_INTERESTS`.
 */
export function resolveCategories(
	raw: string[] | undefined | null,
	limit = Number.POSITIVE_INFINITY,
): ContentCategory[] {
	const seen = new Set<string>();
	const out: ContentCategory[] = [];
	for (const value of raw ?? []) {
		if (typeof value !== "string") continue;
		const key = value.trim().toLowerCase().replace(/\s+/g, "-");
		const id = CATEGORY_BY_ID.has(key)
			? key
			: LEGACY_CATEGORY_ALIASES[key.replace(/-/g, "")] ||
				LEGACY_CATEGORY_ALIASES[key];
		if (!id || seen.has(id)) continue;
		seen.add(id);
		const cat = CATEGORY_BY_ID.get(id);
		if (cat) out.push(cat);
		if (out.length >= limit) break;
	}
	return out;
}

/**
 * Coerce arbitrary stored values into live category ids.
 *
 * Handles the pre-taxonomy profiles (interests were free-text labels like
 * "Technology"), retired ids, casing and spacing drift. Unknown values are
 * dropped rather than passed through — the algorithm should never receive a
 * key it cannot score.
 */
export function normalizeCategoryIds(values: readonly string[]): string[] {
	const out: string[] = [];
	for (const raw of values) {
		if (typeof raw !== "string") continue;
		const key = raw.trim().toLowerCase().replace(/\s+/g, "-");
		const id = CATEGORY_BY_ID.has(key)
			? key
			: LEGACY_CATEGORY_ALIASES[key.replace(/-/g, "")] ||
				LEGACY_CATEGORY_ALIASES[key];
		if (id && CATEGORY_BY_ID.has(id) && !out.includes(id)) out.push(id);
	}
	return out.slice(0, MAX_INTERESTS);
}

/**
 * Render an arbitrary gateway-supplied category string as taxonomy language.
 *
 * Trend rows arrive with whatever the gateway stored ("crypto", "Technology",
 * "crypto-markets"). Anything that maps onto a live id renders as its label;
 * anything else falls through unchanged, so an unknown value still displays
 * rather than vanishing.
 */
export function resolveCategoryLabel(raw: string): string {
	if (!raw?.trim()) return "";
	const [id] = normalizeCategoryIds([raw]);
	return id ? getCategoryLabel(id) : raw;
}

// ── Classifier ───────────────────────────────────────────────────────────

/**
 * Crypto tickers get routed to `crypto-markets`; every other cashtag is
 * assumed to be an equity. Deliberately short — this is a tiebreaker, not a
 * symbol registry (the gateway owns the real one).
 */
const CRYPTO_TICKERS = new Set([
	"btc",
	"eth",
	"sol",
	"xrp",
	"bnb",
	"ada",
	"doge",
	"shib",
	"pepe",
	"ltc",
	"dot",
	"avax",
	"link",
	"matic",
	"usdt",
	"usdc",
	"trx",
	"ton",
]);

const SCORE = {
	hashtag: 4,
	phrase: 3,
	cashtag: 3,
	word: 2,
} as const;

/** word -> category ids (single-token keywords, matched on token equality). */
const WORD_INDEX = new Map<string, string[]>();
/** [phrase, categoryId] for multi-word keywords, matched on padded substring. */
const PHRASE_INDEX: [string, string][] = [];
/** hashtag body ("aiml" for `ai-ml`) -> category id. */
const HASHTAG_INDEX = new Map<string, string[]>();

function indexTerm(index: Map<string, string[]>, term: string, id: string) {
	const bucket = index.get(term);
	if (bucket) {
		if (!bucket.includes(id)) bucket.push(id);
	} else {
		index.set(term, [id]);
	}
}

for (const category of CATEGORIES) {
	indexTerm(HASHTAG_INDEX, category.id.replace(/-/g, ""), category.id);
	for (const keyword of category.keywords) {
		const term = keyword.toLowerCase();
		if (term.includes(" ")) {
			PHRASE_INDEX.push([` ${term} `, category.id]);
			indexTerm(HASHTAG_INDEX, term.replace(/[^a-z0-9]/g, ""), category.id);
		} else {
			indexTerm(WORD_INDEX, term, category.id);
			indexTerm(HASHTAG_INDEX, term.replace(/[^a-z0-9]/g, ""), category.id);
		}
	}
}

/**
 * The taxonomy topic a legacy #hashtag points at, if any.
 *
 * The platform moved from hashtags to the 100-category taxonomy (2026-08):
 * ids ride posts, trends are topic-shaped, ranking reads categories first.
 * Post text still contains hashtags people typed, so the UI maps them onto
 * topics where the classifier vocabulary knows the word — and treats the
 * rest as plain text rather than pretending they lead anywhere.
 */
export function categoryForHashtag(body: string): ContentCategory | undefined {
	const key = body.toLowerCase().replace(/[^a-z0-9]/g, "");
	const ids = HASHTAG_INDEX.get(key);
	return ids?.length ? getCategory(ids[0]) : undefined;
}

const REGION_WORD_INDEX = new Map<string, RegionId[]>();
const REGION_PHRASE_INDEX: [string, RegionId][] = [];

for (const region of REGIONS) {
	for (const keyword of region.keywords) {
		if (keyword.includes(" ")) {
			REGION_PHRASE_INDEX.push([` ${keyword} `, region.id]);
		} else {
			const bucket = REGION_WORD_INDEX.get(keyword);
			if (bucket) bucket.push(region.id);
			else REGION_WORD_INDEX.set(keyword, [region.id]);
		}
	}
}

/** Lowercase, strip punctuation that is not part of a keyword (&, +, -). */
function normalizeText(text: string): string {
	return ` ${text
		.toLowerCase()
		.replace(/https?:\/\/\S+/g, " ")
		.replace(/[^a-z0-9&+#$\s-]/g, " ")
		.replace(/\s+/g, " ")
		.trim()} `;
}

export interface CategoryMatch {
	id: string;
	score: number;
}

export interface ClassifyOptions {
	/** Max matches returned. Default 3 — the tag budget on a post. */
	limit?: number;
	/** Include opt-in categories (politics, betting, health). Default false. */
	includeSensitive?: boolean;
	/**
	 * Confidence floor. Default 3 — one generic keyword (`campaign`, `gym`)
	 * scores 2 and is dropped, while a phrase, a hashtag, a cashtag, or two
	 * independent word hits on the same category all clear the bar. Raising it
	 * trades recall for precision.
	 */
	minScore?: number;
}

/**
 * Best-effort category tagging for a caption, post body or video description.
 *
 * Client-side pre-tagging only — it seeds the composer's suggested tags and
 * gives the gateway a hint. The ranking service stays the source of truth;
 * never treat a match here as an authoritative label.
 */
export function classifyText(
	text: string,
	options: ClassifyOptions = {},
): CategoryMatch[] {
	const {
		limit = 3,
		includeSensitive = false,
		minScore = SCORE.phrase,
	} = options;
	if (!text?.trim()) return [];

	const padded = normalizeText(text);
	const tokens = padded.trim().split(" ").filter(Boolean);
	const scores = new Map<string, number>();

	const add = (id: string, points: number) => {
		scores.set(id, (scores.get(id) ?? 0) + points);
	};

	for (const token of tokens) {
		if (token.startsWith("#")) {
			const body = token.slice(1).replace(/[^a-z0-9]/g, "");
			for (const id of HASHTAG_INDEX.get(body) ?? []) add(id, SCORE.hashtag);
			continue;
		}
		if (token.startsWith("$")) {
			const symbol = token.slice(1).replace(/[^a-z0-9]/g, "");
			if (symbol.length >= 2 && symbol.length <= 6) {
				add(
					CRYPTO_TICKERS.has(symbol) ? "crypto-markets" : "stocks-equities",
					SCORE.cashtag,
				);
			}
			continue;
		}
		for (const id of WORD_INDEX.get(token) ?? []) add(id, SCORE.word);
	}

	for (const [phrase, id] of PHRASE_INDEX) {
		if (padded.includes(phrase)) add(id, SCORE.phrase);
	}

	return [...scores.entries()]
		.filter(([, score]) => score >= minScore)
		.filter(([id]) => includeSensitive || !CATEGORY_BY_ID.get(id)?.sensitive)
		.map(([id, score]) => ({ id, score }))
		.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
		.slice(0, limit);
}

/** `classifyText`, resolved to full category objects. */
export function suggestCategories(
	text: string,
	options?: ClassifyOptions,
): ContentCategory[] {
	return classifyText(text, options)
		.map((match) => CATEGORY_BY_ID.get(match.id))
		.filter((c): c is ContentCategory => Boolean(c));
}

/**
 * Regional signal for a piece of text. Returns `[]` when nothing matches —
 * callers should fall back to the author's own region, then `worldwide`.
 */
export function detectRegions(text: string, limit = 2): RegionId[] {
	if (!text?.trim()) return [];
	const padded = normalizeText(text);
	const scores = new Map<RegionId, number>();

	for (const token of padded.trim().split(" ")) {
		for (const id of REGION_WORD_INDEX.get(token) ?? []) {
			scores.set(id, (scores.get(id) ?? 0) + 1);
		}
	}
	for (const [phrase, id] of REGION_PHRASE_INDEX) {
		if (padded.includes(phrase)) scores.set(id, (scores.get(id) ?? 0) + 2);
	}

	return [...scores.entries()]
		.filter(([id]) => id !== "worldwide")
		.sort((a, b) => b[1] - a[1])
		.slice(0, limit)
		.map(([id]) => id);
}
