"use client";

import { useGatewayRead } from "@/hooks/useGateway";

import { useState, useEffect, useMemo } from "react";
import { X, Search, Loader2 } from "lucide-react";
import { AnimatePresence } from "framer-motion";
import {
	OverlayHeader,
	OverlayPanel,
	OverlayScrim,
	useOverlayDismiss,
} from "@/components/ui/Overlay";
import {
	getFollowersAction,
	getFollowingAction,
} from "@/lib/user.actions";
import { startConversationAction } from "@/lib/conversation.actions";
import { UserBadges } from "@/components/ui/UserBadges";

import { toast } from "sonner";
import { SafeAvatar } from "@/components/ui/SafeAvatar";

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
	const read = useGatewayRead();
	const [users, setUsers] = useState<UserItem[]>([]);
	const [loading, setLoading] = useState(true);
	const [searchQuery, setSearchQuery] = useState("");
	const [startingWith, setStartingWith] = useState<string | null>(null);
	const [remote, setRemote] = useState<UserItem[]>([]);

	// Typing searches EVERYONE, not just your contacts. Premium members can
	// message anyone now, and even for free accounts the send gate is the
	// honest arbiter — a modal that pre-filters to mutuals just looks broken
	// when the person you searched for plainly exists.
	useEffect(() => {
		const q = searchQuery.trim();
		if (!isOpen || q.length < 2) {
			setRemote([]);
			return;
		}
		const id = window.setTimeout(async () => {
			const res = await read(
				`/api/users/search?q=${encodeURIComponent(q)}`,
				(b) => b.data,
			);
			if (res.success && Array.isArray(res.data)) setRemote(res.data);
		}, 300);
		return () => window.clearTimeout(id);
	}, [isOpen, searchQuery]);

	// Only people who follow you back, because those are the only threads
	// the gateway will open. This is the INTERSECTION of followers and
	// following, not the union it used to be.
	useEffect(() => {
		if (!isOpen || !currentUserId) return;

		const fetchUsers = async () => {
			setLoading(true);
			try {
				const [followersRes, followingRes] = await Promise.all([
					getFollowersAction(currentUserId),
					getFollowingAction(currentUserId),
				]);

				const followerIds = new Set<string>(
					followersRes.success && followersRes.data
						? followersRes.data.map((u: any) => String(u._id))
						: [],
				);

				const mutuals: UserItem[] = [];
				const seenIds = new Set<string>();

				if (followingRes.success && followingRes.data) {
					for (const user of followingRes.data) {
						const id = String(user._id);
						// You follow them (this list) AND they follow you.
						if (!followerIds.has(id) || seenIds.has(id)) continue;
						seenIds.add(id);
						mutuals.push(user);
					}
				}

				setUsers(mutuals);
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
		const locals = users.filter(
			(u) =>
				u.username?.toLowerCase().includes(q) ||
				u.firstName?.toLowerCase().includes(q) ||
				u.lastName?.toLowerCase().includes(q) ||
				`${u.firstName} ${u.lastName}`.toLowerCase().includes(q),
		);
		// Contacts first, then the wider directory, deduped: familiarity is
		// still the best ranking signal a DM composer has.
		const seen = new Set(locals.map((u) => String(u._id)));
		return [...locals, ...remote.filter((u) => !seen.has(String(u._id)))];
	}, [users, remote, searchQuery]);

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

	useOverlayDismiss(isOpen, onClose);

	return (
		<AnimatePresence>
			{isOpen && (
				<>
					<OverlayScrim onClose={onClose} />
					<OverlayPanel variant="sheet" label="New conversation">
						<OverlayHeader title="New conversation" onClose={onClose} />

						{/* Search */}
						<div className="shrink-0 p-4 border-b border-hairline">
							<div className="relative">
								<Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-subtle" />
								<input
									type="text"
									placeholder="Search people"
									value={searchQuery}
									onChange={(e) => setSearchQuery(e.target.value)}
									autoFocus
									className="w-full bg-sunken border border-hairline rounded-pill pl-10 pr-4 py-2.5 text-base sm:text-sm text-primary placeholder:text-subtle focus:border-brand/60 outline-none transition-colors"
								/>
							</div>
						</div>

						{/* User List */}
						<div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
							{loading ? (
								<div className="flex flex-col items-center justify-center py-12 text-muted">
									<Loader2 className="w-6 h-6 animate-spin mb-3" />
									<span className="text-sm">Loading contacts...</span>
								</div>
							) : filteredUsers.length === 0 ? (
								<div className="flex flex-col items-center justify-center py-12 text-muted">
									<span className="text-sm">
										{searchQuery.trim()
											? `No results for "${searchQuery}"`
											: "You can only message your Allies"}
									</span>
								</div>
							) : (
								filteredUsers.map((user) => (
									<button
										key={user._id}
										onClick={() => handleSelectUser(user)}
										disabled={startingWith !== null}
										className="w-full flex items-center gap-3 px-4 py-3 hover:bg-raised transition-colors border-b border-hairline/50 disabled:opacity-50 cursor-pointer"
									>
										<div className="relative w-11 h-11 rounded-full overflow-hidden shrink-0 bg-raised">
											<SafeAvatar src={user.avatar} className="object-cover" alt={user.username || "User"} />
										</div>
										<div className="flex-1 text-left min-w-0">
											<div className="flex items-center gap-1">
												<span className="font-semibold text-[15px] text-primary truncate">
													{user.firstName}{" "}
													{user.lastName}
												</span>
												<UserBadges
													isVerified={user.isVerified}
													badges={(user as any).badges}
													size={16}
												/>
											</div>
											<span className="text-muted text-[13px] truncate block">
												@{user.username}
											</span>
										</div>
										{startingWith === user._id && (
											<Loader2 className="w-4 h-4 text-gold animate-spin shrink-0" />
										)}
									</button>
								))
							)}
						</div>
					</OverlayPanel>
				</>
			)}
		</AnimatePresence>
	);
}
