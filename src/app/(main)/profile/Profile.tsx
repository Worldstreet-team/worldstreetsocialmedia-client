"use client";

import { useState, useEffect } from "react";
import { PostCard, type PostProps } from "@/components/feed/PostCard";
import { useAtomValue } from "jotai";
import { userAtom } from "@/store/user.atom";
import { getUserFeedAction } from "@/lib/feed.actions";
import EditProfileModal from "@/components/profile/EditProfileModal";

export default function ProfilePage() {
	const user = useAtomValue(userAtom);
	const [activeTab, setActiveTab] = useState<"posts" | "media" | "likes">(
		"posts",
	);
	const [feedPosts, setFeedPosts] = useState<PostProps[]>([]);
	const [loadingFeed, setLoadingFeed] = useState(false);
	const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);

	const fullName = user
		? user.firstName && user.lastName
			? `${user.firstName} ${user.lastName}`
			: user.username
		: "";

	useEffect(() => {
		const fetchFeed = async () => {
			if (!user?._id) return;
			setLoadingFeed(true);
			const result = await getUserFeedAction(user._id, activeTab);

			console.log("RESULT: ", result);

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
	}, [user?._id, activeTab]);

	if (!user) {
		return (
			<div className="flex justify-center items-center h-screen">
				Loading...
			</div>
		);
	}

	return (
		<div className="flex flex-col min-h-screen">
			<header className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-black/5 px-4 py-3 flex items-center gap-6">
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
					<h1 className="text-lg font-bold leading-5">{fullName}</h1>
					<span className="text-[12px] text-text-light">
						{user.postsCount || 0} Posts
					</span>
				</div>
			</header>

			{/* Hero Section */}
			<div className="relative">
				<div
					className="h-[200px] w-full bg-cover bg-center bg-no-repeat bg-gray-200"
					style={{
						backgroundImage: user.banner
							? `url('${user.banner}')`
							: "linear-gradient(to right, #a18cd1 0%, #fbc2eb 100%)",
					}}
				></div>
				<div className="absolute -bottom-[70px] left-4 border-4 border-white rounded-full">
					<div
						className="w-[134px] h-[134px] rounded-full bg-cover bg-center"
						style={{
							backgroundImage: `url('${user.avatar}')`,
						}}
					></div>
				</div>
			</div>

			{/* Profile Actions */}
			<div className="flex justify-end px-4 py-3 gap-2 mt-2">
				<button
					className="border border-black/20 rounded-full px-6 h-10  font-bold hover:bg-black/3 transition-colors text-[15px] cursor-pointer"
					type="button"
					onClick={() => setIsEditProfileOpen(true)}
				>
					Edit profile
				</button>
			</div>

			{isEditProfileOpen && user && (
				<EditProfileModal
					user={user}
					onClose={() => setIsEditProfileOpen(false)}
				/>
			)}

			{/* Profile Info */}
			<div className="px-4 mt-8 flex flex-col gap-3">
				<div>
					<h1 className="text-xl font-extrabold leading-6">{fullName}</h1>
					<div className="text-[15px] text-text-light">@{user.username}</div>
				</div>

				<div className="text-[15px]">{user.bio || "No bio yet."}</div>

				<div className="flex gap-4 text-text-light text-[15px] flex-wrap">
					{user.location && (
						<div className="flex items-center gap-1">
							<span className="material-symbols-outlined text-[18px]">
								location_on
							</span>
							<span>{user.location}</span>
						</div>
					)}

					{user.website && (
						<div className="flex items-center gap-1">
							<span className="material-symbols-outlined text-[18px]">
								link
							</span>
							<a
								href={
									user.website.startsWith("http")
										? user.website
										: `https://${user.website}`
								}
								className="text-primary hover:underline"
								target="_blank"
								rel="noopener noreferrer"
							>
								{user.website.replace(/^https?:\/\//, "")}
							</a>
						</div>
					)}

					<div className="flex items-center gap-1">
						<span className="material-symbols-outlined text-[18px]">
							calendar_month
						</span>
						<span>
							Joined{" "}
							{new Date(user.createdAt || Date.now()).toLocaleDateString(
								"en-US",
								{ month: "long", year: "numeric" },
							)}
						</span>
					</div>
				</div>

				<div className="flex gap-5 text-[15px]">
					<div className="hover:underline cursor-pointer">
						<span className="font-bold text-black">{user.followingCount}</span>{" "}
						<span className="text-text-light">Following</span>
					</div>
					<div className="hover:underline cursor-pointer">
						<span className="font-bold text-black">{user.followersCount}</span>{" "}
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
							you
							{activeTab === "likes"
								? ` haven't liked any items`
								: ` haven't made any ${activeTab} yet`}
						</h2>
						<p className="text-text-light text-sm tracking-tight">
							When you do, they will show up here.
						</p>
					</div>
				)}
			</div>
		</div>
	);
}
