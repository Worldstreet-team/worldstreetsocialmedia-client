"use client";

import { useEffect, useMemo, useState } from "react";
import {
	Bell,
	BellSlash,
	Broadcast,
	Monitor,
	Star,
	Trash,
	VideoCamera,
} from "@phosphor-icons/react";
import clsx from "clsx";
import { useT } from "@/i18n/client";
import { useToast } from "@/components/ui/Toast/ToastContext";
import GlassSelect from "@/components/ui/GlassSelect";
import { PageHead } from "@/components/studio/studio-ui";
import {
	createPresetAction,
	deletePresetAction,
	listPresetsAction,
	updatePresetAction,
} from "@/lib/creator.actions";
import { CATEGORIES as TAXONOMY, VERTICALS } from "@/data/categories";

/**
 * Rows saved before the taxonomy hold the old six-item values. Map them for
 * display so an existing preset reads "Stocks & Equities", not "markets" —
 * the same table the Go Live sheet uses, kept in step with it.
 */
const LEGACY_CATEGORY: Record<string, string> = {
	markets: "Stocks & Equities",
	crypto: "Crypto Markets",
	forex: "Forex",
	stocks: "Stocks & Equities",
	general: "Just Chatting",
};

function categoryLabel(value: string) {
	const mapped = LEGACY_CATEGORY[value?.toLowerCase()] ?? value;
	return TAXONOMY.find((c) => c.label === mapped)?.label ?? mapped;
}

interface Preset {
	id: string;
	name: string;
	category: string;
	source: "camera" | "obs";
	notifyFollowers: boolean;
	isDefault: boolean;
}

/**
 * Live presets: the answers the Go Live sheet asks for every single stream
 * and then forgets.
 *
 * It used to save a name, a stream title and one of six hardcoded
 * categories. Two of those were dead: the sheet deliberately never prefills
 * a title (a stale title is worse than none), and its category picker reads
 * the 100-category taxonomy, not that six-item list — so a saved preset
 * pointed at a vocabulary nothing used.
 *
 * What a preset holds now is exactly what the sheet asks and forgets:
 * category (same taxonomy), capture source, and whether followers get
 * pinged. Nothing here is invented — every field prefills a real control.
 */
export default function StudioLive() {
	const t = useT();
	const { toast } = useToast();
	const [presets, setPresets] = useState<Preset[]>([]);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);

	const [name, setName] = useState("");
	const [vertical, setVertical] = useState<string>(VERTICALS[0].id);
	const [category, setCategory] = useState("");
	const [source, setSource] = useState<"camera" | "obs">("camera");
	const [notify, setNotify] = useState(true);

	// 100 categories in one dropdown is a scroll; the vertical narrows it to
	// the handful that vertical actually contains.
	const inVertical = useMemo(
		() => TAXONOMY.filter((c) => c.vertical === vertical),
		[vertical],
	);

	// Keep the category valid whenever the vertical moves under it.
	useEffect(() => {
		if (!inVertical.some((c) => c.label === category)) {
			setCategory(inVertical[0]?.label ?? "");
		}
	}, [inVertical, category]);

	const load = async () => {
		const res = await listPresetsAction();
		if (res.success) setPresets(res.presets as Preset[]);
		setLoading(false);
	};

	useEffect(() => {
		void load();
	}, []);

	const create = async () => {
		if (!name.trim() || saving) return;
		setSaving(true);
		const res = await createPresetAction({
			name: name.trim(),
			category,
			source,
			notifyFollowers: notify,
			isDefault: presets.length === 0,
		});
		if (res.success) {
			setName("");
			await load();
			toast(t("studio.live.saved"), { type: "success" });
		} else toast(res.message ?? "Failed", { type: "error" });
		setSaving(false);
	};

	const SOURCES = [
		{ id: "camera" as const, label: t("studio.live.camera"), Icon: VideoCamera },
		{ id: "obs" as const, label: t("studio.live.obs"), Icon: Monitor },
	];

	return (
		<div>
			<PageHead
				title={t("studio.nav.live")}
				caption={t("studio.live.caption")}
			/>

			{/* composer */}
			<section className="rounded-2xl bg-[#171614] p-4">
				<h2 className="glass-eyebrow mb-3 font-sans">{t("studio.live.new")}</h2>

				<div className="grid gap-2.5 md:grid-cols-[1.2fr_1fr_1fr]">
					<input
						value={name}
						onChange={(e) => setName(e.target.value)}
						placeholder={t("studio.live.name")}
						maxLength={60}
						className="h-10 rounded-lg bg-[#fafaf9]/[0.06] px-3.5 font-sans text-base outline-none glass-ink placeholder:text-[#fafaf9]/35 focus:bg-[#fafaf9]/[0.1] sm:text-sm"
					/>
					<GlassSelect
						label={t("studio.live.vertical")}
						value={vertical}
						options={VERTICALS.map((v) => ({ id: v.id, label: v.label }))}
						onChange={setVertical}
					/>
					<GlassSelect
						label={t("studio.live.category")}
						value={category}
						options={inVertical.map((c) => ({ id: c.label, label: c.label }))}
						onChange={setCategory}
					/>
				</div>

				<div className="mt-3 flex flex-wrap items-center gap-3">
					{/* capture source */}
					<div className="flex items-center gap-0.5 rounded-pill bg-[#fafaf9]/[0.05] p-0.5">
						{SOURCES.map(({ id, label, Icon }) => (
							<button
								key={id}
								type="button"
								onClick={() => setSource(id)}
								aria-pressed={source === id}
								className={clsx(
									"flex h-8 cursor-pointer items-center gap-1.5 rounded-pill px-3 font-sans text-[12px] font-semibold transition-colors",
									source === id
										? "bg-[#fafaf9] text-[#0c0a09]"
										: "glass-ink-faint hover:glass-ink",
								)}
							>
								<Icon size={13} weight="bold" />
								{label}
							</button>
						))}
					</div>

					{/* notify followers */}
					<button
						type="button"
						onClick={() => setNotify((v) => !v)}
						aria-pressed={notify}
						className={clsx(
							"flex h-8 cursor-pointer items-center gap-1.5 rounded-pill px-3 font-sans text-[12px] font-semibold transition-colors",
							notify
								? "bg-[var(--ws-brand-primary)]/15 text-[var(--ws-brand-primary)]"
								: "bg-[#fafaf9]/[0.05] glass-ink-faint hover:glass-ink",
						)}
					>
						{notify ? (
							<Bell size={13} weight="fill" />
						) : (
							<BellSlash size={13} weight="bold" />
						)}
						{t("studio.live.notify")}
					</button>

					<button
						type="button"
						onClick={create}
						disabled={!name.trim() || saving}
						className="ml-auto h-9 cursor-pointer rounded-pill bg-[#fafaf9] px-4 font-sans text-[13px] font-semibold text-[#0c0a09] transition-colors hover:bg-white disabled:opacity-40"
					>
						{t("studio.live.save")}
					</button>
				</div>
			</section>

			{/* saved presets */}
			{loading ? (
				<div className="mt-3 flex flex-col gap-2.5">
					{[1, 2].map((i) => (
						<div
							key={i}
							className="h-[68px] animate-pulse rounded-2xl bg-[#fafaf9]/[0.04]"
						/>
					))}
				</div>
			) : presets.length === 0 ? (
				<div className="mt-3 rounded-2xl bg-[#171614] p-10 text-center">
					<span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-pill bg-[#fafaf9]/[0.07] glass-ink-faint">
						<Broadcast size={22} />
					</span>
					<p className="font-sans text-sm glass-ink-dim">
						{t("studio.live.empty")}
					</p>
				</div>
			) : (
				<div className="mt-3 flex flex-col gap-2.5">
					{presets.map((p) => (
						<div
							key={p.id}
							className="flex items-center gap-3 rounded-2xl bg-[#171614] px-4 py-3.5"
						>
							<span
								className={clsx(
									"flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
									p.isDefault
										? "bg-[var(--ws-brand-primary)] text-[#0c0a09]"
										: "bg-[#fafaf9]/[0.06] glass-ink-dim",
								)}
							>
								{p.source === "obs" ? (
									<Monitor size={17} weight="bold" />
								) : (
									<VideoCamera size={17} weight="bold" />
								)}
							</span>

							<div className="min-w-0 flex-1">
								<p className="flex items-center gap-2 font-sans text-[14.5px] font-semibold glass-ink">
									<span className="truncate">{p.name}</span>
									{p.isDefault && (
										<span className="shrink-0 rounded-pill bg-[var(--ws-brand-primary)]/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-[var(--ws-brand-primary)]">
											{t("studio.live.default")}
										</span>
									)}
								</p>
								{/* Every attribute the preset will hand the sheet. */}
								<p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 font-sans text-[12px] glass-ink-faint">
									<span>{categoryLabel(p.category)}</span>
									<span aria-hidden>·</span>
									<span>
										{p.source === "obs"
											? t("studio.live.obs")
											: t("studio.live.camera")}
									</span>
									<span aria-hidden>·</span>
									<span className="flex items-center gap-1">
										{p.notifyFollowers ? (
											<Bell size={11} weight="fill" />
										) : (
											<BellSlash size={11} weight="bold" />
										)}
										{p.notifyFollowers
											? t("studio.live.notifyOn")
											: t("studio.live.notifyOff")}
									</span>
								</p>
							</div>

							{!p.isDefault && (
								<button
									type="button"
									onClick={async () => {
										await updatePresetAction(p.id, { isDefault: true });
										await load();
									}}
									aria-label={t("studio.live.makeDefault")}
									title={t("studio.live.makeDefault")}
									className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-pill glass-ink-faint transition-colors hover:bg-[var(--ws-brand-primary)]/10 hover:text-[var(--ws-brand-primary)]"
								>
									<Star size={17} />
								</button>
							)}
							<button
								type="button"
								onClick={async () => {
									await deletePresetAction(p.id);
									await load();
								}}
								aria-label={t("studio.live.delete")}
								className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-pill glass-ink-faint transition-colors hover:bg-danger/10 hover:text-danger"
							>
								<Trash size={17} />
							</button>
						</div>
					))}
				</div>
			)}
		</div>
	);
}
