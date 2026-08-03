"use client";

import { formatTimeAgo } from "@/lib/utils";

import { useState, useEffect } from "react";
import { PostCard, type PostProps } from "@/components/feed/PostCard";
import { ProfileSkeleton } from "@/components/skeletons/ProfileSkeleton";
import { PostSkeleton } from "@/components/feed/PostSkeleton";
import {
	getProfileByUsernameAction,
	followUserAction,
	unfollowUserAction,
	blockUserAction,
	unblockUserAction,
} from "@/lib/user.actions";
import ConfirmModal from "@/components/ui/ConfirmModal";
import { toast } from "sonner";
import { getUserFeedAction } from "@/lib/feed.actions";
import { useAtomValue } from "jotai";
import { userAtom } from "@/store/user.atom";
import { useRouter } from "next/navigation";
import { startConversationAction } from "@/lib/conversation.actions";
import EditProfileModal from "@/components/profile/EditProfileModal";
import FollowsModal from "@/components/profile/FollowsModal";
import VerifiedIcon from "@/assets/icons/VerifiedIcon";
import { DEFAULT_AVATAR } from "@/const";
import {
	ArrowLeft,
	MapPin,
	Link as LinkIcon,
	Calendar,
	Grid3x3,
	Heart,
	Mail,
	MoreHorizontal,
	Plus,
	Search,
} from "lucide-react";
import { motion } from "framer-motion";
import { EmptyState } from "@/components/ui/EmptyState";
import clsx from "clsx";
import { useAtom } from "jotai";
import {
	profileCacheAtom,
	userPostsCacheAtom,
	ProfileData,
} from "@/store/profileCache";

interface ProfileProps {
	username?: string;
}

export default function Profile({ username }: ProfileProps) {
	const router = useRouter();
	const currentUser = useAtomValue(userAtom);

	// If no username provided, we assume it's "Me" (current user's profile)
	// But we still track "profileUser" separately to handle the case where
	// we view our own profile via /profile/[myUsername]
	const [profileUser, setProfileUser] = useState<any>(null);
	const [profileCache, setProfileCache] = useAtom(profileCacheAtom);
	const [userPostsCache, setUserPostsCache] = useAtom(userPostsCacheAtom);

	const [loadingProfile, setLoadingProfile] = useState(true);
	const [notFound, setNotFound] = useState(false);

	const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
	const [isFollowsModalOpen, setIsFollowsModalOpen] = useState(false);
	const [isBlockModalOpen, setIsBlockModalOpen] = useState(false);
	const [showMoreMenu, setShowMoreMenu] = useState(false);
	const [followsInitialTab, setFollowsInitialTab] = useState<
		"followers" | "following"
	>("followers");

	const [activeTab, setActiveTab] = useState<"posts" | "media" | "likes">(
		"posts",
	);
	const [feedPosts, setFeedPosts] = useState<PostProps[]>([]);
	const [loadingFeed, setLoadingFeed] = useState(false);

	// Follow state
	const [isFollowing, setIsFollowing] = useState(false);
	const [followersCount, setFollowersCount] = useState(0);
	const [followLoading, setFollowLoading] = useState(false);

	// Determine if we are viewing our own profile
	const isMe =
		!username ||
		(currentUser && profileUser && currentUser.userId === profileUser.userId);

	// Sync profileUser with currentUser if isMe (after edit)
	useEffect(() => {
		if (isMe && currentUser) {
			// If we are on /profile (no username) or /profile/[myUsername],
			// keep profileUser in sync with currentUser atom (which updates after edit)
			setProfileUser((prev: any) => ({ ...prev, ...currentUser }));
		}
	}, [currentUser, isMe]);

	// Fetch Profile
	useEffect(() => {
		const fetchProfile = async () => {
			setLoadingProfile(true);

			if (!username) {
				// /profile route -> view current user
				if (currentUser) {
					setProfileUser(currentUser);
					setFollowersCount(currentUser.followersCount || 0);
				}
			} else {
				// Check Cache First
				if (profileCache[username]) {
					const cached = profileCache[username];
					setProfileUser(cached);
					setFollowersCount(cached.followersCount || 0);
					if (currentUser && cached.followers) {
						setIsFollowing(cached.followers.includes(currentUser._id));
					}
					setLoadingProfile(false);
					// return; // Optional: return here to skip fetch completely, or fetch in background
				}

				// /profile/[username] route
				const result = await getProfileByUsernameAction(username);
				if (result.success) {
					setProfileUser(result.data);
					setProfileCache((prev) => ({
						...prev,
						[username]: result.data,
					}));
					setFollowersCount(result.data.followersCount || 0);
					// Check if current user is following
					if (currentUser && result.data.followers) {
						setIsFollowing(result.data.followers.includes(currentUser._id));
					}
				} else {
					if (!profileCache[username]) setNotFound(true);
				}
			}
			setLoadingProfile(false);
		};

		if (currentUser || username) {
			fetchProfile();
		}
	}, [username, currentUser]);

	// Fetch Feed (Only if profile fetching succeeded)
	useEffect(() => {
		if (!profileUser?.userId) return;

		const fetchFeed = async () => {
			const cacheKey = `${profileUser.userId}-${activeTab}`;
			if (userPostsCache[cacheKey]) {
				setFeedPosts(userPostsCache[cacheKey]);
				return;
			}

			setLoadingFeed(true);
			const result = await getUserFeedAction(profileUser.userId, activeTab);

			if (result.success && Array.isArray(result.data)) {
				const mappedPosts: PostProps[] = result.data.map((post: any) => ({
					id: post._id,
					author: {
						id: post.author._id || post.author,
						name:
							post.author.firstName && post.author.lastName
								? `${post.author.firstName} ${post.author.lastName}`
								: post.author.username || "Unknown",
						username: post.author.username || "unknown",
						avatar: post.author.avatar || DEFAULT_AVATAR,
						isVerified: post.author.isVerified || false,
					},
					content: post.content,
					timestamp: formatTimeAgo(post.createdAt),
					images: post.images,
					stats: post.stats || { replies: 0, reposts: 0, likes: 0 },
					isLiked: post.isLiked,
					isBookmarked: post.isBookmarked,
				}));
				setFeedPosts(mappedPosts);
				setUserPostsCache((prev) => ({
					...prev,
					[cacheKey]: mappedPosts,
				}));
			} else {
				setFeedPosts([]);
			}
			setLoadingFeed(false);
		};

		fetchFeed();
	}, [profileUser?.userId, activeTab]);

	const handleFollowToggle = async () => {
		if (!profileUser || !currentUser || followLoading) return;

		// Optimistic update
		const previousIsFollowing = isFollowing;
		const previousCount = followersCount;

		setIsFollowing(!isFollowing);
		setFollowersCount((prev) => (isFollowing ? prev - 1 : prev + 1));
		setFollowLoading(true);

		try {
			let res;
			if (previousIsFollowing) {
				res = await unfollowUserAction(profileUser._id);
			} else {
				res = await followUserAction(profileUser._id);
			}

			if (!res.success) {
				// Revert on failure
				setIsFollowing(previousIsFollowing);
				setFollowersCount(previousCount);
				console.error(res.message);
			} else {
				// Update Cache on success
				if (username) {
					setProfileCache((prev) => {
						const cached = prev[username];
						if (!cached) return prev;
						// Update followers logic in cache if needed, broadly updating count
						return {
							...prev,
							[username]: {
								...cached,
								followersCount: isFollowing
									? previousCount - 1
									: previousCount + 1,
								followers: isFollowing
									? cached.followers?.filter((id) => id !== currentUser._id)
									: [...(cached.followers || []), currentUser._id],
							},
						};
					});
				}
			}
		} catch (error) {
			setIsFollowing(previousIsFollowing);
			setFollowersCount(previousCount);
			console.error(error);
		} finally {
			setFollowLoading(false);
		}
	};

	const handleBlockUser = async () => {
		if (!profileUser?.userId) return;
		const res = await blockUserAction(profileUser.userId);
		if (res.success) {
			toast.success("User blocked");
			router.push("/");
		} else {
			toast.error(res.message);
		}
	};

	const handleUnblockUser = async () => {
		if (!profileUser?.userId) return;
		const res = await unblockUserAction(profileUser.userId);
		if (res.success) {
			toast.success("User unblocked");
			// Refresh profile data manually
			setProfileUser((prev: any) => ({ ...prev, isBlockedByYou: false }));
			// Also update cache
			if (username) {
				setProfileCache((prev) => ({
					...prev,
					[username]: { ...prev[username], isBlockedByYou: false },
				}));
			}
		} else {
			toast.error(res.message);
		}
	};

	if (loadingProfile && !profileUser) {
		return <ProfileSkeleton />;
	}

	if (notFound) {
		return (
			<div className="flex flex-col justify-center items-center min-h-[60vh]">
				<EmptyState
					icon={Search}
					title="This account doesn't exist"
					caption={`@${username} isn't on WorldStreet Social. Try searching for another account.`}
					action={{ label: "Go back", onClick: () => router.back() }}
				/>
			</div>
		);
	}

	if (!profileUser) return null; // Should ideally show loading or error

	const fullName =
		profileUser.firstName && profileUser.lastName
			? `${profileUser.firstName} ${profileUser.lastName}`
			: profileUser.username;

	return (
		<div className="flex flex-col min-h-screen pb-20">
			{isEditProfileOpen && currentUser && (
				<EditProfileModal
					user={currentUser}
					onClose={() => setIsEditProfileOpen(false)}
				/>
			)}

			<header className="sticky top-0 z-sticky bg-page border-b border-hairline px-4 py-2 flex items-center gap-6">
				<button
					className="rounded-full w-9 h-9 hover:bg-raised flex items-center justify-center transition-colors cursor-pointer text-primary"
					type="button"
					onClick={() => router.back()}
				>
					<ArrowLeft className="w-5 h-5" />
				</button>
				<div className="flex flex-col">
					<h1 className="text-lg font-bold leading-5 flex items-center gap-1 font-sans text-primary">
						{fullName}
						{profileUser.isVerified && <VerifiedIcon />}
					</h1>
					<span className="text-xs text-muted font-sans tabular-nums">
						{(profileUser.postsCount || 0).toLocaleString("en-NG")}{" "}
						{profileUser.postsCount === 1 ? "Post" : "Posts"}
					</span>
				</div>
			</header>

			{/* Hero Section */}
			<div className="relative">
				<div
					className="relative h-[150px] sm:h-[200px] w-full bg-cover bg-center bg-no-repeat bg-sunken"
					style={
						profileUser.banner
							? { backgroundImage: `url('${profileUser.banner}')` }
							: undefined
					}
				>
					{/* No banner: quiet sunken band with a faint centered brand
					    mark — imagery rules ban gradient placeholder surfaces. */}
					{!profileUser.banner && (
						<img
							src="/images/logo.png"
							alt=""
							aria-hidden="true"
							className="absolute left-1/2 top-1/2 w-12 -translate-x-1/2 -translate-y-1/2 opacity-[0.08] pointer-events-none select-none"
						/>
					)}
				</div>
				<div className="absolute -bottom-[50px] sm:-bottom-[67px] left-4 border-4 border-page rounded-full bg-page">
					<div
						className="w-[100px] h-[100px] sm:w-[134px] sm:h-[134px] rounded-full bg-cover bg-center border border-hairline"
						style={{
							backgroundImage: `url('${profileUser.avatar || DEFAULT_AVATAR}')`,
						}}
					/>
				</div>
			</div>

			{/* Blocked Status Banners */}
			{profileUser.isBlockedByYou && (
				<div className="mx-4 mt-2 p-3 bg-danger/10 border border-danger/20 rounded-xl flex items-center justify-between">
					<span className="text-danger text-sm font-semibold font-sans">
						You blocked this user.
					</span>
					<button
						onClick={handleUnblockUser}
						className="text-primary text-xs bg-danger hover:opacity-90 px-3 py-1.5 rounded-md font-semibold transition-colors cursor-pointer"
					>
						Unblock
					</button>
				</div>
			)}

			{profileUser.isBlockedByThem && (
				<div className="mx-4 mt-2 p-3 bg-surface border border-hairline rounded-xl">
					<span className="text-muted text-sm font-semibold font-sans">
						You have been blocked by this user.
					</span>
				</div>
			)}

			{/* Profile Actions */}
			<div className="flex justify-end px-4 py-3 gap-2 mt-2 min-h-[50px]">
				{!isMe &&
					!profileUser.isBlockedByThem &&
					!profileUser.isBlockedByYou && (
						<button
							className="w-10 h-10 border border-hairline rounded-pill flex items-center justify-center hover:bg-raised transition-colors cursor-pointer"
							type="button"
							onClick={async () => {
								if (!profileUser?.userId) return;
								// Implement start conversation
								const res = await startConversationAction(profileUser.userId);
								if (res.success || res._id) {
									router.push(`/messages/${res._id || res.data?._id}`);
								} else {
									console.error("Failed to start conversation");
								}
							}}
						>
							<Mail className="w-[18px] h-[18px] text-muted" />
						</button>
					)}
				{!isMe &&
					!profileUser.isBlockedByThem &&
					!profileUser.isBlockedByYou && (
						<div className="relative">
							<button
								className="w-10 h-10 border border-hairline rounded-pill flex items-center justify-center hover:bg-raised transition-colors cursor-pointer text-primary"
								type="button"
								onClick={() => setShowMoreMenu(!showMoreMenu)}
							>
								<MoreHorizontal className="w-[18px] h-[18px] text-muted" />
							</button>
							{showMoreMenu && (
								<div className="absolute top-full right-0 mt-2 w-[220px] bg-surface border border-hairline rounded-lg shadow-nav overflow-hidden z-dropdown flex flex-col py-1.5">
									<button
										className="w-full text-left px-3.5 py-2.5 text-danger hover:bg-raised text-sm font-medium font-sans transition-colors cursor-pointer"
										onClick={() => {
											setShowMoreMenu(false);
											setIsBlockModalOpen(true);
										}}
									>
										Block @{profileUser.username}
									</button>
								</div>
							)}
						</div>
					)}
				{isMe ? (
					<button
						className="border border-hairline text-primary rounded-pill px-5 h-9 font-semibold hover:bg-raised transition-colors text-sm cursor-pointer font-sans"
						type="button"
						onClick={() => setIsEditProfileOpen(true)}
					>
						Edit profile
					</button>
				) : profileUser.isBlockedByYou ? (
					<button
						className="rounded-pill px-5 h-9 font-semibold transition-colors text-sm cursor-pointer min-w-[100px] font-sans bg-danger text-primary hover:opacity-90"
						type="button"
						onClick={handleUnblockUser}
					>
						Unblock
					</button>
				) : profileUser.isBlockedByThem ? (
					<button
						className="rounded-pill px-5 h-9 font-semibold transition-colors text-sm cursor-not-allowed min-w-[100px] font-sans border border-hairline bg-raised text-subtle"
						type="button"
						disabled
					>
						Blocked
					</button>
				) : (
					<button
						className={clsx(
							"rounded-pill px-5 h-9 font-semibold transition-colors text-sm cursor-pointer min-w-[100px] font-sans",
							isFollowing
								? "border border-hairline bg-transparent text-primary hover:border-danger hover:text-danger"
								: "bg-primary text-page hover:bg-muted",
						)}
						type="button"
						onClick={handleFollowToggle}
						disabled={followLoading}
						onMouseEnter={(e) => {
							if (isFollowing) e.currentTarget.textContent = "Unfollow";
						}}
						onMouseLeave={(e) => {
							if (isFollowing) e.currentTarget.textContent = "Following";
						}}
					>
						{isFollowing ? "Following" : "Follow"}
					</button>
				)}
			</div>

			{/* Profile Info */}
			<div className="px-4 mt-6 flex flex-col gap-3">
				<div>
					<h1 className="font-display text-xl font-semibold leading-6 flex items-center gap-1.5 text-primary">
						{fullName}
						{profileUser.isVerified && <VerifiedIcon />}
					</h1>
					<div className="text-sm text-muted font-sans">
						@{profileUser.username}
					</div>
				</div>

				<div className="text-[15px] text-primary leading-relaxed font-sans">
					{profileUser.bio || (
						<span className="text-subtle">No bio yet.</span>
					)}
				</div>

				<div className="flex gap-x-4 gap-y-2 text-muted text-[14px] flex-wrap mt-1 font-sans">
					{profileUser.location && (
						<div className="flex items-center gap-1">
							<MapPin className="w-4 h-4" />
							<span>{profileUser.location}</span>
						</div>
					)}

					{profileUser.website && (
						<div className="flex items-center gap-1">
							<LinkIcon className="w-4 h-4" />
							<a
								href={
									profileUser.website.startsWith("http")
										? profileUser.website
										: `https://${profileUser.website}`
								}
								className="text-gold hover:underline"
								target="_blank"
								rel="noopener noreferrer"
							>
								{profileUser.website.replace(/^https?:\/\//, "")}
							</a>
						</div>
					)}

					<div className="flex items-center gap-1">
						<Calendar className="w-4 h-4" />
						<span>
							Joined{" "}
							{new Date(profileUser.createdAt || Date.now()).toLocaleDateString(
								"en-US",
								{ month: "long", year: "numeric" },
							)}
						</span>
					</div>
				</div>

				{profileUser && (
					<FollowsModal
						isOpen={isFollowsModalOpen}
						onClose={() => setIsFollowsModalOpen(false)}
						userId={profileUser.userId || profileUser._id}
						initialTab={followsInitialTab}
					/>
				)}

				<ConfirmModal
					isOpen={isBlockModalOpen}
					onClose={() => setIsBlockModalOpen(false)}
					onConfirm={handleBlockUser}
					title={`Block @${profileUser.username}?`}
					message="They will not be able to message you or see your posts. This action cannot be easily undone."
					confirmText="Block"
					isDestructive={true}
				/>

				<div className="flex gap-5 text-[15px] mt-1 font-sans">
					<button
						type="button"
						className="hover:underline cursor-pointer bg-transparent border-none p-0 flex gap-1 items-baseline"
						onClick={() => {
							setFollowsInitialTab("following");
							setIsFollowsModalOpen(true);
						}}
					>
						<span className="font-semibold text-primary tabular-nums">
							{(profileUser.followingCount || 0).toLocaleString("en-NG")}
						</span>{" "}
						<span className="text-muted">Following</span>
					</button>
					<button
						type="button"
						className="hover:underline cursor-pointer bg-transparent border-none p-0 flex gap-1 items-baseline"
						onClick={() => {
							setFollowsInitialTab("followers");
							setIsFollowsModalOpen(true);
						}}
					>
						<span className="font-semibold text-primary tabular-nums">
							{followersCount.toLocaleString("en-NG")}
						</span>{" "}
						<span className="text-muted">Followers</span>
					</button>
				</div>
			</div>

			{/* Tabs */}
			<div
				role="tablist"
				aria-label="Profile content"
				className="flex mt-6 border-b border-hairline overflow-x-auto no-scrollbar"
			>
				{(["posts", "media", "likes"] as const).map((tab) => (
					<button
						key={tab}
						role="tab"
						aria-selected={activeTab === tab}
						onClick={() => setActiveTab(tab)}
						className={clsx(
							"flex-1 min-w-fit h-12 flex items-center justify-center hover:bg-raised/40 transition-colors relative cursor-pointer font-sans text-sm capitalize",
							activeTab === tab
								? "font-semibold text-primary"
								: "font-medium text-muted hover:text-primary",
						)}
						type="button"
					>
						{tab}
						{activeTab === tab && (
							<motion.span
								layoutId="profile-tab-underline"
								transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
								className="absolute bottom-0 h-0.5 w-14 rounded-pill bg-brand"
							/>
						)}
					</button>
				))}
			</div>

			{/* Content Feed */}
			<div className="flex flex-col min-h-[300px]">
				{loadingFeed ? (
					<div className="flex flex-col">
						{[...Array(3)].map((_, i) => (
							<PostSkeleton key={i} />
						))}
					</div>
				) : feedPosts.length > 0 ? (
					feedPosts.map((post) => <PostCard key={post.id} post={post} />)
				) : (
					<div className="py-10">
						<EmptyState
							icon={
								activeTab === "likes"
									? Heart
									: activeTab === "media"
										? Grid3x3
										: Plus
							}
							title={
								activeTab === "likes"
									? "No likes yet"
									: activeTab === "media"
										? "No media yet"
										: "No posts yet"
							}
							caption={
								isMe
									? activeTab === "posts"
										? "Your posts land here. Share what's moving today."
										: activeTab === "likes"
											? "Posts you like show up here."
											: "Posts with photos or video show up here."
									: `When @${profileUser.username} posts, it shows up here.`
							}
						/>
					</div>
				)}
			</div>
		</div>
	);
}
