"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Compass as CompassIcon, House, MagnifyingGlass, Plus } from "@phosphor-icons/react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useAtom, useSetAtom } from "jotai";
import { Compass, UsersRound } from "lucide-react";

import { PostCard, type PostProps } from "@/components/feed/PostCard";
import { PostSkeleton } from "@/components/feed/PostSkeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Tabs } from "@/components/ui/Tabs";
import { useToast } from "@/components/ui/Toast/ToastContext";
import CreateCommunitySheet from "@/components/community/CreateCommunitySheet";
import {
	MyCommunitiesRail,
	type RailCommunity,
} from "@/components/community/MyCommunitiesRail";
import {
	DiscoverRow,
	type DiscoverCommunity,
} from "@/components/community/DiscoverRow";
import {
	createCommunityAction,
	getCommunitiesAction,
	getCommunityHomeAction,
	toggleCommunityAction,
} from "@/lib/community.actions";
import { sendFormDirect } from "@/lib/upload-direct";
import { mapApiPost as mapPost } from "@/lib/post-mapper";
import {
	communityDirAtom,
	communityDirFetchedAtAtom,
	communityDirLoadedAtom,
	communityHomeAtom,
	communityHomeFetchedAtAtom,
} from "@/store/communities.atom";
import { useT } from "@/i18n/client";

type Tab = "home" | "explore";

/** One easing for the lists breathing when a refresh lands. */
const LIST_TRANSITION = { duration: 0.26, ease: [0.2, 0, 0, 1] as const };

/**
 * Communities.
 *
 * Home is a feed, not a list: the communities you belong to as art tiles, then
 * one timeline aggregating everything posted across all of them, each post
 * stamped with where it came from. Explore is the directory.
 *
 * The old page was only ever the directory, which is why joining led nowhere.
 */
export default function CommunitiesPage() {
	const t = useT();
	const router = useRouter();
	const { toast } = useToast();

	const [tab, setTab] = useState<Tab>("home");
	const [creating, setCreating] = useState(false);
	const [busy, setBusy] = useState(false);
	const [query, setQuery] = useState("");

	// Both halves are cached app-wide (stale-while-revalidate): a revisit
	// paints the last result immediately and refreshes quietly underneath.
	// Skeletons only on the genuinely first visit of a session.
	const reduced = useReducedMotion();
	const [home, setHome] = useAtom(communityHomeAtom);
	const setHomeFetchedAt = useSetAtom(communityHomeFetchedAtAtom);
	const [rows, setRows] = useAtom(communityDirAtom);
	const [dirLoaded, setDirLoaded] = useAtom(communityDirLoadedAtom);
	const setDirFetchedAt = useSetAtom(communityDirFetchedAtAtom);

	const mine: RailCommunity[] = home?.mine ?? [];
	const posts: PostProps[] = home?.posts ?? [];
	const cursor = home?.cursor ?? null;
	const hasMore = home?.hasMore ?? false;

	const [homeLoading, setHomeLoading] = useState(home === null);
	const [loadingMore, setLoadingMore] = useState(false);
	const [dirLoading, setDirLoading] = useState(!dirLoaded);

	const loadHome = useCallback(async () => {
		const res = await getCommunityHomeAction(null);
		if (res.success) {
			setHome({
				mine: res.communities,
				posts: res.posts.map(mapPost),
				cursor: res.nextCursor ?? null,
				hasMore: Boolean(res.hasMore),
			});
			setHomeFetchedAt(Date.now());
		}
		setHomeLoading(false);
	}, [setHome, setHomeFetchedAt]);

	const loadDirectory = useCallback(async () => {
		const res = await getCommunitiesAction();
		if (res.success) {
			setRows(res.communities);
			setDirLoaded(true);
			setDirFetchedAt(Date.now());
		}
		setDirLoading(false);
	}, [setRows, setDirLoaded, setDirFetchedAt]);

	// Always revalidate on mount — quietly when the cache is warm; the
	// loading flags above decide whether a skeleton fronts the fetch.
	useEffect(() => {
		void loadHome();
		void loadDirectory();
	}, [loadHome, loadDirectory]);

	const loadMore = useCallback(async () => {
		if (loadingMore || !hasMore || !cursor) return;
		setLoadingMore(true);
		const res = await getCommunityHomeAction(cursor);
		if (res.success) {
			setHome((prev) =>
				prev
					? {
							...prev,
							posts: [...prev.posts, ...res.posts.map(mapPost)],
							cursor: res.nextCursor ?? null,
							hasMore: Boolean(res.hasMore),
						}
					: prev,
			);
		}
		setLoadingMore(false);
	}, [loadingMore, hasMore, cursor, setHome]);

	const sentinel = useRef<HTMLDivElement>(null);
	useEffect(() => {
		const node = sentinel.current;
		if (!node || !hasMore || tab !== "home") return;
		const io = new IntersectionObserver(
			(entries) => entries[0]?.isIntersecting && void loadMore(),
			{ rootMargin: "600px" },
		);
		io.observe(node);
		return () => io.disconnect();
	}, [hasMore, loadMore, tab]);

	const toggle = useCallback(
		async (row: DiscoverCommunity) => {
			const was = row.joined;
			setRows((prev) =>
				prev.map((r) =>
					r.id === row.id
						? { ...r, joined: !was, membersCount: r.membersCount + (was ? -1 : 1) }
						: r,
				),
			);
			const res = await toggleCommunityAction(row.id, !was);
			if (!res.success) {
				setRows((prev) =>
					prev.map((r) =>
						r.id === row.id
							? { ...r, joined: was, membersCount: row.membersCount }
							: r,
					),
				);
				if (res.message) toast(res.message, { type: "error" });
				return;
			}
			// Membership changed, so Home's rail and timeline are both stale.
			void loadHome();
		},
		[toast, loadHome],
	);

	const create = useCallback(
		async (payload: {
			name: string;
			description: string;
			category: string;
			avatar: File | null;
		}) => {
			if (busy) return;
			setBusy(true);
			try {
				const form = new FormData();
				form.append("name", payload.name);
				form.append("description", payload.description);
				form.append("category", payload.category);
				if (payload.avatar) form.append("avatar", payload.avatar);

				let res: Awaited<ReturnType<typeof createCommunityAction>>;
				if (payload.avatar) {
					const r = await sendFormDirect("/api/communities", form);
					res = r.success
						? {
								success: true,
								slug: (r.data as any)?.slug,
								communityId: (r.data as any)?.communityId,
							}
						: ({ success: false, message: r.message } as any);
				} else {
					res = await createCommunityAction(form);
				}
				if (res.success && res.slug) {
					setCreating(false);
					toast(t("community.created"), { type: "success" });
					// Land in the thing you just made, not back on a grid.
					router.push(`/communities/${res.slug}`);
				} else if (res.message) {
					toast(res.message, { type: "error" });
				}
			} finally {
				setBusy(false);
			}
		},
		[busy, router, toast, t],
	);

	const q = query.trim().toLowerCase();
	const filtered = q
		? rows.filter(
				(r) =>
					r.name.toLowerCase().includes(q) ||
					r.description?.toLowerCase().includes(q) ||
					r.category?.toLowerCase().includes(q),
			)
		: rows;
	const unjoined = filtered.filter((r) => !r.joined);

	const TABS = [
		{ key: "home" as const, label: t("community.tab.home"), Icon: House },
		{ key: "explore" as const, label: t("community.tab.explore"), Icon: CompassIcon },
	];

	return (
		<div className="flex min-h-dvh flex-col pb-nav md:pb-10">
			{creating && (
				<CreateCommunitySheet
					busy={busy}
					onClose={() => setCreating(false)}
					onCreate={create}
				/>
			)}

			<header className="sticky top-0 z-sticky border-b border-hairline bg-page md:top-0">
				<div className="flex items-end justify-between gap-3 px-4 pb-3 pt-5">
					<div className="min-w-0">
						<span className="block font-sans text-[11px] font-bold uppercase tracking-[0.16em] text-gold">
							{t("community.eyebrow")}
						</span>
						<h1 className="mt-1 font-display text-[24px] font-semibold leading-none text-primary">
							{t("nav.communities")}
						</h1>
					</div>
					<button
						type="button"
						onClick={() => setCreating(true)}
						aria-label={t("community.create")}
						className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-pill bg-brand text-brand-on transition-colors hover:bg-brand-active"
					>
						<Plus size={16} weight="bold" />
					</button>
				</div>

				<Tabs
					items={TABS}
					value={tab}
					onChange={setTab}
					ariaLabel={t("nav.communities")}
				/>
			</header>

			{tab === "home" ? (
				<>
					{mine.length > 0 && (
						<section
							className="animate-rise border-b border-hairline px-4 py-4"
							style={{ animationDelay: "60ms" }}
						>
							<h2 className="mb-3 font-sans text-[11px] font-semibold uppercase tracking-[0.14em] text-subtle">
								{t("community.yours")}
							</h2>
							<MyCommunitiesRail
								communities={mine}
								onCreate={() => setCreating(true)}
							/>
						</section>
					)}

					{homeLoading ? (
						[0, 1, 2].map((i) => <PostSkeleton key={i} />)
					) : mine.length === 0 ? (
						<EmptyState
							icon={UsersRound}
							title={t("community.homeEmptyTitle")}
							caption={t("community.homeEmptyCaption")}
							action={{
								label: t("community.browse"),
								onClick: () => setTab("explore"),
							}}
						/>
					) : posts.length === 0 ? (
						<EmptyState
							icon={Compass}
							title={t("community.emptyTitle")}
							caption={t("community.emptyCaptionMember")}
						/>
					) : (
						<>
							{posts.map((post) => (
								<PostCard key={post.id} post={post} />
							))}
							<div ref={sentinel} className="h-px" />
							{loadingMore && <PostSkeleton />}
						</>
					)}
				</>
			) : (
				<>
					<div className="border-b border-hairline px-4 py-3">
						<div className="group relative">
							<MagnifyingGlass
								size={16}
								className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-subtle transition-colors group-focus-within:text-primary"
							/>
							<input
								value={query}
								onChange={(e) => setQuery(e.target.value)}
								placeholder={t("community.browse")}
								// text-base on mobile or iOS Safari zooms on focus.
								className="h-10 w-full rounded-pill bg-chip pl-10 pr-4 font-sans text-base text-primary outline-none transition-colors placeholder:text-subtle focus:bg-raised sm:text-[14px]"
							/>
						</div>
					</div>

					<h2 className="px-4 pb-1 pt-4 font-sans text-[11px] font-semibold uppercase tracking-[0.14em] text-subtle">
						{t("community.discover")}
					</h2>

					{dirLoading ? (
						<div className="flex flex-col gap-2 p-4">
							{[0, 1, 2, 3].map((i) => (
								<div key={i} className="skeleton h-[92px] rounded-xl" />
							))}
						</div>
					) : filtered.length === 0 ? (
						<EmptyState
							icon={Compass}
							title={t("community.emptyDirTitle")}
							caption={t("community.empty")}
							action={{
								label: t("community.create"),
								onClick: () => setCreating(true),
							}}
						/>
					) : (
						<div className="flex flex-col">
							<AnimatePresence initial={false}>
								{(unjoined.length > 0 ? unjoined : filtered).map((row) => (
									<motion.div
										key={row.id}
										layout={!reduced}
										initial={reduced ? false : { opacity: 0, y: 8 }}
										animate={{ opacity: 1, y: 0 }}
										exit={reduced ? undefined : { opacity: 0 }}
										transition={LIST_TRANSITION}
									>
										<DiscoverRow row={row} onToggle={toggle} />
									</motion.div>
								))}
							</AnimatePresence>
						</div>
					)}
				</>
			)}
		</div>
	);
}
