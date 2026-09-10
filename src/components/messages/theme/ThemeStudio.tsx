"use client";

import clsx from "clsx";
import { AnimatePresence } from "framer-motion";
import { useState } from "react";
import { useAuth } from "@clerk/nextjs";
import {
	OverlayHeader,
	OverlayPanel,
	OverlayScrim,
	useOverlayDismiss,
} from "@/components/ui/Overlay";
import { Tabs } from "@/components/ui/Tabs";
import { useToast } from "@/components/ui/Toast/ToastContext";
import {
	type BubbleShape,
	type ChatTheme,
	HOUSE_DEFAULT,
	HOUSE_THEIRS,
	MINE_PRESETS,
	type MineFill,
	SHAPES,
	THEIRS_PRESETS,
	type ThemeMode,
	type ThemeScope,
	WALLPAPERS,
	mineCss,
} from "./chatTheme";
import { ScopeSwitch } from "./ThemeGallery";
import { ThemePreview } from "./ThemePreview";
import { uploadWallpaperImage } from "./themeApi";

type Device = "phone" | "desktop" | "both";

/**
 * Advanced (owner 2026-09-10): the studio behind the gallery. A stage with
 * the sample thread on a phone, a desktop pane or both, and every control
 * in the pack. Nothing here touches the real chat until Save.
 */
export function ThemeStudio({
	mode,
	initial,
	scope: scopeIn,
	conversationId,
	isGroup,
	saving,
	onClose,
	onSave,
}: {
	mode: ThemeMode;
	initial: ChatTheme;
	scope: ThemeScope;
	conversationId: string;
	isGroup: boolean;
	saving: boolean;
	onClose: () => void;
	onSave: (theme: ChatTheme, scope: ThemeScope) => void;
}) {
	const { getToken } = useAuth();
	const { toast } = useToast();
	const [draft, setDraft] = useState<ChatTheme>(initial);
	const [scope, setScope] = useState<ThemeScope>(scopeIn);
	const [device, setDevice] = useState<Device>("phone");
	const [tab, setTab] = useState<"wallpaper" | "bubbles">("wallpaper");
	const [uploading, setUploading] = useState(false);
	useOverlayDismiss(true, onClose);

	const wp = (patch: Partial<ChatTheme["wallpaper"]>) =>
		setDraft((d) => ({ ...d, wallpaper: { ...d.wallpaper, ...patch } }));
	const bb = (patch: Partial<ChatTheme["bubbles"]>) =>
		setDraft((d) => ({ ...d, bubbles: { ...d.bubbles, ...patch } }));
	const mine = draft.bubbles.mine;
	const setMine = (m: MineFill) => bb({ mine: m });

	const pickPhoto = () => {
		const input = document.createElement("input");
		input.type = "file";
		input.accept = "image/*";
		input.onchange = async () => {
			const file = input.files?.[0];
			if (!file) return;
			setUploading(true);
			try {
				const { key, url } = await uploadWallpaperImage(getToken, file, conversationId);
				wp({ type: "image", imageKey: key, imageUrl: url, preset: undefined });
			} catch {
				toast("Couldn't upload that photo", { type: "error" });
			} finally {
				setUploading(false);
			}
		};
		input.click();
	};

	const label = "font-sans text-[11px] font-semibold uppercase tracking-[0.12em] text-subtle";
	const tile = "relative aspect-[4/3] cursor-pointer overflow-hidden rounded-[10px] border transition-colors";
	const chip = "h-9 w-9 shrink-0 cursor-pointer rounded-pill border-2 transition-transform";

	return (
		<AnimatePresence>
			<OverlayScrim key="studio-scrim" onClose={onClose} label="Close" />
			<OverlayPanel
				key="studio-panel"
				variant="sheet"
				label="Theme studio"
				dragClose={onClose}
				ground="none"
				className="bg-surface md:w-[min(960px,94vw)]"
			>
				<OverlayHeader title="Theme studio" onClose={onClose} />
				<div className="grid min-h-0 flex-1 grid-rows-[auto_1fr] overflow-hidden md:grid-cols-[1fr_340px] md:grid-rows-1">
					{/* Stage */}
					<div className="flex flex-col items-center gap-3 bg-sunken px-4 py-4 md:py-6">
						<div className="flex rounded-pill bg-primary/10 p-1">
							{(["phone", "desktop", "both"] as Device[]).map((d) => (
								<button
									key={d}
									type="button"
									onClick={() => setDevice(d)}
									aria-pressed={device === d}
									className={clsx(
										"h-8 cursor-pointer rounded-pill px-3.5 font-sans text-[12.5px] font-medium capitalize transition-colors",
										device === d ? "bg-primary text-page" : "text-muted hover:text-primary",
									)}
								>
									{d}
								</button>
							))}
						</div>
						<div
							className={clsx(
								"flex w-full items-end justify-center gap-4",
								device === "both" ? "flex-col md:flex-row" : "",
							)}
						>
							{device !== "desktop" && <ThemePreview theme={draft} frame="phone" />}
							{device !== "phone" && (
								<ThemePreview
									theme={draft}
									frame="desktop"
									className="max-w-[520px]"
								/>
							)}
						</div>
					</div>

					{/* Controls */}
					<div className="flex min-h-0 flex-col md:border-l md:border-hairline">
						<Tabs
							ariaLabel="Theme controls"
							value={tab}
							onChange={setTab}
							items={[
								{ key: "wallpaper", label: "Wallpaper" },
								{ key: "bubbles", label: "Bubbles" },
							]}
							className="px-4 pt-3"
						/>
						<div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 py-4">
							{tab === "wallpaper" ? (
								<>
									<div>
										<p className={clsx(label, "mb-2")}>Picture</p>
										<div className="grid grid-cols-4 gap-2">
											<button
												type="button"
												aria-label="Flat"
												onClick={() => wp({ type: "flat", preset: undefined })}
												className={clsx(
													tile,
													"flex items-center justify-center bg-page font-sans text-[11px] text-muted",
													draft.wallpaper.type === "flat" ? "border-brand" : "border-hairline",
												)}
											>
												Flat
											</button>
											{WALLPAPERS.map((w) => (
												<button
													key={w.id}
													type="button"
													aria-label={w.label}
													title={w.label}
													onClick={() => wp({ type: "preset", preset: w.id })}
													className={clsx(
														tile,
														draft.wallpaper.type === "preset" && draft.wallpaper.preset === w.id
															? "border-brand"
															: "border-hairline",
													)}
												>
													{/* eslint-disable-next-line @next/next/no-img-element */}
													<img src={w.src} alt="" className="h-full w-full object-cover" />
												</button>
											))}
											<button
												type="button"
												onClick={pickPhoto}
												disabled={uploading}
												className={clsx(
													tile,
													"flex items-center justify-center border-dashed font-sans text-[11px] font-medium text-muted hover:text-primary",
													draft.wallpaper.type === "image" ? "border-brand" : "border-hairline",
												)}
											>
												{uploading ? "…" : draft.wallpaper.type === "image" ? "Your photo" : "Upload"}
											</button>
										</div>
									</div>

									<Slider
										label="Frost"
										value={draft.wallpaper.frost}
										max={100}
										onChange={(v) => wp({ frost: v })}
										disabled={draft.wallpaper.type === "flat"}
									/>
									<label className="flex cursor-pointer items-center justify-between">
										<span className="font-sans text-[13.5px] text-primary">Cyan hue</span>
										<input
											type="checkbox"
											checked={draft.wallpaper.hue === "cyan"}
											disabled={draft.wallpaper.type === "flat"}
											onChange={(e) => wp({ hue: e.target.checked ? "cyan" : "none" })}
											className="h-4 w-4 accent-[var(--ws-brand-primary)]"
										/>
									</label>
									<Slider
										label="Dim"
										value={draft.wallpaper.dim}
										max={60}
										onChange={(v) => wp({ dim: v })}
										disabled={draft.wallpaper.type === "flat"}
									/>
								</>
							) : (
								<>
									<div>
										<p className={clsx(label, "mb-2")}>My bubbles</p>
										<div className="flex flex-wrap gap-2">
											{MINE_PRESETS.map((p) => (
												<button
													key={p.id}
													type="button"
													aria-label={p.label}
													title={p.label}
													onClick={() => setMine(p.fill)}
													className={clsx(
														chip,
														JSON.stringify(p.fill) === JSON.stringify(mine)
															? "scale-110 border-primary"
															: "border-transparent",
													)}
													style={{ background: mineCss(p.fill) }}
												/>
											))}
										</div>
									</div>
									<div>
										<p className={clsx(label, "mb-2")}>Custom</p>
										<div className="flex rounded-pill bg-primary/10 p-1">
											{(["solid", "gradient"] as const).map((k) => (
												<button
													key={k}
													type="button"
													onClick={() =>
														setMine(
															k === "solid"
																? { kind: "solid", color: mine.kind === "solid" ? mine.color : mine.stops[0] }
																: {
																		kind: "gradient",
																		stops: mine.kind === "gradient" ? mine.stops : [mine.color, "#6D5BFF"],
																		angle: mine.kind === "gradient" ? mine.angle : 135,
																	},
														)
													}
													aria-pressed={mine.kind === k}
													className={clsx(
														"h-8 flex-1 cursor-pointer rounded-pill font-sans text-[12.5px] font-medium capitalize transition-colors",
														mine.kind === k ? "bg-primary text-page" : "text-muted hover:text-primary",
													)}
												>
													{k}
												</button>
											))}
										</div>
										<div className="mt-3 flex items-center gap-3">
											{mine.kind === "solid" ? (
												<ColorField
													label="Colour"
													value={mine.color}
													onChange={(c) => setMine({ kind: "solid", color: c })}
												/>
											) : (
												<>
													<ColorField
														label="From"
														value={mine.stops[0]}
														onChange={(c) => setMine({ ...mine, stops: [c, mine.stops[1]] })}
													/>
													<ColorField
														label="To"
														value={mine.stops[1]}
														onChange={(c) => setMine({ ...mine, stops: [mine.stops[0], c] })}
													/>
												</>
											)}
										</div>
										{mine.kind === "gradient" && (
											<Slider
												label="Angle"
												value={mine.angle}
												max={360}
												unit="°"
												onChange={(v) => setMine({ ...mine, angle: v })}
											/>
										)}
									</div>
									<div>
										<p className={clsx(label, "mb-2")}>Their bubbles</p>
										<div className="flex flex-wrap items-center gap-2">
											{THEIRS_PRESETS.map((p) => (
												<button
													key={p.id}
													type="button"
													aria-label={p.label}
													title={p.label}
													onClick={() => bb({ theirs: { color: p.color } })}
													className={clsx(
														chip,
														draft.bubbles.theirs.color === p.color
															? "scale-110 border-primary"
															: "border-hairline",
													)}
													style={{ background: p.color }}
												/>
											))}
											<ColorField
												label="Custom"
												value={draft.bubbles.theirs.color === HOUSE_THEIRS ? "#26262E" : draft.bubbles.theirs.color}
												onChange={(c) => bb({ theirs: { color: c } })}
											/>
										</div>
									</div>
									<div>
										<p className={clsx(label, "mb-2")}>Shape</p>
										<div className="flex rounded-pill bg-primary/10 p-1">
											{(Object.keys(SHAPES) as BubbleShape[]).map((s) => (
												<button
													key={s}
													type="button"
													onClick={() => bb({ shape: s })}
													aria-pressed={draft.bubbles.shape === s}
													className={clsx(
														"h-8 flex-1 cursor-pointer rounded-pill font-sans text-[12.5px] font-medium transition-colors",
														draft.bubbles.shape === s ? "bg-primary text-page" : "text-muted hover:text-primary",
													)}
												>
													{SHAPES[s].label}
												</button>
											))}
										</div>
									</div>
								</>
							)}
						</div>

						{/* Footer */}
						<div className="flex flex-col gap-3 border-t border-hairline px-4 pb-[calc(12px+var(--ws-safe-bottom))] pt-3">
							<ScopeSwitch scope={scope} onChange={setScope} isGroup={isGroup} />
							<div className="flex items-center justify-between gap-3">
								<button
									type="button"
									onClick={() => setDraft(HOUSE_DEFAULT[mode])}
									className="cursor-pointer font-sans text-[13px] text-muted transition-colors hover:text-primary"
								>
									Reset
								</button>
								<button
									type="button"
									disabled={saving || uploading}
									onClick={() => onSave(draft, scope)}
									className="h-10 cursor-pointer rounded-pill bg-brand px-5 font-sans text-[13.5px] font-semibold text-brand-on transition-colors hover:bg-brand-active disabled:opacity-50"
								>
									{saving ? "Saving…" : scope === "all" ? "Save for all chats" : "Save"}
								</button>
							</div>
						</div>
					</div>
				</div>
			</OverlayPanel>
		</AnimatePresence>
	);
}

function Slider({
	label,
	value,
	max,
	unit = "%",
	disabled,
	onChange,
}: {
	label: string;
	value: number;
	max: number;
	unit?: string;
	disabled?: boolean;
	onChange: (v: number) => void;
}) {
	return (
		<div className={clsx(disabled && "opacity-40")}>
			<p className="mb-1.5 flex items-center justify-between font-sans text-[11px] font-semibold uppercase tracking-[0.12em] text-subtle">
				{label}
				<span className="tabular-nums text-muted">
					{value}
					{unit}
				</span>
			</p>
			<input
				type="range"
				min={0}
				max={max}
				step={max > 100 ? 5 : 5}
				value={value}
				disabled={disabled}
				onChange={(e) => onChange(Number(e.target.value))}
				className="w-full accent-[var(--ws-brand-primary)]"
			/>
		</div>
	);
}

function ColorField({
	label,
	value,
	onChange,
}: {
	label: string;
	value: string;
	onChange: (hex: string) => void;
}) {
	return (
		<label className="flex cursor-pointer items-center gap-2">
			<span className="relative h-9 w-9 overflow-hidden rounded-pill border border-hairline">
				<input
					type="color"
					value={value}
					onChange={(e) => onChange(e.target.value)}
					aria-label={label}
					className="absolute -inset-2 h-[calc(100%+16px)] w-[calc(100%+16px)] cursor-pointer border-0 bg-transparent p-0"
				/>
			</span>
			<span className="font-sans text-[12px] text-muted">
				{label}
				<span className="ml-1 font-mono text-[11px] uppercase text-subtle">{value}</span>
			</span>
		</label>
	);
}
