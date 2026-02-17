"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getFollowersAction, getFollowingAction } from "@/lib/user.actions";
import { Skeleton } from "@/components/ui/Skeleton";
import Link from "next/link";
import { useAtomValue } from "jotai";
import { userAtom } from "@/store/user.atom";
import { followUserAction, unfollowUserAction } from "@/lib/user.actions";
import ConfirmModalPortal from "@/components/ui/ConfirmModalPortal";
import clsx from "clsx";
import { VerifiedIcon, UserX } from "lucide-react";

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
	const [activeTab, setActiveTab] = useState(initialTab); // Simplified from web's useStateAndSync
	const [loading, setLoading] = useState(true);
	const [users, setUsers] = useState<UserItem[]>([]);
	const currentUser = useAtomValue(userAtom);

	useEffect(() => {
		if (isOpen) {
			document.body.style.overflow = "hidden";
			setActiveTab(initialTab); // Sync on open
		} else {
			document.body.style.overflow = "unset";
		}
		return () => {
			document.body.style.overflow = "unset";
		};
	}, [isOpen, initialTab]);

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
		<ConfirmModalPortal>
			<AnimatePresence>
				{isOpen && (
					<div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
						<motion.div
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							onClick={onClose}
							className="absolute inset-0 bg-zinc-900/80 backdrop-blur-sm"
						/>
						<motion.div
							initial={{ opacity: 0, scale: 0.95, y: 10 }}
							animate={{ opacity: 1, scale: 1, y: 0 }}
							exit={{ opacity: 0, scale: 0.95, y: 10 }}
							className="relative bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl w-full max-w-md overflow-hidden max-h-[80vh] flex flex-col z-50 text-white"
						>
							{/* Header with Tabs */}
							<div className="flex border-b border-zinc-800">
								<button
									type="button"
									onClick={() => setActiveTab("followers")}
									className={clsx(
										"flex-1 py-4 text-[15px] font-bold text-center relative hover:bg-zinc-800 transition-colors font-sans cursor-pointer",
										activeTab === "followers" ? "text-white" : "text-zinc-500",
									)}
								>
									Followers
									{activeTab === "followers" && (
										<div className="absolute bottom-0 left-0 right-0 h-1 bg-yellow-500 mx-10" />
									)}
								</button>
								<button
									type="button"
									onClick={() => setActiveTab("following")}
									className={clsx(
										"flex-1 py-4 text-[15px] font-bold text-center relative hover:bg-zinc-800 transition-colors font-sans cursor-pointer",
										activeTab === "following" ? "text-white" : "text-zinc-500",
									)}
								>
									Following
									{activeTab === "following" && (
										<div className="absolute bottom-0 left-0 right-0 h-1 bg-yellow-500 mx-10" />
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
												className="flex items-center gap-3 p-4 border-b border-zinc-800 last:border-0"
											>
												<Skeleton className="w-10 h-10 rounded-full bg-zinc-800" />
												<div className="flex flex-col gap-1 flex-1">
													<Skeleton className="h-4 w-32 bg-zinc-800" />
													<Skeleton className="h-3 w-20 bg-zinc-800" />
												</div>
												<Skeleton className="h-8 w-20 rounded-full bg-zinc-800" />
											</div>
										))}
									</div>
								) : users.length > 0 ? (
									<div className="flex flex-col">
										{users.map((user) => (
											<div
												key={user._id}
												className="flex items-center gap-3 p-4 hover:bg-zinc-800/50 transition-colors cursor-pointer border-b border-zinc-800 last:border-0"
												onClick={() => {
													onClose();
												}}
											>
												<Link
													href={`/profile/${user.username}`}
													className="shrink-0"
												>
													<div
														className="w-10 h-10 rounded-full bg-cover bg-center border border-zinc-700"
														style={{
															backgroundImage: `url('${user.avatar || "https://upload.wikimedia.org/wikipedia/commons/7/7c/Profile_avatar_placeholder_large.png"}')`,
														}}
													/>
												</Link>
												<div className="flex flex-col flex-1 min-w-0">
													<Link
														href={`/profile/${user.username}`}
														className="font-bold text-[15px] truncate flex items-center gap-1 hover:underline font-sans text-white"
													>
														{user.firstName} {user.lastName}
														{user.isVerified && (
															<VerifiedIcon className="w-4 h-4 text-blue-500" />
														)}
													</Link>
													<Link
														href={`/profile/${user.username}`}
														className="text-zinc-500 text-[14px] truncate font-sans"
													>
														@{user.username}
													</Link>
													{user.bio && (
														<p className="text-[13px] text-zinc-400 truncate mt-0.5 font-sans">
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
														className={clsx(
															"rounded-full px-4 py-1.5 font-bold text-[13px] transition-all min-w-[90px] border font-sans shadow-[2px_2px_0px_0px_rgba(255,255,255,0.1)] active:translate-x-px active:translate-y-px active:shadow-none",
															user.isFollowing
																? "border-zinc-600 bg-transparent text-white hover:border-red-600 hover:text-red-600"
																: "bg-white text-black border-transparent hover:bg-zinc-200",
														)}
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
									<div className="flex flex-col items-center justify-center h-full p-8 text-center text-zinc-500 font-sans">
										<UserX className="w-12 h-12 mb-2 opacity-50" />
										<p>No {activeTab} yet.</p>
									</div>
								)}
							</div>
						</motion.div>
					</div>
				)}
			</AnimatePresence>
		</ConfirmModalPortal>
	);
}
