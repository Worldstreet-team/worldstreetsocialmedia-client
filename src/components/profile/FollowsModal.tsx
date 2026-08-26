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
import { UserX } from "lucide-react";
import { UserBadges } from "@/components/ui/UserBadges";
import { SafeAvatar } from "@/components/ui/SafeAvatar";

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
					<div className="fixed inset-0 z-modal flex items-center justify-center p-4">
						<motion.div
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							onClick={onClose}
							className="absolute inset-0 bg-scrim"
						/>
						<motion.div
							initial={{ opacity: 0, scale: 0.98, y: 8 }}
							animate={{ opacity: 1, scale: 1, y: 0 }}
							exit={{ opacity: 0, scale: 0.98, y: 8 }}
							transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
							className="relative bg-surface border border-hairline rounded-xl shadow-nav w-full max-w-md overflow-hidden max-h-[80dvh] flex flex-col text-primary"
						>
							{/* Header with Tabs */}
							<div className="flex border-b border-hairline">
								<button
									type="button"
									onClick={() => setActiveTab("followers")}
									className={clsx(
										"flex-1 py-4 text-[15px] font-semibold text-center relative hover:bg-raised transition-colors font-sans cursor-pointer",
										activeTab === "followers" ? "text-primary" : "text-muted",
									)}
								>
									Followers
									{activeTab === "followers" && (
										<div className="absolute bottom-0 left-1/2 -translate-x-1/2 h-0.5 w-14 bg-brand rounded-pill" />
									)}
								</button>
								<button
									type="button"
									onClick={() => setActiveTab("following")}
									className={clsx(
										"flex-1 py-4 text-[15px] font-semibold text-center relative hover:bg-raised transition-colors font-sans cursor-pointer",
										activeTab === "following" ? "text-primary" : "text-muted",
									)}
								>
									Following
									{activeTab === "following" && (
										<div className="absolute bottom-0 left-1/2 -translate-x-1/2 h-0.5 w-14 bg-brand rounded-pill" />
									)}
								</button>
							</div>

							{/* List Content */}
							{/* min-h capped against the viewport: a hard 300px floor
							    plus header overflowed short phones in landscape. */}
							<div className="overflow-y-auto overscroll-contain p-0 flex-1 min-h-[min(300px,40dvh)]">
								{loading ? (
									<div className="flex flex-col">
										{[...Array(5)].map((_, i) => (
											<div
												key={i}
												className="flex items-center gap-3 p-4 border-b border-hairline last:border-0"
											>
												<Skeleton className="w-10 h-10 rounded-pill" />
												<div className="flex flex-col gap-1 flex-1">
													<Skeleton className="h-4 w-32" />
													<Skeleton className="h-3 w-20" />
												</div>
												<Skeleton className="h-8 w-20 rounded-pill" />
											</div>
										))}
									</div>
								) : users.length > 0 ? (
									<div className="flex flex-col">
										{users.map((user) => (
											<div
												key={user._id}
												className="flex items-center gap-3 p-4 hover:bg-raised transition-colors cursor-pointer border-b border-hairline last:border-0"
												onClick={() => {
													onClose();
												}}
											>
												<Link
													href={`/profile/${user.username}`}
													className="relative h-10 w-10 shrink-0 overflow-hidden rounded-pill bg-raised"
												>
													<SafeAvatar src={user.avatar} />
												</Link>
												<div className="flex flex-col flex-1 min-w-0">
													<Link
														href={`/profile/${user.username}`}
														className="font-semibold text-[15px] truncate flex items-center gap-1 hover:underline font-sans text-primary"
													>
														{user.firstName} {user.lastName}
														<UserBadges
											isVerified={user.isVerified}
											badges={(user as any).badges}
											size={16}
										/>
													</Link>
													<Link
														href={`/profile/${user.username}`}
														className="text-muted text-[14px] truncate font-sans"
													>
														@{user.username}
													</Link>
													{user.bio && (
														<p className="text-[13px] text-muted truncate mt-0.5 font-sans">
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
															"rounded-pill px-4 py-1.5 font-semibold text-[13px] transition-colors min-w-[90px] border font-sans",
															user.isFollowing
																? "border-hairline bg-transparent text-primary hover:border-danger hover:text-danger"
																: "bg-primary text-page border-transparent hover:bg-muted",
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
									<div className="flex flex-col items-center justify-center h-full p-8 text-center text-muted font-sans">
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
