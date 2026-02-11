"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getFollowersAction, getFollowingAction } from "@/lib/user.actions";
import { Skeleton } from "@/components/ui/Skeleton";
import Link from "next/link";
import VerifiedIcon from "@/assets/icons/VerifiedIcon";
import { useAtomValue } from "jotai";
import { userAtom } from "@/store/user.atom";
import { followUserAction, unfollowUserAction } from "@/lib/user.actions";

interface FollowsModalProps {
	isOpen: boolean;
	onClose: () => void;
	userId: string;
	initialTab: "followers" | "following";
}

interface UserItem {
	_id: string;
	userId: string;
	username: string;
	firstName: string;
	lastName: string;
	avatar: string;
	bio: string;
	isVerified: boolean;
	isFollowing: boolean; // Computed from backend
}

export default function FollowsModal({
	isOpen,
	onClose,
	userId,
	initialTab,
}: FollowsModalProps) {
	const [activeTab, setActiveTab] = useStateAndSync(initialTab);
	const [loading, setLoading] = useState(true);
	const [users, setUsers] = useState<UserItem[]>([]);
	const currentUser = useAtomValue(userAtom);

	// Sync internal tab state if prop changes when reopening
	function useStateAndSync(initialValue: "followers" | "following") {
		const [value, setValue] = useState(initialValue);
		useEffect(() => {
			if (isOpen) setValue(initialTab);
		}, [isOpen, initialTab]);
		return [value, setValue] as const;
	}

	useEffect(() => {
		if (!isOpen) return;

		const fetchData = async () => {
			setLoading(true);
			setUsers([]);
			let res;
			if (activeTab === "followers") {
				res = await getFollowersAction(userId);
			} else {
				res = await getFollowingAction(userId);
			}

			if (res.success) {
				setUsers(res.data);
			}
			setLoading(false);
		};

		fetchData();
	}, [isOpen, activeTab, userId]);

	const handleFollowToggle = async (targetUser: UserItem) => {
		// Optimistic update
		const isNowFollowing = !targetUser.isFollowing;
		setUsers((prev) =>
			prev.map((u) =>
				u._id === targetUser._id ? { ...u, isFollowing: isNowFollowing } : u,
			),
		);

		try {
			if (isNowFollowing) {
				await followUserAction(targetUser._id);
			} else {
				await unfollowUserAction(targetUser._id);
			}
		} catch (error) {
			console.error("Failed to toggle follow", error);
			// Revert
			setUsers((prev) =>
				prev.map((u) =>
					u._id === targetUser._id ? { ...u, isFollowing: !isNowFollowing } : u,
				),
			);
		}
	};

	return (
		<AnimatePresence>
			{isOpen && (
				<div
					className="fixed inset-0 z-[9999] flex items-center justify-center px-4"
					onClick={(e) => e.stopPropagation()}
				>
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						onClick={onClose}
						className="absolute inset-0 bg-black/40 backdrop-blur-sm"
					/>
					<motion.div
						initial={{ opacity: 0, scale: 0.95, y: 10 }}
						animate={{ opacity: 1, scale: 1, y: 0 }}
						exit={{ opacity: 0, scale: 0.95, y: 10 }}
						className="relative bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden max-h-[80vh] flex flex-col"
						onClick={(e) => e.stopPropagation()}
					>
						{/* Header with Tabs */}
						<div className="flex border-b border-black/10">
							<button
								type="button"
								onClick={() => setActiveTab("followers")}
								className={`flex-1 py-4 text-[15px] font-bold text-center relative hover:bg-black/5 transition-colors ${activeTab === "followers" ? "text-black" : "text-text-light"}`}
							>
								Followers
								{activeTab === "followers" && (
									<div className="absolute bottom-0 left-0 right-0 h-1 bg-primary rounded-t-full mx-10" />
								)}
							</button>
							<button
								type="button"
								onClick={() => setActiveTab("following")}
								className={`flex-1 py-4 text-[15px] font-bold text-center relative hover:bg-black/5 transition-colors ${activeTab === "following" ? "text-black" : "text-text-light"}`}
							>
								Following
								{activeTab === "following" && (
									<div className="absolute bottom-0 left-0 right-0 h-1 bg-primary rounded-t-full mx-10" />
								)}
							</button>
						</div>

						{/* List Content */}
						<div className="overflow-y-auto p-0 flex-1 min-h-[300px]">
							{loading ? (
								<div className="flex flex-col">
									{[...Array(5)].map((_, i) => (
										<div
											key={i}
											className="flex items-center gap-3 p-4 border-b border-black/5 last:border-0"
										>
											<Skeleton className="w-10 h-10 rounded-full" />
											<div className="flex flex-col gap-1 flex-1">
												<Skeleton className="h-4 w-32" />
												<Skeleton className="h-3 w-20" />
											</div>
											<Skeleton className="h-8 w-20 rounded-full" />
										</div>
									))}
								</div>
							) : users.length > 0 ? (
								<div className="flex flex-col">
									{users.map((user) => (
										<div
											key={user._id}
											className="flex items-center gap-3 p-4 hover:bg-black/5 transition-colors cursor-pointer border-b border-black/5 last:border-0"
											onClick={() => {
												onClose();
												// Navigation handling logic if needed, usually Link handles it but to close modal first:
											}}
										>
											<Link
												href={`/profile/${user.username}`}
												className="shrink-0"
											>
												<div
													className="w-10 h-10 rounded-full bg-cover bg-center"
													style={{
														backgroundImage: `url('${user.avatar || "https://upload.wikimedia.org/wikipedia/commons/7/7c/Profile_avatar_placeholder_large.png"}')`,
													}}
												/>
											</Link>
											<div className="flex flex-col flex-1 min-w-0">
												<Link
													href={`/profile/${user.username}`}
													className="font-bold text-[15px] truncate flex items-center gap-1 hover:underline"
												>
													{user.firstName} {user.lastName}
													{user.isVerified && <VerifiedIcon />}
												</Link>
												<Link
													href={`/profile/${user.username}`}
													className="text-text-light text-[14px] truncate"
												>
													@{user.username}
												</Link>
												{user.bio && (
													<p className="text-[13px] text-black/80 truncate mt-0.5">
														{user.bio}
													</p>
												)}
											</div>
											{currentUser?._id !== user._id && (
												<button
													type="button"
													onClick={(e) => {
														e.stopPropagation();
														handleFollowToggle(user);
													}}
													className={`
                                                    rounded-full px-4 py-1.5 font-bold text-[14px] transition-all min-w-[90px]
                                                    ${
																											user.isFollowing
																												? "border border-black/20 bg-white text-black hover:bg-red-50 hover:text-red-600 hover:border-red-200"
																												: "bg-black text-white hover:bg-black/80"
																										}
                                                `}
													onMouseEnter={(e) => {
														if (user.isFollowing)
															e.currentTarget.textContent = "Unfollow";
													}}
													onMouseLeave={(e) => {
														if (user.isFollowing)
															e.currentTarget.textContent = "Following";
													}}
												>
													{user.isFollowing ? "Following" : "Follow"}
												</button>
											)}
										</div>
									))}
								</div>
							) : (
								<div className="flex flex-col items-center justify-center h-full p-8 text-center text-text-light">
									<span className="material-symbols-outlined text-4xl mb-2 opacity-50">
										group_off
									</span>
									<p>No {activeTab} yet.</p>
								</div>
							)}
						</div>
					</motion.div>
				</div>
			)}
		</AnimatePresence>
	);
}
