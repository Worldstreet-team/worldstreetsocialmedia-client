"use client";

import { formatCompact } from "@/lib/utils";
import { useBackWithFallback } from "@/lib/nav";
import type { ProfileBadge } from "@/components/ui/UserBadges";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Check, ShareNetwork, UsersThree } from "@phosphor-icons/react";
import { Tabs } from "@/components/ui/Tabs";
import { MessageSquarePlus, Search } from "@/components/ui/icons";

import { PostCard, type PostProps } from "@/components/feed/PostCard";
import { ImpressionSensor } from "@/components/feed/ImpressionSensor";
import { PostComposer } from "@/components/feed/PostComposer";
import { PostSkeleton } from "@/components/feed/PostSkeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { SafeAvatar } from "@/components/ui/SafeAvatar";
import { UserBadges } from "@/components/ui/UserBadges";
import { useToast } from "@/components/ui/Toast/ToastContext";
import {
	type CommunityMemberRow,
	getCommunityAction,
	getCommunityMembersAction,
	getCommunityPostsAction,
	toggleCommunityAction,
} from "@/lib/community.actions";
import { ManageCommunity } from "@/components/community/ManageCommunity";
import { resolveCategoryLabel } from "@/lib/categories";
import { mapApiPost as mapPost } from "@/lib/post-mapper";
import { useT } from "@/i18n/client";
import {
	press,
	reveal,
	staggerParent,
	staggerPop,
	swap,
} from "@/lib/motion-presets";

interface CommunityDetail {
	id: string;
	name: string;
	slug: string;
	description?: string;
	category: string;
	avatar?: string;
	owner?: {
		userId: string;
		username: string;
		avatar?: string;
		firstName?: string;
		lastName?: string;
		isVerified?: boolean;
		badges?: ProfileBadge[];
	};
	membersCount: number;
	createdAt?: string;
	joined: boolean;
	isOwner: boolean;
	memberPreview?: {
		userId: string;
		username: string;
		avatar?: string;
	}[];
}

/**
 * A community as a place: header, membership, and its own timeline.
 *
 * Before this, joining wrote to a graph nothing read. The composer here is
 * locked to this community, so membership finally leads somewhere.
 */
export default function CommunityScreen({ slug }: { slug: string }) {
	const t = useT();
	const router = useRouter();
	const goBack = useBackWithFallback();
	const { toast } = useToast();

	const [community, setCommunity] = useState<CommunityDetail | null>(null);
	const [loading, setLoading] = useState(true);
	const [notFound, setNotFound] = useState(false);

	const [posts, setPosts] = useState<PostProps[]>([]);
	const [postsLoading, setPostsLoading] = useState(true);
	const [cursor, setCursor] = useState<string | null>(null);
	const [hasMore, setHasMore] = useState(false);
	const [loadingMore, setLoadingMore] = useState(false);
	const [joinBusy, setJoinBusy] = useState(false);

	// Bumped by ManageCommunity after an edit/removal so the header refetches.
	const [refetch, setRefetch] = useState(0);
	// Communities v2, inside: Posts and the people in it.
	const [tab, setTab] = useState<"posts" | "members">("posts");
	const [members, setMembers] = useState<CommunityMemberRow[] | null>(null);
	useEffect(() => {
		if (tab !== "members" || members) return;
		void getCommunityMembersAction(slug).then((r) => setMembers(r.members));
	}, [tab, members, slug]);

	const share = useCallback(async () => {
		const url = `${window.location.origin}/communities/${slug}`;
		if (navigator.share) {
			try {
				await navigator.share({ title: community?.name, url });
			} catch {
				/* dismissed */
			}
			return;
		}
		await navigator.clipboard.writeText(url);
		toast(t("community.linkCopied"), { type: "success" });
	}, [slug, community?.name, toast, t]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: refetch is the signal; its value is unused.
	useEffect(() => {
		let cancelled = false;
		setLoading(true);
		void getCommunityAction(slug).then((res) => {
			if (cancelled) return;
			if (res.success) setCommunity(res.community);
			else if (res.status === 404) setNotFound(true);
			setLoading(false);
		});
		return () => {
			cancelled = true;
		};
	}, [slug, refetch]);

	// Normalized so the failure branch of the action, which carries no
	// pagination fields, can't widen these into optionals.
	const loadPosts = useCallback(
		async (next: string | null) => {
			const res = await getCommunityPostsAction(slug, next);
			if (!res.success) return null;
			return {
				posts: res.posts ?? [],
				nextCursor: res.nextCursor ?? null,
				hasMore: Boolean(res.hasMore),
			};
		},
		[slug],
	);

	useEffect(() => {
		let cancelled = false;
		setPostsLoading(true);
		void loadPosts(null).then((res) => {
			if (cancelled) return;
			if (res) {
				setPosts(res.posts.map(mapPost));
				setCursor(res.nextCursor);
				setHasMore(res.hasMore);
			}
			setPostsLoading(false);
		});
		return () => {
			cancelled = true;
		};
	}, [loadPosts]);

	const loadMore = useCallback(async () => {
		if (loadingMore || !hasMore || !cursor) return;
		setLoadingMore(true);
		const res = await loadPosts(cursor);
		if (res) {
			setPosts((prev) => [...prev, ...res.posts.map(mapPost)]);
			setCursor(res.nextCursor);
			setHasMore(res.hasMore);
		}
		setLoadingMore(false);
	}, [loadingMore, hasMore, cursor, loadPosts]);

	// Auto-load the next page as the sentinel comes into view.
	const sentinel = useRef<HTMLDivElement>(null);
	useEffect(() => {
		const node = sentinel.current;
		if (!node || !hasMore) return;
		const io = new IntersectionObserver(
			(entries) => entries[0]?.isIntersecting && void loadMore(),
			{ rootMargin: "600px" },
		);
		io.observe(node);
		return () => io.disconnect();
	}, [hasMore, loadMore]);

	const toggleJoin = useCallback(async () => {
		if (!community || joinBusy || community.isOwner) return;
		const was = community.joined;
		setJoinBusy(true);
		setCommunity((c) =>
			c
				? { ...c, joined: !was, membersCount: c.membersCount + (was ? -1 : 1) }
				: c,
		);
		const res = await toggleCommunityAction(community.id, !was);
		if (!res.success) {
			setCommunity((c) =>
				c ? { ...c, joined: was, membersCount: c.membersCount + (was ? 1 : -1) } : c,
			);
			if (res.message) toast(res.message, { type: "error" });
		}
		setJoinBusy(false);
	}, [community, joinBusy, toast]);

	const onPosted = useCallback(() => {
		setPostsLoading(true);
		void loadPosts(null).then((res) => {
			if (res) {
				setPosts(res.posts.map(mapPost));
				setCursor(res.nextCursor);
				setHasMore(res.hasMore);
			}
			setPostsLoading(false);
		});
	}, [loadPosts]);

	// The first page rises once, when the skeleton hands over. Pagination, a
	// refetch after posting and a header refresh all land without it.
	const postsIntro = useRef(true);
	useEffect(() => {
		if (!loading && !postsLoading) postsIntro.current = false;
	}, [loading, postsLoading]);

	if (notFound) {
		return (
			<div className="flex min-h-[60dvh] flex-col items-center justify-center">
				<EmptyState
					icon={Search}
					title={t("community.notFound")}
					caption={t("community.notFoundCaption")}
					action={{
						label: t("nav.communities"),
						onClick: () => router.push("/communities"),
					}}
				/>
			</div>
		);
	}

	return (
		<div className="flex min-h-dvh flex-col pb-nav md:pb-20">
			{/* Frosted, no rule (owner 2026-10-16): the cover below leads. */}
			<header className="sticky top-0 z-sticky flex items-center gap-2 bg-page/75 px-2 py-2 backdrop-blur-xl backdrop-saturate-150 sm:px-3">
				<button
					type="button"
					aria-label={t("common.back")}
					onClick={() => goBack("/communities")}
					className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-pill text-primary transition-colors hover:bg-primary/[0.08]"
				>
					<ArrowLeft size={19} weight="bold" />
				</button>
				<h1 className="min-w-0 flex-1 truncate font-sans text-[calc(16px*var(--ws-fs))] font-semibold text-primary">
					{community?.name ?? slug.replace(/-/g, " ")}
				</h1>
				{community?.isOwner && (
					<ManageCommunity
						community={{
							id: community.id,
							slug: community.slug,
							name: community.name,
							description: community.description,
							category: community.category,
							avatar: community.avatar,
						}}
						onChanged={() => setRefetch((n) => n + 1)}
					/>
				)}
			</header>

			{loading || !community ? (
				<div className="p-4">
					<div className="skeleton mb-4 h-32 rounded-xl" />
					<PostSkeleton />
					<PostSkeleton />
				</div>
			) : (
				<>
					{/* Inside a community (Communities v2): the cover leads as
					    content, then what it is, who's in it, and one wide way
					    to join, with share beside it. */}
					<section className="animate-rise px-4 pb-2 pt-1">
						<div className="relative aspect-[2/1] w-full overflow-hidden rounded-[22px] bg-raised">
							{community.avatar ? (
								<SafeAvatar src={community.avatar} className="object-cover" sizes="(max-width: 640px) 100vw, 600px" />
							) : (
								<span className="flex h-full w-full items-center justify-center font-display text-5xl font-semibold text-gold">
									{community.name.charAt(0).toUpperCase()}
								</span>
							)}
						</div>

						<span className="mt-4 block font-sans text-[calc(11px*var(--ws-fs))] font-semibold uppercase tracking-[0.16em] text-muted">
							{resolveCategoryLabel(community.category) || community.category}
						</span>
						<h2 className="mt-1 break-words font-display text-[calc(26px*var(--ws-fs))] font-semibold leading-tight text-primary">
							{community.name}
						</h2>
						{community.description && (
							<p className="mt-2 break-words font-sans text-[calc(15px*var(--ws-fs))] leading-relaxed text-primary/85">
								{community.description}
							</p>
						)}

						<div className="mt-3 flex min-w-0 items-center gap-2">
							<motion.span className="flex shrink-0 items-center" variants={staggerParent} initial="hidden" animate="show">
								{(community.memberPreview ?? []).slice(0, 5).map((m, i) => (
									<motion.span
										key={m.userId}
										variants={staggerPop}
										className="relative -ml-2 h-7 w-7 shrink-0 overflow-hidden rounded-pill bg-raised ring-2 ring-page first:ml-0"
										style={{ zIndex: 5 - i }}
									>
										<SafeAvatar src={m.avatar} />
									</motion.span>
								))}
							</motion.span>
							<span className="min-w-0 truncate font-sans text-[calc(14px*var(--ws-fs))] text-muted">
								<span className="relative inline-flex overflow-hidden align-bottom font-semibold tabular-nums text-primary">
									<AnimatePresence mode="popLayout" initial={false}>
										<motion.span key={community.membersCount} {...swap} className="inline-block">
											{formatCompact(community.membersCount)}
										</motion.span>
									</AnimatePresence>
								</span>{" "}
								{t("community.members")}
								{community.owner && (
									<>
										{" · "}
										<Link href={`/profile/${community.owner.username}`} className="hover:text-primary">
											@{community.owner.username}
										</Link>
									</>
								)}
							</span>
							{community.owner && (
								<UserBadges
									isVerified={community.owner.isVerified}
									verification={(community.owner as any).verification}
									badges={community.owner?.badges}
									size={11}
								/>
							)}
						</div>

						<div className="mt-4 flex items-center gap-2">
							<motion.button
								type="button"
								onClick={toggleJoin}
								disabled={joinBusy || community.isOwner}
								{...press}
								className={clsx(
									"flex h-11 min-w-0 flex-1 items-center justify-center gap-2 overflow-hidden rounded-pill font-sans text-[calc(14.5px*var(--ws-fs))] font-semibold transition-colors",
									community.isOwner
										? "cursor-default bg-primary/[0.08] text-muted"
										: community.joined
											? "cursor-pointer bg-primary/[0.08] text-primary hover:text-danger"
											: "cursor-pointer bg-brand text-brand-on hover:bg-brand-active",
								)}
							>
								<AnimatePresence mode="wait" initial={false}>
									<motion.span
										key={community.isOwner ? "owner" : community.joined ? "joined" : "join"}
										{...swap}
										className="flex items-center gap-2"
									>
										{community.joined && !community.isOwner && <Check size={15} weight="bold" />}
										{community.isOwner
											? t("community.owner")
											: community.joined
												? t("community.joined")
												: t("community.join")}
									</motion.span>
								</AnimatePresence>
							</motion.button>
							<motion.button
								type="button"
								onClick={() => void share()}
								aria-label={t("community.share")}
								{...press}
								className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-pill bg-primary/[0.08] text-primary transition-colors hover:bg-primary/[0.13]"
							>
								<ShareNetwork size={18} weight="bold" />
							</motion.button>
						</div>
					</section>

					<Tabs
						items={[
							{ key: "posts" as const, label: t("community.posts") },
							{ key: "members" as const, label: t("community.membersTab") },
						]}
						value={tab}
						onChange={setTab}
						ariaLabel={community.name}
						variant="line"
						className="border-b border-hairline"
					/>

					{tab === "members" ? (
						<div className="flex flex-col py-1">
							{members === null
								? [0, 1, 2, 3].map((i) => (
										<div key={i} className="flex items-center gap-3 px-4 py-2.5">
											<span className="skeleton h-10 w-10 rounded-pill" />
											<span className="skeleton h-3.5 w-40 rounded-[4px]" />
										</div>
									))
								: members.map((m) => (
										<Link
											key={m.id}
											href={`/profile/${m.username}`}
											className="flex items-center gap-3 rounded-[18px] px-4 py-2.5 transition-colors hover:bg-primary/[0.05]"
										>
											<span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-pill bg-raised">
												<SafeAvatar src={m.avatar} />
											</span>
											<span className="flex min-w-0 flex-1 flex-col">
												<span className="truncate font-sans text-[calc(15px*var(--ws-fs))] font-semibold text-primary">
													{[m.firstName, m.lastName].filter(Boolean).join(" ") || m.username}
												</span>
												<span className="truncate font-sans text-[calc(13px*var(--ws-fs))] text-muted">@{m.username}</span>
											</span>
											{m.isOwner && (
												<span className="shrink-0 rounded-pill bg-primary/[0.08] px-2.5 py-1 font-sans text-[calc(11.5px*var(--ws-fs))] font-semibold text-primary">
													{t("community.owner")}
												</span>
											)}
										</Link>
									))}
						</div>
					) : (
					<>

					{/* initial={false}: whatever is true on load is simply there. Only
					    a join made here brings the composer in. It rises, it does
					    not unfold: a clipping wrapper would cut off its popovers. */}
					<AnimatePresence mode="wait" initial={false}>
					{community.joined ? (
						<motion.div
							key="composer"
							{...reveal()}
						>
							<PostComposer
								community={{
									id: community.id,
									name: community.name,
									slug: community.slug,
									avatar: community.avatar,
								}}
								onPostSuccess={onPosted}
							/>
						</motion.div>
					) : (
						<motion.button
							key="join-to-post"
							type="button"
							onClick={toggleJoin}
							// No press scale: this is a full-width row, not a button
							// shaped thing, and a row that shrinks reads as a glitch.
							exit={swap.exit}
							className="flex cursor-pointer items-center justify-center gap-2.5 px-4 py-5 font-sans text-[calc(15.5px*var(--ws-fs))] font-semibold text-muted transition-colors hover:bg-surface hover:text-primary"
						>
							<UsersThree size={20} weight="duotone" className="text-gold" />
							{t("community.joinToPost")}
						</motion.button>
					)}
					</AnimatePresence>

					<div className="flex flex-col">
						{postsLoading ? (
							[0, 1, 2].map((i) => <PostSkeleton key={i} />)
						) : posts.length === 0 ? (
							<EmptyState
								icon={MessageSquarePlus}
								title={t("community.emptyTitle")}
								caption={
									community.joined
										? t("community.emptyCaptionMember")
										: t("community.emptyCaptionGuest")
								}
							/>
						) : (
							<>
								{posts.map((post, i) => (
									// `initial` is only read at mount, and the target never
									// changes, so a re-render mid-rise (the sentinel firing,
									// a join) cannot strand a card half faded.
									<motion.div
										key={post.id}
										initial={
											postsIntro.current && i < 6 ? reveal(i).initial : false
										}
										animate={reveal(Math.min(i, 5)).animate}
									>
										<ImpressionSensor meta={{ post: post.id, author: post.author?.id ?? "", surface: "community", position: i }}>
											<PostCard post={post} />
										</ImpressionSensor>
									</motion.div>
								))}
								<div ref={sentinel} className="h-px" />
								{loadingMore && <PostSkeleton />}
							</>
						)}
					</div>
					</>
					)}
				</>
			)}
		</div>
	);
}
