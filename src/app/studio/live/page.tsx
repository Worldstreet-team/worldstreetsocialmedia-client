"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { Broadcast, Star, Trash } from "@phosphor-icons/react";
import { useT } from "@/i18n/client";
import { PageHead } from "@/components/studio/studio-ui";
import {
	createPresetAction,
	deletePresetAction,
	listPresetsAction,
	updatePresetAction,
} from "@/lib/creator.actions";
import { useToast } from "@/components/ui/Toast/ToastContext";

interface Preset {
	id: string;
	name: string;
	title: string;
	category: string;
	isDefault: boolean;
}

// Xstream's real taxonomy — presets store exactly what streams will show.
const CATEGORIES: { value: string; label: string }[] = [
	{ value: "Market Analysis", label: "Markets" },
	{ value: "Bitcoin Trading", label: "Bitcoin" },
	{ value: "Altcoins & DeFi", label: "Altcoins & DeFi" },
	{ value: "NFTs & Web3", label: "NFTs & Web3" },
	{ value: "Crypto Education", label: "Education" },
	{ value: "General / Just Chatting", label: "Just Chatting" },
];

/** Live presets: saved go-live defaults. The default preset prefills the
 *  Go Live sheet across the app. */
export default function StudioLive() {
	const t = useT();
	const { toast } = useToast();
	const [presets, setPresets] = useState<Preset[]>([]);
	const [loading, setLoading] = useState(true);
	const [name, setName] = useState("");
	const [title, setTitle] = useState("");
	const [category, setCategory] = useState(CATEGORIES[0].value);
	const [saving, setSaving] = useState(false);

	const load = async () => {
		const res = await listPresetsAction();
		if (res.success) setPresets(res.presets);
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
			title: title.trim(),
			category,
			isDefault: presets.length === 0,
		});
		if (res.success) {
			setName("");
			setTitle("");
			await load();
			toast(t("studio.live.saved"), { type: "success" });
		} else toast(res.message ?? "Failed", { type: "error" });
		setSaving(false);
	};

	return (
		<div>
			<PageHead
				title={t("studio.nav.live")}
				caption={t("studio.live.caption")}
			/>

			<section className="glass-panel backdrop-blur-xl backdrop-saturate-150 border glass-divider rounded-2xl p-4 mb-3">
				<h2 className="glass-eyebrow font-sans mb-3">
					{t("studio.live.new")}
				</h2>
				<div className="flex flex-col sm:flex-row gap-2.5">
					<input
						value={name}
						onChange={(e) => setName(e.target.value)}
						placeholder={t("studio.live.name")}
						maxLength={60}
						className="flex-1 h-10 rounded-lg glass-input px-3.5 font-sans text-base sm:text-sm outline-none"
					/>
					<input
						value={title}
						onChange={(e) => setTitle(e.target.value)}
						placeholder={t("studio.live.titlePh")}
						maxLength={120}
						className="flex-1 h-10 rounded-lg glass-input px-3.5 font-sans text-base sm:text-sm outline-none"
					/>
				</div>
				<div className="flex items-center gap-1.5 mt-3 flex-wrap">
					{CATEGORIES.map((c) => (
						<button
							key={c.value}
							type="button"
							onClick={() => setCategory(c.value)}
							className={clsx(
								"h-7 px-3 rounded-pill font-sans text-[12px] font-medium transition-colors cursor-pointer",
								category === c.value
									? "glass-chip-active font-semibold"
									: "glass-chip backdrop-blur-md",
							)}
						>
							{c.label}
						</button>
					))}
					<button
						type="button"
						onClick={create}
						disabled={!name.trim() || saving}
						className="ml-auto h-9 px-4 rounded-pill glass-cta font-sans text-[13px] font-semibold transition-colors cursor-pointer disabled:opacity-50 active:brightness-95"
					>
						{t("studio.live.save")}
					</button>
				</div>
			</section>

			{loading ? (
				<div className="rounded-2xl h-20 bg-[#fafaf9]/[0.05] animate-pulse" />
			) : presets.length === 0 ? (
				<div className="glass-panel backdrop-blur-xl backdrop-saturate-150 border glass-divider rounded-2xl p-8 text-center">
					<span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-pill bg-[#fafaf9]/[0.07] glass-ink-faint">
						<Broadcast size={22} />
					</span>
					<p className="font-sans text-sm glass-ink-dim">
						{t("studio.live.empty")}
					</p>
				</div>
			) : (
				<div className="flex flex-col gap-2.5">
					{presets.map((p) => (
						<div
							key={p.id}
							className="glass-panel backdrop-blur-xl backdrop-saturate-150 border glass-divider rounded-2xl px-4 py-3 flex items-center gap-3"
						>
							<div className="flex-1 min-w-0">
								<p className="font-sans text-[14.5px] font-semibold glass-ink truncate">
									{p.name}
									{p.isDefault && (
										<span className="ml-2 rounded-pill bg-gold/15 text-gold px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide">
											{t("studio.live.default")}
										</span>
									)}
								</p>
								<p className="font-sans text-[12.5px] glass-ink-faint truncate">
 {p.title || ""} ·{" "}
									{CATEGORIES.find((c) => c.value === p.category)?.label ??
										p.category}
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
									className="flex h-10 w-10 items-center justify-center rounded-pill glass-ink-faint hover:text-gold hover:bg-gold/10 transition-colors cursor-pointer"
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
								className="flex h-10 w-10 items-center justify-center rounded-pill glass-ink-faint hover:text-danger hover:bg-danger/10 transition-colors cursor-pointer"
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
