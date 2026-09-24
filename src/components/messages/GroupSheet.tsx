"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
	Check,
	Crown,
	Loader2,
	LogOut,
	Pencil,
	Shield,
	UserMinus,
	UserPlus,
	Users,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import {
	OverlayHeader,
	OverlayPanel,
	OverlayScrim,
	useOverlayDismiss,
} from "@/components/ui/Overlay";
import { SafeAvatar } from "@/components/ui/SafeAvatar";
import { postJsonDirect, sendFormDirect } from "@/lib/upload-direct";
import {
	type AddOutcome,
	groupOutcomes,
	OUTCOME_WORDS,
	PeoplePicker,
	type PickedPerson,
	personName,
} from "./PeoplePicker";
import { compressImage } from "@/lib/image-compress";
import {
	collapse,
	snappySpring,
	staggerParentFast,
	swap,
} from "@/lib/motion-presets";
import { CascadeRow } from "./ConversationList";
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
	adminsOnly,
	currentClerkId,
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
	/** Group lock: only admins may post while true (register 99). */
	adminsOnly?: boolean;
	/** Clerk id, for the relations endpoint behind Add people. */
	currentClerkId?: string;
	members: MemberRecord[];
	participants: ParticipantUser[];
	myProfileId: string;
	onChanged: () => void;
	onLeft: () => void;
}) {
	const [renaming, setRenaming] = useState(false);
	const [draftName, setDraftName] = useState(name);
	const [busy, setBusy] = useState<string | null>(null);
	const photoInputRef = useRef<HTMLInputElement | null>(null);
	const [addOpen, setAddOpen] = useState(false);
	const [addSelected, setAddSelected] = useState<Record<string, PickedPerson>>({});
	const [addOutcome, setAddOutcome] = useState<{ status: AddOutcome; names: string[] }[]>([]);

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

	/** Group photo: compress -> direct upload (files never ride a server
	 *  action) -> PATCH the returned KEY; the gateway presigns on read. */
	const changePhoto = async (file: File) => {
		setBusy("photo");
		try {
			const small = await compressImage(file, {
				maxEdge: 512,
				quality: 0.85,
				skipUnderBytes: 40 * 1024,
			});
			const fd = new FormData();
			fd.append("file", small);
			const up = await sendFormDirect("/api/messages/upload", fd);
			if (!up.success) {
				toast.error(up.message || "Couldn't upload the photo");
				return;
			}
			const key = up.data?.key ?? up.data?.url;
			const res = await patch(`/api/messages/groups/${conversationId}`, {
				avatar: key,
			});
			if (res.success) onChanged();
			else toast.error(res.message || "Couldn't change the photo");
		} finally {
			setBusy(null);
		}
	};

	const toggleLock = async () => {
		setBusy("lock");
		const res = await patch(`/api/messages/groups/${conversationId}`, {
			adminsOnly: !adminsOnly,
		});
		setBusy(null);
		if (res.success) onChanged();
		else toast.error(res.message || "Couldn't change that");
	};

	const activeIdSet = useMemo(() => new Set(active.map((a) => a.id)), [active]);
	const toggleAdd = (u: PickedPerson) =>
		setAddSelected((prev) => {
			const next = { ...prev };
			if (next[u._id]) delete next[u._id];
			else next[u._id] = u;
			return next;
		});

	/** Add the picks (audit G41, G169): the gateway answers per person, and
	 *  the answer stays on screen so an invite never reads as a failure. */
	const addPeople = async () => {
		const picks = Object.values(addSelected);
		if (picks.length === 0) return;
		setBusy("add");
		const res = await postJsonDirect(`/api/messages/groups/${conversationId}/members`, {
			memberIds: picks.map((p) => p._id),
		});
		setBusy(null);
		// "Nobody could be added" still says what happened to each person.
		const results = (res.data?.results ?? []) as { id: string; status: AddOutcome }[];
		if (!res.success && results.length === 0) {
			toast.error(res.message || "Couldn't add them");
			return;
		}
		setAddOutcome(
			groupOutcomes(results, (id) => (addSelected[id] ? personName(addSelected[id]) : "Someone")),
		);
		setAddSelected({});
		if (res.success) onChanged();
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


	// Each cascade plays once: the roster per open of the sheet, the
	// candidates the first time they are shown. A refetch after a role change
	// or a search remounts rows, and those must cut.
	const rosterPlayed = useRef(false);
	useEffect(() => {
		rosterPlayed.current = open;
	}, [open]);

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
								<button
									type="button"
									onClick={() => iAmAdmin && photoInputRef.current?.click()}
									disabled={busy === "photo"}
									aria-label={iAmAdmin ? "Change group photo" : undefined}
									className={
										iAmAdmin
											? "group/photo relative flex h-20 w-20 cursor-pointer items-center justify-center overflow-hidden rounded-pill bg-raised disabled:opacity-60"
											: "relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-pill bg-raised"
									}
								>
									{avatar ? (
										<SafeAvatar src={avatar} eager />
									) : (
										<Users className="h-8 w-8 text-muted" />
									)}
									{iAmAdmin && (
										<span className="absolute inset-x-0 bottom-0 bg-scrim py-0.5 text-center font-sans text-[calc(9px*var(--ws-fs))] font-semibold uppercase tracking-wide text-primary opacity-0 transition-opacity group-hover/photo:opacity-100">
											Change
										</span>
									)}
								</button>
								<input
									ref={photoInputRef}
									type="file"
									accept="image/*"
									className="hidden"
									onChange={(e) => {
										const f = e.target.files?.[0];
										if (f) void changePhoto(f);
										if (photoInputRef.current) photoInputRef.current.value = "";
									}}
								/>
								{/* Name and field trade places; "wait" so the field
								    mounts (and takes focus) once the name is gone. */}
								<AnimatePresence mode="wait" initial={false}>
								{renaming ? (
									<motion.div
										key="rename"
										{...swap}
										className="flex w-full items-center gap-2"
									>
										<input
											value={draftName}
											onChange={(e) => setDraftName(e.target.value)}
											maxLength={80}
											autoFocus
											className="min-w-0 flex-1 rounded-[10px] bg-primary/5 px-3 py-2 text-center font-sans text-[calc(16px*var(--ws-fs))] font-semibold text-primary outline-none focus:bg-primary/10"
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
									</motion.div>
								) : (
									<motion.button
										key="name"
										{...swap}
										type="button"
										onClick={() => iAmAdmin && setRenaming(true)}
										className={
											iAmAdmin
												? "flex cursor-pointer items-center gap-1.5 font-display text-[calc(18px*var(--ws-fs))] font-semibold text-primary"
												: "font-display text-[calc(18px*var(--ws-fs))] font-semibold text-primary"
										}
									>
										{name}
										{iAmAdmin && (
											<Pencil className="h-3.5 w-3.5 text-muted" />
										)}
									</motion.button>
								)}
								</AnimatePresence>
								<span className="text-[calc(13px*var(--ws-fs))] text-muted">
									{active.length} members
								</span>
							</div>

							{/* Admin controls (register 99): the lock and the door. */}
							{iAmAdmin && (
								<div className="border-t border-hairline px-4 py-2">
									<button
										type="button"
										onClick={toggleLock}
										disabled={busy === "lock"}
										className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-[10px] px-1 py-2 text-left transition-colors hover:bg-primary/5 disabled:opacity-60"
									>
										<span className="min-w-0">
											<span className="block font-sans text-[calc(14px*var(--ws-fs))] font-medium text-primary">
												Only admins can send
											</span>
											<span className="block font-sans text-[calc(12px*var(--ws-fs))] text-muted">
												Members can read but not post
											</span>
										</span>
										<span
											className={
												adminsOnly
													? "relative h-6 w-11 shrink-0 rounded-pill bg-brand transition-colors"
													: "relative h-6 w-11 shrink-0 rounded-pill bg-chip transition-colors"
											}
										>
											{/* The knob travels on a transform, not on
											    `left`: 20px is the old 22px stop less the
											    2px inset. */}
											<motion.span
												initial={false}
												animate={{ x: adminsOnly ? 20 : 0 }}
												transition={snappySpring}
												className="absolute top-0.5 left-0.5 h-5 w-5 rounded-pill bg-page"
											/>
										</span>
									</button>
									<button
										type="button"
										onClick={() => setAddOpen((v) => !v)}
										className="flex w-full cursor-pointer items-center gap-2.5 rounded-[10px] px-1 py-2.5 text-left font-sans text-[calc(14px*var(--ws-fs))] font-medium text-primary transition-colors hover:bg-primary/5"
									>
										<UserPlus className="h-4 w-4 text-muted" />
										Add people
									</button>
									<AnimatePresence initial={false}>
									{addOpen && (
										<motion.div key="add-people" {...collapse} className="overflow-hidden">
											<div className="flex max-h-[46dvh] flex-col pb-2">
												<PeoplePicker
													myClerkId={currentClerkId ?? ""}
													exclude={activeIdSet}
													selected={addSelected}
													onToggle={toggleAdd}
													placeholder="Search anyone"
												/>
												{Object.keys(addSelected).length > 0 && (
													<button
														type="button"
														onClick={() => void addPeople()}
														disabled={busy === "add"}
														className="mx-4 mt-2 flex h-10 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-pill bg-brand font-sans text-[calc(13px*var(--ws-fs))] font-semibold text-brand-on transition-colors hover:bg-brand-active disabled:opacity-50"
													>
														{busy === "add" && <Loader2 className="h-4 w-4 animate-spin" />}
														Add {Object.keys(addSelected).length}
													</button>
												)}
												{addOutcome.length > 0 && (
													<div className="mx-4 mt-2 space-y-1.5">
														{addOutcome.map((g) => (
															<p key={g.status} className="font-sans text-[calc(12.5px*var(--ws-fs))] text-muted">
																<span className="font-semibold text-primary">{OUTCOME_WORDS[g.status].title}:</span>{" "}
																{g.names.join(", ")}
																{OUTCOME_WORDS[g.status].note ? `. ${OUTCOME_WORDS[g.status].note}` : ""}
															</p>
														))}
													</div>
												)}
											</div>
										</motion.div>
									)}
									</AnimatePresence>
								</div>
							)}

							{/* Roster */}
							<motion.div
								variants={staggerParentFast}
								initial={rosterPlayed.current ? false : "hidden"}
								animate="show"
								className="border-t border-hairline"
							>
								{active.map((a, i) => {
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
										<CascadeRow key={a.id} index={i}>
										<div className="flex items-center gap-3 px-4 py-2.5">
											<span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-pill bg-raised">
												<SafeAvatar src={u?.avatar} eager />
											</span>
											<span className="min-w-0 flex-1">
												<span
													className="block truncate font-sans text-[calc(14px*var(--ws-fs))] font-medium"
													style={{ color: senderColor(a.id) }}
												>
													{nm} {isMe && "(you)"}
												</span>
												{a.role !== "member" && (
													<span className="flex items-center gap-1 text-[calc(11.5px*var(--ws-fs))] text-subtle">
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
															className="flex h-8 w-8 items-center justify-center rounded-pill text-muted transition-colors hover:bg-primary/5 hover:text-primary disabled:opacity-50"
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
														className="flex h-8 w-8 items-center justify-center rounded-pill text-muted transition-colors hover:bg-primary/5 hover:text-danger disabled:opacity-50"
													>
														<UserMinus className="h-4 w-4" />
													</button>
												</div>
											)}
										</div>
										</CascadeRow>
									);
								})}
							</motion.div>
						</div>

						<div className="shrink-0 border-t border-hairline p-3">
							<button
								type="button"
								onClick={() => remove(myProfileId)}
								disabled={busy === myProfileId}
								className="flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-pill bg-raised font-sans text-[calc(14px*var(--ws-fs))] font-semibold text-danger transition-colors hover:bg-primary/5 disabled:opacity-50"
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
