"use client";

import { useEffect, useState } from "react";
import { Plus, UsersThree } from "@phosphor-icons/react";
import clsx from "clsx";
import { useT } from "@/i18n/client";
import {
	createCommunityAction,
	getCommunitiesAction,
	toggleCommunityAction,
} from "@/lib/community.actions";
import { useToast } from "@/components/ui/Toast/ToastContext";
import { SafeAvatar } from "@/components/ui/SafeAvatar";

interface CommunityRow {
	id: string;
	name: string;
	slug: string;
	description?: string;
	category: string;
	avatar?: string;
	membersCount: number;
	joined: boolean;
}

const CATEGORIES = ["markets", "crypto", "forex", "stocks", "general"];

/**
 * Communities v1: discover, create, join. Community feeds and posting into
 * a community arrive with v2 — this surface builds the graph they'll need.
 */
export default function CommunitiesPage() {
	const t = useT();
	const { toast } = useToast();
	const [rows, setRows] = useState<CommunityRow[]>([]);
	const [loading, setLoading] = useState(true);
	const [creating, setCreating] = useState(false);
	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const [category, setCategory] = useState(CATEGORIES[0]);
	const [busy, setBusy] = useState(false);

	const load = async () => {
		const res = await getCommunitiesAction();
		if (res.success) setRows(res.communities);
		setLoading(false);
	};

	useEffect(() => {
		void load();
	}, []);

	const toggle = async (row: CommunityRow) => {
		setRows((prev) =>
			prev.map((r) =>
				r.id === row.id
					? {
							...r,
							joined: !r.joined,
							membersCount: r.membersCount + (r.joined ? -1 : 1),
						}
					: r,
			),
		);
		const res = await toggleCommunityAction(row.id, !row.joined);
		if (!res.success) {
			setRows((prev) =>
				prev.map((r) =>
					r.id === row.id
						? {
								...r,
								joined: row.joined,
								membersCount: row.membersCount,
							}
						: r,
				),
			);
			if (res.message) toast(res.message, { type: "error" });
		}
	};

	const create = async () => {
		if (busy || name.trim().length < 3) return;
		setBusy(true);
		try {
			const res = await createCommunityAction(
				name.trim(),
				description.trim(),
				category,
			);
			if (res.success) {
				setName("");
				setDescription("");
				setCreating(false);
				await load();
				toast(t("community.created"), { type: "success" });
			} else if (res.message) toast(res.message, { type: "error" });
		} finally {
			setBusy(false);
		}
	};

	return (
		<div className="w-full min-w-0 px-4 py-6 pb-nav md:pb-10">
			<div className="flex items-center justify-between mb-5">
				<h1 className="flex items-center gap-2.5 font-display font-semibold text-xl text-primary">
					<UsersThree size={22} weight="duotone" className="text-gold" />
					{t("nav.communities")}
				</h1>
				<button
					type="button"
					onClick={() => setCreating((v) => !v)}
					className="flex items-center gap-1.5 px-4 h-9 rounded-pill bg-brand text-brand-on text-[13px] font-semibold font-sans hover:bg-brand-active transition-colors cursor-pointer"
				>
					<Plus size={14} weight="bold" />
					{t("community.create")}
				</button>
			</div>

			{creating && (
				<div className="card-depth p-4 mb-5 flex flex-col gap-3">
					<input
						value={name}
						onChange={(e) => setName(e.target.value)}
						maxLength={48}
						placeholder={t("community.name")}
						className="w-full bg-transparent text-[16px] font-semibold text-primary font-sans placeholder:text-subtle placeholder:font-normal outline-none"
					/>
					<div className="h-px bg-raised" />
					<input
						value={description}
						onChange={(e) => setDescription(e.target.value)}
						maxLength={280}
						placeholder={t("community.description")}
						className="w-full bg-transparent text-sm text-primary font-sans placeholder:text-subtle outline-none"
					/>
					<div className="flex gap-1.5 flex-wrap">
						{CATEGORIES.map((c) => (
							<button
								key={c}
								type="button"
								onClick={() => setCategory(c)}
								className={clsx(
									"px-3 h-7 rounded-pill text-[12px] font-medium font-sans transition-colors cursor-pointer capitalize",
									category === c
										? "bg-primary text-page"
										: "bg-raised text-muted hover:text-primary",
								)}
							>
								{c}
							</button>
						))}
					</div>
					<button
						type="button"
						disabled={busy || name.trim().length < 3}
						onClick={create}
						className="self-end px-5 h-9 rounded-pill bg-brand text-brand-on text-[13px] font-semibold font-sans hover:bg-brand-active transition-colors disabled:opacity-40 cursor-pointer"
					>
						{t("community.create")}
					</button>
				</div>
			)}

			{loading ? (
				<div className="grid sm:grid-cols-2 gap-3">
					{[1, 2, 3, 4].map((i) => (
						<div key={i} className="card-depth h-28 skeleton" />
					))}
				</div>
			) : rows.length === 0 ? (
				<p className="text-center text-muted font-sans py-14">
					{t("community.empty")}
				</p>
			) : (
				<div className="grid sm:grid-cols-2 gap-3">
					{rows.map((row) => (
						<div key={row.id} className="card-depth p-4 flex gap-3">
							<div className="relative w-11 h-11 rounded-xl overflow-hidden bg-raised shrink-0">
								{row.avatar ? (
									<SafeAvatar src={row.avatar} />
								) : (
									<span className="absolute inset-0 flex items-center justify-center font-display font-semibold text-gold text-lg">
										{row.name[0]?.toUpperCase()}
									</span>
								)}
							</div>
							<div className="flex flex-col min-w-0 flex-1">
								<span className="font-semibold text-primary text-[15px] truncate font-sans">
									{row.name}
								</span>
								<span className="text-[11px] uppercase tracking-wider text-subtle font-sans font-semibold">
									{row.category} ·{" "}
									<span className="tabular-nums">{row.membersCount}</span>{" "}
									{t("community.members")}
								</span>
								{row.description && (
									<span className="text-[13px] text-muted font-sans mt-1 line-clamp-2">
										{row.description}
									</span>
								)}
							</div>
							<button
								type="button"
								onClick={() => toggle(row)}
								className={clsx(
									"self-start px-3.5 h-8 rounded-pill text-[12px] font-semibold font-sans transition-colors shrink-0 cursor-pointer",
									row.joined
										? "bg-raised text-muted hover:text-danger"
										: "bg-primary text-page hover:bg-muted",
								)}
							>
								{row.joined ? t("community.joined") : t("community.join")}
							</button>
						</div>
					))}
				</div>
			)}
		</div>
	);
}
