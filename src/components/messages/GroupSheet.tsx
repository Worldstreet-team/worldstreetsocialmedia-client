"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	ArrowLeft,
	Ban,
	BellOff,
	Check,
	ChevronRight,
	Clock,
	Copy,
	Crown,
	History,
	Link2,
	Loader2,
	LogOut,
	Pencil,
	Search,
	Settings2,
	Shield,
	Trash2,
	UserPlus,
	Users,
} from "lucide-react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import {
	OverlayHeader,
	OverlayPanel,
	OverlayScrim,
	useOverlayDismiss,
} from "@/components/ui/Overlay";
import { SafeAvatar } from "@/components/ui/SafeAvatar";
import { SelectRow, ToggleRow } from "@/components/settings/inspector";
import { useGatewayRead } from "@/hooks/useGateway";
import { compressImage } from "@/lib/image-compress";
import { displayNameOf } from "@/lib/conversation-identity";
import { collapse, staggerParentFast, swap } from "@/lib/motion-presets";
import {
	deleteDirect,
	patchJsonDirect,
	postJsonDirect,
	sendFormDirect,
} from "@/lib/upload-direct";
import { formatTimeAgo } from "@/lib/utils";
import { CascadeRow } from "./ConversationList";
import {
	type AddOutcome,
	groupOutcomes,
	OUTCOME_WORDS,
	PeoplePicker,
	type PickedPerson,
	personName,
} from "./PeoplePicker";
import { senderColor } from "./thread/groupSystem";

/* ------------------------------------------------------------------ */
/* Shapes, as the gateway answers them                                 */
/* ------------------------------------------------------------------ */

type Role = "owner" | "admin" | "member";
type Rule = "everyone" | "admins";
const SETTING_KEYS = [
	"send",
	"media",
	"addMembers",
	"editInfo",
	"pin",
	"calls",
	"mentionAll",
	"money",
] as const;
type SettingKey = (typeof SETTING_KEYS)[number];
const SETTING_LABELS: Record<SettingKey, [string, string]> = {
	send: ["Send messages", "Who may post. Admins can always."],
	media: ["Send photos, videos and voice notes", ""],
	addMembers: ["Add people", "By their own setting, some get an invite instead."],
	editInfo: ["Edit the name, photo and description", ""],
	pin: ["Pin messages", "Three at most."],
	calls: ["Start calls", ""],
	mentionAll: ["Mention everyone", "Reaches the whole group, muted or not. Admins only above 32 people."],
	money: ["Send money", ""],
};
const RIGHT_KEYS = [
	"editInfo",
	"deleteMessages",
	"removeMembers",
	"banMembers",
	"approveJoins",
	"manageLinks",
	"restrictMembers",
	"addAdmins",
] as const;
type Right = (typeof RIGHT_KEYS)[number];
const RIGHT_LABELS: Record<Right, string> = {
	editInfo: "Edit the group",
	deleteMessages: "Remove anyone's messages",
	removeMembers: "Remove people",
	banMembers: "Ban people",
	approveJoins: "Approve who joins",
	manageLinks: "Manage invite links",
	restrictMembers: "Pause someone's messages",
	addAdmins: "Make other admins",
};
const DEFAULT_RIGHTS: Record<Right, boolean> = {
	editInfo: true,
	deleteMessages: true,
	removeMembers: true,
	banMembers: true,
	approveJoins: true,
	manageLinks: true,
	restrictMembers: true,
	addAdmins: false,
};

interface Person {
	_id: string;
	firstName?: string;
	lastName?: string;
	username?: string;
	avatar?: string;
}
interface GroupInfo {
	id: string;
	name?: string;
	description: string;
	avatar?: string;
	createdAt?: string;
	memberCount: number;
	adminCount: number;
	pendingCount?: number;
	settings: Record<SettingKey, Rule>;
	historyVisible: boolean;
	joinApproval: boolean;
	historyShare?: number;
	slowModeSec?: number;
	disappearSec?: number;
	me: {
		role: Role | null;
		muted: boolean;
		mutedUntil?: string;
		notifyLevel?: "all" | "mentions" | "none";
		permissions: Record<string, boolean>;
	};
}
interface RosterRow {
	profile: Person;
	role: Role;
	joinedAt?: string;
	addedBy?: Person | string;
	via?: string;
	restrictedUntil?: string;
	rights?: Partial<Record<Right, boolean>>;
}
interface GroupLink {
	code: string;
	by?: Person | string;
	at: string;
	title?: string;
	expiresAt?: string;
	maxUses?: number;
	uses: number;
	approval?: boolean;
	revokedAt?: string;
}
interface BanRow {
	profile: Person | string;
	by?: Person | string;
	at: string;
	until?: string;
}
interface LogRow {
	at: string;
	by?: Person | string;
	action: string;
	target?: Person | string;
	meta?: Record<string, unknown>;
}

type View =
	| "main"
	| "members"
	| "settings"
	| "links"
	| "bans"
	| "past"
	| "log"
	| "leave"
	| "delete"
	| { rights: RosterRow }
	| { handover: true };

const nameOf = (p: Person | string | undefined) =>
	typeof p === "object" && p ? displayNameOf(p) : "Someone";
const idOf = (p: Person | string | undefined) => (typeof p === "string" ? p : (p?._id ?? ""));

/** "Sep 24", or a relative stamp for the last day. */
const when = (iso?: string) => (iso ? formatTimeAgo(iso) : "");

/** The words for a log line (audit G120). */
function logWords(row: LogRow): string {
	const t = row.target ? nameOf(row.target) : "";
	switch (row.action) {
		case "member.removed":
			return `removed ${t}`;
		case "member.banned":
			return `banned ${t}`;
		case "member.unbanned":
			return `lifted the ban on ${t}`;
		case "member.promoted":
			return `made ${t} an admin`;
		case "member.demoted":
			return `took admin from ${t}`;
		case "member.rights":
			return `changed what ${t} may do`;
		case "member.restricted":
			return `paused ${t}'s messages`;
		case "member.unrestricted":
			return `let ${t} send again`;
		case "request.approved":
			return `let ${t} in`;
		case "request.declined":
			return `declined ${t}`;
		case "link.created":
			return "made an invite link";
		case "link.revoked":
			return "revoked an invite link";
		case "group.updated":
			return `changed ${((row.meta?.changed as string[]) ?? []).join(", ") || "the group"}`;
		case "group.deleted":
			return "deleted the group";
		case "group.restored":
			return "restored the group";
		case "owner.transferred":
			return `handed the group to ${t}`;
		case "message.pinned":
			return "pinned a message";
		default:
			return row.action;
	}
}

/** The group as it will read once the PATCH lands, for the optimistic
 *  paint. Only the fields updateGroup accepts. */
function applyGroupPatch(info: GroupInfo, body: Record<string, unknown>): GroupInfo {
	const next: GroupInfo = { ...info, settings: { ...info.settings } };
	if (typeof body.name === "string") next.name = body.name;
	if (typeof body.description === "string") next.description = body.description;
	if (typeof body.avatar === "string") next.avatar = body.avatar || undefined;
	if (body.settings && typeof body.settings === "object")
		next.settings = { ...next.settings, ...(body.settings as Partial<Record<SettingKey, Rule>>) };
	if (typeof body.joinApproval === "boolean") next.joinApproval = body.joinApproval;
	if (typeof body.historyVisible === "boolean") next.historyVisible = body.historyVisible;
	if (typeof body.historyShare === "number") next.historyShare = body.historyShare;
	if (typeof body.slowModeSec === "number") next.slowModeSec = body.slowModeSec;
	if (typeof body.disappearSec === "number") next.disappearSec = body.disappearSec;
	if (typeof body.adminsOnly === "boolean") next.settings.send = body.adminsOnly ? "admins" : "everyone";
	return next;
}

const NOTIFY_SPANS: Record<string, number> = { "8h": 8 * 3600_000, "1w": 7 * 24 * 3600_000 };

const notifyValue = (me: GroupInfo["me"]): "all" | "mentions" | "8h" | "1w" | "none" => {
	if (me.notifyLevel === "none") return "none";
	if (me.muted) {
		if (!me.mutedUntil) return "none";
		const left = new Date(me.mutedUntil).getTime() - Date.now();
		return left > 24 * 3600_000 ? "1w" : "8h";
	}
	return me.notifyLevel === "mentions" ? "mentions" : "all";
};

/* ------------------------------------------------------------------ */
/* The sheet                                                           */
/* ------------------------------------------------------------------ */

/**
 * The group, in one sheet (audit G170, G172, G176, G177, G78). It reads the
 * group from GET /groups/:id, so what it shows and what it lets you do
 * come from `me.permissions`, never from a guess about roles. One panel,
 * many views: the front (identity, notifications, the doors to the rest),
 * members with their actions, settings, invite links, bans, past
 * participants, the admin log, and the ways out.
 */
export function GroupSheet({
	open,
	onClose,
	conversationId,
	currentClerkId,
	myProfileId,
	onChanged,
	onLeft,
	onOpenRequests,
	epoch,
}: {
	open: boolean;
	onClose: () => void;
	conversationId: string;
	/** Clerk id, for the follows behind Add people. */
	currentClerkId?: string;
	myProfileId: string;
	/** The inbox row or the header changed: refetch. */
	onChanged: () => void;
	/** I left, or the group is gone: leave the thread. */
	onLeft: () => void;
	/** People asking to join, in their own sheet. */
	onOpenRequests: () => void;
	/** Bumped by the parent when the room changes under the sheet. */
	epoch?: number;
}) {
	const read = useGatewayRead();
	const [info, setInfo] = useState<GroupInfo | null>(null);
	const [view, setView] = useState<View>("main");
	const [busy, setBusy] = useState<string | null>(null);
	useOverlayDismiss(open, onClose);

	const load = useCallback(async () => {
		const res = await read(`/api/messages/groups/${conversationId}`, (b) => b);
		if (res.success && res.data?.id) setInfo(res.data as GroupInfo);
		else if (!res.success) toast.error(res.message || "Couldn't load the group");
	}, [read, conversationId]);

	useEffect(() => {
		if (!open) {
			setView("main");
			return;
		}
		void load();
	}, [open, load]);

	const refresh = useCallback(async () => {
		await load();
		onChanged();
	}, [load, onChanged]);

	const can = (k: string) => Boolean(info?.me.permissions?.[k]);
	const isAdmin = info?.me.role === "owner" || info?.me.role === "admin";
	const isOwner = info?.me.role === "owner";

	/* ---- the group PATCH, one field at a time ---- */
	// Optimistic (owner 2026-09-25): the control answers the moment it is
	// touched; the read after the write confirms, and a refusal puts the
	// old value back. It used to wait on the round trip and the refetch,
	// so the row in the thread arrived before the switch moved.
	const patchGroup = async (body: Record<string, unknown>, key: string) => {
		const before = info;
		if (info) setInfo(applyGroupPatch(info, body));
		setBusy(key);
		const res = await patchJsonDirect(`/api/messages/groups/${conversationId}`, body);
		setBusy(null);
		if (!res.success) {
			setInfo(before);
			toast.error(res.message || "Couldn't change that");
			return false;
		}
		await refresh();
		return true;
	};

	// Another tab, another admin, or the realtime event for this room:
	// the parent bumps `epoch` and the sheet re-reads in place.
	useEffect(() => {
		if (open && epoch) void load();
	}, [epoch, open, load]);

	const title =
		typeof view === "string"
			? {
					main: "Group",
					members: "Members",
					settings: "Group settings",
					links: "Invite links",
					bans: "Banned",
					past: "Past participants",
					log: "Admin log",
					leave: "Leave group",
					delete: "Delete group",
				}[view]
			: "rights" in view
				? `${nameOf(view.rights.profile)} can`
				: "Hand the group over";

	return (
		<AnimatePresence>
			{open && (
				<>
					<OverlayScrim onClose={onClose} />
					<OverlayPanel
						dragClose={onClose}
						variant="sheet"
						ground="none"
						className="bg-surface sm:w-[min(560px,94vw)] sm:max-h-[86vh]"
						label="Group details"
					>
						<OverlayHeader title={title} onClose={onClose}>
							{/* Children replace the title, so a sub-view carries
							    both the way back and its own name. */}
							{view !== "main" ? (
								<>
									<button
										type="button"
										onClick={() => setView("main")}
										aria-label="Back"
										className="-ml-2 flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-pill text-muted transition-colors hover:bg-primary/5 hover:text-primary"
									>
										<ArrowLeft className="h-5 w-5" />
									</button>
									<h2 className="flex-1 truncate font-sans text-[calc(14px*var(--ws-fs))] font-semibold text-primary">
										{title}
									</h2>
								</>
							) : undefined}
						</OverlayHeader>

						{!info ? (
							<div className="flex flex-col items-center justify-center py-16 text-muted">
								<Loader2 className="mb-3 h-6 w-6 animate-spin" />
								<span className="text-sm">Loading</span>
							</div>
						) : (
							<AnimatePresence mode="wait" initial={false}>
								<motion.div
									key={typeof view === "string" ? view : Object.keys(view)[0]}
									{...swap}
									className="flex min-h-0 flex-1 flex-col"
								>
									{view === "main" && (
										<MainView
											info={info}
											setInfo={setInfo}
											busy={busy}
											patchGroup={patchGroup}
											can={can}
											isAdmin={Boolean(isAdmin)}
											isOwner={Boolean(isOwner)}
											conversationId={conversationId}
											go={setView}
											onOpenRequests={onOpenRequests}
											refresh={refresh}
											setBusy={setBusy}
										/>
									)}
									{view === "members" && (
										<MembersView
											info={info}
											conversationId={conversationId}
											myProfileId={myProfileId}
											currentClerkId={currentClerkId ?? ""}
											can={can}
											isOwner={Boolean(isOwner)}
											refresh={refresh}
											go={setView}
										/>
									)}
									{view === "settings" && (
										<SettingsView info={info} busy={busy} patchGroup={patchGroup} />
									)}
									{view === "links" && (
										<LinksView conversationId={conversationId} info={info} />
									)}
									{view === "bans" && <BansView conversationId={conversationId} />}
									{view === "past" && <PastView conversationId={conversationId} />}
									{view === "log" && <LogView conversationId={conversationId} />}
									{view === "leave" && (
										<LeaveView
											info={info}
											conversationId={conversationId}
											myProfileId={myProfileId}
											isOwner={Boolean(isOwner)}
											onLeft={onLeft}
											onClose={onClose}
											go={setView}
										/>
									)}
									{view === "delete" && (
										<DeleteView
											info={info}
											conversationId={conversationId}
											onLeft={onLeft}
											onClose={onClose}
										/>
									)}
									{typeof view === "object" && "rights" in view && (
										<RightsView
											conversationId={conversationId}
											member={view.rights}
											onDone={() => {
												void refresh();
												setView("members");
											}}
										/>
									)}
									{typeof view === "object" && "handover" in view && (
										<HandoverView
											conversationId={conversationId}
											myProfileId={myProfileId}
											onDone={async (thenLeave) => {
												await refresh();
												if (thenLeave) setView("leave");
												else setView("main");
											}}
										/>
									)}
								</motion.div>
							</AnimatePresence>
						)}
					</OverlayPanel>
				</>
			)}
		</AnimatePresence>
	);
}

/* ------------------------------------------------------------------ */
/* Pieces                                                              */
/* ------------------------------------------------------------------ */

function DoorRow({
	icon,
	label,
	value,
	onClick,
	href,
	tone,
}: {
	icon: React.ReactNode;
	label: string;
	value?: React.ReactNode;
	onClick?: () => void;
	href?: string;
	tone?: "danger";
}) {
	const inner = (
		<>
			<span className={tone === "danger" ? "text-danger" : "text-muted"}>{icon}</span>
			<span
				className={
					tone === "danger"
						? "min-w-0 flex-1 truncate font-sans text-[calc(14px*var(--ws-fs))] font-medium text-danger"
						: "min-w-0 flex-1 truncate font-sans text-[calc(14px*var(--ws-fs))] font-medium text-primary"
				}
			>
				{label}
			</span>
			{value !== undefined && (
				<span className="shrink-0 font-sans text-[calc(13px*var(--ws-fs))] tabular-nums text-muted">
					{value}
				</span>
			)}
			<ChevronRight className="h-4 w-4 shrink-0 text-subtle" />
		</>
	);
	const cls =
		"flex min-h-[48px] w-full cursor-pointer items-center gap-3 rounded-[10px] px-2 text-left transition-colors hover:bg-primary/5";
	if (href)
		return (
			<Link href={href} className={cls}>
				{inner}
			</Link>
		);
	return (
		<button type="button" onClick={onClick} className={cls}>
			{inner}
		</button>
	);
}

function Section({ title, children }: { title?: string; children: React.ReactNode }) {
	return (
		<section className="px-3 py-2">
			{title && (
				<h3 className="px-2 pb-1 font-sans text-[calc(13px*var(--ws-fs))] font-semibold text-primary">
					{title}
				</h3>
			)}
			<div className="flex flex-col">{children}</div>
		</section>
	);
}

/* ---------------------------- main ---------------------------- */

function MainView({
	info,
	setInfo,
	busy,
	patchGroup,
	can,
	isAdmin,
	isOwner,
	conversationId,
	go,
	onOpenRequests,
	refresh,
	setBusy,
}: {
	info: GroupInfo;
	setInfo: (next: GroupInfo | null) => void;
	busy: string | null;
	patchGroup: (body: Record<string, unknown>, key: string) => Promise<boolean>;
	can: (k: string) => boolean;
	isAdmin: boolean;
	isOwner: boolean;
	conversationId: string;
	go: (v: View) => void;
	onOpenRequests: () => void;
	refresh: () => Promise<void>;
	setBusy: (k: string | null) => void;
}) {
	const [renaming, setRenaming] = useState(false);
	const [draftName, setDraftName] = useState(info.name ?? "");
	const [describing, setDescribing] = useState(false);
	const [draftDesc, setDraftDesc] = useState(info.description ?? "");
	const photoInputRef = useRef<HTMLInputElement | null>(null);
	const canEdit = can("editInfo");

	const rename = async () => {
		const next = draftName.trim();
		setRenaming(false);
		if (!next || next === info.name) return;
		await patchGroup({ name: next }, "rename");
	};
	const describe = async () => {
		const next = draftDesc.trim().slice(0, 500);
		setDescribing(false);
		if (next === (info.description ?? "")) return;
		await patchGroup({ description: next }, "describe");
	};
	/** Compress, upload direct, PATCH the key. */
	const changePhoto = async (file: File) => {
		setBusy("photo");
		try {
			const small = await compressImage(file, { maxEdge: 512, quality: 0.85, skipUnderBytes: 40 * 1024 });
			const fd = new FormData();
			fd.append("file", small);
			const up = await sendFormDirect("/api/messages/upload", fd);
			if (!up.success) {
				toast.error(up.message || "Couldn't upload the photo");
				return;
			}
			await patchGroup({ avatar: up.data?.key ?? up.data?.url }, "photo");
		} finally {
			setBusy(null);
		}
	};

	const notify = notifyValue(info.me);
	const setNotify = async (v: typeof notify) => {
		// Optimistic: the pill reads the new value at once.
		const before = info;
		setInfo({
			...info,
			me:
				v === "8h" || v === "1w"
					? { ...info.me, muted: true, mutedUntil: new Date(Date.now() + NOTIFY_SPANS[v]).toISOString(), notifyLevel: "all" }
					: v === "none"
						? { ...info.me, muted: true, mutedUntil: undefined, notifyLevel: "none" }
						: { ...info.me, muted: false, mutedUntil: undefined, notifyLevel: v },
		});
		const res =
			v === "8h" || v === "1w"
				? await patchJsonDirect(`/api/messages/conversations/${conversationId}/mute`, { until: v })
				: await patchJsonDirect(`/api/messages/conversations/${conversationId}/notifications`, { level: v });
		if (!res.success) {
			setInfo(before);
			toast.error(res.message || "Couldn't change that");
			return;
		}
		await refresh();
	};

	return (
		<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[calc(12px+var(--ws-safe-bottom))]">
			{/* Identity */}
			<div className="flex flex-col items-center gap-2 px-4 pb-3 pt-1">
				<button
					type="button"
					onClick={() => canEdit && photoInputRef.current?.click()}
					disabled={busy === "photo"}
					aria-label={canEdit ? "Change group photo" : undefined}
					className={
						canEdit
							? "group/photo relative flex h-20 w-20 cursor-pointer items-center justify-center overflow-hidden rounded-pill bg-raised disabled:opacity-60"
							: "relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-pill bg-raised"
					}
				>
					{info.avatar ? <SafeAvatar src={info.avatar} eager /> : <Users className="h-8 w-8 text-muted" />}
					{canEdit && (
						<span className="absolute inset-x-0 bottom-0 bg-scrim py-0.5 text-center font-sans text-[calc(10px*var(--ws-fs))] font-semibold text-primary opacity-0 transition-opacity group-hover/photo:opacity-100">
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
				<AnimatePresence mode="wait" initial={false}>
					{renaming ? (
						<motion.div key="rename" {...swap} className="flex w-full items-center gap-2">
							<input
								value={draftName}
								onChange={(e) => setDraftName(e.target.value)}
								onKeyDown={(e) => e.key === "Enter" && void rename()}
								maxLength={80}
								autoFocus
								className="min-w-0 flex-1 rounded-[10px] bg-primary/5 px-3 py-2 text-center font-sans text-[calc(16px*var(--ws-fs))] font-semibold text-primary outline-none focus:bg-primary/10"
							/>
							<button
								type="button"
								onClick={() => void rename()}
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
							onClick={() => {
								if (!canEdit) return;
								setDraftName(info.name ?? "");
								setRenaming(true);
							}}
							className={
								canEdit
									? "flex cursor-pointer items-center gap-1.5 font-display text-[calc(18px*var(--ws-fs))] font-semibold text-primary"
									: "font-display text-[calc(18px*var(--ws-fs))] font-semibold text-primary"
							}
						>
							{info.name}
							{canEdit && <Pencil className="h-3.5 w-3.5 text-muted" />}
						</motion.button>
					)}
				</AnimatePresence>
				<span className="font-sans text-[calc(13px*var(--ws-fs))] text-muted">
					{info.memberCount} {info.memberCount === 1 ? "member" : "members"}
					{info.createdAt ? ` · since ${when(info.createdAt)}` : ""}
				</span>
				{/* What the group is about (audit G78). */}
				<AnimatePresence mode="wait" initial={false}>
					{describing ? (
						<motion.div key="desc" {...swap} className="w-full">
							<textarea
								value={draftDesc}
								onChange={(e) => setDraftDesc(e.target.value)}
								maxLength={500}
								rows={3}
								autoFocus
								placeholder="What is this group about?"
								className="w-full resize-none rounded-[10px] bg-primary/5 px-3 py-2 font-sans text-[calc(14px*var(--ws-fs))] text-primary outline-none placeholder:text-subtle focus:bg-primary/10"
							/>
							<div className="mt-1 flex justify-end gap-2">
								<button
									type="button"
									onClick={() => setDescribing(false)}
									className="h-9 cursor-pointer rounded-pill px-3 font-sans text-[calc(13px*var(--ws-fs))] font-medium text-muted hover:bg-primary/5"
								>
									Cancel
								</button>
								<button
									type="button"
									onClick={() => void describe()}
									disabled={busy === "describe"}
									className="h-9 cursor-pointer rounded-pill bg-brand px-4 font-sans text-[calc(13px*var(--ws-fs))] font-semibold text-brand-on disabled:opacity-50"
								>
									Save
								</button>
							</div>
						</motion.div>
					) : info.description ? (
						<motion.button
							key="has-desc"
							{...swap}
							type="button"
							onClick={() => {
								if (!canEdit) return;
								setDraftDesc(info.description);
								setDescribing(true);
							}}
							className={
								canEdit
									? "max-w-[420px] cursor-pointer whitespace-pre-wrap break-words text-center font-sans text-[calc(14px*var(--ws-fs))] text-primary"
									: "max-w-[420px] whitespace-pre-wrap break-words text-center font-sans text-[calc(14px*var(--ws-fs))] text-primary"
							}
						>
							{info.description}
						</motion.button>
					) : canEdit ? (
						<motion.button
							key="no-desc"
							{...swap}
							type="button"
							onClick={() => {
								setDraftDesc("");
								setDescribing(true);
							}}
							className="cursor-pointer font-sans text-[calc(13px*var(--ws-fs))] text-muted hover:text-primary"
						>
							Add a description
						</motion.button>
					) : null}
				</AnimatePresence>
			</div>

			<div className="px-5">
				<div className="flex flex-col [&>*:last-child]:border-b-0">
					<SelectRow
						label="Notifications"
						hint="Mentions and @everyone still reach you while muted."
						value={notify}
						options={[
							["all", "All messages"],
							["mentions", "Mentions only"],
							["8h", "Muted for 8 hours"],
							["1w", "Muted for a week"],
							["none", "Muted"],
						] as const}
						onPick={(v) => void setNotify(v)}
					/>
				</div>
			</div>

			<Section>
				<DoorRow
					icon={<Users className="h-5 w-5" />}
					label="Members"
					value={info.memberCount}
					onClick={() => go("members")}
				/>
				{can("approveJoins") && (info.pendingCount ?? 0) > 0 && (
					<DoorRow
						icon={<UserPlus className="h-5 w-5" />}
						label="Waiting to get in"
						value={info.pendingCount}
						onClick={onOpenRequests}
					/>
				)}
				{can("manageLinks") && (
					<DoorRow icon={<Link2 className="h-5 w-5" />} label="Invite links" onClick={() => go("links")} />
				)}
				{isAdmin && (
					<DoorRow
						icon={<Settings2 className="h-5 w-5" />}
						label="Group settings"
						onClick={() => go("settings")}
					/>
				)}
			</Section>

			{isAdmin && (
				<Section title="Admins">
					{can("banMembers") && (
						<DoorRow icon={<Ban className="h-5 w-5" />} label="Banned" onClick={() => go("bans")} />
					)}
					<DoorRow
						icon={<History className="h-5 w-5" />}
						label="Past participants"
						onClick={() => go("past")}
					/>
					<DoorRow icon={<Clock className="h-5 w-5" />} label="Admin log" onClick={() => go("log")} />
				</Section>
			)}

			<Section>
				<DoorRow
					icon={<LogOut className="h-5 w-5" />}
					label="Leave group"
					tone="danger"
					onClick={() => go("leave")}
				/>
				{isOwner && (
					<DoorRow
						icon={<Trash2 className="h-5 w-5" />}
						label="Delete group"
						tone="danger"
						onClick={() => go("delete")}
					/>
				)}
			</Section>
		</div>
	);
}

/* --------------------------- settings --------------------------- */

function SettingsView({
	info,
	busy,
	patchGroup,
}: {
	info: GroupInfo;
	busy: string | null;
	patchGroup: (body: Record<string, unknown>, key: string) => Promise<boolean>;
}) {
	const history: "hidden" | "25" | "100" | "all" = info.historyVisible
		? "all"
		: info.historyShare === 25
			? "25"
			: info.historyShare === 100
				? "100"
				: "hidden";
	return (
		<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-[calc(20px+var(--ws-safe-bottom))]">
			<Group title="Who can">
				{SETTING_KEYS.map((k) => (
					<SelectRow
						key={k}
						label={SETTING_LABELS[k][0]}
						hint={SETTING_LABELS[k][1] || undefined}
						value={info.settings[k] ?? "everyone"}
						options={[
							["everyone", "Everyone"],
							["admins", "Admins"],
						] as const}
						onPick={(v) => void patchGroup({ settings: { [k]: v } }, `setting:${k}`)}
					/>
				))}
			</Group>
			<Group title="Joining">
				<ToggleRow
					label="Approve new members"
					hint="Link joins and members' adds wait for an admin."
					checked={info.joinApproval}
					onChange={(v) => void patchGroup({ joinApproval: v }, "joinApproval")}
				/>
				<SelectRow
					label="History for new members"
					hint="What someone sees from before they joined."
					value={history}
					options={[
						["hidden", "Nothing"],
						["25", "The last 25 messages"],
						["100", "The last 100 messages"],
						["all", "Everything"],
					] as const}
					onPick={(v) =>
						void patchGroup(
							v === "all"
								? { historyVisible: true }
								: { historyVisible: false, historyShare: v === "hidden" ? 0 : Number(v) },
							"history",
						)
					}

				/>
			</Group>
			<Group title="Pace">
				<SelectRow
					label="Slow mode"
					hint="One message per member per span. Admins are exempt."
					value={info.slowModeSec ?? 0}
					options={[
						[0, "Off"],
						[10, "10 seconds"],
						[30, "30 seconds"],
						[60, "1 minute"],
						[300, "5 minutes"],
						[900, "15 minutes"],
						[3600, "1 hour"],
					] as const}
					onPick={(v) => void patchGroup({ slowModeSec: v }, "slow")}
				/>
				<SelectRow
					label="Disappearing messages"
					hint="Applies to what is sent from now on."
					value={info.disappearSec ?? 0}
					options={[
						[0, "Off"],
						[86400, "24 hours"],
						[604800, "7 days"],
						[7776000, "90 days"],
					] as const}
					onPick={(v) => void patchGroup({ disappearSec: v }, "disappear")}
				/>
			</Group>
		</div>
	);
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
	return (
		<section className="pt-4">
			<h3 className="pb-1 font-display text-[calc(15px*var(--ws-fs))] font-semibold tracking-tight text-primary">
				{title}
			</h3>
			<div className="flex flex-col [&>*:last-child]:border-b-0">{children}</div>
		</section>
	);
}

/* ---------------------------- members ---------------------------- */

function MembersView({
	info,
	conversationId,
	myProfileId,
	currentClerkId,
	can,
	isOwner,
	refresh,
	go,
}: {
	info: GroupInfo;
	conversationId: string;
	myProfileId: string;
	currentClerkId: string;
	can: (k: string) => boolean;
	isOwner: boolean;
	refresh: () => Promise<void>;
	go: (v: View) => void;
}) {
	const read = useGatewayRead();
	const [rows, setRows] = useState<RosterRow[] | null>(null);
	const [total, setTotal] = useState(0);
	const [q, setQ] = useState("");
	const [openId, setOpenId] = useState<string | null>(null);
	const [busy, setBusy] = useState<string | null>(null);
	const [adding, setAdding] = useState(false);
	const [addSelected, setAddSelected] = useState<Record<string, PickedPerson>>({});
	const [addOutcome, setAddOutcome] = useState<{ status: AddOutcome; names: string[] }[]>([]);
	const PAGE = 50;

	const loadPage = useCallback(
		async (offset: number, query: string) => {
			const res = await read(
				`/api/messages/groups/${conversationId}/members?offset=${offset}&limit=${PAGE}${query ? `&q=${encodeURIComponent(query)}` : ""}`,
				(b) => b,
			);
			if (!res.success) return;
			const page = (res.data?.members ?? []) as RosterRow[];
			setTotal(res.data?.total ?? page.length);
			setRows((prev) => (offset === 0 || !prev ? page : [...prev, ...page]));
		},
		[read, conversationId],
	);

	useEffect(() => {
		const id = window.setTimeout(() => void loadPage(0, q.trim()), q ? 250 : 0);
		return () => window.clearTimeout(id);
	}, [q, loadPage]);

	const reload = async () => {
		await loadPage(0, q.trim());
		await refresh();
	};

	const act = async (key: string, run: () => Promise<{ success: boolean; message?: string }>) => {
		setBusy(key);
		const res = await run();
		setBusy(null);
		if (!res.success) {
			toast.error(res.message || "Couldn't do that");
			return;
		}
		setOpenId(null);
		await reload();
	};

	const setRole = (id: string, role: "admin" | "member") =>
		act(`${id}:role`, () => patchJsonDirect(`/api/messages/groups/${conversationId}/members/${id}`, { role }));
	const restrict = (id: string, span: "1h" | "1d" | "1w" | null) =>
		act(`${id}:restrict`, () =>
			patchJsonDirect(`/api/messages/groups/${conversationId}/members/${id}`, { restrict: span }),
		);
	const remove = (id: string, ban: boolean) =>
		act(`${id}:remove`, () =>
			deleteDirect(`/api/messages/groups/${conversationId}/members/${id}${ban ? "?ban=1" : ""}`),
		);

	const activeIds = useMemo(() => new Set((rows ?? []).map((r) => r.profile._id)), [rows]);
	const toggleAdd = (u: PickedPerson) =>
		setAddSelected((prev) => {
			const next = { ...prev };
			if (next[u._id]) delete next[u._id];
			else next[u._id] = u;
			return next;
		});
	const addPeople = async () => {
		const picks = Object.values(addSelected);
		if (!picks.length) return;
		setBusy("add");
		const res = await postJsonDirect(`/api/messages/groups/${conversationId}/members`, {
			memberIds: picks.map((p) => p._id),
		});
		setBusy(null);
		const results = (res.data?.results ?? []) as { id: string; status: AddOutcome }[];
		if (!res.success && results.length === 0) {
			toast.error(res.message || "Couldn't add them");
			return;
		}
		setAddOutcome(groupOutcomes(results, (id) => (addSelected[id] ? personName(addSelected[id]) : "Someone")));
		setAddSelected({});
		if (res.success) await reload();
	};

	return (
		<div className="flex min-h-0 flex-1 flex-col">
			<div className="shrink-0 px-4 pb-2">
				{can("addMembers") && (
					<button
						type="button"
						onClick={() => setAdding((v) => !v)}
						className="mb-2 flex min-h-[44px] w-full cursor-pointer items-center gap-2.5 rounded-[10px] px-2 text-left font-sans text-[calc(14px*var(--ws-fs))] font-medium text-primary transition-colors hover:bg-primary/5"
					>
						<UserPlus className="h-5 w-5 text-muted" />
						Add people
						<ChevronRight className={adding ? "ml-auto h-4 w-4 rotate-90 text-subtle transition-transform" : "ml-auto h-4 w-4 text-subtle transition-transform"} />
					</button>
				)}
				<AnimatePresence initial={false}>
					{adding && (
						<motion.div key="add" {...collapse} className="overflow-hidden">
							<div className="flex max-h-[40dvh] flex-col pb-2">
								<PeoplePicker
									myClerkId={currentClerkId}
									exclude={activeIds}
									selected={addSelected}
									onToggle={toggleAdd}
									placeholder="Search anyone"
								/>
								{Object.keys(addSelected).length > 0 && (
									<button
										type="button"
										onClick={() => void addPeople()}
										disabled={busy === "add"}
										className="mx-4 mt-2 flex h-10 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-pill bg-brand font-sans text-[calc(13px*var(--ws-fs))] font-semibold text-brand-on disabled:opacity-50"
									>
										{busy === "add" && <Loader2 className="h-4 w-4 animate-spin" />}
										Add {Object.keys(addSelected).length}
									</button>
								)}
								{addOutcome.length > 0 && (
									<div className="mx-4 mt-2 space-y-1">
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
				<div className="relative">
					<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
					<input
						value={q}
						onChange={(e) => setQ(e.target.value)}
						placeholder={`Search ${total || info.memberCount} members`}
						className="w-full rounded-pill bg-primary/5 py-2 pl-10 pr-4 font-sans text-[calc(13px*var(--ws-fs))] text-primary outline-none transition-colors placeholder:text-subtle focus:bg-primary/10"
					/>
				</div>
			</div>

			<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[calc(12px+var(--ws-safe-bottom))]">
				{rows === null ? (
					<div className="flex justify-center py-10 text-muted">
						<Loader2 className="h-6 w-6 animate-spin" />
					</div>
				) : (
					<motion.div variants={staggerParentFast} initial="hidden" animate="show">
						{rows.map((r, i) => {
							const id = r.profile._id;
							const isMe = id === myProfileId;
							const nm = displayNameOf(r.profile);
							const restricted = r.restrictedUntil && new Date(r.restrictedUntil) > new Date();
							const canManage =
								!isMe &&
								r.role !== "owner" &&
								(r.role === "member" ? can("removeMembers") || can("restrictMembers") || can("addAdmins") : isOwner);
							const open = openId === id;
							return (
								<CascadeRow key={id} index={i}>
									<div>
										<button
											type="button"
											onClick={() => (canManage ? setOpenId(open ? null : id) : undefined)}
											className={
												canManage
													? "flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-primary/5"
													: "flex w-full items-center gap-3 px-4 py-2.5 text-left"
											}
										>
											<span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-pill bg-raised">
												<SafeAvatar src={r.profile.avatar} eager />
											</span>
											<span className="min-w-0 flex-1">
												<span
													className="block truncate font-sans text-[calc(14px*var(--ws-fs))] font-medium"
													style={{ color: senderColor(id) }}
												>
													{nm}
													{isMe && " (you)"}
												</span>
												<span className="flex items-center gap-1.5 truncate font-sans text-[calc(11.5px*var(--ws-fs))] text-subtle">
													{r.role === "owner" ? (
														<>
															<Crown className="h-3 w-3" /> owner
														</>
													) : r.role === "admin" ? (
														<>
															<Shield className="h-3 w-3" /> admin
														</>
													) : r.profile.username ? (
														`@${r.profile.username}`
													) : null}
													{r.via === "link"
														? " · joined by link"
														: r.addedBy && typeof r.addedBy === "object" && idOf(r.addedBy) !== id
															? ` · added by ${nameOf(r.addedBy)}`
															: ""}
													{restricted ? " · paused" : ""}
												</span>
											</span>
											{canManage && (
												<ChevronRight
													className={
														open
															? "h-4 w-4 shrink-0 rotate-90 text-subtle transition-transform"
															: "h-4 w-4 shrink-0 text-subtle transition-transform"
													}
												/>
											)}
										</button>
										<AnimatePresence initial={false}>
											{open && (
												<motion.div key="actions" {...collapse} className="overflow-hidden">
													<div className="flex flex-wrap gap-1.5 px-4 pb-3 pl-[68px]">
														<Link
															href={`/profile/${r.profile.username ?? ""}`}
															className="h-9 rounded-pill bg-primary/5 px-3 font-sans text-[calc(12.5px*var(--ws-fs))] font-medium leading-9 text-primary hover:bg-primary/10"
														>
															View profile
														</Link>
														{r.role === "member" && can("addAdmins") && (
															<ActionChip busy={busy === `${id}:role`} onClick={() => void setRole(id, "admin")}>
																Make admin
															</ActionChip>
														)}
														{r.role === "admin" && isOwner && (
															<>
																<ActionChip busy={busy === `${id}:role`} onClick={() => void setRole(id, "member")}>
																	Remove admin
																</ActionChip>
																<ActionChip onClick={() => go({ rights: r })}>What they can do</ActionChip>
															</>
														)}
														{(r.role === "member" || isOwner) && can("restrictMembers") && (
															restricted ? (
																<ActionChip busy={busy === `${id}:restrict`} onClick={() => void restrict(id, null)}>
																	Let them send
																</ActionChip>
															) : (
																<>
																	<ActionChip busy={busy === `${id}:restrict`} onClick={() => void restrict(id, "1h")}>
																		Pause 1h
																	</ActionChip>
																	<ActionChip busy={busy === `${id}:restrict`} onClick={() => void restrict(id, "1d")}>
																		Pause 1d
																	</ActionChip>
																	<ActionChip busy={busy === `${id}:restrict`} onClick={() => void restrict(id, "1w")}>
																		Pause 1w
																	</ActionChip>
																</>
															)
														)}
														{(r.role === "member" || isOwner) && can("removeMembers") && (
															<ActionChip tone="danger" busy={busy === `${id}:remove`} onClick={() => void remove(id, false)}>
																Remove
															</ActionChip>
														)}
														{(r.role === "member" || isOwner) && can("banMembers") && (
															<ActionChip tone="danger" busy={busy === `${id}:remove`} onClick={() => void remove(id, true)}>
																Remove and ban
															</ActionChip>
														)}
													</div>
												</motion.div>
											)}
										</AnimatePresence>
									</div>
								</CascadeRow>
							);
						})}
						{rows.length < total && (
							<button
								type="button"
								onClick={() => void loadPage(rows.length, q.trim())}
								className="mx-auto my-2 block cursor-pointer rounded-pill px-4 py-2 font-sans text-[calc(13px*var(--ws-fs))] font-medium text-muted hover:bg-primary/5 hover:text-primary"
							>
								Show more
							</button>
						)}
					</motion.div>
				)}
			</div>
		</div>
	);
}

function ActionChip({
	children,
	onClick,
	busy,
	tone,
}: {
	children: React.ReactNode;
	onClick: () => void;
	busy?: boolean;
	tone?: "danger";
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			disabled={busy}
			className={
				tone === "danger"
					? "h-9 cursor-pointer rounded-pill bg-primary/5 px-3 font-sans text-[calc(12.5px*var(--ws-fs))] font-medium text-danger transition-colors hover:bg-primary/10 disabled:opacity-50"
					: "h-9 cursor-pointer rounded-pill bg-primary/5 px-3 font-sans text-[calc(12.5px*var(--ws-fs))] font-medium text-primary transition-colors hover:bg-primary/10 disabled:opacity-50"
			}
		>
			{children}
		</button>
	);
}

/* ---------------------------- rights ---------------------------- */

function RightsView({
	conversationId,
	member,
	onDone,
}: {
	conversationId: string;
	member: RosterRow;
	onDone: () => void;
}) {
	const [rights, setRights] = useState<Record<Right, boolean>>({ ...DEFAULT_RIGHTS, ...(member.rights ?? {}) });
	const [busy, setBusy] = useState(false);
	const save = async () => {
		setBusy(true);
		const res = await patchJsonDirect(`/api/messages/groups/${conversationId}/members/${member.profile._id}`, {
			rights,
		});
		setBusy(false);
		if (!res.success) {
			toast.error(res.message || "Couldn't save that");
			return;
		}
		onDone();
	};
	return (
		<div className="flex min-h-0 flex-1 flex-col">
			<div className="min-h-0 flex-1 overflow-y-auto px-5">
				<p className="pb-2 pt-1 font-sans text-[calc(13px*var(--ws-fs))] text-muted">
					An admin has everything except making other admins, unless you say otherwise.
				</p>
				<div className="flex flex-col [&>*:last-child]:border-b-0">
					{RIGHT_KEYS.map((k) => (
						<ToggleRow
							key={k}
							label={RIGHT_LABELS[k]}
							checked={rights[k]}
							onChange={(v) => setRights((prev) => ({ ...prev, [k]: v }))}
						/>
					))}
				</div>
			</div>
			<div className="shrink-0 border-t border-hairline p-3">
				<button
					type="button"
					onClick={() => void save()}
					disabled={busy}
					className="flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-pill bg-brand font-sans text-[calc(14px*var(--ws-fs))] font-semibold text-brand-on disabled:opacity-50"
				>
					{busy && <Loader2 className="h-4 w-4 animate-spin" />}
					Save
				</button>
			</div>
		</div>
	);
}

/* ----------------------------- links ----------------------------- */

function LinksView({ conversationId, info }: { conversationId: string; info: GroupInfo }) {
	const read = useGatewayRead();
	const [links, setLinks] = useState<GroupLink[] | null>(null);
	const [making, setMaking] = useState(false);
	const [title, setTitle] = useState("");
	const [expiresIn, setExpiresIn] = useState<"never" | "1d" | "7d" | "30d">("7d");
	const [maxUses, setMaxUses] = useState<0 | 1 | 10 | 100>(0);
	const [approval, setApproval] = useState(false);
	const [busy, setBusy] = useState<string | null>(null);

	const load = useCallback(async () => {
		const res = await read(`/api/messages/groups/${conversationId}/links`, (b) => b);
		setLinks(res.success && Array.isArray(res.data) ? (res.data as GroupLink[]) : []);
	}, [read, conversationId]);
	useEffect(() => {
		void load();
	}, [load]);

	const live = (links ?? []).filter((l) => !l.revokedAt);
	const urlFor = (code: string) => `${window.location.origin}/join/${code}`;
	const copy = async (code: string) => {
		try {
			await navigator.clipboard.writeText(urlFor(code));
			toast.success("Link copied");
		} catch {
			toast.error("Couldn't copy. The link is " + urlFor(code));
		}
	};
	const create = async () => {
		setBusy("new");
		const res = await postJsonDirect(`/api/messages/groups/${conversationId}/links`, {
			title: title.trim() || undefined,
			expiresIn: expiresIn === "never" ? undefined : expiresIn,
			maxUses: maxUses || undefined,
			approval: approval || undefined,
		});
		setBusy(null);
		if (!res.success) {
			toast.error(res.message || "Couldn't make a link");
			return;
		}
		setMaking(false);
		setTitle("");
		await load();
		if (res.data?.code) void copy(res.data.code);
	};
	const revoke = async (code: string) => {
		setBusy(code);
		const res = await deleteDirect(`/api/messages/groups/${conversationId}/links/${encodeURIComponent(code)}`);
		setBusy(null);
		if (!res.success) toast.error(res.message || "Couldn't revoke that");
		await load();
	};

	return (
		<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-[calc(20px+var(--ws-safe-bottom))]">
			<p className="pb-3 pt-1 font-sans text-[calc(13px*var(--ws-fs))] text-muted">
				Anyone with a link can join {info.name}
				{info.joinApproval ? ", once an admin approves them" : ""}. Each link has its own life; revoke one and
				the others keep working.
			</p>
			{links === null ? (
				<div className="flex justify-center py-8 text-muted">
					<Loader2 className="h-6 w-6 animate-spin" />
				</div>
			) : (
				<div className="flex flex-col [&>*:last-child]:border-b-0">
					{live.map((l) => (
						<div key={l.code} className="flex items-center gap-3 border-b border-hairline py-2.5">
							<Link2 className="h-5 w-5 shrink-0 text-muted" />
							<span className="min-w-0 flex-1">
								<span className="block truncate font-sans text-[calc(14px*var(--ws-fs))] font-medium text-primary">
									{l.title || "Invite link"}
								</span>
								<span className="block truncate font-sans text-[calc(12px*var(--ws-fs))] text-muted">
									{l.uses} {l.uses === 1 ? "use" : "uses"}
									{l.maxUses ? ` of ${l.maxUses}` : ""}
									{l.expiresAt ? ` · ends ${when(l.expiresAt)}` : " · no end"}
									{l.approval ? " · needs approval" : ""}
									{l.by && typeof l.by === "object" ? ` · by ${nameOf(l.by)}` : ""}
								</span>
							</span>
							<button
								type="button"
								onClick={() => void copy(l.code)}
								aria-label="Copy link"
								className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-pill text-muted transition-colors hover:bg-primary/5 hover:text-primary"
							>
								<Copy className="h-4 w-4" />
							</button>
							<button
								type="button"
								onClick={() => void revoke(l.code)}
								disabled={busy === l.code}
								className="h-9 shrink-0 cursor-pointer rounded-pill px-3 font-sans text-[calc(12.5px*var(--ws-fs))] font-medium text-danger transition-colors hover:bg-primary/5 disabled:opacity-50"
							>
								Revoke
							</button>
						</div>
					))}
					{live.length === 0 && (
						<p className="py-6 text-center font-sans text-[calc(13px*var(--ws-fs))] text-subtle">
							No links yet.
						</p>
					)}
				</div>
			)}

			<AnimatePresence initial={false}>
				{making ? (
					<motion.div key="form" {...collapse} className="overflow-hidden">
						<div className="mt-3 rounded-[10px] bg-primary/5 px-4 pb-3 pt-1">
							<input
								value={title}
								onChange={(e) => setTitle(e.target.value)}
								maxLength={60}
								placeholder="A name for this link (optional)"
								className="mb-1 mt-2 w-full rounded-pill bg-page/60 px-4 py-2 font-sans text-[calc(13px*var(--ws-fs))] text-primary outline-none placeholder:text-subtle"
							/>
							<div className="flex flex-col [&>*:last-child]:border-b-0">
								<SelectRow
									label="Ends"
									value={expiresIn}
									options={[
										["never", "Never"],
										["1d", "After a day"],
										["7d", "After a week"],
										["30d", "After 30 days"],
									] as const}
									onPick={setExpiresIn}
								/>
								<SelectRow
									label="Uses"
									value={maxUses}
									options={[
										[0, "No limit"],
										[1, "Once"],
										[10, "10"],
										[100, "100"],
									] as const}
									onPick={setMaxUses}
								/>
								<ToggleRow
									label="Needs approval"
									hint="People who join through it wait for an admin."
									checked={approval}
									onChange={setApproval}
								/>
							</div>
							<div className="mt-2 flex justify-end gap-2">
								<button
									type="button"
									onClick={() => setMaking(false)}
									className="h-9 cursor-pointer rounded-pill px-3 font-sans text-[calc(13px*var(--ws-fs))] font-medium text-muted hover:bg-primary/10"
								>
									Cancel
								</button>
								<button
									type="button"
									onClick={() => void create()}
									disabled={busy === "new"}
									className="flex h-9 cursor-pointer items-center gap-2 rounded-pill bg-brand px-4 font-sans text-[calc(13px*var(--ws-fs))] font-semibold text-brand-on disabled:opacity-50"
								>
									{busy === "new" && <Loader2 className="h-4 w-4 animate-spin" />}
									Make link and copy
								</button>
							</div>
						</div>
					</motion.div>
				) : (
					<motion.button
						key="new"
						{...collapse}
						type="button"
						onClick={() => setMaking(true)}
						disabled={live.length >= 20}
						className="mt-3 flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-pill bg-primary/5 font-sans text-[calc(14px*var(--ws-fs))] font-semibold text-primary transition-colors hover:bg-primary/10 disabled:opacity-50"
					>
						<Link2 className="h-4 w-4" />
						New link
					</motion.button>
				)}
			</AnimatePresence>
		</div>
	);
}

/* ------------------------ bans, past, log ------------------------ */

function PeopleList<T>({
	load,
	render,
	empty,
}: {
	load: () => Promise<T[]>;
	render: (row: T, i: number, reload: () => Promise<void>) => React.ReactNode;
	empty: string;
}) {
	const [rows, setRows] = useState<T[] | null>(null);
	const reload = useCallback(async () => setRows(await load()), [load]);
	useEffect(() => {
		void reload();
	}, [reload]);
	return (
		<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[calc(12px+var(--ws-safe-bottom))]">
			{rows === null ? (
				<div className="flex justify-center py-10 text-muted">
					<Loader2 className="h-6 w-6 animate-spin" />
				</div>
			) : rows.length === 0 ? (
				<p className="px-6 py-10 text-center font-sans text-[calc(13px*var(--ws-fs))] text-subtle">{empty}</p>
			) : (
				<motion.div variants={staggerParentFast} initial="hidden" animate="show">
					{rows.map((r, i) => (
						<CascadeRow key={i} index={i}>
							{render(r, i, reload)}
						</CascadeRow>
					))}
				</motion.div>
			)}
		</div>
	);
}

function PersonLine({ person, sub }: { person: Person | string | undefined; sub: React.ReactNode }) {
	const p = typeof person === "object" ? person : undefined;
	return (
		<>
			<span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-pill bg-raised">
				<SafeAvatar src={p?.avatar} eager />
			</span>
			<span className="min-w-0 flex-1">
				<span className="block truncate font-sans text-[calc(14px*var(--ws-fs))] font-medium text-primary">
					{nameOf(person)}
				</span>
				<span className="block truncate font-sans text-[calc(12px*var(--ws-fs))] text-muted">{sub}</span>
			</span>
		</>
	);
}

function BansView({ conversationId }: { conversationId: string }) {
	const read = useGatewayRead();
	const [busy, setBusy] = useState<string | null>(null);
	const load = useCallback(async () => {
		const res = await read(`/api/messages/groups/${conversationId}/bans`, (b) => b);
		return res.success && Array.isArray(res.data) ? (res.data as BanRow[]) : [];
	}, [read, conversationId]);
	return (
		<PeopleList
			load={load}
			empty="Nobody is banned."
			render={(b, _i, reload) => {
				const id = idOf(b.profile);
				return (
					<div className="flex items-center gap-3 px-4 py-2.5">
						<PersonLine
							person={b.profile}
							sub={`${b.until ? `until ${when(b.until)}` : "for good"}${b.by && typeof b.by === "object" ? ` · by ${nameOf(b.by)}` : ""}`}
						/>
						<button
							type="button"
							disabled={busy === id}
							onClick={async () => {
								setBusy(id);
								const res = await deleteDirect(`/api/messages/groups/${conversationId}/bans/${id}`);
								setBusy(null);
								if (!res.success) toast.error(res.message || "Couldn't lift that");
								await reload();
							}}
							className="h-9 shrink-0 cursor-pointer rounded-pill bg-primary/5 px-3 font-sans text-[calc(12.5px*var(--ws-fs))] font-medium text-primary hover:bg-primary/10 disabled:opacity-50"
						>
							Lift ban
						</button>
					</div>
				);
			}}
		/>
	);
}

function PastView({ conversationId }: { conversationId: string }) {
	const read = useGatewayRead();
	const load = useCallback(async () => {
		const res = await read(`/api/messages/groups/${conversationId}/past`, (b) => b);
		return res.success && Array.isArray(res.data) ? (res.data as { profile: Person; leftAt: string }[]) : [];
	}, [read, conversationId]);
	return (
		<PeopleList
			load={load}
			empty="Nobody has left in the last 60 days."
			render={(r) => (
				<div className="flex items-center gap-3 px-4 py-2.5">
					<PersonLine person={r.profile} sub={`left ${when(r.leftAt)}`} />
				</div>
			)}
		/>
	);
}

function LogView({ conversationId }: { conversationId: string }) {
	const read = useGatewayRead();
	const load = useCallback(async () => {
		const res = await read(`/api/messages/groups/${conversationId}/log`, (b) => b);
		return res.success && Array.isArray(res.data) ? (res.data as LogRow[]) : [];
	}, [read, conversationId]);
	return (
		<PeopleList
			load={load}
			empty="Nothing yet. Admin actions land here."
			render={(r) => (
				<div className="flex items-center gap-3 px-4 py-2.5">
					<PersonLine
						person={r.by}
						sub={
							<>
								{logWords(r)} <span className="text-subtle">· {when(r.at)}</span>
							</>
						}
					/>
				</div>
			)}
		/>
	);
}

/* -------------------------- the ways out -------------------------- */

function LeaveView({
	info,
	conversationId,
	myProfileId,
	isOwner,
	onLeft,
	onClose,
	go,
}: {
	info: GroupInfo;
	conversationId: string;
	myProfileId: string;
	isOwner: boolean;
	onLeft: () => void;
	onClose: () => void;
	go: (v: View) => void;
}) {
	const [busy, setBusy] = useState<string | null>(null);
	const leave = async (quiet: boolean) => {
		setBusy(quiet ? "quiet" : "leave");
		const res = await deleteDirect(
			`/api/messages/groups/${conversationId}/members/${myProfileId}${quiet ? "?quiet=1" : ""}`,
		);
		setBusy(null);
		if (!res.success) {
			toast.error(res.message || "Couldn't leave");
			return;
		}
		onLeft();
		onClose();
	};
	const alone = info.memberCount <= 1;
	return (
		<div className="flex min-h-0 flex-1 flex-col px-5 pb-[calc(20px+var(--ws-safe-bottom))]">
			<p className="pb-4 pt-1 font-sans text-[calc(14px*var(--ws-fs))] text-muted">
				{isOwner && !alone
					? "You own this group. Hand it to someone first, or delete it."
					: alone
						? "You are the last one here. Leaving closes the group."
						: "You keep what was said until now. Nothing after."}
			</p>
			{isOwner && !alone ? (
				<>
					<button
						type="button"
						onClick={() => go({ handover: true })}
						className="mb-2 flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-pill bg-brand font-sans text-[calc(14px*var(--ws-fs))] font-semibold text-brand-on"
					>
						<Crown className="h-4 w-4" />
						Hand over, then leave
					</button>
					<button
						type="button"
						onClick={() => go("delete")}
						className="flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-pill bg-primary/5 font-sans text-[calc(14px*var(--ws-fs))] font-semibold text-danger hover:bg-primary/10"
					>
						<Trash2 className="h-4 w-4" />
						Delete the group instead
					</button>
				</>
			) : (
				<>
					<button
						type="button"
						onClick={() => void leave(false)}
						disabled={busy !== null}
						className="mb-2 flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-pill bg-primary/5 font-sans text-[calc(14px*var(--ws-fs))] font-semibold text-danger hover:bg-primary/10 disabled:opacity-50"
					>
						{busy === "leave" && <Loader2 className="h-4 w-4 animate-spin" />}
						<LogOut className="h-4 w-4" />
						Leave group
					</button>
					{!alone && (
						<button
							type="button"
							onClick={() => void leave(true)}
							disabled={busy !== null}
							className="flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-pill font-sans text-[calc(14px*var(--ws-fs))] font-medium text-muted hover:bg-primary/5 disabled:opacity-50"
						>
							{busy === "quiet" && <Loader2 className="h-4 w-4 animate-spin" />}
							<BellOff className="h-4 w-4" />
							Leave quietly
						</button>
					)}
					{!alone && (
						<p className="pt-2 text-center font-sans text-[calc(12px*var(--ws-fs))] text-subtle">
							Quietly posts no row. Only the admins are told.
						</p>
					)}
				</>
			)}
		</div>
	);
}

function HandoverView({
	conversationId,
	myProfileId,
	onDone,
}: {
	conversationId: string;
	myProfileId: string;
	onDone: (thenLeave: boolean) => Promise<void>;
}) {
	const read = useGatewayRead();
	const [rows, setRows] = useState<RosterRow[] | null>(null);
	const [busy, setBusy] = useState<string | null>(null);
	useEffect(() => {
		void (async () => {
			const res = await read(`/api/messages/groups/${conversationId}/members?limit=100`, (b) => b);
			setRows(res.success ? ((res.data?.members ?? []) as RosterRow[]) : []);
		})();
	}, [read, conversationId]);
	const hand = async (to: string) => {
		setBusy(to);
		const res = await postJsonDirect(`/api/messages/groups/${conversationId}/transfer`, { to });
		setBusy(null);
		if (!res.success) {
			toast.error(res.message || "Couldn't hand it over");
			return;
		}
		toast.success("They own the group now");
		await onDone(true);
	};
	const candidates = (rows ?? []).filter((r) => r.profile._id !== myProfileId);
	return (
		<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[calc(12px+var(--ws-safe-bottom))]">
			<p className="px-5 pb-2 pt-1 font-sans text-[calc(13px*var(--ws-fs))] text-muted">
				Pick the new owner. You stay as an admin.
			</p>
			{rows === null ? (
				<div className="flex justify-center py-8 text-muted">
					<Loader2 className="h-6 w-6 animate-spin" />
				</div>
			) : (
				candidates.map((r) => (
					<button
						key={r.profile._id}
						type="button"
						onClick={() => void hand(r.profile._id)}
						disabled={busy !== null}
						className="flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-primary/5 disabled:opacity-60"
					>
						<PersonLine person={r.profile} sub={r.role === "admin" ? "admin" : `@${r.profile.username ?? ""}`} />
						{busy === r.profile._id ? (
							<Loader2 className="h-4 w-4 animate-spin text-muted" />
						) : (
							<Crown className="h-4 w-4 text-muted" />
						)}
					</button>
				))
			)}
		</div>
	);
}

function DeleteView({
	info,
	conversationId,
	onLeft,
	onClose,
}: {
	info: GroupInfo;
	conversationId: string;
	onLeft: () => void;
	onClose: () => void;
}) {
	const [typed, setTyped] = useState("");
	const [busy, setBusy] = useState(false);
	const ok = typed.trim().toLowerCase() === (info.name ?? "").trim().toLowerCase();
	const del = async () => {
		setBusy(true);
		const res = await deleteDirect(`/api/messages/conversations/${conversationId}`);
		setBusy(false);
		if (!res.success) {
			toast.error(res.message || "Couldn't delete the group");
			return;
		}
		toast.success("Group deleted. You can restore it for 30 days.");
		onLeft();
		onClose();
	};
	return (
		<div className="flex min-h-0 flex-1 flex-col px-5 pb-[calc(20px+var(--ws-safe-bottom))]">
			<p className="pb-3 pt-1 font-sans text-[calc(14px*var(--ws-fs))] text-muted">
				Everyone loses the group at once. For 30 days you can restore it; after that the messages and media
				are gone for good. Payment receipts stay.
			</p>
			<label className="pb-1 font-sans text-[calc(13px*var(--ws-fs))] font-medium text-primary">
				Type <span className="font-semibold">{info.name}</span> to confirm
			</label>
			<input
				value={typed}
				onChange={(e) => setTyped(e.target.value)}
				autoFocus
				className="mb-3 w-full rounded-pill bg-primary/5 px-4 py-2.5 font-sans text-[calc(14px*var(--ws-fs))] text-primary outline-none focus:bg-primary/10"
			/>
			<button
				type="button"
				onClick={() => void del()}
				disabled={!ok || busy}
				className="flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-pill bg-danger font-sans text-[calc(14px*var(--ws-fs))] font-semibold text-primary disabled:opacity-40"
			>
				{busy && <Loader2 className="h-4 w-4 animate-spin" />}
				<Trash2 className="h-4 w-4" />
				Delete group
			</button>
		</div>
	);
}
