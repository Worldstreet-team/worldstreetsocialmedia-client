"use client";

import { useMemo, useState } from "react";
import {
	Check,
	Crown,
	LogOut,
	Pencil,
	Shield,
	UserMinus,
	Users,
} from "lucide-react";
import { AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
	OverlayHeader,
	OverlayPanel,
	OverlayScrim,
	useOverlayDismiss,
} from "@/components/ui/Overlay";
import { SafeAvatar } from "@/components/ui/SafeAvatar";
import { postJsonDirect } from "@/lib/upload-direct";
import { senderColor } from "./thread/groupSystem";

type Role = "owner" | "admin" | "member";

interface MemberRecord {
	profile: string | { _id: string };
	role?: Role;
	leftAt?: string;
}
interface ParticipantUser {
	_id: string;
	firstName?: string;
	lastName?: string;
	username?: string;
	avatar?: string;
}

/** DELETE with a JSON-less body; postJsonDirect is POST-only, so a tiny
 *  fetch mirrors its token + shape for the two DELETE routes. */
async function del(path: string) {
	try {
		const token = await (window as any).Clerk?.session?.getToken?.();
		const API =
			process.env.NEXT_PUBLIC_API_URL ||
			(await import("@/const")).BACKEND_URL;
		const res = await fetch(`${API}${path}`, {
			method: "DELETE",
			headers: { Authorization: `Bearer ${token}` },
		});
		const body = await res.json().catch(() => null);
		return { success: res.ok, message: body?.message };
	} catch {
		return { success: false, message: "Network error" };
	}
}

async function patch(path: string, data: unknown) {
	try {
		const token = await (window as any).Clerk?.session?.getToken?.();
		const API =
			process.env.NEXT_PUBLIC_API_URL ||
			(await import("@/const")).BACKEND_URL;
		const res = await fetch(`${API}${path}`, {
			method: "PATCH",
			headers: {
				Authorization: `Bearer ${token}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify(data),
		});
		const body = await res.json().catch(() => null);
		return { success: res.ok, message: body?.message };
	} catch {
		return { success: false, message: "Network error" };
	}
}

/**
 * The group member sheet (register 103/104): roster with roles, admin
 * controls per policy, rename, and leave. Rebuilds are cheap — every action
 * calls `onChanged` so the parent refetches the thread.
 */
export function GroupSheet({
	open,
	onClose,
	conversationId,
	name,
	avatar,
	members,
	participants,
	myProfileId,
	onChanged,
	onLeft,
}: {
	open: boolean;
	onClose: () => void;
	conversationId: string;
	name: string;
	avatar?: string;
	members: MemberRecord[];
	participants: ParticipantUser[];
	myProfileId: string;
	onChanged: () => void;
	onLeft: () => void;
}) {
	const [renaming, setRenaming] = useState(false);
	const [draftName, setDraftName] = useState(name);
	const [busy, setBusy] = useState<string | null>(null);

	const byId = useMemo(() => {
		const m = new Map<string, ParticipantUser>();
		for (const p of participants) m.set(String(p._id), p);
		return m;
	}, [participants]);

	const active = useMemo(
		() =>
			members
				.filter((m) => !m.leftAt)
				.map((m) => ({
					id: String(
						typeof m.profile === "string" ? m.profile : m.profile._id,
					),
					role: (m.role ?? "member") as Role,
				}))
				.sort((a, b) => {
					const rank = { owner: 0, admin: 1, member: 2 } as const;
					return rank[a.role] - rank[b.role];
				}),
		[members],
	);
	const myRole = active.find((a) => a.id === myProfileId)?.role ?? "member";
	const iAmAdmin = myRole === "owner" || myRole === "admin";

	useOverlayDismiss(open, onClose);

	const rename = async () => {
		const next = draftName.trim();
		if (!next || next === name) {
			setRenaming(false);
			return;
		}
		setBusy("rename");
		const res = await patch(`/api/messages/groups/${conversationId}`, {
			name: next,
		});
		setBusy(null);
		setRenaming(false);
		if (res.success) onChanged();
		else toast.error(res.message || "Couldn't rename");
	};

	const setRole = async (id: string, role: "admin" | "member") => {
		setBusy(id);
		const res = await patch(
			`/api/messages/groups/${conversationId}/members/${id}`,
			{ role },
		);
		setBusy(null);
		if (res.success) onChanged();
		else toast.error(res.message || "Couldn't change role");
	};

	const remove = async (id: string) => {
		setBusy(id);
		const res = await del(
			`/api/messages/groups/${conversationId}/members/${id}`,
		);
		setBusy(null);
		if (res.success) {
			if (id === myProfileId) {
				onLeft();
				onClose();
			} else onChanged();
		} else toast.error(res.message || "Couldn't remove");
	};

	return (
		<AnimatePresence>
			{open && (
				<>
					<OverlayScrim onClose={onClose} />
					<OverlayPanel
						dragClose={onClose}
						variant="sheet"
						label="Group details"
					>
						<OverlayHeader title="Group details" onClose={onClose} />

						<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
							{/* Identity */}
							<div className="flex flex-col items-center gap-3 px-4 pb-4 pt-2">
								<span className="relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-pill bg-raised">
									{avatar ? (
										<SafeAvatar src={avatar} eager />
									) : (
										<Users className="h-8 w-8 text-muted" />
									)}
								</span>
								{renaming ? (
									<div className="flex w-full items-center gap-2">
										<input
											value={draftName}
											onChange={(e) => setDraftName(e.target.value)}
											maxLength={80}
											autoFocus
											className="min-w-0 flex-1 rounded-[10px] bg-sunken px-3 py-2 text-center font-sans text-[16px] font-semibold text-primary outline-none focus:bg-raised"
										/>
										<button
											type="button"
											onClick={rename}
											disabled={busy === "rename"}
											aria-label="Save name"
											className="flex h-9 w-9 shrink-0 items-center justify-center rounded-pill bg-brand text-brand-on disabled:opacity-50"
										>
											<Check className="h-4 w-4" />
										</button>
									</div>
								) : (
									<button
										type="button"
										onClick={() => iAmAdmin && setRenaming(true)}
										className={
											iAmAdmin
												? "flex cursor-pointer items-center gap-1.5 font-display text-[18px] font-semibold text-primary"
												: "font-display text-[18px] font-semibold text-primary"
										}
									>
										{name}
										{iAmAdmin && (
											<Pencil className="h-3.5 w-3.5 text-muted" />
										)}
									</button>
								)}
								<span className="text-[13px] text-muted">
									{active.length} members
								</span>
							</div>

							{/* Roster */}
							<div className="border-t border-hairline">
								{active.map((a) => {
									const u = byId.get(a.id);
									const nm =
										`${u?.firstName ?? ""} ${u?.lastName ?? ""}`.trim() ||
										u?.username ||
										"Member";
									const isMe = a.id === myProfileId;
									const canManage =
										iAmAdmin &&
										!isMe &&
										a.role !== "owner" &&
										// Admins can't act on admins; only the owner can.
										(myRole === "owner" || a.role === "member");
									return (
										<div
											key={a.id}
											className="flex items-center gap-3 px-4 py-2.5"
										>
											<span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-pill bg-raised">
												<SafeAvatar src={u?.avatar} eager />
											</span>
											<span className="min-w-0 flex-1">
												<span
													className="block truncate font-sans text-[14px] font-medium"
													style={{ color: senderColor(a.id) }}
												>
													{nm} {isMe && "(you)"}
												</span>
												{a.role !== "member" && (
													<span className="flex items-center gap-1 text-[11.5px] text-subtle">
														{a.role === "owner" ? (
															<Crown className="h-3 w-3" />
														) : (
															<Shield className="h-3 w-3" />
														)}
														{a.role}
													</span>
												)}
											</span>
											{canManage && (
												<div className="flex shrink-0 items-center gap-1">
													{myRole === "owner" && (
														<button
															type="button"
															onClick={() =>
																setRole(
																	a.id,
																	a.role === "admin"
																		? "member"
																		: "admin",
																)
															}
															disabled={busy === a.id}
															aria-label={
																a.role === "admin"
																	? "Demote"
																	: "Make admin"
															}
															className="flex h-8 w-8 items-center justify-center rounded-pill text-muted transition-colors hover:bg-chip hover:text-primary disabled:opacity-50"
														>
															<Shield
																className={
																	a.role === "admin"
																		? "h-4 w-4 text-gold"
																		: "h-4 w-4"
																}
															/>
														</button>
													)}
													<button
														type="button"
														onClick={() => remove(a.id)}
														disabled={busy === a.id}
														aria-label="Remove"
														className="flex h-8 w-8 items-center justify-center rounded-pill text-muted transition-colors hover:bg-chip hover:text-danger disabled:opacity-50"
													>
														<UserMinus className="h-4 w-4" />
													</button>
												</div>
											)}
										</div>
									);
								})}
							</div>
						</div>

						<div className="shrink-0 border-t border-hairline p-3">
							<button
								type="button"
								onClick={() => remove(myProfileId)}
								disabled={busy === myProfileId}
								className="flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-pill bg-raised font-sans text-[14px] font-semibold text-danger transition-colors hover:bg-chip disabled:opacity-50"
							>
								<LogOut className="h-4 w-4" />
								Leave group
							</button>
						</div>
					</OverlayPanel>
				</>
			)}
		</AnimatePresence>
	);
}
