"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { VolumeX } from "@/components/ui/icons";
import { SafeAvatar } from "@/components/ui/SafeAvatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast/ToastContext";
import { getMutedUsersAction, unmuteUserAction } from "@/lib/mute.actions";
import { DEFAULT_AVATAR } from "@/const";
import { collapse, staggerItem, staggerParentFast } from "@/lib/motion-presets";

type MutedUser = {
	_id: string;
	username: string;
	firstName?: string;
	lastName?: string;
	avatar?: string;
};

/**
 * The accounts you have muted, each with Unmute. Built on the blocked list:
 * the same rows, the same fold-shut exit. Muting is one-way and silent, so
 * the empty state says what it does rather than what it prevents.
 */
export function MutedAccounts() {
	const { toast } = useToast();
	const [users, setUsers] = useState<MutedUser[] | null>(null);
	const [busyId, setBusyId] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;
		void getMutedUsersAction().then((res) => {
			if (cancelled) return;
			setUsers(res.success ? (res.data as MutedUser[]) : []);
			if (!res.success) {
				toast(res.message ?? "Could not load muted accounts", { type: "error" });
			}
		});
		return () => {
			cancelled = true;
		};
	}, [toast]);

	const unmute = async (user: MutedUser) => {
		setBusyId(user._id);
		const res = await unmuteUserAction(user._id);
		setBusyId(null);
		if (!res.success) {
			toast(res.message ?? "Could not unmute", { type: "error" });
			return;
		}
		setUsers((prev) => (prev ?? []).filter((u) => u._id !== user._id));
		toast(`Unmuted @${user.username}`);
	};

	if (users === null) {
		return (
			<div className="flex flex-col gap-2 py-3">
				{[0, 1, 2].map((i) => (
					<div key={i} className="flex items-center gap-3">
						<Skeleton className="h-10 w-10 rounded-full" />
						<div className="flex flex-1 flex-col gap-1.5">
							<Skeleton className="h-3 w-32" />
							<Skeleton className="h-3 w-20" />
						</div>
					</div>
				))}
			</div>
		);
	}

	if (users.length === 0) {
		return (
			<EmptyState
				icon={VolumeX}
				title="No muted accounts"
				caption="Mute someone from their profile or a post's menu. Their posts leave your feed and they're never told."
			/>
		);
	}

	return (
		// The list lands once, when the fetch resolves; an unmute only filters
		// it, so the cascade never replays. The presence is here for the exit
		// only (no initial={false}: that would block the rows' entrance too).
		<motion.ul
			variants={staggerParentFast}
			initial="hidden"
			animate="show"
			className="flex flex-col"
		>
			<AnimatePresence>
			{users.map((user) => {
				const name =
					[user.firstName, user.lastName].filter(Boolean).join(" ") ||
					user.username;
				return (
					// The li carries the height so an unmuted row folds shut
					// and the rows below glide up; the padding sits on the inner
					// div because a padded box cannot collapse to zero.
					<motion.li
						key={user._id}
						variants={staggerItem}
						exit={collapse.exit}
						className="overflow-hidden"
					>
					<div className="flex min-h-[56px] items-center gap-3 border-b border-hairline py-2">
						<Link
							href={`/profile/${user.username}`}
							className="flex min-w-0 flex-1 items-center gap-3"
						>
							{/* SafeAvatar renders with `fill`, so it needs a
							    positioned box to fill. */}
							<span className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full bg-sunken">
								<SafeAvatar src={user.avatar || DEFAULT_AVATAR} />
							</span>
							<span className="flex min-w-0 flex-col">
								<span className="truncate font-sans text-sm font-semibold text-primary">
									{name}
								</span>
								<span className="truncate font-sans text-[calc(13px*var(--ws-fs))] text-muted">
									@{user.username}
								</span>
							</span>
						</Link>
						<button
							type="button"
							onClick={() => unmute(user)}
							disabled={busyId === user._id}
							className="h-10 shrink-0 cursor-pointer rounded-pill bg-primary/5 px-4 font-sans text-[calc(13px*var(--ws-fs))] font-semibold text-primary transition-colors hover:bg-primary/10 disabled:opacity-50"
						>
							{busyId === user._id ? "Unmuting…" : "Unmute"}
						</button>
					</div>
					</motion.li>
				);
			})}
			</AnimatePresence>
		</motion.ul>
	);
}
