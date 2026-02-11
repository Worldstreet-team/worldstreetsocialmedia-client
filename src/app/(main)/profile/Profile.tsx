"use client";

import { useState } from "react";
import { PostCard, type PostProps } from "@/components/feed/PostCard";
import MoreIcon from "@/assets/icons/MoreIcon";
import { useAtomValue } from "jotai";
import { userAtom } from "@/store/user.atom";

const userPosts: PostProps[] = [
	{
		id: "explore-1",
		author: {
			name: "David", // Placeholder, will be updated in component
			username: "david",
			avatar:
				"https://lh3.googleusercontent.com/aida-public/AB6AXuCVh8p3iIVB6V8SmlrlYhTYWcYKtbi1qAwIQl3p699QnBtz2ery9QBZekmokbzjOXzYF5frjM8R7ARMtmQB6nxSZi64f7NerLQ7qGEcIt2yl8HmIOmElLD9vvPsDgz-rHHV64QlGEJ_EV4xpBfyYCx1qBycp3FL959LShnq007ra5467_vkjYyUqisNvZKv3m86lX1dZoj63dTuvEzUFto3QRrPkMAK8WMEZAxi0JbbFowvF9pBwhC7djdOs5EkUd44L02u8cE66tM0",
			isVerified: true,
			id: "user-1", // Added ID
		},
		timestamp: "5h",
		content: "Just deployed the new feature! 🚀 #coding #webdev",
		images: [
			"https://lh3.googleusercontent.com/aida-public/AB6AXuDd-evzsvivS30hlWWhs8NK4GS34z0MFLA5ys1E3Xi1Ze3ANPr33B0eo21EVy-ojF_5DOaAZE0B3oFNEkrr_Mg7yUw5MjBFBPl9K0FqUaqfg7kRqt7THyQOFiT-26kEOsmd3DLbSysRcKBwH-ceObCR6X9heUYmSw5DotEK-maSeeV0OdOCRtH8RLjgLjOwwYcT5GKk3JH4tOlCxbirUsuCk5Kikl9XBPwJXR8-J_VDkcTSowSNq6G-XXTq53J7jarGjNf4ml9v8hFW",
		],
		stats: {
			replies: 10,
			reposts: 5,
			likes: 45,
		},
	},
	{
		id: "explore-2",
		author: {
			name: "David",
			username: "david",
			avatar:
				"https://lh3.googleusercontent.com/aida-public/AB6AXuCVh8p3iIVB6V8SmlrlYhTYWcYKtbi1qAwIQl3p699QnBtz2ery9QBZekmokbzjOXzYF5frjM8R7ARMtmQB6nxSZi64f7NerLQ7qGEcIt2yl8HmIOmElLD9vvPsDgz-rHHV64QlGEJ_EV4xpBfyYCx1qBycp3FL959LShnq007ra5467_vkjYyUqisNvZKv3m86lX1dZoj63dTuvEzUFto3QRrPkMAK8WMEZAxi0JbbFowvF9pBwhC7djdOs5EkUd44L02u8cE66tM0",
			isVerified: true,
			id: "user-1",
		},
		timestamp: "1d",
		content: "Learning new things every day.",
		stats: {
			replies: 2,
			reposts: 1,
			likes: 20,
		},
	},
];

export default function ProfilePage() {
	const user = useAtomValue(userAtom);
	const [activeTab, setActiveTab] = useState<"posts" | "media" | "likes">(
		"posts",
	);

	if (!user) {
		return (
			<div className="flex justify-center items-center h-screen">
				Loading...
			</div>
		);
	}

	const fullName =
		user.firstName && user.lastName
			? `${user.firstName} ${user.lastName}`
			: user.username;

	// Enhance mock posts with real user data for consistent "Own Post" behavior
	const displayingPosts = userPosts.map((post) => ({
		...post,
		author: {
			...post.author,
			id: user._id,
			name: fullName,
			username: user.username,
			avatar: user.avatar,
			isVerified: user.isVerified,
		},
	}));

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
					<span className="text-[12px] text-text-light">25 Posts</span>
				</div>
			</header>

			{/* Hero Section */}
			<div className="relative">
				<div
					className="h-[200px] bg-sky-200 w-full"
					style={{
						backgroundImage:
							"linear-gradient(to right, #a18cd1 0%, #fbc2eb 100%)",
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
					className="w-9 h-9 border border-border-gray rounded-full flex items-center justify-center hover:bg-black/3 transition-colors cursor-pointer"
					type="button"
				>
					<MoreIcon />
				</button>
				<button
					className="w-9 h-9 border border-border-gray rounded-full flex items-center justify-center hover:bg-black/3 transition-colors cursor-pointer"
					type="button"
				>
					<span className="material-symbols-outlined text-[20px]">mail</span>
				</button>
				<button
					className="border border-border-gray rounded-full px-4 font-bold hover:bg-black/3 transition-colors text-[15px] cursor-pointer"
					type="button"
				>
					Edit profile
				</button>
			</div>

			{/* Profile Info */}
			<div className="px-4 mt-8 flex flex-col gap-3">
				<div>
					<h1 className="text-xl font-extrabold leading-6">{fullName}</h1>
					<div className="text-[15px] text-text-light">@{user.username}</div>
				</div>

				<div className="text-[15px]">{user.bio || "No bio yet."}</div>

				<div className="flex gap-4 text-text-light text-[15px] flex-wrap">
					{/* Location placeholder - not in atom yet */}
					<div className="flex items-center gap-1">
						<span className="material-symbols-outlined text-[18px]">
							location_on
						</span>
						<span>San Francisco, CA</span>
					</div>

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

					{/* Joined date placeholder - not in atom yet */}
					<div className="flex items-center gap-1">
						<span className="material-symbols-outlined text-[18px]">
							calendar_month
						</span>
						<span>Joined September 2018</span>
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
				{activeTab === "posts" ? (
					displayingPosts.map((post) => <PostCard key={post.id} post={post} />)
				) : (
					<div className="p-12 text-center">
						<h2 className="text-xl font-bold mb-2 wrap-break-word">
							@
							{activeTab === "likes"
								? `${user.username} haven't liked any tweets`
								: `${user.username} hasn't posted any ${activeTab} yet`}
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
