"use client";

import { useState, useEffect, use } from "react";
import { PostCard, type PostProps } from "@/components/feed/PostCard";
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

export default function UserProfilePage({
	params,
}: {
	params: Promise<{ username: string }>;
}) {
	const { username } = use(params);
	const router = useRouter();

	const currentUser = useAtomValue(userAtom);
	const [profileUser, setProfileUser] = useState<any>(null);
	const [loadingProfile, setLoadingProfile] = useState(true);
	const [notFound, setNotFound] = useState(false);
	const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);

	const [activeTab, setActiveTab] = useState<"posts" | "media" | "likes">(
		"posts",
	);
	const [feedPosts, setFeedPosts] = useState<PostProps[]>([]);
	const [loadingFeed, setLoadingFeed] = useState(false);

	// Follow state
	const [isFollowing, setIsFollowing] = useState(false);
	const [followersCount, setFollowersCount] = useState(0);
	const [followLoading, setFollowLoading] = useState(false);

	const isMe = currentUser?.userId === profileUser?.userId;

	// Sync profileUser with currentUser if isMe (after edit)
	useEffect(() => {
		if (isMe && currentUser) {
			setProfileUser((prev: any) => ({ ...prev, ...currentUser }));
		}
	}, [currentUser, isMe]);

	// Fetch Profile
	useEffect(() => {
		const fetchProfile = async () => {
			setLoadingProfile(true);
			const result = await getProfileByUsernameAction(username);
			if (result.success) {
				setProfileUser(result.data);
				setFollowersCount(result.data.followersCount || 0);
				// Check if current user is following
				if (currentUser && result.data.followers) {
					setIsFollowing(result.data.followers.includes(currentUser._id));
				}
			} else {
				setNotFound(true);
			}
			setLoadingProfile(false);
		};
		fetchProfile();
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
						firstName: post.author.firstName || "Unknown",
						lastName: post.author.lastName || "",
						username: post.author.username || "unknown",
						avatar:
							post.author.avatar ||
							"https://upload.wikimedia.org/wikipedia/commons/7/7c/Profile_avatar_placeholder_large.png",
						isVerified: post.author.isVerified || false,
					},
					content: post.content,
					timestamp: new Date(post.createdAt).toLocaleDateString(),
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
			// biome-ignore lint/suspicious/noImplicitAnyLet: <explanation>
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

	if (loadingProfile) {
		return (
			<div className="flex justify-center items-center h-screen">
				Loading Profile...
			</div>
		);
	}

	if (notFound || !profileUser) {
		return (
			<div className="flex justify-center items-center h-screen">
				User @{username} not found
			</div>
		);
	}

	const fullName =
		profileUser.firstName && profileUser.lastName
			? `${profileUser.firstName} ${profileUser.lastName}`
			: profileUser.username;



	return (
		<div className="flex flex-col min-h-screen">
			{isEditProfileOpen && currentUser && (
				<EditProfileModal
					user={currentUser}
					onClose={() => setIsEditProfileOpen(false)}
				/>
			)}
			<header className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-black/5 px-4 py-1 flex items-center gap-6">
				<button
					className="rounded-full w-9 h-9 hover:bg-black/10 flex items-center justify-center transition-colors cursor-pointer"
					type="button"
					onClick={() => window.history.back()}
				>
					<span className="material-symbols-outlined text-[20px]">
						arrow_back
					</span>
				</button>
				<div className="flex flex-col">
					<h1 className="text-xl font-bold leading-5">{fullName}</h1>
					<span className="text-[13px] text-text-light">
						{profileUser.postsCount || 0} Posts
					</span>
				</div>
			</header>

			{/* Hero Section */}
			<div className="relative">
				<div
					className="h-[200px] w-full bg-cover bg-center bg-no-repeat bg-gray-200"
					style={{
						backgroundImage: profileUser.banner
							? `url('${profileUser.banner}')`
							: "linear-gradient(to right, #a18cd1 0%, #fbc2eb 100%)",
					}}
				></div>
				<div className="absolute -bottom-[70px] left-4 border-4 border-white rounded-full">
					<div
						className="w-[134px] h-[134px] rounded-full bg-cover bg-center"
						style={{
							backgroundImage: `url('${profileUser.avatar || "https://upload.wikimedia.org/wikipedia/commons/7/7c/Profile_avatar_placeholder_large.png"}')`,
						}}
					></div>
				</div>
			</div>

			{/* Profile Actions */}
			<div className="flex justify-end px-4 py-3 gap-2 mt-2">
				{!isMe && (
					<button
						className="w-9 h-9 border border-border-gray rounded-full flex items-center justify-center hover:bg-black/3 transition-colors cursor-pointer"
						type="button"
						onClick={async () => {
							if (!profileUser?.userId) return;
							const res = await startConversationAction(profileUser.userId);
							if (res.success || res._id) {
								router.push(`/messages/${res._id || res.data?._id}`);
							} else {
								console.error("Failed to start conversation");
							}
						}}
					>
						<span className="material-symbols-outlined text-[20px]">mail</span>
					</button>
				)}
				{isMe ? (
					<button
						className="border border-black/20 rounded-full px-6 h-10 font-bold hover:bg-black/3 transition-colors text-[15px] cursor-pointer"
						type="button"
						onClick={() => setIsEditProfileOpen(true)}
					>
						Edit profile
					</button>
				) : (
					<button
						className={`${
							isFollowing
								? "border border-black/20 bg-white text-black hover:bg-red-50 hover:text-red-600 hover:border-red-200"
								: "bg-black text-white hover:bg-black/80"
						} rounded-full px-4 py-1.5 font-bold transition-all text-[15px] cursor-pointer min-w-[100px]`}
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
			<div className="px-4 mt-8 flex flex-col gap-3">
				<div>
					<h1 className="text-xl font-extrabold leading-6">{fullName}</h1>
					<div className="text-[15px] text-text-light">
						@{profileUser.username}
					</div>
				</div>

				<div className="text-[15px]">{profileUser.bio || "No bio yet."}</div>

				<div className="flex gap-4 text-text-light text-[15px] flex-wrap mt-2">
					{profileUser.location && (
						<div className="flex items-center gap-1">
							<span className="material-symbols-outlined text-[18px]">
								location_on
							</span>
							<span>{profileUser.location}</span>
						</div>
					)}
					{profileUser.website && (
						<div className="flex items-center gap-1">
							<span className="material-symbols-outlined text-[18px]">
								link
							</span>
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
						<span className="material-symbols-outlined text-[18px]">
							calendar_month
						</span>
						<span>Joined {new Date(profileUser.createdAt || Date.now()).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
					</div>
				</div>

				<div className="flex gap-5 text-[15px]">
					<div className="hover:underline cursor-pointer">
						<span className="font-bold text-black">
							{profileUser.followingCount}
						</span>{" "}
						<span className="text-text-light">Following</span>
					</div>
					<div className="hover:underline cursor-pointer">
						<span className="font-bold text-black">{followersCount}</span>{" "}
						<span className="text-text-light">Followers</span>
					</div>
				</div>
			</div>

			{/* Tabs */}
			<div className="flex mt-4 border-b border-black/10 overflow-x-auto">
				{["posts", "media", "likes"].map((tab) => (
					<button
						key={tab}
						onClick={() => setActiveTab(tab as typeof activeTab)}
						className="flex-1 min-w-fit px-4 py-4 hover:bg-hover-gray transition-colors relative cursor-pointer"
						type="button"
					>
						<span
							className={`text-[15px] capitalize whitespace-nowrap ${activeTab === tab ? "font-bold" : "font-medium text-text-light"}`}
						>
							{tab}
						</span>
						{activeTab === tab && (
							<div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-14 h-1 bg-primary rounded-full" />
						)}
					</button>
				))}
			</div>

			{/* Content Feed */}
			<div className="flex flex-col">
				{loadingFeed ? (
					<div className="p-8 text-center text-text-light">Loading feed...</div>
				) : feedPosts.length > 0 ? (
					feedPosts.map((post) => <PostCard key={post.id} post={post} />)
				) : (
					<div className="p-12 text-center">
						<h2 className="text-xl font-bold mb-2 wrap-break-word">
							@
							{activeTab === "likes"
								? `${profileUser.username} hasn't liked any posts`
								: `${profileUser.username} hasn't posted any ${activeTab} yet`}
						</h2>
						<p className="text-text-light text-sm tracking-tight">
							When they do, they will show up here.
						</p>
					</div>
				)}
			</div>
		</div>
	);
}
