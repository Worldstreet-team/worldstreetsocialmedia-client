"use client";

import clsx from "clsx";
import { followUserDirect, unfollowUserDirect } from "@/lib/upload-direct";
import Link from "next/link";
import { AnimatePresence } from "framer-motion";
import { OverlayPanel, OverlayScrim } from "@/components/ui/Overlay";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { MagnifyingGlass, X } from "@phosphor-icons/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { CATEGORIES, VERTICALS } from "@/data/categories";
import { useT } from "@/i18n/client";
import {
	listCommunities,
	searchPosts as searchPostsLive,
	searchUsers as searchUsersLive,
} from "@/lib/search.client";
import { formatTimeAgo } from "@/lib/utils";
import { followingIdsAtom, searchOpenAtom, searchSeedAtom } from "@/store/ui.atom";
import { SafeAvatar } from "@/components/ui/SafeAvatar";
import { UserBadges } from "@/components/ui/UserBadges";

type Filter = "all" | "people" | "posts" | "communities" | "topics";

const FILTERS: { id: Filter; key: string }[] = [
	{ id: "all", key: "search.filter.all" },
	{ id: "people", key: "search.filter.people" },
	{ id: "posts", key: "search.filter.posts" },
	{ id: "communities", key: "search.filter.communities" },
	{ id: "topics", key: "search.filter.topics" },
];

/** Long enough that a single keystroke does not fire a request. */
const DEBOUNCE_MS = 250;
/** Rows per section in "All". A tab shows the full set. */
const PREVIEW = 3;

const VERTICAL_LABEL = new Map(VERTICALS.map((v) => [v.id, v.label]));

interface PersonResult {
	_id: string;
	username: string;
	firstName?: string;
	lastName?: string;
	avatar?: string;
	isVerified?: boolean;
	verification?: { tier?: "bronze" | "silver" | "gold" } | null;
	badges?: any[];
	isFollowing?: boolean;
}

const displayName = (u: PersonResult) =>
	u.firstName && u.lastName ? `${u.firstName} ${u.lastName}` : u.username;

/**
 * Search: people, posts, communities and topics in one window.
 *
 * Deliberately NOT part of the command palette. The palette answers "take me
 * somewhere / do something" and its only nod to search was a row that punted
 * to /explore — so the rail's search box, the most obvious search affordance
 * in the app, could not find a single user.
 *
 * Two of the four sources are server-backed (`/api/users/search`,
 * `/api/posts/search`) and two are filtered on the client: the community
 * directory is one small request the gateway has no search endpoint for, and
 * topics are the local 100-item taxonomy, so they resolve with no request at
 * all. That split is why topics and communities feel instant and the other two
 * carry a loading state.
 */
export function SearchWindow() {
	const t = useT();
	const [open, setOpen] = useAtom(searchOpenAtom);
	const [seed, setSeed] = useAtom(searchSeedAtom);
	const followedIds = useAtomValue(followingIdsAtom);
	const setFollowedIds = useSetAtom(followingIdsAtom);

	const [query, setQuery] = useState("");
	const [filter, setFilter] = useState<Filter>("all");
	const [people, setPeople] = useState<PersonResult[]>([]);
	const [posts, setPosts] = useState<any[]>([]);
	const [communities, setCommunities] = useState<any[]>([]);
	const [loading, setLoading] = useState(false);

	const inputRef = useRef<HTMLInputElement>(null);

	const term = query.trim();

	const close = useCallback(() => {
		setOpen(false);
		setSeed("");
	}, [setOpen, setSeed]);

	// Opening resets to a clean sheet, seeded if a caller passed a query.
	useEffect(() => {
		if (!open) return;
		setQuery(seed);
		setFilter("all");
		const id = window.setTimeout(() => inputRef.current?.focus(), 40);
		return () => window.clearTimeout(id);
	}, [open, seed]);

	useEffect(() => {
		if (!open) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") close();
		};
		window.addEventListener("keydown", onKey);
		// The page behind must not scroll under the window.
		const prev = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		return () => {
			window.removeEventListener("keydown", onKey);
			document.body.style.overflow = prev;
		};
	}, [open, close]);

	// The community directory is fetched once per session, not per keystroke —
	// it is a list, not a query, and the filtering happens below.
	//
	// Latched on a ref rather than on `communities.length`: an account in no
	// communities gets an empty array back, the length stays 0, the effect
	// re-arms and it fetches in a loop until React gives up with "maximum
	// update depth exceeded". Emptiness is a valid answer, so the flag has to
	// record that we asked, not what came back.
	const communitiesFetchedRef = useRef(false);
	useEffect(() => {
		if (!open || communitiesFetchedRef.current) return;
		communitiesFetchedRef.current = true;
		const ac = new AbortController();
		void listCommunities(ac.signal).then(setCommunities);
		return () => ac.abort();
	}, [open]);

	// Debounced search, keyed on the TERM only — never on the active tab.
	//
	// Gating the request on the tab meant switching to "Posts" threw away the
	// people results, so the People chip lost its count and coming back
	// refetched from scratch. The chips exist to say how much is behind each
	// tab; they can only do that if every source is fetched for the term and
	// the tabs merely filter what is already here. Tab switching is then
	// instant and costs nothing.
	useEffect(() => {
		if (!open || !term) {
			setPeople([]);
			setPosts([]);
			setLoading(false);
			return;
		}
		const ac = new AbortController();
		setLoading(true);
		const id = window.setTimeout(async () => {
			const [u, p] = await Promise.all([
				searchUsersLive(term, ac.signal),
				searchPostsLive(term, ac.signal),
			]);
			if (ac.signal.aborted) return;
			setPeople(u as PersonResult[]);
			setPosts(p);
			setLoading(false);
		}, DEBOUNCE_MS);
		// Cancels the timer AND any request already in flight, so an older
		// query can never land on top of a newer one.
		return () => {
			window.clearTimeout(id);
			ac.abort();
		};
	}, [open, term]);

	const topics = useMemo(() => {
		if (!term) return [];
		const q = term.toLowerCase();
		return CATEGORIES.filter(
			(c) =>
				c.label.toLowerCase().includes(q) ||
				c.keywords.some((k) => k.includes(q)),
		).slice(0, filter === "topics" ? 40 : PREVIEW);
	}, [term, filter]);

	const matchedCommunities = useMemo(() => {
		if (!term) return [];
		const q = term.toLowerCase();
		return communities
			.filter(
				(c: any) =>
					String(c.name ?? "").toLowerCase().includes(q) ||
					String(c.slug ?? "").toLowerCase().includes(q) ||
					String(c.description ?? "").toLowerCase().includes(q),
			)
			.slice(0, filter === "communities" ? 40 : PREVIEW);
	}, [term, communities, filter]);

	const shownPeople = filter === "all" ? people.slice(0, PREVIEW) : people;
	const shownPosts = filter === "all" ? posts.slice(0, PREVIEW) : posts;

	const counts: Record<Filter, number | null> = {
		all: null,
		people: people.length,
		posts: posts.length,
		communities: matchedCommunities.length,
		topics: topics.length,
	};

	const anyResults =
		shownPeople.length > 0 ||
		shownPosts.length > 0 ||
		matchedCommunities.length > 0 ||
		topics.length > 0;

	const nothing = !!term && !loading && !anyResults;

	const follow = async (id: string) => {
		setFollowedIds((prev) => [...prev, id]);
		const res = await followUserDirect(id);
		if (!res.success) setFollowedIds((prev) => prev.filter((x) => x !== id));
	};

	const show = (f: Filter) => filter === "all" || filter === f;

	return (
		<AnimatePresence>
			{open && (
				<>
					<OverlayScrim onClose={close} label={t("common.close")} />


					<OverlayPanel variant="center" label={t("search.title")}>
						{/* ── query ── */}
						<div className="flex h-14 shrink-0 items-center gap-3 px-4">
							<MagnifyingGlass
								size={18}
								className="shrink-0 text-subtle"
								aria-hidden
							/>
							<input
								ref={inputRef}
								value={query}
								onChange={(e) => setQuery(e.target.value)}
								placeholder={t("search.placeholder")}
								aria-label={t("search.title")}
								className="min-w-0 flex-1 bg-transparent font-sans text-[15px] text-primary outline-none placeholder:text-subtle"
							/>
							<button
								type="button"
								onClick={close}
								aria-label={t("common.close")}
								className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-pill bg-chip text-muted transition-colors hover:text-primary"
							>
								<X size={14} weight="bold" />
							</button>
						</div>

						{/* ── filters ── */}
						<div className="flex shrink-0 gap-1.5 overflow-x-auto px-4 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
							{FILTERS.map((f) => {
								const n = counts[f.id];
								const active = filter === f.id;
								return (
									<button
										key={f.id}
										type="button"
										onClick={() => setFilter(f.id)}
										aria-pressed={active}
										className={clsx(
											"flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-pill px-3 font-sans text-[13px] font-medium transition-colors",
											active
												? "bg-primary text-page"
												: "bg-chip text-muted hover:text-primary",
										)}
									>
										{t(f.key)}
										{!!n && !active && (
											<span className="tabular-nums text-subtle">{n}</span>
										)}
									</button>
								);
							})}
						</div>

						<div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
							{!term && (
								<p className="px-2 py-8 text-center font-sans text-[13px] text-subtle">
									{t("search.hint")}
								</p>
							)}

							{/* Only while the panel is genuinely empty. Topics and
							    communities resolve locally and land first, and a
							    "Searching…" line sitting above them reads as if those
							    results were still pending too. */}
							{!!term && loading && !anyResults && (
								<p className="px-2 py-8 text-center font-sans text-[13px] text-subtle">
									{t("search.searching")}
								</p>
							)}

							{nothing && (
								<div className="px-2 py-8 text-center">
									<p className="font-sans text-[14px] text-primary">
										{t("search.empty").replace("{q}", term)}
									</p>
									<p className="mt-1 font-sans text-[13px] text-subtle">
										{t("search.emptyHint")}
									</p>
								</div>
							)}

							{/* ── people ── */}
							{show("people") && shownPeople.length > 0 && (
								<Section label={t("search.section.people")}>
									{shownPeople.map((u) => {
										const followed =
											followedIds.includes(u._id) || !!u.isFollowing;
										return (
											<div
												key={u._id}
												className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-chip"
											>
												<Link
													href={`/profile/${u.username}`}
													onClick={close}
													className="relative h-10 w-10 shrink-0 overflow-hidden rounded-pill bg-raised"
												>
													<SafeAvatar src={u.avatar} />
												</Link>
												<Link
													href={`/profile/${u.username}`}
													onClick={close}
													className="min-w-0 flex-1"
												>
													<span className="flex items-center gap-1">
														<span className="truncate font-sans text-[14px] font-semibold text-primary">
															{displayName(u)}
														</span>
														<UserBadges
															isVerified={u.isVerified}
															verification={u.verification}
															badges={u.badges}
															size={13}
														/>
													</span>
													<span className="block truncate font-sans text-[13px] text-muted">
														@{u.username}
													</span>
												</Link>
												{!followed && (
													<button
														type="button"
														onClick={() => follow(u._id)}
														className="h-8 shrink-0 cursor-pointer rounded-pill bg-primary px-3.5 font-sans text-[12.5px] font-bold text-page transition-opacity hover:opacity-90"
													>
														{t("rail.follow")}
													</button>
												)}
											</div>
										);
									})}
								</Section>
							)}

							{/* ── posts ── */}
							{show("posts") && shownPosts.length > 0 && (
								<Section label={t("search.section.posts")}>
									{shownPosts.map((p: any) => (
										<Link
											key={p._id}
											href={`/post/${p._id}`}
											onClick={close}
											className="block rounded-xl px-2 py-2 transition-colors hover:bg-chip"
										>
											<span className="flex items-center gap-1.5">
												<span className="relative h-5 w-5 shrink-0 overflow-hidden rounded-pill bg-raised">
													<SafeAvatar src={p.author?.avatar} />
												</span>
												<span className="truncate font-sans text-[13px] font-semibold text-primary">
													{p.author?.firstName && p.author?.lastName
														? `${p.author.firstName} ${p.author.lastName}`
														: (p.author?.username ?? "")}
												</span>
												<UserBadges
													isVerified={p.author?.isVerified}
													verification={p.author?.verification}
													badges={p.author?.badges}
													size={12}
												/>
												<span className="shrink-0 font-sans text-[12px] text-subtle">
													· {formatTimeAgo(p.createdAt)}
												</span>
											</span>
											<span className="mt-1 block line-clamp-2 font-sans text-[13.5px] text-muted">
												{p.content}
											</span>
										</Link>
									))}
								</Section>
							)}

							{/* ── communities ── */}
							{show("communities") && matchedCommunities.length > 0 && (
								<Section label={t("search.section.communities")}>
									{matchedCommunities.map((c: any) => (
										<Link
											key={c.id ?? c._id ?? c.slug}
											href={`/communities/${c.slug}`}
											onClick={close}
											className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-chip"
										>
											<span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-[10px] bg-raised">
												<SafeAvatar src={c.avatar} />
											</span>
											<span className="min-w-0 flex-1">
												<span className="block truncate font-sans text-[14px] font-semibold text-primary">
													{c.name}
												</span>
												<span className="block truncate font-sans text-[13px] text-muted">
													<span className="tabular-nums">
														{Number(c.membersCount ?? 0).toLocaleString()}
													</span>{" "}
													{t("search.members")}
												</span>
											</span>
										</Link>
									))}
								</Section>
							)}

							{/* ── topics ── */}
							{show("topics") && topics.length > 0 && (
								<Section label={t("search.section.topics")}>
									<div className="flex flex-wrap gap-1.5 px-2 py-1">
										{topics.map((c) => (
											<Link
												key={c.id}
												href={`/explore?q=${encodeURIComponent(c.label)}`}
												onClick={close}
												className="flex h-8 items-center gap-1.5 rounded-pill bg-chip px-3 font-sans text-[13px] text-primary transition-colors hover:bg-raised"
											>
												{c.label}
												<span className="text-[12px] text-subtle">
													{VERTICAL_LABEL.get(c.vertical)}
												</span>
											</Link>
										))}
									</div>
								</Section>
							)}

							{/* Search is a preview; Explore is the full result page. */}
							{!!term && !loading && !nothing && (
								<Link
									href={`/explore?q=${encodeURIComponent(term)}`}
									onClick={close}
									className="mt-1 block rounded-xl px-4 py-3 text-center font-sans text-[13px] font-medium text-muted transition-colors hover:bg-chip hover:text-primary"
								>
									{t("search.seeAll")}
								</Link>
							)}
						</div>
					</OverlayPanel>
				</>
			)}
		</AnimatePresence>
	);
}

function Section({
	label,
	children,
}: {
	label: string;
	children: React.ReactNode;
}) {
	return (
		<section className="pt-1">
			<h2 className="px-4 pb-1 pt-2 font-sans text-[11px] font-semibold uppercase tracking-[0.08em] text-subtle">
				{label}
			</h2>
			{children}
		</section>
	);
}
