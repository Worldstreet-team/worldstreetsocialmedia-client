"use client";

import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
	Broadcast,
	Microphone,
	VideoCamera,
	Warning,
	X,
} from "@phosphor-icons/react";
import clsx from "clsx";
import { XSTREAM_WEB_URL } from "@/const";
import { useT } from "@/i18n/client";
import { goLiveAction } from "@/lib/live.actions";
import { useToast } from "@/components/ui/Toast/ToastContext";

const CATEGORIES = ["markets", "crypto", "forex", "stocks", "general"];

/**
 * Go-live pre-flight, portaled to <body> so no transformed or
 * overflow-hidden ancestor can clip or reposition it. Flow: the camera
 * preview leads full-bleed, device pickers ride the preview as overlay
 * pills, title + category chips below, one shining CTA. Permission
 * problems surface here — before a stream exists — with a retry.
 */
export function GoLiveSheet({ onClose }: { onClose: () => void }) {
	const t = useT();
	const { toast } = useToast();
	const [title, setTitle] = useState("");
	const [category, setCategory] = useState(CATEGORIES[0]);
	const [cams, setCams] = useState<MediaDeviceInfo[]>([]);
	const [mics, setMics] = useState<MediaDeviceInfo[]>([]);
	const [camId, setCamId] = useState("");
	const [micId, setMicId] = useState("");
	const [denied, setDenied] = useState(false);
	const [ready, setReady] = useState(false);
	const [starting, setStarting] = useState(false);
	const videoRef = useRef<HTMLVideoElement>(null);
	const streamRef = useRef<MediaStream | null>(null);

	const stopTracks = () => {
		streamRef.current?.getTracks().forEach((track) => track.stop());
		streamRef.current = null;
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
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") close();
		};
		window.addEventListener("keydown", onKey);
		return () => {
			window.removeEventListener("keydown", onKey);
			stopTracks();
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const close = () => {
		stopTracks();
		onClose();
	};

	const start = async () => {
		if (starting || !ready) return;
		setStarting(true);
		try {
			const res = await goLiveAction(title.trim() || "Live", category);
			if (!res.success) {
				toast(res.message ?? t("promo.failed"), { type: "error" });
				return;
			}
			stopTracks();
			window.open(`${XSTREAM_WEB_URL}/studio`, "_blank", "noopener");
			toast(t("golive.opens"), { type: "success" });
			onClose();
		} finally {
			setStarting(false);
		}
	};

	if (typeof document === "undefined") return null;

	return createPortal(
		<AnimatePresence>
			<motion.div
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				exit={{ opacity: 0 }}
				transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
				className="fixed inset-0 z-modal bg-black/75 flex items-end sm:items-center justify-center"
				onClick={close}
			>
				<motion.div
					initial={{ opacity: 0, y: 12, scale: 0.98 }}
					animate={{ opacity: 1, y: 0, scale: 1 }}
					exit={{ opacity: 0, y: 12, scale: 0.98 }}
					transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
					className="w-full sm:w-[460px] card-depth overflow-hidden rounded-t-2xl sm:rounded-2xl"
					onClick={(e) => e.stopPropagation()}
				>
					{/* ── Preview leads ── */}
					<div className="relative aspect-video bg-black">
						{denied ? (
							<div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-8 text-center">
								<span className="flex h-12 w-12 items-center justify-center rounded-pill bg-danger/15 text-danger">
									<Warning size={22} weight="fill" />
								</span>
								<p className="text-sm text-muted font-sans max-w-[280px]">
									{t("golive.denied")}
								</p>
								<button
									type="button"
									onClick={() => void openPreview()}
									className="mt-1 px-4 h-9 rounded-pill bg-raised text-sm font-semibold text-primary font-sans hover:bg-chip transition-colors cursor-pointer"
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
								{/* preview chip */}
								<span className="absolute top-3 left-3 flex items-center gap-1.5 rounded-pill bg-black/60 px-2.5 h-6 text-[11px] font-bold tracking-wide text-white font-sans">
									<span className="relative flex h-1.5 w-1.5">
										<span className="absolute inline-flex h-full w-full rounded-pill bg-danger opacity-70 animate-ping" />
										<span className="relative inline-flex h-1.5 w-1.5 rounded-pill bg-danger" />
									</span>
									{t("golive.preview")}
								</span>
								{/* device pills ride the preview */}
								{(cams.length > 1 || mics.length > 1) && (
									<div className="absolute bottom-3 inset-x-3 flex gap-2">
										<label className="flex-1 flex items-center gap-1.5 rounded-pill bg-black/60 px-2.5 h-8 min-w-0">
											<VideoCamera
												size={14}
												className="text-white/80 shrink-0"
											/>
											<select
												value={camId}
												onChange={(e) => {
													setCamId(e.target.value);
													void openPreview(
														e.target.value,
														micId || undefined,
													);
												}}
												className="w-full bg-transparent text-[12px] text-white font-sans outline-none cursor-pointer [&>option]:text-black"
											>
												{cams.map((d) => (
													<option key={d.deviceId} value={d.deviceId}>
														{d.label || "Camera"}
													</option>
												))}
											</select>
										</label>
										<label className="flex-1 flex items-center gap-1.5 rounded-pill bg-black/60 px-2.5 h-8 min-w-0">
											<Microphone
												size={14}
												className="text-white/80 shrink-0"
											/>
											<select
												value={micId}
												onChange={(e) => {
													setMicId(e.target.value);
													void openPreview(
														camId || undefined,
														e.target.value,
													);
												}}
												className="w-full bg-transparent text-[12px] text-white font-sans outline-none cursor-pointer [&>option]:text-black"
											>
												{mics.map((d) => (
													<option key={d.deviceId} value={d.deviceId}>
														{d.label || "Microphone"}
													</option>
												))}
											</select>
										</label>
									</div>
								)}
							</>
						)}
						<button
							type="button"
							onClick={close}
							aria-label="Close"
							className="absolute top-3 right-3 flex h-8 w-8 items-center justify-center rounded-pill bg-black/60 text-white hover:bg-black/80 transition-colors cursor-pointer"
						>
							<X size={16} />
						</button>
					</div>

					{/* ── Details ── */}
					<div className="p-5 flex flex-col gap-4">
						<div>
							<input
								value={title}
								onChange={(e) => setTitle(e.target.value)}
								maxLength={120}
								placeholder={t("golive.placeholder")}
								className="w-full bg-transparent text-[17px] font-semibold text-primary font-sans placeholder:text-subtle placeholder:font-normal outline-none"
							/>
							<div className="mt-2 h-px bg-raised" />
						</div>

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
							disabled={denied || starting || !ready}
							onClick={start}
							className="w-full h-12 shine flex items-center justify-center gap-2 rounded-pill font-sans font-semibold text-[15px] text-white bg-gradient-to-b from-danger to-[#C22D2D] hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
						>
							<Broadcast size={17} weight="fill" />
							{starting ? t("golive.starting") : t("golive.start")}
						</button>
						<p className="text-center text-[12px] text-subtle font-sans -mt-1">
							{t("golive.opens")}
						</p>
					</div>
				</motion.div>
			</motion.div>
		</AnimatePresence>,
		document.body,
	);
}
