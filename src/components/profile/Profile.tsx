"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAtom, useAtomValue } from "jotai";
import { Grid3x3, Heart, MessageCircle, Plus, Search, Video } from "lucide-react";

import {
	hasRenderableBody,
	PostCard,
	type PostProps,
} from "@/components/feed/PostCard";
import { PostSkeleton } from "@/components/feed/PostSkeleton";
import { ProfileSkeleton } from "@/components/skeletons/ProfileSkeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import ConfirmModal from "@/components/ui/ConfirmModal";
import { useToast } from "@/components/ui/Toast/ToastContext";
import EditProfileModal from "@/components/profile/EditProfileModal";
import FollowsModal from "@/components/profile/FollowsModal";
import { ProfileHeader } from "@/components/profile/ProfileHeader";
import { ProfileAbout, type CommunityChip } from "@/components/profile/ProfileAbout";
import { ProfileTabs, type ProfileTab } from "@/components/profile/ProfileTabs";
import { ProfileGrid } from "@/components/profile/ProfileGrid";
import ReportSheet from "@/components/safety/ReportSheet";

import {
	blockUserAction,
	followUserAction,
	getProfileByUsernameAction,
	unblockUserAction,
	unfollowUserAction,
} from "@/lib/user.actions";
import { getUserFeedAction } from "@/lib/feed.actions";
import { getCommunitiesAction } from "@/lib/community.actions";
import { getUserStoriesAction } from "@/lib/stories.actions";
import { StoryViewer, type RailEntry } from "@/components/feed/StoryViewer";
import { startConversationAction } from "@/lib/conversation.actions";
import { useLiveNow } from "@/hooks/useLiveNow";
import { formatTimeAgo } from "@/lib/utils";
import { DEFAULT_AVATAR } from "@/const";
import { useT } from "@/i18n/client";
import { userAtom } from "@/store/user.atom";
import {
	cacheKeys,
	fetchCached,
	invalidate,
	invalidatePrefix,
	isFresh,
	readCache,
	writeCache,
} from "@/lib/cache";
import { useCachedResource } from "@/hooks/useCachedResource";

/** Which endpoint backs each tab. Street and Media share one media fetch. */
/**
 * A profile is mostly identity — name, bio, avatar, counts — which does not
 * move minute to minute, so five minutes of "don't ask again" is invisible to
 * the reader. Anything that DOES move (following, block, edit) invalidates the
 * key directly, so this is the ceiling on staleness, not the latency of a change.
 */
const PROFILE_TTL = 5 * 60_000;
/** Posts move faster than identity, so a shorter ceiling. */
const POSTS_TTL = 60_000;

/** Patch block state into the cached copy without forcing a re-request. */
function setBlockedInCache(handle: string | undefined, blocked: boolean) {
	if (!handle) return;
	const key = cacheKeys.profile(handle);
	const cached = readCache<any>(key);
	if (cached) writeCache(key, { ...cached.data, isBlockedByYou: blocked });
}

const FETCH_FOR: Record<ProfileTab, "posts" | "replies" | "media" | "likes"> = {
	posts: "posts",
	replies: "replies",
	street: "media",
	media: "media",
	likes: "likes",
};

/**
 * Whether the signed-in user follows this profile.
 *
 * The gateway answers this directly now. It used to be derived client-side by
 * scanning the profile's `followers` array, which meant every profile response
 * had to carry every follower id — the same payload that was also leaking the
 * person's email. The array branch stays for your own profile, which still
 * returns the full document.
 */
function readIsFollowing(profile: any, currentUser: any): boolean {
	if (typeof profile?.isFollowing === "boolean") return profile.isFollowing;
	if (currentUser && Array.isArray(profile?.followers)) {
		return profile.followers.includes(currentUser._id);
	}
	return false;
}

function mapPost(post: any): PostProps {
	return {
		id: post._id,
		author: {
			id: post.author?._id || post.author,
			name:
				post.author?.firstName && post.author?.lastName
					? `${post.author.firstName} ${post.author.lastName}`
					: post.author?.username || "Unknown",
			username: post.author?.username || "unknown",
			avatar: post.author?.avatar || DEFAULT_AVATAR,
			isVerified: post.author?.isVerified || false,
			badges: post.author?.badges,
		},
		content: post.content,
		mentions: post.mentions,
		timestamp: formatTimeAgo(post.createdAt),
		images: post.images,
		videos: post.videos,
		stats: post.stats || { replies: 0, reposts: 0, likes: 0 },
		isLiked: post.isLiked,
		isBookmarked: post.isBookmarked,
	};
}

export default function Profile({ username }: { username?: string }) {
	const router = useRouter();
	const t = useT();
	const { toast } = useToast();
	const currentUser = useAtomValue(userAtom);
	const { entries: liveEntries } = useLiveNow();

	const [profileUser, setProfileUser] = useState<any>(null);

	const [loadingProfile, setLoadingProfile] = useState(true);
	const [notFound, setNotFound] = useState(false);

	const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
	const [isFollowsModalOpen, setIsFollowsModalOpen] = useState(false);
	const [isBlockModalOpen, setIsBlockModalOpen] = useState(false);
	const [isReportOpen, setIsReportOpen] = useState(false);
	const [followsInitialTab, setFollowsInitialTab] = useState<
		"followers" | "following"
	>("followers");

	const [activeTab, setActiveTab] = useState<ProfileTab>("posts");
	const [feedPosts, setFeedPosts] = useState<PostProps[]>([]);
	const [loadingFeed, setLoadingFeed] = useState(false);
	const [communities, setCommunities] = useState<CommunityChip[]>([]);
	// The ring on the avatar, and what it opens. Fetched per profile rather
	// than read off the rail: the rail only carries people you follow.
	const [storyEntry, setStoryEntry] = useState<RailEntry | null>(null);
	const [storyOpen, setStoryOpen] = useState(false);

	const [isFollowing, setIsFollowing] = useState(false);
	const [followersCount, setFollowersCount] = useState(0);
	const [followLoading, setFollowLoading] = useState(false);

	const isMe =
		!username ||
		Boolean(currentUser && profileUser && currentUser.userId === profileUser.userId);

	// Keep our own profile in sync with the atom, so an edit lands immediately.
	useEffect(() => {
		if (isMe && currentUser) {
			setProfileUser((prev: any) => ({ ...prev, ...currentUser }));
		}
	}, [currentUser, isMe]);

	// /profile with no username used to read the hydrated atom and stop
	// there, so your own profile rendered without counts, interests or
	// block state. Resolve the handle, then read like any other profile.
	const handle = username || currentUser?.username || null;

	// Cached read: a profile visited in the last few minutes renders from
	// memory with no request at all, and a stale one renders immediately while
	// it revalidates. Mutations below invalidate the key rather than each
	// surface refetching on its own schedule.
	const {
		data: cachedProfile,
		loading: profileFetching,
		error: profileError,
	} = useCachedResource(
		handle ? cacheKeys.profile(handle) : null,
		async () => {
			const result = await getProfileByUsernameAction(handle as string);
			if (!result.success) throw new Error(result.message || "not found");
			return result.data;
		},
		{ ttl: PROFILE_TTL },
	);

	useEffect(() => {
		if (!cachedProfile) return;
		setProfileUser(cachedProfile);
		setFollowersCount(cachedProfile.followersCount || 0);
		setIsFollowing(readIsFollowing(cachedProfile, currentUser));
	}, [cachedProfile, currentUser]);

	useEffect(() => {
		setLoadingProfile(Boolean(handle) && profileFetching);
	}, [handle, profileFetching]);

	useEffect(() => {
		// Only a failure with nothing to fall back on is a 404 — a failed
		// revalidation of a profile we already have is not.
		if (profileError && !cachedProfile) setNotFound(true);
	}, [profileError, cachedProfile]);

	// Communities are only shown on your own profile: the gateway's list
	// carries the viewer's membership, not the profile owner's.
	useEffect(() => {
		if (!isMe) {
			setCommunities([]);
			return;
		}
		let cancelled = false;
		void getCommunitiesAction().then((res) => {
			if (cancelled || !res.success) return;
			setCommunities(
				(res.communities ?? [])
					.filter((c: any) => c.joined)
					.map((c: any) => ({
						id: String(c.id),
						name: c.name,
						slug: c.slug,
						avatar: c.avatar || undefined,
					})),
			);
		});
		return () => {
			cancelled = true;
		};
	}, [isMe]);

	useEffect(() => {
		const handle = profileUser?.username;
		if (!handle) return;
		let cancelled = false;
		void getUserStoriesAction(handle).then((res) => {
			if (!cancelled) setStoryEntry(res.entry);
		});
		return () => {
			cancelled = true;
		};
	}, [profileUser?.username]);

	useEffect(() => {
		if (!profileUser?.userId) return;

		const kind = FETCH_FOR[activeTab];
		const key = cacheKeys.userPosts(profileUser.userId, kind);
		const cached = readCache<PostProps[]>(key);

		// Show whatever we have straight away — switching tabs back and forth
		// used to be free only because the old cache never expired at all.
		if (cached) setFeedPosts(cached.data);
		if (isFresh(cached, POSTS_TTL)) {
			setLoadingFeed(false);
			return;
		}

		let cancelled = false;
		setLoadingFeed(!cached);
		void fetchCached<PostProps[]>(
			key,
			async () => {
				const result = await getUserFeedAction(profileUser.userId, kind);
				if (!(result.success && Array.isArray(result.data))) return [];
				return result.data.map(mapPost);
			},
			POSTS_TTL,
		)
			.then((posts) => {
				if (cancelled) return;
				setFeedPosts(posts);
				setLoadingFeed(false);
			})
			.catch(() => {
				if (cancelled) return;
				if (!cached) setFeedPosts([]);
				setLoadingFeed(false);
			});
		return () => {
			cancelled = true;
		};
	}, [profileUser?.userId, activeTab]);

	// Street and Media split one media fetch: video posts vs everything else.
	const visiblePosts = useMemo(() => {
		// Drop bodyless rows first, so the empty state below counts what will
		// actually render — otherwise a tab holding nothing but blank posts
		// says "no posts yet" underneath a stack of empty cards.
		const real = feedPosts.filter(hasRenderableBody);
		if (activeTab === "street") return real.filter((p) => p.videos?.length);
		if (activeTab === "media") return real.filter((p) => !p.videos?.length);
		return real;
	}, [feedPosts, activeTab]);

	const handleFollowToggle = useCallback(async () => {
		if (!profileUser || !currentUser || followLoading) return;

		const wasFollowing = isFollowing;
		const previousCount = followersCount;
		setIsFollowing(!wasFollowing);
		setFollowersCount((n) => (wasFollowing ? n - 1 : n + 1));
		setFollowLoading(true);

		const res = wasFollowing
			? await unfollowUserAction(profileUser._id)
			: await followUserAction(profileUser._id);

		if (!res.success) {
			setIsFollowing(wasFollowing);
			setFollowersCount(previousCount);
			toast(t("rail.followFailed"), { type: "error" });
		} else {
			// Write the new truth into the cache rather than dropping the key:
			// the optimistic UI already shows it, so an invalidate here would
			// make the counts flicker back on the next read.
			const handleKey = profileUser.username;
			if (handleKey) {
				const key = cacheKeys.profile(handleKey);
				const cached = readCache<any>(key);
				if (cached) {
					writeCache(key, {
						...cached.data,
						followersCount: wasFollowing
							? previousCount - 1
							: previousCount + 1,
						followers: wasFollowing
							? cached.data.followers?.filter(
									(id: string) => id !== currentUser._id,
								)
							: [...(cached.data.followers || []), currentUser._id],
					});
				}
			}
			// Our own following count moved too, and that lives on our profile.
			if (currentUser.username) {
				invalidate(cacheKeys.profile(currentUser.username));
			}
		}
		setFollowLoading(false);
	}, [
		profileUser,
		currentUser,
		followLoading,
		isFollowing,
		followersCount,
		toast,
		t,
	]);

	/**
	 * Block without leaving the page. The report sheet offers "also block" on
	 * its confirmation step, and `handleBlock`'s redirect would rip the sheet
	 * away before the user saw it land.
	 */
	const blockInPlace = useCallback(async () => {
		if (!profileUser?._id) return;
		const res = await blockUserAction(profileUser._id);
		if (!res.success) {
			toast(res.message ?? "Could not block", { type: "error" });
			return;
		}
		toast(t("safety.blocked.toast"));
		setProfileUser((prev: any) => ({ ...prev, isBlockedByYou: true }));
		setBlockedInCache(profileUser.username, true);
	}, [profileUser?._id, profileUser?.username, toast, t]);

	// `_id`, not `userId` — the gateway resolves both now, but the follow
	// handler two functions up already passes `_id` and these should agree.
	const handleBlock = useCallback(async () => {
		if (!profileUser?._id) return;
		const res = await blockUserAction(profileUser._id);
		if (res.success) {
			toast(t("safety.blocked.toast"));
			router.push("/");
		} else {
			toast(res.message ?? "Could not block", { type: "error" });
		}
	}, [profileUser?._id, router, toast, t]);

	const handleUnblock = useCallback(async () => {
		if (!profileUser?._id) return;
		const res = await unblockUserAction(profileUser._id);
		if (!res.success) {
			toast(res.message ?? "Could not unblock", { type: "error" });
			return;
		}
		toast(t("safety.unblocked.toast"));
		setProfileUser((prev: any) => ({ ...prev, isBlockedByYou: false }));
		setBlockedInCache(profileUser.username, false);
		// Blocking hid their posts; unblocking has to let them back in.
		invalidatePrefix(cacheKeys.userPostsAll(profileUser.userId));
	}, [profileUser?._id, profileUser?.username, profileUser?.userId, toast, t]);

	const handleMessage = useCallback(async () => {
		if (!profileUser?.userId) return;
		const res: any = await startConversationAction(profileUser.userId);
		const id = res?._id || res?.data?._id;
		if (id) router.push(`/messages/${id}`);
		else toast("Could not open the conversation", { type: "error" });
	}, [profileUser?.userId, router, toast]);

	if (loadingProfile && !profileUser) return <ProfileSkeleton />;

	if (notFound) {
		return (
			<div className="flex min-h-[60dvh] flex-col items-center justify-center">
				<EmptyState
					icon={Search}
					title="This account doesn't exist"
					caption={`@${username} isn't on WorldSpace. Try searching for another account.`}
					action={{ label: t("common.back"), onClick: () => router.back() }}
				/>
			</div>
		);
	}

	if (!profileUser) return null;

	const fullName =
		profileUser.firstName && profileUser.lastName
			? `${profileUser.firstName} ${profileUser.lastName}`
			: profileUser.username;

	const isLive = liveEntries.some((e) => e.username === profileUser.username);
	// The gateway sends this as a boolean now. The array fallback covers the
	// owner's own payload, which still carries the full document.
	const followsYou =
		!isMe &&
		(typeof profileUser.followsYou === "boolean"
			? profileUser.followsYou
			: Boolean(currentUser && profileUser.following?.includes(currentUser._id)));

	const emptyIcon =
		activeTab === "likes"
			? Heart
			: activeTab === "media"
				? Grid3x3
				: activeTab === "street"
					? Video
					: activeTab === "replies"
						? MessageCircle
						: Plus;

	const emptyCaptionKey =
		activeTab === "likes"
			? isMe
				? "profile.empty.likesSelf"
				: "profile.empty.likesOther"
			: activeTab === "media"
				? "profile.empty.media"
				: activeTab === "street"
					? isMe
						? "profile.empty.streetSelf"
						: "profile.empty.streetOther"
					: activeTab === "replies"
						? "profile.empty.replies"
						: isMe
							? "profile.empty.postsSelf"
							: "profile.empty.postsOther";

	return (
		<div className="flex min-h-dvh flex-col pb-nav md:pb-20">
			{storyOpen && storyEntry && (
				<StoryViewer
					entry={storyEntry}
					onClose={() => {
						setStoryOpen(false);
						// Re-read so the ring settles to "seen" without a reload.
						if (profileUser?.username) {
							void getUserStoriesAction(profileUser.username).then((res) =>
								setStoryEntry(res.entry),
							);
						}
					}}
				/>
			)}

			{isEditProfileOpen && currentUser && (
				<EditProfileModal
					user={currentUser}
					onClose={() => setIsEditProfileOpen(false)}
				/>
			)}

			<ProfileHeader
				fullName={fullName}
				username={profileUser.username}
				isVerified={profileUser.isVerified}
				badges={profileUser.badges}
				postsCount={profileUser.postsCount || 0}
				banner={profileUser.banner}
				avatar={profileUser.avatar}
				isLive={isLive}
				storyState={
					storyEntry
						? storyEntry.hasUnseen
							? "unseen"
							: "seen"
						: "none"
				}
				onAvatarClick={storyEntry ? () => setStoryOpen(true) : undefined}
				isMe={isMe}
				isFollowing={isFollowing}
				followLoading={followLoading}
				blockedByYou={profileUser.isBlockedByYou}
				blockedByThem={profileUser.isBlockedByThem}
				onBack={() => router.back()}
				onEdit={() => setIsEditProfileOpen(true)}
				onFollowToggle={handleFollowToggle}
				onMessage={handleMessage}
				onBlock={() => setIsBlockModalOpen(true)}
				onUnblock={handleUnblock}
				onReport={() => setIsReportOpen(true)}
			/>

			{isReportOpen && (
				<ReportSheet
					targetType="user"
					targetId={profileUser._id}
					subject={`@${profileUser.username}`}
					canBlock={!profileUser.isBlockedByYou}
					alreadyBlocked={Boolean(profileUser.isBlockedByYou)}
					onBlock={blockInPlace}
					onClose={() => setIsReportOpen(false)}
				/>
			)}

			{profileUser.isBlockedByYou && (
				<div className="mx-4 mt-2 flex items-center justify-between rounded-xl border border-danger/20 bg-danger/10 p-3">
					<span className="font-sans text-sm font-semibold text-danger">
						You blocked this user.
					</span>
					<button
						type="button"
						onClick={handleUnblock}
						className="cursor-pointer rounded-md bg-danger px-3 py-1.5 font-sans text-xs font-semibold text-page transition-opacity hover:opacity-90"
					>
						Unblock
					</button>
				</div>
			)}

			{profileUser.isBlockedByThem && (
				<div className="mx-4 mt-2 rounded-xl border border-hairline bg-surface p-3">
					<span className="font-sans text-sm font-semibold text-muted">
						You have been blocked by this user.
					</span>
				</div>
			)}

			<ProfileAbout
				fullName={fullName}
				username={profileUser.username}
				isVerified={profileUser.isVerified}
				badges={profileUser.badges}
				bio={profileUser.bio}
				location={profileUser.location}
				website={profileUser.website}
				createdAt={profileUser.createdAt}
				interests={profileUser.interests}
				communities={communities}
				followsYou={followsYou}
				followingCount={profileUser.followingCount || 0}
				followersCount={followersCount}
				onOpenFollows={(tab) => {
					setFollowsInitialTab(tab);
					setIsFollowsModalOpen(true);
				}}
				onEditTopics={() => setIsEditProfileOpen(true)}
				isMe={isMe}
			/>

			<FollowsModal
				isOpen={isFollowsModalOpen}
				onClose={() => setIsFollowsModalOpen(false)}
				userId={profileUser.userId || profileUser._id}
				initialTab={followsInitialTab}
			/>

			<ConfirmModal
				isOpen={isBlockModalOpen}
				onClose={() => setIsBlockModalOpen(false)}
				onConfirm={handleBlock}
				title={`Block @${profileUser.username}?`}
				message="They will not be able to message you or see your posts. This action cannot be easily undone."
				confirmText="Block"
				isDestructive
			/>

			<ProfileTabs active={activeTab} onChange={setActiveTab} />

			<div className="flex min-h-[300px] flex-col">
				{loadingFeed ? (
					[0, 1, 2].map((i) => <PostSkeleton key={i} />)
				) : visiblePosts.length === 0 ? (
					<EmptyState
						icon={emptyIcon}
						title={t(`profile.emptyTitle.${activeTab}`)}
						caption={t(emptyCaptionKey)}
					/>
				) : activeTab === "media" || activeTab === "street" ? (
					<ProfileGrid posts={visiblePosts} kind={activeTab} />
				) : (
					visiblePosts.map((post) => <PostCard key={post.id} post={post} />)
				)}
			</div>
		</div>
	);
}
