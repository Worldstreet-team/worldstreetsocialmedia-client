"use client";

import { formatCompact } from "@/lib/utils";
import { useBackWithFallback } from "@/lib/nav";
import type { ProfileBadge } from "@/components/ui/UserBadges";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, UsersThree } from "@phosphor-icons/react";
import { MessageSquarePlus, Search } from "lucide-react";

import { PostCard, type PostProps } from "@/components/feed/PostCard";
import { ImpressionSensor } from "@/components/feed/ImpressionSensor";
import { PostComposer } from "@/components/feed/PostComposer";
import { PostSkeleton } from "@/components/feed/PostSkeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { SafeAvatar } from "@/components/ui/SafeAvatar";
import { UserBadges } from "@/components/ui/UserBadges";
import { useToast } from "@/components/ui/Toast/ToastContext";
import {
	getCommunityAction,
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
			<header className="sticky top-0 z-sticky flex items-center gap-3 border-b border-hairline bg-page px-2 py-2 sm:px-4 md:top-0">
				<button
					type="button"
					aria-label={t("common.back")}
					onClick={() => goBack("/communities")}
					className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-pill text-primary transition-colors hover:bg-raised"
				>
					<ArrowLeft size={19} weight="bold" />
				</button>
				<div className="flex min-w-0 flex-col">
					<h1 className="truncate font-sans text-xl font-bold leading-6 text-primary">
						{community?.name ?? slug.replace(/-/g, " ")}
					</h1>
					{community && (
						<span className="font-sans text-[calc(13px*var(--ws-fs))] tabular-nums text-muted">
							{formatCompact(community.membersCount)} {t("community.members")}
						</span>
					)}
				</div>
				{community?.isOwner && (
					<div className="ml-auto">
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
					</div>
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
					<section className="animate-rise border-b border-hairline px-4 py-5">
						<div className="flex gap-4">
							<div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-raised">
								{community.avatar ? (
									<SafeAvatar src={community.avatar} className="object-cover" sizes="64px" />
								) : (
									<span className="flex h-full w-full items-center justify-center font-display text-2xl font-semibold text-gold">
										{community.name.charAt(0).toUpperCase()}
									</span>
								)}
							</div>

							<div className="flex min-w-0 flex-1 flex-col gap-1">
								<span className="font-sans text-[calc(12px*var(--ws-fs))] font-semibold uppercase tracking-[0.14em] text-gold">
									{resolveCategoryLabel(community.category) || community.category}
								</span>
								<h2 className="truncate font-display text-[calc(26px*var(--ws-fs))] font-semibold leading-tight text-primary">
									{community.name}
								</h2>
								{community.owner && (
									<Link
										href={`/profile/${community.owner.username}`}
										className="flex items-center gap-1.5 font-sans text-[calc(14px*var(--ws-fs))] text-muted hover:text-primary"
									>
										<span className="relative h-4 w-4 shrink-0 overflow-hidden rounded-pill bg-raised">
											<SafeAvatar src={community.owner.avatar} />
										</span>
										<span className="truncate">@{community.owner.username}</span>
										<UserBadges
											isVerified={community.owner.isVerified}
											verification={(community.owner as any).verification}
											badges={community.owner?.badges}
											size={11}
										/>
										<span className="text-subtle">· {t("community.owner")}</span>
									</Link>
								)}
							</div>

							<motion.button
								type="button"
								onClick={toggleJoin}
								disabled={joinBusy || community.isOwner}
								{...press}
								className={clsx(
									"h-10 shrink-0 self-start overflow-hidden rounded-pill px-5 font-sans text-[calc(14px*var(--ws-fs))] font-semibold transition-colors",
									community.isOwner
										? "cursor-default bg-raised text-muted"
										: community.joined
											? "cursor-pointer bg-raised text-muted hover:text-danger"
											: "cursor-pointer bg-primary text-page hover:bg-muted",
								)}
							>
								<AnimatePresence mode="wait" initial={false}>
									<motion.span
										key={
											community.isOwner
												? "owner"
												: community.joined
													? "joined"
													: "join"
										}
										{...swap}
										className="block"
									>
										{community.isOwner
											? t("community.owner")
											: community.joined
												? t("community.joined")
												: t("community.join")}
									</motion.span>
								</AnimatePresence>
							</motion.button>
						</div>

						{community.description && (
							<p className="mt-3.5 break-words font-sans text-[calc(16px*var(--ws-fs))] leading-relaxed text-primary">
								{community.description}
							</p>
						)}

						<div className="mt-3.5 flex flex-wrap items-center gap-4">
							<motion.span
								className="flex items-center gap-2"
								variants={staggerParent}
								initial="hidden"
								animate="show"
							>
								{(community.memberPreview ?? []).slice(0, 5).map((m, i) => (
									<motion.span
										key={m.userId}
										variants={staggerPop}
										className="relative -ml-2 h-6 w-6 shrink-0 overflow-hidden rounded-pill bg-raised ring-2 ring-page first:ml-0"
										style={{ zIndex: 5 - i }}
									>
										<SafeAvatar src={m.avatar} />
									</motion.span>
								))}
								<span className="font-sans text-[calc(14px*var(--ws-fs))] text-muted">
									{/* Rolls with the optimistic join. The header repeats
									    this number and stays still: one roll per press. */}
									<span className="relative inline-flex overflow-hidden align-bottom font-semibold tabular-nums text-primary">
										<AnimatePresence mode="popLayout" initial={false}>
											<motion.span
												key={community.membersCount}
												{...swap}
												className="inline-block"
											>
												{formatCompact(community.membersCount)}
											</motion.span>
										</AnimatePresence>
									</span>{" "}
									{t("community.members")}
								</span>
							</motion.span>
							{community.createdAt && (
								<span className="font-sans text-[calc(14px*var(--ws-fs))] text-subtle">
									{t("community.created.on")}{" "}
									{new Date(community.createdAt).toLocaleDateString(t.locale, {
										month: "long",
										year: "numeric",
									})}
								</span>
							)}
						</div>
					</section>

					{/* initial={false}: whatever is true on load is simply there. Only
					    a join made here brings the composer in. It rises, it does
					    not unfold: a clipping wrapper would cut off its popovers. */}
					<AnimatePresence mode="wait" initial={false}>
					{community.joined ? (
						<motion.div
							key="composer"
							{...reveal()}
							className="border-b border-hairline"
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
		</div>
	);
}
