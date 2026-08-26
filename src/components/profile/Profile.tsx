"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAtom, useAtomValue } from "jotai";
import { Grid3x3, Heart, MessageCircle, Plus, Search, Video } from "lucide-react";

import { PostCard, type PostProps } from "@/components/feed/PostCard";
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
import { profileCacheAtom, userPostsCacheAtom } from "@/store/profileCache";

/** Which endpoint backs each tab. Street and Media share one media fetch. */
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
	const [profileCache, setProfileCache] = useAtom(profileCacheAtom);
	const [userPostsCache, setUserPostsCache] = useAtom(userPostsCacheAtom);

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

	useEffect(() => {
		// /profile with no username used to read the hydrated atom and stop
		// there, so your own profile rendered without counts, interests or
		// block state. Resolve the handle, then fetch like any other profile.
		const handle = username || currentUser?.username;
		if (!handle) return;

		let cancelled = false;
		const run = async () => {
			setLoadingProfile(true);

			const cached = profileCache[handle];
			if (cached) {
				setProfileUser(cached);
				setFollowersCount(cached.followersCount || 0);
				setIsFollowing(readIsFollowing(cached, currentUser));
				setLoadingProfile(false);
			}

			const result = await getProfileByUsernameAction(handle);
			if (cancelled) return;

			if (result.success) {
				setProfileUser(result.data);
				setProfileCache((prev) => ({ ...prev, [handle]: result.data }));
				setFollowersCount(result.data.followersCount || 0);
				setIsFollowing(readIsFollowing(result.data, currentUser));
			} else if (!cached) {
				setNotFound(true);
			}
			setLoadingProfile(false);
		};

		void run();
		return () => {
			cancelled = true;
		};
	}, [username, currentUser?.username]);

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
		const cacheKey = `${profileUser.userId}-${kind}`;
		const cached = userPostsCache[cacheKey];
		if (cached) {
			setFeedPosts(cached);
			return;
		}

		let cancelled = false;
		setLoadingFeed(true);
		void getUserFeedAction(profileUser.userId, kind).then((result) => {
			if (cancelled) return;
			if (result.success && Array.isArray(result.data)) {
				const mapped = result.data.map(mapPost);
				setFeedPosts(mapped);
				setUserPostsCache((prev) => ({ ...prev, [cacheKey]: mapped }));
			} else {
				setFeedPosts([]);
			}
			setLoadingFeed(false);
		});
		return () => {
			cancelled = true;
		};
	}, [profileUser?.userId, activeTab]);

	// Street and Media split one media fetch: video posts vs everything else.
	const visiblePosts = useMemo(() => {
		if (activeTab === "street") return feedPosts.filter((p) => p.videos?.length);
		if (activeTab === "media") return feedPosts.filter((p) => !p.videos?.length);
		return feedPosts;
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
		} else if (username) {
			setProfileCache((prev) => {
				const cached = prev[username];
				if (!cached) return prev;
				return {
					...prev,
					[username]: {
						...cached,
						followersCount: wasFollowing ? previousCount - 1 : previousCount + 1,
						followers: wasFollowing
							? cached.followers?.filter((id) => id !== currentUser._id)
							: [...(cached.followers || []), currentUser._id],
					},
				};
			});
		}
		setFollowLoading(false);
	}, [
		profileUser,
		currentUser,
		followLoading,
		isFollowing,
		followersCount,
		username,
		setProfileCache,
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
		if (username) {
			setProfileCache((prev) => ({
				...prev,
				[username]: { ...prev[username], isBlockedByYou: true },
			}));
		}
	}, [profileUser?._id, username, setProfileCache, toast, t]);

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
		if (username) {
			setProfileCache((prev) => ({
				...prev,
				[username]: { ...prev[username], isBlockedByYou: false },
			}));
		}
	}, [profileUser?._id, username, setProfileCache, toast, t]);

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
					caption={`@${username} isn't on WorldStreet Social. Try searching for another account.`}
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
