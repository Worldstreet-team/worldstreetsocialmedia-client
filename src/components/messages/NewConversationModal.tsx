"use client";

import { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import { X, Search, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { getFollowersAction, getFollowingAction } from "@/lib/user.actions";
import { startConversationAction } from "@/lib/conversation.actions";
import VerifiedIcon from "@/assets/icons/VerifiedIcon";
import { toast } from "sonner";

interface UserItem {
	_id: string;
	userId: string;
	username: string;
	firstName: string;
	lastName: string;
	avatar: string;
	isVerified?: boolean;
	bio?: string;
}

interface NewConversationModalProps {
	isOpen: boolean;
	onClose: () => void;
	currentUserId: string; // Clerk userId
	onConversationStarted: (conversationId: string) => void;
}

export default function NewConversationModal({
	isOpen,
	onClose,
	currentUserId,
	onConversationStarted,
}: NewConversationModalProps) {
	const [users, setUsers] = useState<UserItem[]>([]);
	const [loading, setLoading] = useState(true);
	const [searchQuery, setSearchQuery] = useState("");
	const [startingWith, setStartingWith] = useState<string | null>(null);

	// Fetch followers + following on open
	useEffect(() => {
		if (!isOpen || !currentUserId) return;

		const fetchUsers = async () => {
			setLoading(true);
			try {
				const [followersRes, followingRes] = await Promise.all([
					getFollowersAction(currentUserId),
					getFollowingAction(currentUserId),
				]);

				const allUsers: UserItem[] = [];
				const seenIds = new Set<string>();

				const addUsers = (data: any[]) => {
					for (const user of data) {
						if (!seenIds.has(user._id)) {
							seenIds.add(user._id);
							allUsers.push(user);
						}
					}
				};

				if (followersRes.success && followersRes.data) {
					addUsers(followersRes.data);
				}
				if (followingRes.success && followingRes.data) {
					addUsers(followingRes.data);
				}

				setUsers(allUsers);
			} catch (error) {
				console.error("Failed to fetch users:", error);
				toast.error("Failed to load contacts");
			} finally {
				setLoading(false);
			}
		};

		fetchUsers();
	}, [isOpen, currentUserId]);

	// Reset search when modal closes
	useEffect(() => {
		if (!isOpen) {
			setSearchQuery("");
			setStartingWith(null);
		}
	}, [isOpen]);

	// Filter users by search query
	const filteredUsers = useMemo(() => {
		if (!searchQuery.trim()) return users;
		const q = searchQuery.toLowerCase();
		return users.filter(
			(u) =>
				u.username?.toLowerCase().includes(q) ||
				u.firstName?.toLowerCase().includes(q) ||
				u.lastName?.toLowerCase().includes(q) ||
				`${u.firstName} ${u.lastName}`.toLowerCase().includes(q),
		);
	}, [users, searchQuery]);

	const handleSelectUser = async (user: UserItem) => {
		setStartingWith(user._id);
		try {
			const result = await startConversationAction(user._id);
			if (result?._id) {
				onConversationStarted(result._id);
				onClose();
			} else if (result?.error) {
				toast.error(result.error);
			}
		} catch (error) {
			console.error("Failed to start conversation:", error);
			toast.error("Failed to start conversation");
		} finally {
			setStartingWith(null);
		}
	};

	return (
		<AnimatePresence>
			{isOpen && (
				<>
					{/* Backdrop */}
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						onClick={onClose}
						className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
					/>

					{/* Modal */}
					<motion.div
						initial={{ opacity: 0, scale: 0.95, y: 20 }}
						animate={{ opacity: 1, scale: 1, y: 0 }}
						exit={{ opacity: 0, scale: 0.95, y: 20 }}
						transition={{ type: "spring", damping: 25, stiffness: 300 }}
						className="fixed inset-0 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-[480px] md:max-h-[600px] md:rounded-2xl bg-black border border-zinc-800 z-50 flex flex-col overflow-hidden"
					>
						{/* Header */}
						<div className="flex items-center justify-between p-4 border-b border-zinc-800">
							<div className="flex items-center gap-4">
								<button
									onClick={onClose}
									className="p-1 rounded-full hover:bg-zinc-800 transition-colors text-zinc-400 hover:text-white"
								>
									<X className="w-5 h-5" />
								</button>
								<h2 className="text-lg font-bold text-white">
									New Conversation
								</h2>
							</div>
						</div>

						{/* Search */}
						<div className="p-4 border-b border-zinc-800">
							<div className="relative">
								<Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
								<input
									type="text"
									placeholder="Search people"
									value={searchQuery}
									onChange={(e) => setSearchQuery(e.target.value)}
									autoFocus
									className="w-full bg-zinc-900 border border-zinc-800 rounded-full pl-10 pr-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-yellow-500/50 focus:ring-1 focus:ring-yellow-500/20 outline-none transition-all"
								/>
							</div>
						</div>

						{/* User List */}
						<div className="flex-1 overflow-y-auto">
							{loading ? (
								<div className="flex flex-col items-center justify-center py-12 text-zinc-500">
									<Loader2 className="w-6 h-6 animate-spin mb-3" />
									<span className="text-sm">Loading contacts...</span>
								</div>
							) : filteredUsers.length === 0 ? (
								<div className="flex flex-col items-center justify-center py-12 text-zinc-500">
									<span className="text-sm">
										{searchQuery.trim()
											? `No results for "${searchQuery}"`
											: "No followers or following yet"}
									</span>
								</div>
							) : (
								filteredUsers.map((user) => (
									<button
										key={user._id}
										onClick={() => handleSelectUser(user)}
										disabled={startingWith !== null}
										className="w-full flex items-center gap-3 px-4 py-3 hover:bg-zinc-900/70 transition-colors border-b border-zinc-800/30 disabled:opacity-50 cursor-pointer"
									>
										<div className="relative w-11 h-11 rounded-full overflow-hidden shrink-0 bg-zinc-800">
											<Image
												src={
													user.avatar ||
													"https://upload.wikimedia.org/wikipedia/commons/7/7c/Profile_avatar_placeholder_large.png"
												}
												alt={user.username || "User"}
												fill
												className="object-cover"
											/>
										</div>
										<div className="flex-1 text-left min-w-0">
											<div className="flex items-center gap-1">
												<span className="font-bold text-[15px] text-white truncate">
													{user.firstName}{" "}
													{user.lastName}
												</span>
												{user.isVerified && (
													<VerifiedIcon color="blue" />
												)}
											</div>
											<span className="text-zinc-500 text-[13px] truncate block">
												@{user.username}
											</span>
										</div>
										{startingWith === user._id && (
											<Loader2 className="w-4 h-4 text-yellow-500 animate-spin shrink-0" />
										)}
									</button>
								))
							)}
						</div>
					</motion.div>
				</>
			)}
		</AnimatePresence>
	);
}
