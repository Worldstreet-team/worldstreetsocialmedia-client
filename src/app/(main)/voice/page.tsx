"use client";

import { useEffect, useState } from "react";
import { Microphone, Plus } from "@phosphor-icons/react";
import clsx from "clsx";
import { useT } from "@/i18n/client";
import {
	createSpaceAction,
	endSpaceAction,
	getSpacesAction,
	joinSpaceAction,
	startSpaceAction,
} from "@/lib/space.actions";
import { getCommunitiesAction } from "@/lib/community.actions";
import { useToast } from "@/components/ui/Toast/ToastContext";
import { SafeAvatar } from "@/components/ui/SafeAvatar";

interface SpaceRow {
	id: string;
	title: string;
	status: "scheduled" | "live" | "ended";
	scheduledFor?: string;
	host: {
		username: string;
		avatar?: string;
		firstName?: string;
		lastName?: string;
	};
	community?: { name: string; slug: string } | null;
	membersCount: number;
	joined: boolean;
	isHost: boolean;
}

/**
 * Street Voice v1: the spaces directory — live rooms ranked by size,
 * scheduled rooms by start time. Create now or schedule; tie a space to a
 * community you've joined or leave it open. Audio transport (LiveKit) is
 * the next pass — join today is membership/RSVP.
 */
export default function VoicePage() {
	const t = useT();
	const { toast } = useToast();
	const [live, setLive] = useState<SpaceRow[]>([]);
	const [upcoming, setUpcoming] = useState<SpaceRow[]>([]);
	const [communities, setCommunities] = useState<
		{ id: string; name: string }[]
	>([]);
	const [loading, setLoading] = useState(true);
	const [creating, setCreating] = useState(false);
	const [title, setTitle] = useState("");
	const [when, setWhen] = useState("");
	const [communityId, setCommunityId] = useState("");
	const [busy, setBusy] = useState(false);

	const load = async () => {
		const res = await getSpacesAction();
		if (res.success) {
			setLive(res.live);
			setUpcoming(res.upcoming);
		}
		setLoading(false);
	};

	useEffect(() => {
		void load();
		void getCommunitiesAction().then((res) => {
			if (res.success) {
				setCommunities(
					res.communities
						.filter((c: any) => c.joined)
						.map((c: any) => ({ id: c.id, name: c.name })),
				);
			}
		});
	}, []);

	const create = async () => {
		if (busy || title.trim().length < 3) return;
		setBusy(true);
		try {
			const res = await createSpaceAction(
				title.trim(),
				when || undefined,
				communityId || undefined,
			);
			if (res.success) {
				setTitle("");
				setWhen("");
				setCommunityId("");
				setCreating(false);
				await load();
				toast(t(when ? "voice.scheduled" : "voice.created"), {
					type: "success",
				});
			} else if (res.message) toast(res.message, { type: "error" });
		} finally {
			setBusy(false);
		}
	};

	const SpaceCard = ({ row }: { row: SpaceRow }) => (
		<div className="card-depth p-4 flex items-center gap-3">
			<div className="relative w-11 h-11 rounded-pill overflow-hidden bg-raised shrink-0">
				<SafeAvatar src={row.host.avatar} />
			</div>
			<div className="flex flex-col min-w-0 flex-1">
				<span className="flex items-center gap-2 min-w-0">
					{row.status === "live" && (
						<span className="shrink-0 flex items-center gap-1 rounded-[4px] bg-danger px-1.5 py-px text-[9px] font-bold tracking-wide text-white font-sans">
							<span className="w-1 h-1 rounded-pill bg-white animate-pulse" />
							{t("live.badge")}
						</span>
					)}
					<span className="font-semibold text-primary text-[15px] truncate font-sans">
						{row.title}
					</span>
				</span>
				<span className="text-[12px] text-subtle font-sans truncate">
					@{row.host.username}
					{row.community ? ` · ${row.community.name}` : ""}
					{row.status === "scheduled" && row.scheduledFor
						? ` · ${new Date(row.scheduledFor).toLocaleString([], {
								month: "short",
								day: "numeric",
								hour: "2-digit",
								minute: "2-digit",
							})}`
						: ` · ${row.membersCount} ${t("voice.listeners")}`}
				</span>
			</div>
			{row.isHost ? (
				row.status === "scheduled" ? (
					<button
						type="button"
						onClick={async () => {
							await startSpaceAction(row.id);
							await load();
						}}
						className="px-3.5 h-8 rounded-pill bg-danger text-white text-[12px] font-semibold font-sans hover:opacity-90 transition-opacity shrink-0 cursor-pointer"
					>
						{t("voice.start")}
					</button>
				) : (
					<button
						type="button"
						onClick={async () => {
							await endSpaceAction(row.id);
							await load();
						}}
						className="px-3.5 h-8 rounded-pill bg-raised text-muted text-[12px] font-semibold font-sans hover:text-danger transition-colors shrink-0 cursor-pointer"
					>
						{t("voice.end")}
					</button>
				)
			) : (
				<button
					type="button"
					disabled={row.joined}
					onClick={async () => {
						await joinSpaceAction(row.id);
						await load();
					}}
					className={clsx(
						"px-3.5 h-8 rounded-pill text-[12px] font-semibold font-sans transition-colors shrink-0 cursor-pointer",
						row.joined
							? "bg-raised text-muted cursor-default"
							: "bg-primary text-page hover:bg-muted",
					)}
				>
					{row.joined
						? t("voice.joined")
						: row.status === "live"
							? t("voice.join")
							: t("voice.remind")}
				</button>
			)}
		</div>
	);

	return (
		<div className="w-full min-w-0 px-4 py-6 pb-nav md:pb-10">
			<div className="flex items-center justify-between mb-5">
				<h1 className="flex items-center gap-2.5 font-display font-semibold text-xl text-primary">
					<Microphone size={22} weight="duotone" className="text-gold" />
					{t("nav.voice")}
				</h1>
				<button
					type="button"
					onClick={() => setCreating((v) => !v)}
					className="flex items-center gap-1.5 px-4 h-9 rounded-pill bg-brand text-brand-on text-[13px] font-semibold font-sans hover:bg-brand-active transition-colors cursor-pointer"
				>
					<Plus size={14} weight="bold" />
					{t("voice.create")}
				</button>
			</div>

			{creating && (
				<div className="card-depth p-4 mb-5 flex flex-col gap-3">
					<input
						value={title}
						onChange={(e) => setTitle(e.target.value)}
						maxLength={96}
						placeholder={t("voice.placeholder")}
						className="w-full bg-transparent text-[16px] font-semibold text-primary font-sans placeholder:text-subtle placeholder:font-normal outline-none"
					/>
					<div className="h-px bg-raised" />
					<div className="flex flex-wrap gap-2">
						<label className="flex items-center gap-2 text-[13px] text-muted font-sans">
							{t("voice.when")}
							<input
								type="datetime-local"
								value={when}
								onChange={(e) => setWhen(e.target.value)}
								className="rounded-lg bg-raised px-2.5 py-1.5 text-[13px] text-primary font-sans outline-none [color-scheme:dark]"
							/>
						</label>
						{communities.length > 0 && (
							<select
								value={communityId}
								onChange={(e) => setCommunityId(e.target.value)}
								className="rounded-lg bg-raised px-2.5 py-1.5 text-[13px] text-primary font-sans outline-none"
							>
								<option value="">{t("voice.standalone")}</option>
								{communities.map((c) => (
									<option key={c.id} value={c.id}>
										{c.name}
									</option>
								))}
							</select>
						)}
					</div>
					<button
						type="button"
						disabled={busy || title.trim().length < 3}
						onClick={create}
						className="self-end px-5 h-9 rounded-pill bg-brand text-brand-on text-[13px] font-semibold font-sans hover:bg-brand-active transition-colors disabled:opacity-40 cursor-pointer"
					>
						{when ? t("voice.schedule") : t("voice.goLiveNow")}
					</button>
				</div>
			)}

			{loading ? (
				<div className="flex flex-col gap-3">
					{[1, 2, 3].map((i) => (
						<div key={i} className="card-depth h-20 skeleton" />
					))}
				</div>
			) : (
				<>
					{live.length > 0 && (
						<>
							<h2 className="font-sans font-semibold text-[11px] uppercase tracking-[0.14em] text-subtle mb-2">
								{t("voice.liveNow")}
							</h2>
							<div className="flex flex-col gap-3 mb-6">
								{live.map((row) => (
									<SpaceCard key={row.id} row={row} />
								))}
							</div>
						</>
					)}
					{upcoming.length > 0 && (
						<>
							<h2 className="font-sans font-semibold text-[11px] uppercase tracking-[0.14em] text-subtle mb-2">
								{t("voice.upcoming")}
							</h2>
							<div className="flex flex-col gap-3">
								{upcoming.map((row) => (
									<SpaceCard key={row.id} row={row} />
								))}
							</div>
						</>
					)}
					{live.length === 0 && upcoming.length === 0 && (
						<p className="text-center text-muted font-sans py-14">
							{t("voice.empty")}
						</p>
					)}
				</>
			)}
		</div>
	);
}
