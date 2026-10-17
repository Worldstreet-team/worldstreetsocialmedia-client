"use client";

import { ArrowUpRight, LinkSimple, X } from "@phosphor-icons/react";
import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { firstPlatformPostId } from "@/components/feed/EmbeddedPost";
import { getLinkPreviewAction } from "@/lib/post.actions";
import { DUR, EASE } from "@/lib/motion-presets";

/**
 * Link previews in chat (owner 2026-10-08): the page's own title, summary
 * and picture under a message that carries a link, and the same card,
 * smaller, above the composer while the link is still being typed.
 *
 * Data comes from the gateway's `/api/util/link-preview` (SSRF-guarded,
 * rate limited, cached there for a day) through `getLinkPreviewAction`.
 *
 * Fast on purpose (owner 2026-10-09: "the meta data takes time to load"):
 * - Every answer is kept on the device (`localStorage`, capped, 7 days for
 *   a preview, 1 day for "nothing to show"), so a link seen once renders
 *   its card on the first frame, no skeleton, even after a reload.
 * - An entry older than a day still renders at once and is refreshed
 *   quietly behind it (stale-while-revalidate).
 * - While a first fetch is in flight the card shows its domain straight
 *   from the URL, so there is never an empty wait.
 * - Concurrent asks for one URL share one request.
 *
 * A WorldSpace post link is NOT previewed here: the bubble already embeds
 * the post itself. A page with no title renders nothing rather than an
 * empty box.
 */

export interface LinkMeta {
	url: string;
	title: string;
	description: string;
	image: string;
	domain: string;
}

const STORE_KEY = "ws-link-meta-v1";
const STORE_MAX = 400;
const KEEP_HIT_MS = 7 * 24 * 60 * 60 * 1000;
const KEEP_MISS_MS = 24 * 60 * 60 * 1000;
const FRESH_MS = 24 * 60 * 60 * 1000;

type Stored = { m: LinkMeta | null; at: number };

const inflight = new Map<string, Promise<LinkMeta | null>>();
const settled = new Map<string, Stored>();
let store: Record<string, Stored> | null = null;
let flushTimer: number | null = null;

function readStore(): Record<string, Stored> {
	if (store) return store;
	store = {};
	if (typeof window === "undefined") return store;
	try {
		const raw = window.localStorage.getItem(STORE_KEY);
		const parsed = raw ? (JSON.parse(raw) as Record<string, Stored>) : {};
		const now = Date.now();
		for (const [url, e] of Object.entries(parsed)) {
			if (!e || typeof e.at !== "number") continue;
			if (now - e.at > (e.m ? KEEP_HIT_MS : KEEP_MISS_MS)) continue;
			store[url] = e;
		}
	} catch {
		/* private mode or a corrupt entry: start empty */
	}
	return store;
}

// Batched: a thread full of links lands as one write, not forty.
function writeStore(url: string, e: Stored) {
	const s = readStore();
	s[url] = e;
	if (typeof window === "undefined" || flushTimer !== null) return;
	flushTimer = window.setTimeout(() => {
		flushTimer = null;
		try {
			const entries = Object.entries(s).sort((a, b) => b[1].at - a[1].at).slice(0, STORE_MAX);
			store = Object.fromEntries(entries);
			window.localStorage.setItem(STORE_KEY, JSON.stringify(store));
		} catch {
			/* quota: the memory copy still serves this session */
		}
	}, 400);
}

/** What is already known about a URL, from memory or the device. */
function known(url: string): Stored | undefined {
	const hit = settled.get(url);
	if (hit) return hit;
	const e = readStore()[url];
	if (e) settled.set(url, e);
	return e;
}

function loadPreview(url: string): Promise<LinkMeta | null> {
	let p = inflight.get(url);
	if (!p) {
		p = getLinkPreviewAction(url)
			.then((r) => {
				const d = r.success ? (r.data as LinkMeta | undefined) : undefined;
				const meta = d?.title?.trim()
					? { ...d, title: d.title.trim(), description: (d.description || "").trim() }
					: null;
				const e = { m: meta, at: Date.now() };
				settled.set(url, e);
				writeStore(url, e);
				return meta;
			})
			.catch(() => {
				// A network blip is not "nothing to show": keep whatever we had.
				return known(url)?.m ?? null;
			})
			.finally(() => {
				inflight.delete(url);
			});
		inflight.set(url, p);
	}
	return p;
}

const URL_IN_TEXT = /https?:\/\/[^\s<]+/i;

/** The first link worth previewing: not a WorldSpace post, trailing punctuation trimmed. */
export function firstPreviewableUrl(text: string | undefined | null): string | null {
	if (!text) return null;
	const m = text.match(URL_IN_TEXT);
	if (!m) return null;
	const url = m[0].replace(/[).,!?;:'"\]]+$/, "");
	if (firstPlatformPostId(url, "")) return null;
	try {
		new URL(url);
		return url;
	} catch {
		return null;
	}
}

/** `undefined` while loading, `null` when there is nothing to show. */
export function useLinkPreview(url: string | null, delayMs = 0) {
	const [meta, setMeta] = useState<LinkMeta | null | undefined>(() => {
		if (!url) return null;
		const k = known(url);
		return k ? k.m : undefined;
	});
	useEffect(() => {
		if (!url) {
			setMeta(null);
			return;
		}
		const k = known(url);
		if (k) {
			setMeta(k.m);
			// Old but usable: show it now, refresh behind it.
			if (Date.now() - k.at > FRESH_MS) {
				let gone = false;
				void loadPreview(url).then((m) => {
					if (!gone) setMeta(m);
				});
				return () => {
					gone = true;
				};
			}
			return;
		}
		setMeta(undefined);
		let gone = false;
		const t = window.setTimeout(() => {
			void loadPreview(url).then((m) => {
				if (!gone) setMeta(m);
			});
		}, delayMs);
		return () => {
			gone = true;
			window.clearTimeout(t);
		};
	}, [url, delayMs]);
	return meta;
}

/** The host straight from the URL: shown before any metadata arrives. */
export function domainOf(url: string): string {
	try {
		return new URL(url).hostname.replace(/^www\./, "");
	} catch {
		return "";
	}
}

const prettyDomain = (d: string) => d.replace(/^www\./, "");

/** Inside a bubble, under the text. Takes the bubble's ink, so it reads on either fill. */
export function LinkPreviewCard({ url, mine }: { url: string; mine: boolean }) {
	const meta = useLinkPreview(url);
	const [imgOk, setImgOk] = useState(true);
	return (
		<AnimatePresence initial={false} mode="popLayout">
			{/* First fetch in flight: the domain is already known from the URL,
			    so the card starts as a quiet placeholder rather than a gap. */}
			{meta === undefined && (
				<motion.span
					key="loading"
					aria-hidden
					initial={{ opacity: 0 }}
					animate={{ opacity: 1, transition: { duration: DUR.base, ease: EASE } }}
					exit={{ opacity: 0, transition: { duration: 0.12 } }}
					className={clsx(
						"mt-2 flex w-[300px] max-w-full flex-col gap-2 rounded-[14px] px-3 py-2.5",
						mine
							? "bg-[color-mix(in_srgb,currentColor_10%,transparent)]"
							: "bg-[color-mix(in_srgb,currentColor_5%,transparent)]",
					)}
				>
					<span className="flex items-center gap-1.5 font-sans text-[calc(11.5px*var(--ws-fs))] font-medium opacity-65">
						<LinkSimple size={12} weight="bold" />
						<span className="truncate">{domainOf(url)}</span>
					</span>
					<span className="h-2.5 w-[85%] animate-pulse rounded-full bg-[color-mix(in_srgb,currentColor_12%,transparent)]" />
					<span className="h-2.5 w-[55%] animate-pulse rounded-full bg-[color-mix(in_srgb,currentColor_12%,transparent)]" />
				</motion.span>
			)}
			{meta && (
				<motion.a
					key="card"
					href={meta.url || url}
					target="_blank"
					rel="noopener noreferrer"
					onClick={(e) => e.stopPropagation()}
					initial={{ opacity: 0, y: 4 }}
					animate={{ opacity: 1, y: 0, transition: { duration: DUR.base, ease: EASE } }}
					className={clsx(
						// Depth tells the link from the words (owner 2026-10-12): an
						// inset card, darker than the bubble, lifted on a soft shadow.
						"group/link mt-2 block w-[300px] max-w-full overflow-hidden rounded-[16px] transition-colors",
						mine
							? "bg-black/25 shadow-[0_6px_16px_rgb(0_0_0/0.22)] hover:bg-black/30"
							: "bg-[color-mix(in_srgb,currentColor_6%,transparent)] shadow-[0_4px_12px_rgb(0_0_0/0.12)] hover:bg-[color-mix(in_srgb,currentColor_9%,transparent)]",
					)}
				>
					{meta.image && imgOk && (
						<span className="block aspect-[1.91/1] max-h-[158px] w-full overflow-hidden bg-[color-mix(in_srgb,currentColor_8%,transparent)]">
							{/* biome-ignore lint/performance/noImgElement: any site's og:image; next/image would need every domain allow-listed. */}
							<img
								src={meta.image}
								alt=""
								loading="lazy"
								referrerPolicy="no-referrer"
								onError={() => setImgOk(false)}
								className="h-full w-full object-cover transition-transform duration-500 group-hover/link:scale-[1.02]"
							/>
						</span>
					)}
					<span className="flex flex-col gap-0.5 px-3 py-2.5">
						<span className="flex items-center gap-1.5 font-sans text-[calc(11.5px*var(--ws-fs))] font-medium opacity-65">
							<LinkSimple size={12} weight="bold" />
							<span className="truncate">{prettyDomain(meta.domain)}</span>
							<ArrowUpRight size={11} weight="bold" className="ml-auto shrink-0 opacity-0 transition-opacity group-hover/link:opacity-100" />
						</span>
						<span className="line-clamp-2 font-sans text-[calc(13.5px*var(--ws-fs))] font-semibold leading-snug">
							{meta.title}
						</span>
						{meta.description && (
							<span className="line-clamp-2 font-sans text-[calc(12.5px*var(--ws-fs))] leading-snug opacity-75">
								{meta.description}
							</span>
						)}
					</span>
				</motion.a>
			)}
		</AnimatePresence>
	);
}

/**
 * Above the composer while a link is in the draft: what the other person
 * will see, before it is sent. Dismissing only hides this strip; the
 * preview under the sent message is drawn from the link itself.
 */
export function ComposerLinkPreview({ url, onDismiss }: { url: string; onDismiss: () => void }) {
	// A short wait: a link being typed character by character should not
	// fire a fetch per keystroke. A link already in the device cache skips
	// the wait entirely.
	const meta = useLinkPreview(url, 250);
	const domain = domainOf(url);
	if (meta === null) return null;
	return (
		<div className="chat-chrome flex items-center gap-2.5 rounded-[14px] py-1.5 pl-1.5 pr-1">
			<span className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-[10px] bg-primary/10 text-muted">
				{meta?.image ? (
					// biome-ignore lint/performance/noImgElement: any site's og:image; next/image would need every domain allow-listed.
					<img src={meta.image} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
				) : (
					<LinkSimple size={18} weight="bold" className={clsx(meta === undefined && "animate-pulse")} />
				)}
			</span>
			<span className="min-w-0 flex-1">
				<span className="block truncate font-sans text-[calc(13px*var(--ws-fs))] font-semibold text-primary">
					{meta ? meta.title : "Fetching a preview…"}
				</span>
				<span className="block truncate font-sans text-[calc(11.5px*var(--ws-fs))] text-muted">
					{meta?.description ? `${domain} · ${meta.description}` : domain}
				</span>
			</span>
			<button
				type="button"
				onMouseDown={(e) => e.preventDefault()}
				onClick={onDismiss}
				aria-label="Hide link preview"
				className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-pill text-subtle transition-colors hover:bg-primary/5 hover:text-primary"
			>
				<X size={14} weight="bold" />
			</button>
		</div>
	);
}
