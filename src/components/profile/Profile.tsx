"use client";

import { useState, useEffect } from "react";
import { PostCard, type PostProps } from "@/components/feed/PostCard";
import { ProfileSkeleton } from "@/components/skeletons/ProfileSkeleton";
import { PostSkeleton } from "@/components/feed/PostSkeleton";
import {
	getProfileByUsernameAction,
	followUserAction,
	unfollowUserAction,
} from "@/lib/user.actions";
import { getUserFeedAction } from "@/lib/feed.actions";
import { useAtomValue } from "jotai";
import { userAtom } from "@/store/user.atom";
import { useRouter } from "next/navigation";
import { startConversationAction } from "@/lib/conversation.actions";
import EditProfileModal from "@/components/profile/EditProfileModal";
import FollowsModal from "@/components/profile/FollowsModal";
import VerifiedIcon from "@/assets/icons/VerifiedIcon";
import {
	ArrowLeft,
	MapPin,
	Link as LinkIcon,
	Calendar,
	Mail,
} from "lucide-react";
import clsx from "clsx";

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
	const [loadingProfile, setLoadingProfile] = useState(true);
	const [notFound, setNotFound] = useState(false);

	const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
	const [isFollowsModalOpen, setIsFollowsModalOpen] = useState(false);
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
				// If currentUser is null (not loaded yet), we wait.
				// But usually if protected route, it should be there.
				// If not logged in, middleware handles it?
			} else {
				// /profile/[username] route
				const result = await getProfileByUsernameAction(username);
				if (result.success) {
					console.log("Fetched Profile Data:", result.data);
					setProfileUser(result.data);
					setFollowersCount(result.data.followersCount || 0);
					// Check if current user is following
					if (currentUser && result.data.followers) {
						setIsFollowing(result.data.followers.includes(currentUser._id));
					}
				} else {
					setNotFound(true);
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
						avatar:
							post.author.avatar ||
							"https://upload.wikimedia.org/wikipedia/commons/7/7c/Profile_avatar_placeholder_large.png",
						isVerified: post.author.isVerified || false,
					},
					content: post.content,
					timestamp: new Date(post.createdAt).toLocaleDateString(), // Use short format if needed
					images: post.images,
					stats: post.stats || { replies: 0, reposts: 0, likes: 0 },
					isLiked: post.isLiked,
					isBookmarked: post.isBookmarked,
				}));
				setFeedPosts(mappedPosts);
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
			}
		} catch (error) {
			setIsFollowing(previousIsFollowing);
			setFollowersCount(previousCount);
			console.error(error);
		} finally {
			setFollowLoading(false);
		}
	};

	if (loadingProfile && !profileUser) {
		return <ProfileSkeleton />;
	}

	if (notFound) {
		return (
			<div className="flex flex-col justify-center items-center h-[50vh] text-zinc-500 font-space-mono">
				<h2 className="text-xl font-bold mb-2 text-white">User not found</h2>
				<p>@{username}</p>
				<button
					onClick={() => router.back()}
					className="mt-4 text-sm underline hover:text-white"
				>
					Go back
				</button>
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

			<header className="sticky top-0 z-20 bg-black/80 backdrop-blur-md border-b border-zinc-800 px-4 py-2 flex items-center gap-6">
				<button
					className="rounded-full w-9 h-9 hover:bg-zinc-800 flex items-center justify-center transition-colors cursor-pointer text-white"
					type="button"
					onClick={() => router.back()}
				>
					<ArrowLeft className="w-5 h-5" />
				</button>
				<div className="flex flex-col">
					<h1 className="text-lg font-bold leading-5 flex items-center gap-1 font-space-mono text-white">
						{fullName}
						{profileUser.isVerified && <VerifiedIcon color="blue" />}
					</h1>
					<span className="text-xs text-zinc-500 font-space-mono">
						{profileUser.postsCount || 0} Posts
					</span>
				</div>
			</header>

			{/* Hero Section */}
			<div className="relative">
				<div
					className="h-[150px] sm:h-[200px] w-full bg-cover bg-center bg-no-repeat bg-zinc-800"
					style={{
						backgroundImage: profileUser.banner
							? `url('${profileUser.banner}')`
							: "linear-gradient(to right, #18181b 0%, #27272a 100%)",
					}}
				/>
				<div className="absolute -bottom-[50px] sm:-bottom-[67px] left-4 border-4 border-black rounded-full bg-black">
					<div
						className="w-[100px] h-[100px] sm:w-[134px] sm:h-[134px] rounded-full bg-cover bg-center border border-zinc-800"
						style={{
							backgroundImage: `url('${profileUser.avatar || "https://upload.wikimedia.org/wikipedia/commons/7/7c/Profile_avatar_placeholder_large.png"}')`,
						}}
					/>
				</div>
			</div>

			{/* Profile Actions */}
			<div className="flex justify-end px-4 py-3 gap-2 mt-2 min-h-[50px]">
				{!isMe && (
					<button
						className="w-9 h-9 border border-zinc-700 rounded-full flex items-center justify-center hover:bg-zinc-800 transition-colors cursor-pointer"
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
						<Mail className="w-5 h-5 text-zinc-400" />
					</button>
				)}
				{isMe ? (
					<button
						className="border border-zinc-700 bg-black text-white rounded-full px-5 h-9 font-bold hover:bg-zinc-900 transition-colors text-sm cursor-pointer font-space-mono shadow-[2px_2px_0px_0px_rgba(255,255,255,0.2)] active:translate-x-px active:translate-y-px active:shadow-none"
						type="button"
						onClick={() => setIsEditProfileOpen(true)}
					>
						Edit profile
					</button>
				) : (
					<button
						className={clsx(
							"rounded-full px-5 py-1.5 font-bold transition-all text-sm cursor-pointer min-w-[100px] font-space-mono shadow-[2px_2px_0px_0px_rgba(255,255,255,0.2)] active:translate-x-px active:translate-y-px active:shadow-none border border-zinc-700",
							isFollowing
								? "bg-transparent text-white hover:border-red-600 hover:text-red-500"
								: "bg-white text-black hover:bg-zinc-200",
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
					<h1 className="text-xl sm:text-2xl font-black leading-6 font-space-mono flex items-center gap-1 text-white">
						{fullName}
						{profileUser.isVerified && <VerifiedIcon color="blue" />}
					</h1>
					<div className="text-sm text-zinc-500 font-space-mono">
						@{profileUser.username}
					</div>
				</div>

				<div className="text-[15px] text-zinc-300 leading-relaxed font-sans">
					{profileUser.bio || (
						<span className="text-zinc-500 italic">No bio yet.</span>
					)}
				</div>

				<div className="flex gap-x-4 gap-y-2 text-zinc-500 text-[14px] flex-wrap mt-1 font-space-mono">
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
								className="text-primary hover:underline"
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

				<div className="flex gap-5 text-[15px] mt-1 font-space-mono">
					<button
						type="button"
						className="hover:underline cursor-pointer bg-transparent border-none p-0 flex gap-1 items-baseline"
						onClick={() => {
							setFollowsInitialTab("following");
							setIsFollowsModalOpen(true);
						}}
					>
						<span className="font-bold text-white">
							{profileUser.followingCount || 0}
						</span>{" "}
						<span className="text-zinc-500">Following</span>
					</button>
					<button
						type="button"
						className="hover:underline cursor-pointer bg-transparent border-none p-0 flex gap-1 items-baseline"
						onClick={() => {
							setFollowsInitialTab("followers");
							setIsFollowsModalOpen(true);
						}}
					>
						<span className="font-bold text-white">{followersCount}</span>{" "}
						<span className="text-zinc-500">Followers</span>
					</button>
				</div>
			</div>

			{/* Tabs */}
			<div className="flex mt-6 border-b border-zinc-800 overflow-x-auto no-scrollbar">
				{["posts", "media", "likes"].map((tab) => (
					<button
						key={tab}
						onClick={() => setActiveTab(tab as typeof activeTab)}
						className="flex-1 min-w-fit px-4 py-3 hover:bg-zinc-900 transition-colors relative cursor-pointer font-space-mono text-sm uppercase tracking-wide"
						type="button"
					>
						<span
							className={clsx(
								activeTab === tab
									? "font-bold text-white"
									: "font-medium text-zinc-500",
							)}
						>
							{tab}
						</span>
						{activeTab === tab && (
							<div className="absolute bottom-0 left-0 right-0 h-[2px] bg-white" />
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
					<div className="p-12 text-center flex flex-col items-center justify-center text-zinc-500 font-space-mono">
						<h2 className="text-lg font-bold mb-2 wrap-break-word text-white">
							{isMe ? "You" : `@${profileUser.username}`}
							{activeTab === "likes"
								? ` haven't liked any posts`
								: ` haven't posted any ${activeTab} yet`}
						</h2>
						<p className="text-sm tracking-tight text-zinc-500">
							When {isMe ? "you" : "they"} do, they will show up here.
						</p>
					</div>
				)}
			</div>
		</div>
	);
}
