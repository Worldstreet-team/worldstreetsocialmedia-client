"use client";

import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import {
	OverlayHeader,
	OverlayPanel,
	OverlayScrim,
	useOverlayDismiss,
} from "@/components/ui/Overlay";
import GlassSelect from "@/components/ui/GlassSelect";
import { Switch } from "@/components/ui/Switch";
import { Tabs } from "@/components/ui/Tabs";
import { useToast } from "@/components/ui/Toast/ToastContext";
import {
	collapse,
	staggerParentFast,
	staggerPop,
	swap,
} from "@/lib/motion-presets";
import {
	type BubbleShape,
	type ChatTheme,
	GROUND_PRESETS,
	HOUSE_DEFAULT,
	HOUSE_THEIRS,
	MINE_PRESETS,
	type MineFill,
	SHAPES,
	THEIRS_PRESETS,
	type ThemeMode,
	type ThemeScope,
	type ThemeWallpaper,
	WALLPAPERS,
	groundCss,
	mineCss,
} from "./chatTheme";
import { ScopeSwitch } from "./ThemeGallery";
import { ThemePreview } from "./ThemePreview";
import { uploadWallpaperImage } from "./themeApi";

type Device = "phone" | "desktop" | "both";
type Panel = "wallpaper" | "bubbles";

/** True below the md breakpoint, false on the server and on a desktop. */
function usePhone(): boolean {
	const [phone, setPhone] = useState(false);
	useEffect(() => {
		const mq = window.matchMedia("(max-width: 767px)");
		const sync = () => setPhone(mq.matches);
		sync();
		mq.addEventListener("change", sync);
		return () => mq.removeEventListener("change", sync);
	}, []);
	return phone;
}

/**
 * Advanced (owner 2026-09-10, second pass 2026-09-11): the studio behind the
 * gallery. The sample thread on a stage, every control in the pack under it,
 * nothing touching the real chat until Save.
 *
 * The stage shows the device you are on. A phone gets the phone frame and no
 * device picker (you are holding the answer); a desktop defaults to the pane
 * it will paint and can flip to the phone or both. The controls are the house
 * ones (Tabs, Switch, GlassSelect), not native inputs, and they are grouped
 * by what a person is deciding: the ground, then the picture and its
 * treatment, then my bubbles, theirs, and last the geometry.
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
	const phone = usePhone();
	const [draft, setDraft] = useState<ChatTheme>(initial);
	const [scope, setScope] = useState<ThemeScope>(scopeIn);
	const [device, setDevice] = useState<Device | null>(null);
	const [panel, setPanel] = useState<Panel>("wallpaper");
	const [uploading, setUploading] = useState(false);
	useOverlayDismiss(true, onClose);
	// The studio mounts per open, so "after the first commit" is "after the
	// opening": the ground chips cascade once, and the first panel arrives
	// with the sheet instead of fading in a second time inside it.
	const opened = useRef(false);
	useEffect(() => {
		opened.current = true;
	}, []);
	// Until the person picks, the stage follows the viewport.
	const shown: Device = device ?? (phone ? "phone" : "desktop");

	const wp = (patch: Partial<ThemeWallpaper>) =>
		setDraft((d) => ({ ...d, wallpaper: { ...d.wallpaper, ...patch } }));
	const bb = (patch: Partial<ChatTheme["bubbles"]>) =>
		setDraft((d) => ({ ...d, bubbles: { ...d.bubbles, ...patch } }));
	const mine = draft.bubbles.mine;
	const setMine = (m: MineFill) => bb({ mine: m });
	const w = draft.wallpaper;
	const hasPicture = w.type === "preset" || w.type === "image";
	const groundId =
		w.type === "flat"
			? "flat"
			: (GROUND_PRESETS.find((g) => sameGround(g[mode], w))?.id ?? (hasPicture ? "" : "custom"));

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

	const heading = "font-sans text-[calc(13px*var(--ws-fs))] font-semibold text-primary";
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
				<div className="grid min-h-0 flex-1 grid-rows-[auto_1fr] overflow-hidden md:grid-cols-[1fr_360px] md:grid-rows-1">
					{/* Stage */}
					<div className="flex flex-col items-center gap-3 bg-sunken px-4 py-3 md:py-6">
						{!phone && (
							<Tabs<Device>
								ariaLabel="Preview device"
								value={shown}
								onChange={setDevice}
								className="px-0 py-0"
								items={[
									{ key: "desktop", label: "Desktop" },
									{ key: "phone", label: "Phone" },
									{ key: "both", label: "Both" },
								]}
							/>
						)}
						<div
							className={clsx(
								"flex w-full items-end justify-center gap-4",
								shown === "both" ? "flex-col md:flex-row" : "",
							)}
						>
							{shown !== "desktop" && (
								<ThemePreview
									theme={draft}
									frame="phone"
									// On a phone the stage is a strip above the controls;
									// a full-height frame would push them off the screen.
									className={clsx(phone && "!aspect-[9/11] w-[150px]")}
								/>
							)}
							{shown !== "phone" && (
								<ThemePreview theme={draft} frame="desktop" className="max-w-[520px]" />
							)}
						</div>
					</div>

					{/* Controls */}
					<div className="flex min-h-0 flex-col md:border-l md:border-hairline">
						<Tabs<Panel>
							ariaLabel="Theme controls"
							value={panel}
							onChange={setPanel}
							items={[
								{ key: "wallpaper", label: "Wallpaper" },
								{ key: "bubbles", label: "Bubbles" },
							]}
							className="px-4 pt-3"
						/>
						<div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-4">
							<AnimatePresence mode="wait">
							{panel === "wallpaper" ? (
								<motion.div
									key="wallpaper"
									{...swap}
									initial={opened.current ? swap.initial : false}
									className="flex shrink-0 flex-col gap-6"
								>
									<section>
										<p className={clsx(heading, "mb-2")}>Ground</p>
										<motion.div
											variants={staggerParentFast}
											initial={opened.current ? false : "hidden"}
											animate="show"
											className="flex flex-wrap items-center gap-2"
										>
											{/* Each chip rides a wrapper: the chip's own CSS
											    transition on transform (its selected scale)
											    would smear a framer transform set on it. */}
											<motion.span variants={staggerPop} className="flex shrink-0">
											<button
												type="button"
												aria-label="Flat"
												title="Flat, the app's own ground"
												onClick={() => wp({ type: "flat", color: undefined, stops: undefined, preset: undefined, imageKey: undefined, imageUrl: undefined })}
												className={clsx(chip, "bg-page", groundId === "flat" ? "scale-110 border-primary" : "border-hairline")}
											/>
											</motion.span>
											{GROUND_PRESETS.map((g) => (
												<motion.span key={g.id} variants={staggerPop} className="flex shrink-0">
												<button
													type="button"
													aria-label={g.label}
													title={g.label}
													onClick={() => wp({ ...g[mode], preset: undefined, imageKey: undefined, imageUrl: undefined })}
													className={clsx(chip, groundId === g.id ? "scale-110 border-primary" : "border-hairline")}
													style={{ background: groundCss(g[mode]) ?? undefined }}
												/>
												</motion.span>
											))}
											<motion.span variants={staggerPop} className="flex shrink-0">
											<ColorField
												label="Own colour"
												value={w.type === "solid" && w.color ? w.color : mode === "dark" ? "#000000" : "#FAFAF9"}
												onChange={(c) => wp({ type: "solid", color: c, stops: undefined, preset: undefined, imageKey: undefined, imageUrl: undefined })}
											/>
											</motion.span>
										</motion.div>
									</section>

									<section>
										<p className={clsx(heading, "mb-2")}>Picture</p>
										<div className="grid grid-cols-4 gap-2">
											{/* This mode's pictures first: a dark chat wants the dark ones in reach. */}
											{[...WALLPAPERS].sort((a, b) => Number(b.tone === mode) - Number(a.tone === mode)).map((p) => (
												<button
													key={p.id}
													type="button"
													aria-label={p.label}
													title={p.label}
													onClick={() => wp({ type: "preset", preset: p.id, color: undefined, stops: undefined })}
													className={clsx(
														tile,
														w.type === "preset" && w.preset === p.id ? "border-brand" : "border-hairline",
													)}
												>
													{/* eslint-disable-next-line @next/next/no-img-element */}
													<img src={p.src} alt="" loading="lazy" className="h-full w-full object-cover" />
												</button>
											))}
											<button
												type="button"
												onClick={pickPhoto}
												disabled={uploading}
												className={clsx(
													tile,
													"flex items-center justify-center border-dashed font-sans text-[calc(11px*var(--ws-fs))] font-medium text-muted hover:text-primary",
													w.type === "image" ? "border-brand" : "border-hairline",
												)}
											>
												{uploading ? "…" : w.type === "image" ? "Your photo" : "Upload"}
											</button>
										</div>
										{hasPicture && (
											<button
												type="button"
												onClick={() => wp({ type: "flat", preset: undefined, imageKey: undefined, imageUrl: undefined })}
												className="mt-2 cursor-pointer font-sans text-[calc(12px*var(--ws-fs))] text-muted transition-colors hover:text-primary"
											>
												Remove picture
											</button>
										)}

									{/* Treatments exist only for a picture: a painted ground has
									    nothing to frost or dim, so the rows are gone, not greyed.
									    They fold open under the pictures; the column's gap
									    lives inside the fold (pt-6) so it closes to nothing. */}
									<AnimatePresence initial={false}>
									{hasPicture && (
										<motion.div key="treatment" {...collapse} className="overflow-hidden">
										<section className="flex flex-col gap-4 pt-6">
											<p className={heading}>Treatment</p>
											<Slider label="Frost" value={w.frost} max={100} onChange={(v) => wp({ frost: v })} />
											<div className="flex items-center justify-between">
												<span className="font-sans text-[calc(13.5px*var(--ws-fs))] text-primary">
													Brand tint
													<span className="block font-sans text-[calc(11.5px*var(--ws-fs))] text-muted">
														Grayscale, washed in the brand colour
													</span>
												</span>
												<Switch
													checked={w.hue === "cyan"}
													onChange={(on) => wp({ hue: on ? "cyan" : "none" })}
													label="Brand tint"
												/>
											</div>
											<Slider label="Dim" value={w.dim} max={60} onChange={(v) => wp({ dim: v })} />
										</section>
										</motion.div>
									)}
									</AnimatePresence>
									</section>
								</motion.div>
							) : (
								<motion.div key="bubbles" {...swap} className="flex shrink-0 flex-col gap-6">
									<section>
										<p className={clsx(heading, "mb-2")}>My bubbles</p>
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
										<div className="mt-3">
											<Tabs<MineFill["kind"]>
												ariaLabel="Fill"
												value={mine.kind}
												className="px-0 py-0"
												onChange={(k) =>
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
												items={[
													{ key: "solid", label: "Solid" },
													{ key: "gradient", label: "Gradient" },
												]}
											/>
											<div className="mt-3">
												<AnimatePresence mode="wait" initial={false}>
													<motion.div
														key={mine.kind}
														{...swap}
														className="flex flex-wrap items-center gap-3"
													>
														{mine.kind === "solid" ? (
															<ColorField label="Colour" value={mine.color} onChange={(c) => setMine({ kind: "solid", color: c })} />
														) : (
															<>
																<ColorField label="From" value={mine.stops[0]} onChange={(c) => setMine({ ...mine, stops: [c, mine.stops[1]] })} />
																<ColorField label="To" value={mine.stops[1]} onChange={(c) => setMine({ ...mine, stops: [mine.stops[0], c] })} />
															</>
														)}
													</motion.div>
												</AnimatePresence>
											</div>
											<AnimatePresence initial={false}>
												{mine.kind === "gradient" && (
													<motion.div key="angle" {...collapse} className="overflow-hidden">
														<div className="pt-3">
															<Slider label="Angle" value={mine.angle} max={360} unit="°" onChange={(v) => setMine({ ...mine, angle: v })} />
														</div>
													</motion.div>
												)}
											</AnimatePresence>
										</div>
									</section>

									<section>
										<p className={clsx(heading, "mb-2")}>Their bubbles</p>
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
														draft.bubbles.theirs.color === p.color ? "scale-110 border-primary" : "border-hairline",
													)}
													style={{ background: p.color }}
												/>
											))}
											<ColorField
												label="Own colour"
												value={draft.bubbles.theirs.color === HOUSE_THEIRS ? "#26262E" : draft.bubbles.theirs.color}
												onChange={(c) => bb({ theirs: { color: c } })}
											/>
										</div>
									</section>

									<section>
										<p className={clsx(heading, "mb-2")}>Shape</p>
										{/* The one control the gallery never touches: every card
										    ships Rounded (owner, 2026-09-03 / 2026-09-10). Here it is
										    a deliberate act, with the geometry spelled out. */}
										<GlassSelect
											label="Bubble shape"
											value={draft.bubbles.shape}
											onChange={(id) => bb({ shape: id as BubbleShape })}
											options={(Object.keys(SHAPES) as BubbleShape[]).map((s) => ({
												id: s,
												label: SHAPES[s].label,
												hint: `${SHAPES[s].r} / ${SHAPES[s].rin} px${s === "rounded" ? " · what every theme ships" : ""}`,
											}))}
										/>
									</section>
								</motion.div>
							)}
							</AnimatePresence>
						</div>

						{/* Footer */}
						<div className="flex flex-col gap-3 border-t border-hairline px-4 pb-[calc(12px+var(--ws-safe-bottom))] pt-3">
							<ScopeSwitch scope={scope} onChange={setScope} isGroup={isGroup} />
							<div className="flex items-center justify-between gap-3">
								<button
									type="button"
									onClick={() => setDraft(HOUSE_DEFAULT[mode])}
									className="cursor-pointer font-sans text-[calc(13px*var(--ws-fs))] text-muted transition-colors hover:text-primary"
								>
									Reset
								</button>
								<button
									type="button"
									disabled={saving || uploading}
									onClick={() => onSave(draft, scope)}
									className="h-10 cursor-pointer rounded-pill bg-brand px-5 font-sans text-[calc(13.5px*var(--ws-fs))] font-semibold text-brand-on transition-colors hover:bg-brand-active disabled:opacity-50"
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

/** Same painted ground, ignoring the picture-only fields. */
function sameGround(a: ThemeWallpaper, b: ThemeWallpaper): boolean {
	return (
		a.type === b.type &&
		(a.color ?? "") === (b.color ?? "") &&
		(a.stops?.[0] ?? "") === (b.stops?.[0] ?? "") &&
		(a.stops?.[1] ?? "") === (b.stops?.[1] ?? "") &&
		(a.angle ?? 160) === (b.angle ?? 160)
	);
}

function Slider({
	label,
	value,
	max,
	unit = "%",
	onChange,
}: {
	label: string;
	value: number;
	max: number;
	unit?: string;
	onChange: (v: number) => void;
}) {
	return (
		<div>
			<p className="mb-1.5 flex items-center justify-between font-sans text-[calc(13px*var(--ws-fs))] font-semibold text-primary">
				{label}
				<span className="font-normal tabular-nums text-subtle">
					{value}
					{unit}
				</span>
			</p>
			<input
				type="range"
				min={0}
				max={max}
				step={5}
				value={value}
				onChange={(e) => onChange(Number(e.target.value))}
				aria-label={label}
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
			<span className="font-sans text-[calc(12px*var(--ws-fs))] text-muted">
				{label}
				<span className="ml-1 font-mono text-[calc(12px*var(--ws-fs))] uppercase text-muted">{value}</span>
			</span>
		</label>
	);
}
