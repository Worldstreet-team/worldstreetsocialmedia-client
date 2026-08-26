"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
// EmptyState's contract is a Lucide glyph; Ban is the documented stand-in
// for "blocked" since the 74-icon set has no equivalent.
import { Ban } from "lucide-react";
import { SafeAvatar } from "@/components/ui/SafeAvatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast/ToastContext";
import { getBlockedUsersAction } from "@/lib/report.actions";
import { unblockUserAction } from "@/lib/user.actions";
import { useT } from "@/i18n/client";
import { DEFAULT_AVATAR } from "@/const";

type BlockedUser = {
	_id: string;
	username: string;
	firstName?: string;
	lastName?: string;
	avatar?: string;
};

/**
 * The list of accounts you have blocked.
 *
 * Until this existed, blocking was one-way discoverable: the only route back
 * to an unblock was navigating to that person's profile, which is exactly the
 * place you blocked them to stop visiting. Note it lists only who *you*
 * blocked — who blocked you is deliberately not shown, and the gateway does
 * not send it.
 */
export function BlockedAccounts() {
	const t = useT();
	const { toast } = useToast();
	const [users, setUsers] = useState<BlockedUser[] | null>(null);
	const [busyId, setBusyId] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;
		void getBlockedUsersAction().then((res) => {
			if (cancelled) return;
			setUsers(res.success ? (res.data as BlockedUser[]) : []);
			if (!res.success) {
				toast(res.message ?? t("settings.blocked.error"), { type: "error" });
			}
		});
		return () => {
			cancelled = true;
		};
	}, [toast, t]);

	const unblock = async (user: BlockedUser) => {
		setBusyId(user._id);
		const res = await unblockUserAction(user._id);
		setBusyId(null);
		if (!res.success) {
			toast(res.message ?? t("settings.blocked.error"), { type: "error" });
			return;
		}
		setUsers((prev) => (prev ?? []).filter((u) => u._id !== user._id));
		toast(t("safety.unblocked.toast"));
	};

	if (users === null) {
		return (
			<div className="flex flex-col gap-2 px-4 py-3">
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
				icon={Ban}
				title={t("settings.blocked.emptyTitle")}
				caption={t("settings.blocked.emptyBody")}
			/>
		);
	}

	return (
		<ul className="flex flex-col">
			{users.map((user) => {
				const name =
					[user.firstName, user.lastName].filter(Boolean).join(" ") ||
					user.username;
				return (
					<li
						key={user._id}
						className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-raised"
					>
						<Link
							href={`/profile/${user.username}`}
							className="flex min-w-0 flex-1 items-center gap-3"
						>
							{/* SafeAvatar renders with `fill`, so it needs a
							    positioned box to fill. */}
							<span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-sunken">
								<SafeAvatar src={user.avatar || DEFAULT_AVATAR} />
							</span>
							<span className="flex min-w-0 flex-col">
								<span className="truncate font-sans text-sm font-semibold text-primary">
									{name}
								</span>
								<span className="truncate font-sans text-[13px] text-muted">
									@{user.username}
								</span>
							</span>
						</Link>
						<button
							type="button"
							onClick={() => unblock(user)}
							disabled={busyId === user._id}
							className="h-9 shrink-0 cursor-pointer rounded-pill bg-primary px-4 font-sans text-[13px] font-semibold text-page transition-opacity hover:opacity-90 disabled:opacity-50"
						>
							{busyId === user._id
								? t("settings.blocked.unblocking")
								: t("safety.unblock")}
						</button>
					</li>
				);
			})}
		</ul>
	);
}
