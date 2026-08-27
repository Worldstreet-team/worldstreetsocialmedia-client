"use client";

import Image from "next/image";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import {
	ArrowSquareOut,
	Broadcast,
	CaretDown,
	Check,
	Copy,
	MagnifyingGlass,
	Microphone,
	Monitor,
	Plugs,
	VideoCamera,
	Warning,
	X,
} from "@phosphor-icons/react";
import clsx from "clsx";
import { useAtomValue, useSetAtom } from "jotai";
import { userAtom } from "@/store/user.atom";
import { XSTREAM_WEB_URL } from "@/const";
import { useT } from "@/i18n/client";
import {
	goLiveAction,
	xstreamStatusAction,
	type GoLiveSource,
} from "@/lib/live.actions";
import { liveSessionAtom } from "@/store/live.atom";
import { CATEGORIES as TAXONOMY, VERTICALS } from "@/data/categories";
import { useToast } from "@/components/ui/Toast/ToastContext";
import {
	OverlayHeader,
	OverlayPanel,
	OverlayScrim,
	useOverlayDismiss,
} from "@/components/ui/Overlay";
import { SafeAvatar } from "@/components/ui/SafeAvatar";

/** Old preset values (socials 5-list / Xstream 6-enum) → taxonomy labels. */
const LEGACY_PRESET_CATEGORY: Record<string, string> = {
	markets: "Stocks & Equities",
	crypto: "Crypto Markets",
	forex: "Forex",
	stocks: "Stocks & Equities",
	general: "Just Chatting",
};

/* Category icons. The design system bans emoji as UI icons, but the owner
   asked for glyphs that actually depict each vertical, emoji included. */
const VERTICAL_ICON: Record<string, string> = {
	markets: "\u{1F4C8}",
	web3: "\u26D3\uFE0F",
	business: "\u{1F4BC}",
	tech: "\u{1F916}",
	news: "\u{1F4F0}",
	sports: "\u26BD",
	gaming: "\u{1F3AE}",
	entertainment: "\u{1F3AC}",
	music: "\u{1F3B5}",
	lifestyle: "\u2728",
	health: "\u{1F9D8}",
	arts: "\u{1F3A8}",
	creator: "\u{1F4F1}",
	learning: "\u{1F393}",
};

const SOURCES: {
	value: GoLiveSource;
	labelKey: string;
	Icon: typeof VideoCamera;
}[] = [
	{ value: "camera", labelKey: "golive.source.camera", Icon: VideoCamera },
	{ value: "screen", labelKey: "golive.source.screen", Icon: Monitor },
	{ value: "obs", labelKey: "golive.source.obs", Icon: Plugs },
];

type LinkState =
	| { kind: "checking" }
	| { kind: "linked"; name?: string }
	| { kind: "failed"; message?: string };

export interface GoLivePreset {
	title?: string;
	category?: string;
	/** Capture source the creator saved — camera or an OBS/RTMP ingress. */
	source?: "camera" | "obs";
	notifyFollowers?: boolean;
}

/** Glass popover select — replaces the bare native <select> device pickers. */
function GlassSelect({
	icon,
	value,
	options,
	onChange,
}: {
	icon: React.ReactNode;
	value: string;
	options: { id: string; label: string }[];
	onChange: (id: string) => void;
}) {
	const [open, setOpen] = useState(false);
	const current = options.find((o) => o.id === value) ?? options[0];
	return (
		<div className="relative flex-1 min-w-0">
			<button
				type="button"
				onClick={() => setOpen((v) => !v)}
				className="w-full flex items-center gap-1.5 rounded-pill glass-chip px-3 h-8 cursor-pointer"
			>
				<span className="shrink-0 opacity-80">{icon}</span>
				<span className="flex-1 min-w-0 truncate text-left text-[12px] font-sans">
 {current?.label ?? ""}
				</span>
				<CaretDown
					size={11}
					className={clsx("shrink-0 transition-transform", open && "rotate-180")}
				/>
			</button>
			{open && (
				<>
					<button
						type="button"
						aria-label="Close"
						className="fixed inset-0 cursor-default"
						onClick={() => setOpen(false)}
					/>
					{/* No blur of its own: the sheet panel already carries the
					    one backdrop pass in this stack. */}
					<div className="absolute bottom-10 left-0 right-0 glass-panel !rounded-xl py-1 max-h-44 overflow-y-auto">
						{options.map((o) => (
							<button
								key={o.id}
								type="button"
								onClick={() => {
									onChange(o.id);
									setOpen(false);
								}}
								className="w-full flex items-center gap-2 px-3 py-2 text-left font-sans text-[12px] glass-ink-dim hover:glass-ink hover:bg-white/10 transition-colors cursor-pointer"
							>
								<span className="flex-1 truncate">{o.label}</span>
								{o.id === value && (
									<Check size={12} weight="bold" className="shrink-0" />
								)}
							</button>
						))}
					</div>
				</>
			)}
		</div>
	);
}

/**
 * Go-live control room, portaled to <body>, in the editors' glass language.
 * Camera preview leads; the Xstream link is proven up front (quiet chip, a
 * touch of green — not a green slab); source is camera / screen / OBS; the
 * category picker is the curated 100-category taxonomy collapsed by
 * vertical with search; and the "Broadcast from Social" toggle decides
 * whether the stream publishes right here (the floating LiveDock takes
 * over — no redirect) or hands off to the Xstream studio. Hand in glove.
 */
export function GoLiveSheet({
	onClose,
	preset,
}: {
	onClose: () => void;
	preset?: GoLivePreset | null;
}) {
	const t = useT();
	const { toast } = useToast();
	const setLiveSession = useSetAtom(liveSessionAtom);
	// No prefilled title: the broadcaster names their own stream, and cannot
	// start without one.
	const [title, setTitle] = useState("");
	// Both of these are what the preset exists to remember: the sheet used
	// to ask every stream and forget the answer.
	const [notifyFollowers, setNotifyFollowers] = useState(
		preset?.notifyFollowers ?? true,
	);
	const me = useAtomValue(userAtom);
	const [category, setCategory] = useState(() => {
		const raw = preset?.category ?? "";
		const mapped = LEGACY_PRESET_CATEGORY[raw.toLowerCase()] ?? raw;
		return mapped || "Crypto Markets";
	});
	const [pickerOpen, setPickerOpen] = useState(false);
	const [search, setSearch] = useState("");
	const [openVertical, setOpenVertical] = useState<string | null>(null);
	const [source, setSource] = useState<GoLiveSource>(
		preset?.source === "obs" ? "obs" : "camera",
	);
	const [nativeMode, setNativeMode] = useState(true);
	const [link, setLink] = useState<LinkState>({ kind: "checking" });
	const [cams, setCams] = useState<MediaDeviceInfo[]>([]);
	const [mics, setMics] = useState<MediaDeviceInfo[]>([]);
	const [camId, setCamId] = useState("");
	const [micId, setMicId] = useState("");
	const [denied, setDenied] = useState(false);
	const [ready, setReady] = useState(false);
	const [starting, setStarting] = useState(false);
	const [obsInfo, setObsInfo] = useState<{
		url: string;
		streamKey: string;
		streamId?: string;
	} | null>(null);
	const [copied, setCopied] = useState<"url" | "key" | null>(null);
	const videoRef = useRef<HTMLVideoElement>(null);
	const streamRef = useRef<MediaStream | null>(null);

	const byVertical = useMemo(() => {
		const map = new Map<string, typeof TAXONOMY>();
		for (const cat of TAXONOMY) {
			const list = map.get(cat.vertical) ?? [];
			list.push(cat);
			map.set(cat.vertical, list);
		}
		return map;
	}, []);

	const searchResults = useMemo(() => {
		const q = search.trim().toLowerCase();
		if (!q) return null;
		return TAXONOMY.filter((c) => c.label.toLowerCase().includes(q)).slice(
			0,
			24,
		);
	}, [search]);

	const stopTracks = () => {
		streamRef.current?.getTracks().forEach((track) => track.stop());
		streamRef.current = null;
	};

	const checkLink = async () => {
		setLink({ kind: "checking" });
		const res = await xstreamStatusAction();
		if (res.connected) {
			setLink({ kind: "linked", name: res.username ?? res.displayName });
		} else {
			setLink({ kind: "failed", message: res.message });
		}
	};

	const openPreview = async (video?: string, audio?: string) => {
		stopTracks();
		setDenied(false);
		setReady(false);
		try {
			const media = await navigator.mediaDevices.getUserMedia({
				video: video ? { deviceId: { exact: video } } : true,
				audio: audio ? { deviceId: { exact: audio } } : true,
			});
			streamRef.current = media;
			if (videoRef.current) videoRef.current.srcObject = media;
			const devices = await navigator.mediaDevices.enumerateDevices();
			setCams(devices.filter((d) => d.kind === "videoinput"));
			setMics(devices.filter((d) => d.kind === "audioinput"));
			setReady(true);
		} catch {
			setDenied(true);
		}
	};

	useEffect(() => {
		void openPreview();
		void checkLink();
		return () => {
			stopTracks();
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	useEffect(() => {
		if (source === "camera") {
			void openPreview(camId || undefined, micId || undefined);
		} else {
			stopTracks();
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [source]);

	const close = useCallback(() => {
		stopTracks();
		onClose();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [onClose]);

	// Esc + the body scroll lock. Mounted only while open, so `open` is
	// constant — the caller unmounts the sheet to close it.
	useOverlayDismiss(true, close);

	const copyValue = async (kind: "url" | "key", value: string) => {
		try {
			await navigator.clipboard.writeText(value);
			setCopied(kind);
			setTimeout(() => setCopied(null), 1500);
		} catch {
			toast(t("promo.failed"), { type: "error" });
		}
	};

	const linked = link.kind === "linked";
	const canStart =
		linked &&
		!starting &&
		title.trim().length > 0 &&
		(source === "camera" ? ready && !denied : true);

	const start = async () => {
		if (!canStart) return;
		setStarting(true);
		try {
			const res = await goLiveAction(
				title.trim(),
				category,
				source,
				notifyFollowers,
			);
			if (!res.success) {
				toast(res.message ?? t("promo.failed"), { type: "error" });
				return;
			}
			if (source === "obs") {
				stopTracks();
				setObsInfo({
					url: res.ingress?.url ?? "",
					streamKey: res.ingress?.streamKey ?? "",
					streamId: res.streamId,
				});
				return;
			}
			stopTracks();
			if (
				nativeMode &&
				res.streamId &&
				res.roomName &&
				res.livekitToken &&
				res.livekitUrl
			) {
				// Broadcast from HERE: the LiveDock picks the session up and
				// publishes — socials is the studio, no redirect.
				setLiveSession({
					streamId: res.streamId,
					roomName: res.roomName,
					token: res.livekitToken,
					url: res.livekitUrl,
					title: title.trim(),
					category,
					source: source as "camera" | "screen",
				});
				toast(t("golive.liveHere"), { type: "success" });
				onClose();
				return;
			}
			const target =
				source === "screen" ? "/studio?source=screen" : "/studio";
			window.open(`${XSTREAM_WEB_URL}${target}`, "_blank", "noopener");
			toast(t("golive.opens"), { type: "success" });
			onClose();
		} finally {
			setStarting(false);
		}
	};

	if (typeof document === "undefined") return null;

	return createPortal(
		<AnimatePresence>
			<OverlayScrim
				key="golive-scrim"
				onClose={close}
				label={t("common.close")}
			/>
			<OverlayPanel
				key="golive-panel"
				variant="sheet"
				label={obsInfo ? t("golive.obs.title") : t("golive.title")}
				className={clsx(
					obsInfo
						? "sm:!w-[460px]"
						: // Landscape: stage on the left, controls on the right.
							// On a phone the rows stack and the controls row takes
							// what is left, so it scrolls inside the sheet instead
							// of being clipped by it.
							"!grid grid-cols-1 grid-rows-[auto_auto_minmax(0,1fr)] sm:grid-cols-[1.05fr_minmax(330px,0.95fr)] sm:grid-rows-none sm:!w-[860px] sm:!max-w-[94vw]",
				)}
			>
				{obsInfo ? (
					/* ── OBS connect state ─────────────────────────────── */
					<>
						<OverlayHeader onClose={close} closeLabel={t("common.close")}>
							<span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-pill bg-danger/15 text-danger">
								<Plugs size={16} weight="fill" />
							</span>
							<div className="min-w-0 flex-1">
								<p className="truncate font-display text-[15px] font-semibold leading-tight text-primary">
									{t("golive.obs.title")}
								</p>
								<p className="truncate font-sans text-[12px] text-muted">
									{t("golive.obs.note")}
								</p>
							</div>
						</OverlayHeader>
						<div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-5 pt-2">

						{(
							[
								{
									kind: "url" as const,
									label: t("golive.obs.server"),
									value: obsInfo.url,
								},
								{
									kind: "key" as const,
									label: t("golive.obs.key"),
									value: obsInfo.streamKey,
								},
							]
						).map((row) => (
							<div key={row.kind}>
								<p className="font-sans text-[10.5px] font-semibold uppercase tracking-[0.12em] text-subtle mb-1.5">
									{row.label}
								</p>
								<div className="flex items-center gap-2">
									<code className="flex-1 min-w-0 truncate rounded-lg bg-sunken text-primary px-3 h-10 leading-10 font-mono text-[12.5px]">
										{row.kind === "key"
											? "•".repeat(Math.min(24, row.value.length || 12))
 : row.value || ""}
									</code>
									<button
										type="button"
										onClick={() => void copyValue(row.kind, row.value)}
										aria-label={t("golive.obs.copy")}
										className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-chip text-muted transition-colors hover:text-primary cursor-pointer"
									>
										{copied === row.kind ? (
											<Check
												size={15}
												weight="bold"
												className="text-success"
											/>
										) : (
											<Copy size={15} />
										)}
									</button>
								</div>
							</div>
						))}

						<div className="flex gap-2 mt-1">
							{obsInfo.streamId && (
								<a
									href={`${XSTREAM_WEB_URL}/stream/${obsInfo.streamId}`}
									target="_blank"
									rel="noopener noreferrer"
									className="flex-1 h-11 flex items-center justify-center gap-2 rounded-pill bg-chip text-primary transition-colors hover:bg-raised font-sans text-[13px] font-semibold"
								>
									<ArrowSquareOut size={15} />
									{t("golive.obs.open")}
								</a>
							)}
							<button
								type="button"
								onClick={close}
								className="flex-1 h-11 rounded-pill bg-brand text-brand-on font-sans text-[13px] font-semibold transition-colors hover:bg-brand-active cursor-pointer"
							>
								{t("golive.obs.done")}
							</button>
						</div>
						</div>
					</>
				) : (
					<>
						{/* ── Stage ── */}
						<div className="relative bg-black aspect-video shrink-0 sm:aspect-auto sm:h-full sm:min-h-[430px] overflow-hidden">
							{source === "camera" ? (
								denied ? (
									<div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-8 text-center">
										<span className="flex h-12 w-12 items-center justify-center rounded-pill bg-danger/20 text-danger">
											<Warning size={22} weight="fill" />
										</span>
										<p className="text-sm glass-ink-dim font-sans max-w-[280px]">
											{t("golive.denied")}
										</p>
										<button
											type="button"
											onClick={() => void openPreview()}
											className="mt-1 px-4 h-9 rounded-pill glass-chip text-sm font-semibold font-sans cursor-pointer"
										>
											{t("rail.retry")}
										</button>
									</div>
								) : (
									<>
										{/* eslint-disable-next-line jsx-a11y/media-has-caption */}
										<video
											ref={videoRef}
											autoPlay
											playsInline
											muted
											className="absolute inset-0 w-full h-full object-cover [transform:scaleX(-1)]"
										/>
										<span className="absolute top-3 left-3 flex items-center gap-1.5 rounded-pill glass-chip px-2.5 h-6 text-[10.5px] font-bold tracking-wide font-sans">
											<span className="relative flex h-1.5 w-1.5">
												<span className="absolute inline-flex h-full w-full rounded-pill bg-danger opacity-70 animate-ping" />
												<span className="relative inline-flex h-1.5 w-1.5 rounded-pill bg-danger" />
											</span>
											{t("golive.preview")}
										</span>
										{(cams.length > 1 || mics.length > 1) && (
											<div className="absolute bottom-3 inset-x-3 flex gap-2">
												<GlassSelect
													icon={<VideoCamera size={13} />}
													value={camId || cams[0]?.deviceId || ""}
													options={cams.map((d) => ({
														id: d.deviceId,
														label: d.label || "Camera",
													}))}
													onChange={(id) => {
														setCamId(id);
														void openPreview(id, micId || undefined);
													}}
												/>
												<GlassSelect
													icon={<Microphone size={13} />}
													value={micId || mics[0]?.deviceId || ""}
													options={mics.map((d) => ({
														id: d.deviceId,
														label: d.label || "Microphone",
													}))}
													onChange={(id) => {
														setMicId(id);
														void openPreview(camId || undefined, id);
													}}
												/>
											</div>
										)}
									</>
								)
							) : (
								<div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-10 text-center">
									<span className="flex h-12 w-12 items-center justify-center rounded-pill glass-chip ">
										{source === "screen" ? (
											<Monitor size={22} />
										) : (
											<Plugs size={22} />
										)}
									</span>
									<p className="text-[13px] glass-ink-dim font-sans max-w-[300px] leading-relaxed">
										{source === "screen"
											? nativeMode
												? t("golive.screenNativeHint")
												: t("golive.screenHint")
											: t("golive.obsHint")}
									</p>
								</div>
							)}
						</div>

						{/* ── Controls column ── */}
						<div className="relative flex min-h-0 flex-col gap-3 overflow-y-auto p-4 sm:p-5">
							<button
								type="button"
								onClick={close}
								aria-label={t("common.close")}
								className="absolute top-3 right-3 z-10 flex h-8 w-8 items-center justify-center rounded-pill bg-chip text-muted transition-colors hover:text-primary cursor-pointer"
							>
								<X size={15} />
							</button>
							{/* Link status: quiet chip, a touch of green. */}
							<div className="flex items-center gap-2.5 font-sans text-[12px] pr-10">
								{link.kind === "linked" ? (
									<span className="relative shrink-0">
										<span className="block h-7 w-7 rounded-pill overflow-hidden bg-chip">
											{me?.avatar && (
												<SafeAvatar src={me.avatar} width={28} height={28} className="h-7 w-7 object-cover" />
											)}
										</span>
										{/* WorldStreet mark: this identity is the ecosystem one. */}
										<span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-pill bg-page flex items-center justify-center">
											<Image
												src="/images/wsa-mark.png"
												alt="WorldStreet"
												width={9}
												height={9}
												className="h-[9px] w-[9px] object-contain"
											/>
										</span>
									</span>
								) : link.kind === "checking" ? (
									<span className="h-2.5 w-2.5 rounded-pill border-2 border-hairline border-t-muted animate-spin" />
								) : (
									<span className="h-2 w-2 shrink-0 rounded-pill bg-danger" />
								)}
								<span className="text-muted truncate">
									{link.kind === "checking" && t("golive.link.checking")}
									{link.kind === "linked" && (
										<span className="text-primary font-medium">
											@{link.name ?? me?.username}
										</span>
									)}
									{link.kind === "failed" &&
										(link.message ?? t("golive.link.failed"))}
								</span>
								{link.kind === "failed" && (
									<button
										type="button"
										onClick={() => void checkLink()}
										className="ml-auto shrink-0 text-primary font-semibold hover:underline cursor-pointer"
									>
										{t("rail.retry")}
									</button>
								)}
							</div>

							{/* Source */}
							<div className="grid grid-cols-3 gap-1.5">
								{SOURCES.map(({ value, labelKey, Icon }) => (
									<button
										key={value}
										type="button"
										onClick={() => setSource(value)}
										className={clsx(
											"flex items-center justify-center gap-1.5 rounded-pill h-9 font-sans text-[12px] font-semibold transition-colors cursor-pointer",
											source === value
												? "bg-primary text-page"
												: "bg-chip text-muted transition-colors hover:text-primary",
										)}
									>
										<Icon
											size={14}
											weight={source === value ? "fill" : "regular"}
										/>
										{t(labelKey)}
									</button>
								))}
							</div>

							{/* One seamless group: title, category, and the
							    broadcast toggle share a single surface with
							    hairline separators instead of three boxes. */}
							<div className="rounded-xl overflow-hidden bg-chip">
								<input
									value={title}
									onChange={(e) => setTitle(e.target.value)}
									maxLength={100}
									placeholder={t("golive.placeholder")}
									className="w-full bg-transparent border-0 outline-none px-3.5 h-12 text-[15px] font-semibold font-sans text-primary placeholder:text-subtle"
								/>

								<div className="h-px bg-hairline" />

								<button
									type="button"
									onClick={() => setPickerOpen((v) => !v)}
									className="w-full flex items-center gap-2 px-3.5 h-11 cursor-pointer text-left hover:bg-raised transition-colors"
								>
									<span className="font-sans text-[10.5px] font-semibold uppercase tracking-[0.1em] text-subtle shrink-0">
										{t("golive.category")}
									</span>
									<span className="shrink-0 text-[13px] leading-none">
										{VERTICAL_ICON[
											TAXONOMY.find((c) => c.label === category)
												?.vertical ?? ""
										] ?? ""}
									</span>
									<span className="flex-1 min-w-0 truncate font-sans text-[13px] font-semibold text-primary">
										{category}
									</span>
									<CaretDown
										size={13}
										className={clsx(
											"shrink-0 text-muted transition-transform",
											pickerOpen && "rotate-180",
										)}
									/>
								</button>

								{source !== "obs" && (
									<>
										<div className="h-px bg-hairline" />
										<button
											type="button"
											onClick={() => setNativeMode((v) => !v)}
											className="w-full flex items-center gap-3 px-3.5 py-2.5 cursor-pointer text-left hover:bg-raised transition-colors"
										>
											<span className="flex-1 min-w-0">
												<span className="block font-sans text-[13px] font-semibold text-primary">
													{t("golive.native.title")}
												</span>
												<span className="block font-sans text-[11.5px] text-subtle truncate">
													{nativeMode
														? t("golive.native.on")
														: t("golive.native.off")}
												</span>
											</span>
											<span
												className={clsx(
													"relative h-5 w-9 shrink-0 rounded-pill transition-colors",
													nativeMode ? "bg-success/80" : "bg-track",
												)}
											>
												<span
													className={clsx(
														"absolute top-0.5 h-4 w-4 rounded-pill bg-primary transition-all",
														nativeMode ? "left-[18px]" : "left-0.5",
													)}
												/>
											</span>
										</button>
									</>
								)}

								<div className="h-px bg-hairline" />
								<button
									type="button"
									onClick={() => setNotifyFollowers((v) => !v)}
									className="w-full flex items-center gap-3 px-3.5 py-2.5 cursor-pointer text-left hover:bg-raised transition-colors"
								>
									<span className="flex-1 min-w-0 font-sans text-[13px] font-semibold text-primary">
										{t("golive.notify")}
									</span>
									<span
										className={clsx(
											"relative h-5 w-9 shrink-0 rounded-pill transition-colors",
											notifyFollowers ? "bg-success/80" : "bg-track",
										)}
									>
										<span
											className={clsx(
												"absolute top-0.5 h-4 w-4 rounded-pill bg-primary transition-all",
												notifyFollowers ? "left-[18px]" : "left-0.5",
											)}
										/>
									</span>
								</button>
							</div>

							{/* Category picker sheet */}
							<div>
								{pickerOpen && (
									<div className="rounded-xl bg-chip p-2.5">
										<div className="relative mb-2">
											<MagnifyingGlass
												size={13}
												className="absolute left-3 top-1/2 -translate-y-1/2 text-subtle"
											/>
											<input
												value={search}
												onChange={(e) => setSearch(e.target.value)}
												placeholder={t("golive.categorySearch")}
												className="w-full rounded-pill bg-sunken border-0 outline-none pl-8 pr-3 h-8 text-[12px] font-sans text-primary placeholder:text-subtle"
											/>
										</div>
										<div className="max-h-52 overflow-y-auto flex flex-col gap-0.5 pr-0.5">
											{searchResults ? (
												<div className="flex flex-wrap gap-1.5 p-1">
													{searchResults.map((c) => (
														<button
															key={c.id}
															type="button"
															onClick={() => {
																setCategory(c.label);
																setPickerOpen(false);
																setSearch("");
															}}
															className={clsx(
																"flex items-center gap-1.5 px-2.5 h-7 rounded-pill text-[11.5px] font-medium font-sans cursor-pointer",
																category === c.label
																	? "bg-primary text-page"
																	: "bg-chip text-muted transition-colors hover:text-primary",
															)}
														>
															<span className="leading-none">
																{VERTICAL_ICON[c.vertical] ?? ""}
															</span>
															{c.label}
														</button>
													))}
												</div>
											) : (
												VERTICALS.map((v) => {
													const cats = byVertical.get(v.id) ?? [];
													if (cats.length === 0) return null;
													const open = openVertical === v.id;
													return (
														<div key={v.id}>
															<button
																type="button"
																onClick={() =>
																	setOpenVertical(open ? null : v.id)
																}
																className="w-full flex items-center gap-2 px-2 h-8 rounded-lg hover:bg-raised cursor-pointer transition-colors"
															>
																<span className="shrink-0 text-[13px] leading-none">
																	{VERTICAL_ICON[v.id] ?? ""}
																</span>
																<span className="flex-1 text-left font-sans text-[12px] font-semibold text-muted">
																	{v.label}
																</span>
																<span className="font-sans text-[10.5px] text-subtle tabular-nums">
																	{cats.length}
																</span>
																<CaretDown
																	size={11}
																	className={clsx(
																		"text-subtle transition-transform",
																		open && "rotate-180",
																	)}
																/>
															</button>
															{open && (
																<div className="flex flex-wrap gap-1.5 px-2 py-1.5">
																	{cats.map((c) => (
																		<button
																			key={c.id}
																			type="button"
																			onClick={() => {
																				setCategory(c.label);
																				setPickerOpen(false);
																			}}
																			className={clsx(
																				"flex items-center gap-1.5 px-2.5 h-7 rounded-pill text-[11.5px] font-medium font-sans cursor-pointer",
																				category === c.label
																					? "bg-primary text-page"
																					: "bg-chip text-muted transition-colors hover:text-primary",
																			)}
																		>
																			<span className="leading-none">
																				{VERTICAL_ICON[v.id] ?? ""}
																			</span>
																			{c.label}
																		</button>
																	))}
																</div>
															)}
														</div>
													);
												})
											)}
										</div>
									</div>
								)}
							</div>

							{/* CTA */}
							<button
								type="button"
								disabled={!canStart}
								onClick={start}
								className="w-full h-12 shine flex items-center justify-center gap-2 rounded-pill font-sans font-semibold text-[15px] text-white bg-gradient-to-b from-danger to-[#C22D2D] hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
							>
								<Broadcast size={17} weight="fill" />
								{starting
									? t("golive.starting")
									: source === "obs"
										? t("golive.startObs")
										: t("golive.start")}
							</button>

						</div>
					</>
				)}
			</OverlayPanel>
		</AnimatePresence>,
		document.body,
	);
}
