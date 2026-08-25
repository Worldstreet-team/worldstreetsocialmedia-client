"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Radio, X } from "lucide-react";
import { XSTREAM_WEB_URL } from "@/const";
import { useT } from "@/i18n/client";
import { goLiveAction } from "@/lib/live.actions";
import { useToast } from "@/components/ui/Toast/ToastContext";

const CATEGORIES = ["markets", "crypto", "forex", "stocks", "general"];

/**
 * Pre-flight before going live: title, category, and a real camera/mic
 * preview with device pickers — permission problems surface here, not after
 * the stream exists. Starting creates the stream on Xstream (same Clerk
 * session), opens the studio in a new tab, and the relay publishes the feed
 * post on its own.
 */
export function GoLiveSheet({ onClose }: { onClose: () => void }) {
	const t = useT();
	const { toast } = useToast();
	const [title, setTitle] = useState("");
	const [category, setCategory] = useState(CATEGORIES[0]);
	const [cams, setCams] = useState<MediaDeviceInfo[]>([]);
	const [mics, setMics] = useState<MediaDeviceInfo[]>([]);
	const [camId, setCamId] = useState<string>("");
	const [micId, setMicId] = useState<string>("");
	const [denied, setDenied] = useState(false);
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
		} catch {
			setDenied(true);
		}
	};

	useEffect(() => {
		void openPreview();
		return stopTracks;
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const start = async () => {
		if (starting) return;
		setStarting(true);
		try {
			const res = await goLiveAction(title.trim() || "Live", category);
			if (!res.success) {
				toast(res.message ?? "Could not start the stream", { type: "error" });
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

	return (
		<AnimatePresence>
			<motion.div
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				exit={{ opacity: 0 }}
				transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
				className="fixed inset-0 z-modal bg-scrim flex items-end sm:items-center justify-center"
				onClick={() => {
					stopTracks();
					onClose();
				}}
			>
				<motion.div
					initial={{ opacity: 0, y: 8, scale: 0.98 }}
					animate={{ opacity: 1, y: 0, scale: 1 }}
					exit={{ opacity: 0, y: 8, scale: 0.98 }}
					transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
					className="w-full sm:w-[440px] bg-surface border border-hairline rounded-t-xl sm:rounded-xl shadow-nav p-5"
					onClick={(e) => e.stopPropagation()}
				>
					<div className="flex items-center justify-between mb-4">
						<h2 className="flex items-center gap-2 font-display font-semibold text-lg text-primary">
							<Radio className="w-5 h-5 text-danger" />
							{t("golive.title")}
						</h2>
						<button
							type="button"
							onClick={() => {
								stopTracks();
								onClose();
							}}
							aria-label="Close"
							className="flex h-10 w-10 items-center justify-center rounded-pill text-muted hover:text-primary hover:bg-raised transition-colors cursor-pointer"
						>
							<X className="w-5 h-5" />
						</button>
					</div>

					{/* preview */}
					<div className="relative aspect-video rounded-lg overflow-hidden bg-sunken border border-hairline mb-4">
						{denied ? (
							<div className="absolute inset-0 flex items-center justify-center p-6">
								<p className="text-center text-sm text-muted font-sans">
									{t("golive.denied")}
								</p>
							</div>
						) : (
							// eslint-disable-next-line jsx-a11y/media-has-caption
							<video
								ref={videoRef}
								autoPlay
								playsInline
								muted
								className="absolute inset-0 w-full h-full object-cover [transform:scaleX(-1)]"
							/>
						)}
					</div>

					{/* device pickers */}
					{!denied && (cams.length > 1 || mics.length > 1) && (
						<div className="grid grid-cols-2 gap-2 mb-4">
							<select
								value={camId}
								onChange={(e) => {
									setCamId(e.target.value);
									void openPreview(e.target.value, micId || undefined);
								}}
								className="rounded-lg bg-sunken border border-hairline px-2.5 py-2 text-[13px] text-primary font-sans"
							>
								{cams.map((d) => (
									<option key={d.deviceId} value={d.deviceId}>
										{d.label || "Camera"}
									</option>
								))}
							</select>
							<select
								value={micId}
								onChange={(e) => {
									setMicId(e.target.value);
									void openPreview(camId || undefined, e.target.value);
								}}
								className="rounded-lg bg-sunken border border-hairline px-2.5 py-2 text-[13px] text-primary font-sans"
							>
								{mics.map((d) => (
									<option key={d.deviceId} value={d.deviceId}>
										{d.label || "Microphone"}
									</option>
								))}
							</select>
						</div>
					)}

					<label className="block mb-3">
						<span className="block text-[11px] font-semibold uppercase tracking-wider text-subtle font-sans mb-1">
							{t("golive.streamTitle")}
						</span>
						<input
							value={title}
							onChange={(e) => setTitle(e.target.value)}
							maxLength={120}
							placeholder={t("golive.placeholder")}
							className="w-full rounded-lg bg-sunken border border-hairline px-3 py-2.5 text-[15px] text-primary font-sans placeholder:text-subtle focus:outline-none focus:border-brand/60"
						/>
					</label>

					<label className="block mb-5">
						<span className="block text-[11px] font-semibold uppercase tracking-wider text-subtle font-sans mb-1">
							{t("golive.category")}
						</span>
						<select
							value={category}
							onChange={(e) => setCategory(e.target.value)}
							className="w-full rounded-lg bg-sunken border border-hairline px-3 py-2.5 text-[15px] text-primary font-sans"
						>
							{CATEGORIES.map((c) => (
								<option key={c} value={c}>
									{c}
								</option>
							))}
						</select>
					</label>

					<button
						type="button"
						disabled={denied || starting}
						onClick={start}
						className="w-full rounded-pill bg-danger text-white font-semibold text-[15px] font-sans py-3 transition-colors hover:bg-danger/90 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
					>
						{starting ? t("golive.starting") : t("golive.start")}
					</button>
				</motion.div>
			</motion.div>
		</AnimatePresence>
	);
}
