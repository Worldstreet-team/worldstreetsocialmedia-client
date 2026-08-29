"use client";

import { useGatewayRead } from "@/hooks/useGateway";

import { useEffect, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Tabs } from "@/components/ui/Tabs";
import {
	OverlayHeader,
	OverlayPanel,
	OverlayScrim,
	useOverlayDismiss,
} from "@/components/ui/Overlay";
import { useT } from "@/i18n/client";
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
	/** Shown as badges on the tabs — the modal is opened to learn "how many",
	 *  and the caller already knows, so it should not have to be counted. */
	followersCount?: number;
	followingCount?: number;
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
	followersCount,
	followingCount,
}: FollowsModalProps) {
	const read = useGatewayRead();
	const [activeTab, setActiveTab] = useState(initialTab); // Simplified from web's useStateAndSync
	const [loading, setLoading] = useState(true);
	const [users, setUsers] = useState<UserItem[]>([]);
	const [query, setQuery] = useState("");

	/**
	 * Name and handle. A long allies list is a haystack, and the reason you
	 * open it is usually to find one person in it.
	 */
	const shown = users.filter((u) => {
		const q = query.trim().toLowerCase();
		if (!q) return true;
		const name = `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim();
		return (
			name.toLowerCase().includes(q) ||
			(u.username ?? "").toLowerCase().includes(q)
		);
	});
	const currentUser = useAtomValue(userAtom);
	const t = useT();

	// Esc + the body scroll lock come from the overlay grammar now.
	useOverlayDismiss(isOpen, onClose);

	useEffect(() => {
		if (isOpen) {
			setActiveTab(initialTab); // Sync on open
			setQuery("");
		}
	}, [isOpen, initialTab]);

	useEffect(() => {
		if (!isOpen) return;

		const fetchData = async () => {
			setLoading(true);
			setUsers([]);
			let res;
			if (activeTab === "followers") {
				res = await read(`/api/users/${userId}/followers`, (b) => b.data);
			} else {
				res = await read(`/api/users/${userId}/following`, (b) => b.data);
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
					<>
						<OverlayScrim onClose={onClose} label={t("common.close")} />
						<OverlayPanel
							variant="center"
							label={t(
								activeTab === "followers"
									? "profile.followers"
									: "profile.following",
							)}
						>
							{/* THE Tabs component — pill chips, the app's one tab grammar.
							    This was a hand-rolled underline pair, which is exactly
							    the second tab language that control exists to prevent.
							    The counts ride along as badges: "how many" is the
							    question this modal is opened to answer, and it used to
							    make you count rows to find out. The tabs ARE the
							    header row, so the close chip sits beside them. */}
							<OverlayHeader onClose={onClose} closeLabel={t("common.close")}>
								<Tabs
									// Allies first, then Aligned to — the order the
									// profile lists them in. The old array said this in
									// a comment while shipping the opposite; owner
									// review caught the wrong arrangement.
									items={[
										{
											key: "followers" as const,
											label: t("profile.followers"),
											badge: followersCount,
											badgeMax: Number.MAX_SAFE_INTEGER,
										},
										{
											key: "following" as const,
											label: t("profile.alignedTo"),
											badge: followingCount,
											badgeMax: Number.MAX_SAFE_INTEGER,
										},
									]}
									value={activeTab}
									onChange={setActiveTab}
									ariaLabel={t("profile.followers")}
									className="min-w-0 flex-1"
								/>
							</OverlayHeader>

							<div className="shrink-0 px-4 pb-3">
								<input
									value={query}
									onChange={(e) => setQuery(e.target.value)}
									placeholder={t("search.placeholder.people")}
									aria-label={t("search.placeholder.people")}
									className="w-full rounded-pill bg-sunken px-4 py-2 font-sans text-[13.5px] text-primary outline-none transition-colors placeholder:text-subtle focus:bg-raised"
								/>
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
								) : shown.length > 0 ? (
									<div className="flex flex-col">
										{shown.map((user) => (
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
													<SafeAvatar eager src={user.avatar} />
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
																e.currentTarget.textContent = t("profile.unfollow");
														}}
														onMouseLeave={(e) => {
															if (user.isFollowing)
																e.currentTarget.textContent =
																	t("profile.followingState");
														}}
													>
														{user.isFollowing
																					? t("profile.followingState")
																					: t("profile.follow")}
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
						</OverlayPanel>
					</>
				)}
			</AnimatePresence>
		</ConfirmModalPortal>
	);
}
