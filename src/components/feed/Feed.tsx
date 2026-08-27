"use client";

import { mainScrollTop, mainScroller } from "@/lib/utils";

import {
	useState,
	useEffect,
	useRef,
	useSyncExternalStore,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useAtom, useAtomValue } from "jotai";
import { feedAtom } from "@/store/feed.atom";
import { feedTabAtom } from "@/store/ui.atom";
import { autoTranslateAtom, translationsAtom } from "@/store/translate.atom";
import { prefetchTranslations } from "@/lib/translate.prefetch";
import {
	hasRenderableBody,
	PostCard,
	PostProps,
} from "@/components/feed/PostCard";
import { PostComposer } from "@/components/feed/PostComposer";
import { getFeedAction } from "@/lib/feed.actions";
import { getPostByIdAction } from "@/lib/post.actions";
// 03-icons: `plus`, `user-plus` and `arrow-up` are all in the standardized set.
import { ArrowUp, Plus, UserPlus } from "lucide-react";
import { useToast } from "@/components/ui/Toast/ToastContext";
import { PostSkeleton } from "@/components/feed/PostSkeleton";
import { ImpressionSensor } from "@/components/feed/ImpressionSensor";
import { EmptyState } from "@/components/ui/EmptyState";
import { SafeAvatar } from "@/components/ui/SafeAvatar";
import {
	peekHandle,
	requestHandle,
	subscribeMentions,
} from "@/lib/mentionCache";
import { DEFAULT_AVATAR } from "@/const";
import { useT } from "@/i18n/client";
import { useFeedEvents } from "@/hooks/useUserEvents";
import { cacheKeys, invalidate, invalidatePrefix } from "@/lib/cache";
import { loadFeedSnapshot, saveFeedSnapshot } from "@/lib/feedCache";
import { userAtom } from "@/store/user.atom";
import { mapApiPost } from "@/lib/post-mapper";

/**
 * A post the realtime `feed` channel has announced but the timeline has not
 * shown yet. `postId` is what makes the pill honest: the announced post is
 * fetched by that id on click, so what was counted is what appears.
 */
interface PendingPost {
	postId: string;
	author: string;
	username: string;
}

/** Posts per page. Matches the gateway's own default. */
const FEED_PAGE_SIZE = 10;
/** Faces in the stack before the rest collapse into "+n". */
const MAX_FACES = 3;
/** Ceiling on the by-id fetch, for a tab left open all afternoon. */
const MAX_PENDING_FETCH = 20;
/**
 * How long a post waits between arriving and being announced.
 *
 * Two reasons, and the second is the one that matters. A pill that appears on
 * the same frame as the event reads as a twitch next to whatever the reader is
 * doing; a beat's delay makes it feel like it settled in. And the beat is
 * exactly the window the preload needs, so by the time the pill is offering
 * the post, the post is usually already in memory.
 */
const PILL_DELAY_MS = 1000;
/** Ceiling on the preload map — a tab left open must not grow without bound. */
const MAX_PRELOADED = 30;


/**
 * Merge keeping the FIRST occurrence of each id, so ordering expresses
 * precedence. Without this, any repeat fetch of the same page (StrictMode
 * double-effect, remount, retry) appends duplicates and React throws "two
 * children with the same key".
 */
function mergeById(posts: PostProps[]): PostProps[] {
	const byId = new Map<string, PostProps>();
	for (const post of posts) {
		if (!byId.has(post.id)) byId.set(post.id, post);
	}
	return [...byId.values()];
}

export default function Feed() {
	const t = useT();
	const [feedState, setFeedState] = useAtom(feedAtom);
	const tab = useAtomValue(feedTabAtom);
	const autoTranslate = useAtomValue(autoTranslateAtom);
	const [translations, setTranslations] = useAtom(translationsAtom);
	// Read through a ref inside the prefetch so a page landing mid-flight
	// doesn't re-translate what an earlier page already resolved.
	const translationsRef = useRef(translations);
	translationsRef.current = translations;
	const [loading, setLoading] = useState(true);
	// New posts announce themselves, they don't jump in: yanking the timeline
	// under someone mid-read is worse than letting them choose when to see
	// them. Held as the actual posts rather than a count so the pill can show
	// who posted, and so the click can fetch exactly what it advertised.
	const [pending, setPending] = useState<PendingPost[]>([]);
	const [refreshing, setRefreshing] = useState(false);
	const refreshingRef = useRef(false);
	/**
	 * Announced posts, fetched the moment they are announced rather than on
	 * click. The click then has nothing to wait for.
	 */
	const preloadedRef = useRef<Map<string, PostProps>>(new Map());
	/** Pending announce timers, so unmounting mid-beat doesn't set state. */
	const announceTimersRef = useRef<Set<ReturnType<typeof setTimeout>>>(
		new Set(),
	);
	/**
	 * Posts prepended by the pill. A `fetchFeed(true)` REPLACES the list with
	 * the ranked page, and the ranker puts a seconds-old post nowhere near the
	 * first ten — so without re-pinning these, the background reconcile would
	 * quietly delete the very posts the click just delivered.
	 */
	const prependedRef = useRef<PostProps[]>([]);
	const me = useAtomValue(userAtom);
	const [isPosting, setIsPosting] = useState(false);
	const { toast } = useToast();

	// First paint gets the orchestrated stagger; after that, new posts
	// (pagination, tab switches, prepends) rise in without queueing delays.
	const introPlayedRef = useRef(false);
	useEffect(() => {
		if (!loading && feedState.posts.length > 0) {
			const timer = setTimeout(() => {
				introPlayedRef.current = true;
			}, 700);
			return () => clearTimeout(timer);
		}
	}, [loading, feedState.posts.length]);

	// Infinite scroll: a sentinel above the "Show more" button auto-loads the
	// next page as it approaches the viewport; the button stays as fallback.
	const loadMoreRef = useRef<HTMLDivElement>(null);
	const fetchingMoreRef = useRef(false);
	const [isFetchingMore, setIsFetchingMore] = useState(false);
	const loadMore = async () => {
		if (fetchingMoreRef.current) return;
		fetchingMoreRef.current = true;
		setIsFetchingMore(true);
		try {
			await fetchFeed();
		} finally {
			fetchingMoreRef.current = false;
			setIsFetchingMore(false);
		}
	};

	useEffect(() => {
		const node = loadMoreRef.current;
		if (!node) return;
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries[0].isIntersecting) loadMore();
			},
			// Start loading ~one screen before the reader reaches the end.
			{ rootMargin: "600px 0px" },
		);
		observer.observe(node);
		return () => observer.disconnect();
	});

	// Translate in the background whenever posts are present and untranslated
	// — a fresh page, a restored timeline, or the reader turning the
	// preference on mid-scroll. Keyed on posts rather than on the fetch, so a
	// feed rehydrated from feedAtom (no network call) still gets translated.
	// Not awaited: the feed paints immediately and each result lands in the
	// atom as it arrives. prefetchTranslations dedupes against what's already
	// known and what's already in flight.
	useEffect(() => {
		if (!autoTranslate || feedState.posts.length === 0) return;
		void prefetchTranslations(
			feedState.posts,
			(id) => Boolean(translationsRef.current[id]),
			(id, entry) =>
				setTranslations((prev) =>
					prev[id] ? prev : { ...prev, [id]: entry },
				),
		);
	}, [autoTranslate, feedState.posts, setTranslations]);

	// Persist the top of the For-You timeline as the next session's first
	// paint. Keyed per user; posts-change only (live counts ride the separate
	// engagement store, so this doesn't rewrite on every like).
	useEffect(() => {
		if (me?._id && feedState.mode === "foryou" && feedState.posts.length > 0) {
			saveFeedSnapshot(String(me._id), feedState.posts);
		}
	}, [feedState.posts, feedState.mode, me?._id]);

	// Both tabs are now server queries, so what came back IS what to show —
	// minus anything with no body at all, which would paint a card of chrome
	// around nothing. This used to filter the For-You page by
	// `followingIdsAtom`, which only fills as you press Follow in the current
	// session, so Following was empty after every reload however many people
	// you followed.
	const visiblePosts = feedState.posts.filter(hasRenderableBody);

	useEffect(() => {
		// Disable browser's automatic scroll restoration to handle it manually
		if (typeof window !== "undefined") {
			window.history.scrollRestoration = "manual";
		}

		// Cached posts only stand in for a fetch if they are THIS tab's posts.
		if (feedState.posts.length > 0 && feedState.mode === tab) {
			setLoading(false);
			// Restore scroll position with a slight delay to ensure DOM is ready
			if (feedState.scrollPosition > 0) {
				setTimeout(() => {
					mainScroller().scrollTo(0, feedState.scrollPosition);
				}, 10);
			}
		} else {
			// Fresh page load (the atom is memory-only): paint the last-known
			// snapshot immediately and revalidate silently underneath, instead
			// of holding the reader on a skeleton for the whole round trip.
			// Snapshots are For-You only — Following is chronological, where a
			// stale page misleads rather than helps.
			const snapshot =
				tab === "foryou" && me?._id
					? loadFeedSnapshot(String(me._id))
					: null;
			if (snapshot) {
				setFeedState((prev) => ({
					...prev,
					posts: snapshot,
					cursor: null,
					hasMore: true,
					mode: tab,
				}));
				setLoading(false);
				void fetchFeed(true, { silent: true });
			} else {
				fetchFeed();
			}
		}

		// Save scroll position on unmount
		return () => {
			if (typeof window !== "undefined") {
				window.history.scrollRestoration = "auto";
				setFeedState((prev) => ({ ...prev, scrollPosition: mainScrollTop() }));
			}
		};
	}, []);

	// Switching tab switches the QUERY, so it has to refetch. Skipped on the
	// first run — the mount effect above already decided whether to fetch.
	const loadedTabRef = useRef(tab);
	useEffect(() => {
		if (loadedTabRef.current === tab) return;
		loadedTabRef.current = tab;
		// Posts pinned by the pill belong to the tab they were fetched for.
		prependedRef.current = [];
		setPending([]);
		setFeedState((prev) => ({ ...prev, posts: [], cursor: null, mode: tab }));
		void fetchFeed(true);
	}, [tab]);

	useFeedEvents((event, data) => {
		if (event !== "post") return;
		// Your own post already appears optimistically.
		if (data.author && me?._id && String(data.author) === String(me._id))
			return;
		// A community post belongs to its community page — the gateway's home
		// feed query filters `community: null`, so counting one here would
		// promise a post the timeline is never allowed to show.
		if (data.community) return;

		const postId = data.postId ? String(data.postId) : "";
		const username = data.username ? String(data.username) : "";
		// Warm the shared handle cache now, so the face is resolved by the time
		// the pill paints. A burst of posts costs one batched request.
		if (username) requestHandle(username);

		// Preload starts IMMEDIATELY, not after the announce beat and not on
		// click — the whole point is that the post is already here when the
		// reader asks for it. A failure is silent: the click re-fetches
		// anything missing, so this is an optimisation, never a dependency.
		if (postId && !preloadedRef.current.has(postId)) {
			void getPostByIdAction(postId)
				.then((result) => {
					if (!result.success || !result.data) return;
					preloadedRef.current.set(postId, mapApiPost(result.data));
					while (preloadedRef.current.size > MAX_PRELOADED) {
						const oldest = preloadedRef.current.keys().next().value;
						if (oldest === undefined) break;
						preloadedRef.current.delete(oldest);
					}
				})
				.catch(() => {});
		}

		// The announce itself waits a beat. Scheduled per event rather than
		// debounced: a burst of five posts should still end up as five faces,
		// each a second after its own arrival.
		const timer = setTimeout(() => {
			announceTimersRef.current.delete(timer);
			setPending((prev) =>
				postId && prev.some((p) => p.postId === postId)
					? prev
					: [...prev, { postId, author: String(data.author ?? ""), username }],
			);
		}, PILL_DELAY_MS);
		announceTimersRef.current.add(timer);
	});

	// A timer that fires after unmount would set state on a dead component.
	useEffect(() => {
		const timers = announceTimersRef.current;
		return () => {
			for (const timer of timers) clearTimeout(timer);
			timers.clear();
		};
	}, []);

	// The shared handle cache resolves asynchronously (one batched request for a
	// burst of posts), so the pill has to re-render when an answer lands. The
	// snapshot is a newline-joined string — a value React can compare, unlike a
	// fresh array — which is why a resolution elsewhere on the page costs a
	// string compare and no render here. Same pattern as `Mention`.
	const pendingAvatars = useSyncExternalStore(
		subscribeMentions,
		() =>
			pending
				.map((p) => (p.username ? (peekHandle(p.username)?.avatar ?? "") : ""))
				.join("\n"),
		() => "",
	);

	// One face per person, in the order they posted — five posts from one
	// account is one avatar, not five. Unresolved handles carry an empty src and
	// fall through to SafeAvatar's DEFAULT_AVATAR rather than holding the pill
	// back until the lookup returns.
	const resolved = pendingAvatars.split("\n");
	const faces: { key: string; avatar: string }[] = [];
	const seenAuthors = new Set<string>();
	for (let i = 0; i < pending.length; i++) {
		const key =
			pending[i].username || pending[i].author || pending[i].postId;
		if (!key || seenAuthors.has(key)) continue;
		seenAuthors.add(key);
		faces.push({ key, avatar: resolved[i] ?? "" });
	}

	const fetchFeed = async (reset = false, opts?: { silent?: boolean }) => {
		// A silent reset revalidates behind an already-painted snapshot —
		// flipping to the skeleton would throw away exactly what the snapshot
		// bought.
		if (reset && !opts?.silent) {
			setLoading(true);
		}

		try {
			const currentCursor = reset ? null : feedState.cursor;
			// The tab IS the query. Passing it was the missing half of the
			// Following tab: the gateway has a chronological following page
			// built on the server's own follow list, and this client never
			// asked for it — it filtered the ranked For-You page client-side
			// instead, against an atom that only fills as you click Follow and
			// is empty after every reload.
			const result = await getFeedAction(currentCursor, FEED_PAGE_SIZE, tab);

			if (result.success && result.data) {
				const apiPosts = result.data.posts;
				const mappedPosts: PostProps[] = apiPosts.map(mapApiPost);

				setFeedState((prev) => ({
					...prev,
					posts: mergeById(
						reset
							? // Re-pin what the pill delivered. The ranked page will not
								// contain a post published seconds ago, so a bare reset
								// would drop it straight back out of the timeline.
								[...prependedRef.current, ...mappedPosts]
							: [...prev.posts, ...mappedPosts],
					),
					cursor: result.data.nextCursor ?? null,
					hasMore: Boolean(result.data.hasMore),
					mode: tab,
				}));
			} else {
				if (result.message) toast(result.message, { type: "error" });
			}
		} catch (error) {
			console.error("Failed to fetch feed:", error);
			toast("Failed to load feed", { type: "error" });
		} finally {
			setLoading(false);
		}
	};

	/**
	 * Actually load what the pill advertised.
	 *
	 * A plain `fetchFeed(true)` is not enough, and that is why this used to read
	 * as "it just scrolls back up": `GET /api/feed` page 1 is the *ranked* feed,
	 * and the ranker scores a post as
	 * `(0.1 + ln(1 + likes + 2·replies + 3·reposts)) × exp(−ageHours/24) × …`.
	 * A seconds-old post has no engagement, so it sits at the 0.1 floor while
	 * anything from the last day with a couple of likes scores an order of
	 * magnitude higher — the announced post is at the *bottom* of the ranking,
	 * never in the top ten the refresh returns. The reader got the same ten
	 * posts back, and the only visible effect was the scroll.
	 *
	 * So the announced posts are fetched by id and prepended, which is
	 * independent of ranking, while the page refresh runs alongside to bring the
	 * rest of the timeline (and its counts) up to date.
	 */
	/** Put posts on top, and remember them so a reset cannot drop them. */
	const prependPosts = (fresh: PostProps[]) => {
		if (fresh.length === 0) return;
		prependedRef.current = mergeById([
			...fresh,
			...prependedRef.current,
		]).slice(0, MAX_PENDING_FETCH);
		setFeedState((prev) => ({
			...prev,
			posts: mergeById([...fresh, ...prev.posts]),
		}));
	};

	const showNewPosts = () => {
		if (refreshingRef.current) return;

		// Snapshot: anything that arrives while this runs stays pending, so the
		// pill re-appears for it.
		const claimed = pending.slice(-MAX_PENDING_FETCH);
		const ready = claimed.filter((p) => preloadedRef.current.has(p.postId));
		const missing = claimed.filter((p) => !preloadedRef.current.has(p.postId));

		// ── Synchronous: everything the preload already has goes in NOW ──
		// No await before this point, so the posts are on screen in the same
		// frame as the click rather than after a round trip.
		prependPosts(
			ready
				.map((p) => preloadedRef.current.get(p.postId))
				.filter((post): post is PostProps => Boolean(post))
				.reverse(),
		);
		// The pill clears NOW, all of it. Keeping the un-preloaded ones up with
		// a spinner was honest but felt broken: you tap "5 new posts" and the
		// thing you tapped is still sitting there loading. Whatever the
		// preload missed lands underneath a moment later instead.
		setPending([]);
		mainScroller().scrollTo({ top: 0, behavior: "smooth" });

		// ── Background: whatever the preload missed, plus a reconcile ──
		void (async () => {
			refreshingRef.current = true;
			setRefreshing(true);
			try {
				const [, announced] = await Promise.all([
					fetchFeed(true),
					Promise.all(missing.map((p) => getPostByIdAction(p.postId))),
				]);

				const late: PostProps[] = [];
				for (const result of announced) {
					// A 404 here is legitimate — deleted, or from someone who has
					// blocked you since. Skipping it is the point of asking.
					if (result.success && result.data) late.push(mapApiPost(result.data));
				}
				prependPosts(late.reverse());
			} finally {
				refreshingRef.current = false;
				setRefreshing(false);
			}
		})();
	};

	const handlePostStart = () => {
		setIsPosting(true);
	};

	const handlePostSuccess = async (newPost: any) => {
		if (newPost) {
			const mappedPost: PostProps = {
				id: newPost._id,
				author: {
					id: newPost.author._id,
					name:
						newPost.author.firstName && newPost.author.lastName
							? `${newPost.author.firstName} ${newPost.author.lastName}`
							: newPost.author.username,
					username: newPost.author.username,
					avatar: newPost.author.avatar || DEFAULT_AVATAR,
					isVerified: newPost.author.isVerified,
					verification: newPost.author.verification,
				},
				content: newPost.content,
				timestamp: "Just now",
				images: newPost.images,
				videos: newPost.videos,
				stats: newPost.stats || { replies: 0, reposts: 0, likes: 0, views: 0 },
				isLiked: false,
				isBookmarked: false,
			};

			setFeedState((prev) => ({
				...prev,
				posts: [
					mappedPost,
					...prev.posts.filter((p) => p.id !== mappedPost.id),
				],
			}));

			// The feed prepends the new post, but the profile keeps its own
			// cached tab lists. Without this, posting and then opening your
			// profile showed a list that did not include what you just wrote.
			if (newPost.author?.userId) {
				invalidatePrefix(cacheKeys.userPostsAll(newPost.author.userId));
			}
			if (newPost.author?.username) {
				invalidate(cacheKeys.profile(newPost.author.username));
			}

			setIsPosting(false);
		} else {
			// Keep isPosting true while fetching
			await fetchFeed(true);
			setIsPosting(false);
		}
	};

	return (
		<div className="w-full min-w-0 pb-nav md:pb-20">
			{/* New posts announce themselves; the reader decides when to jump.
			    The stack says WHO posted before the click — a name you follow is
			    worth interrupting a read for, a count on its own isn't. */}
			{/* Sticky under the column header rather than `fixed` at a guessed
			    offset: fixed positioning knows nothing about the stories rail
			    or the tab bar above it, so the pill landed ON TOP of the rail.
			    h-0 keeps it out of the flow so nothing below shifts down. */}
			<div className="sticky top-14 z-sticky flex h-0 justify-center">
			<AnimatePresence>
				{pending.length > 0 && (
					<motion.button
						type="button"
						initial={{ opacity: 0, y: -8 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, transition: { duration: 0.12 } }}
						transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
						onClick={showNewPosts}
						disabled={refreshing}
						aria-busy={refreshing}
						className="mt-2 flex items-center gap-2 h-10 pl-2.5 pr-4 rounded-pill bg-brand text-brand-on shadow-nav font-sans text-[13px] font-semibold hover:bg-brand-active transition-colors cursor-pointer disabled:cursor-default"
					>
						{refreshing ? (
							<span
								aria-hidden
								className="w-[14px] h-[14px] rounded-pill border-2 border-brand-on/30 border-t-brand-on animate-spin"
							/>
						) : (
							<ArrowUp className="w-[14px] h-[14px]" />
						)}

						{faces.length > 0 && (
							<span className="flex items-center">
								{faces.slice(0, MAX_FACES).map((face) => (
									<span
										key={face.key}
										className="relative w-6 h-6 shrink-0 overflow-hidden rounded-pill bg-raised ring-2 ring-page -ml-2 first:ml-0"
									>
										<SafeAvatar src={face.avatar} />
									</span>
								))}
								{/* min-w, not a fixed w, so "+12" cannot spill out of
								    its circle. */}
								{faces.length > MAX_FACES && (
									<span className="relative flex h-6 min-w-6 shrink-0 items-center justify-center rounded-pill bg-raised px-1.5 text-primary text-[11px] font-semibold tabular-nums ring-2 ring-page -ml-2">
										+{faces.length - MAX_FACES}
									</span>
								)}
							</span>
						)}

						<span className="tabular-nums">
							{refreshing
								? t("feed.newPosts.loading")
								: `${pending.length} ${
										pending.length === 1
											? t("feed.newPosts.one")
											: t("feed.newPosts")
									}`}
						</span>
					</motion.button>
				)}
			</AnimatePresence>
			</div>


			{/* A normal feed row, not a card (owner ruling 2026-08-26): the
			    card-depth gradient + inset margins made the composer the
			    loudest thing on the page. Same page ground and hairline rhythm
			    as the posts below it. */}
			<div
				className="animate-rise border-b border-hairline"
				style={{ animationDelay: "60ms" }}
			>
				<PostComposer
					onPostStart={handlePostStart}
					onPostSuccess={handlePostSuccess}
				/>
			</div>

			{/* Keyed by tab so switching timelines replays the rise (no stagger). */}
			<div key={tab}>
				{isPosting && <PostSkeleton />}
				{visiblePosts.map((post, index) => (
					<ImpressionSensor
						key={post.id}
						meta={{
							post: post.id,
							author: post.author.id,
							surface: tab === "following" ? "feed_following" : "feed_foryou",
							position: index,
							mediaType: post.live
								? "live"
								: post.videos?.length
									? "video"
									: post.images?.length
										? "image"
										: "text",
							cursorDepth: Math.floor(index / 10),
							promoted: post.promoted,
						}}
						className="animate-rise"
						style={{
							animationDelay: introPlayedRef.current
								? "0ms"
								: `${Math.min(160 + index * 60, 520)}ms`,
						}}
					>
						<PostCard post={post} />
					</ImpressionSensor>
				))}

				{loading && (
					<div className="flex flex-col">
						{[...Array(5)].map((_, i) => (
							<PostSkeleton key={i} hasMedia={i % 2 !== 0} />
						))}
					</div>
				)}

				{!loading &&
					visiblePosts.length === 0 &&
					(tab === "following" ? (
						<EmptyState
							icon={UserPlus}
							title={t("feed.following.empty.title")}
							caption={t("feed.following.empty.caption")}
						/>
					) : (
						<EmptyState
							icon={Plus}
							title={t("feed.empty.title")}
							caption={t("feed.empty.caption")}
							action={{
								label: t("feed.empty.action"),
								onClick: () =>
									document
										.querySelector<HTMLTextAreaElement>("#post-composer-input")
										?.focus(),
							}}
						/>
					))}

				{feedState.hasMore && !loading && tab === "foryou" && feedState.posts.length > 0 && (
					<div ref={loadMoreRef} className="flex justify-center py-8">
						{isFetchingMore ? (
							<span className="h-9 flex items-center gap-2 font-sans text-[13px] text-muted">
								<span className="w-4 h-4 rounded-full border-2 border-raised border-t-brand animate-spin" />
								{t("feed.loading")}
							</span>
						) : (
							<button
								type="button"
								onClick={loadMore}
								className="h-9 px-4 rounded-pill border border-hairline bg-surface hover:bg-raised font-sans text-[13px] font-medium text-primary transition-colors cursor-pointer"
							>
								{t("feed.loadmore")}
							</button>
						)}
					</div>
				)}
			</div>
		</div>
	);
}
