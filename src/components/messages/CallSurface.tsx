"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
	Microphone,
	MicrophoneSlash,
	Phone,
	PhoneDisconnect,
	VideoCamera,
	VideoCameraSlash,
	CornersIn,
	CornersOut,
	WifiSlash,
} from "@phosphor-icons/react";
import Image from "next/image";
import clsx from "clsx";
import { useEffect, useRef, useState } from "react";
import type { LocalVideoTrack, RemoteTrack } from "livekit-client";

import { useCall } from "@/providers/CallProvider";
import { callManager } from "@/lib/call-manager";
import { DEFAULT_AVATAR } from "@/const";

/**
 * The one on-screen surface for a call, in both of its states:
 *  - **maximized** — a full modal (video fills it, voice shows the avatar)
 *  - **minimized** — a dock in the corner, so the call keeps running while
 *    you read the rest of the app
 *
 * Both render from the same state, so minimizing never tears down media —
 * it only changes where the tracks are painted.
 */

/** Attach a LiveKit track to a media element for as long as it is mounted. */
function useAttach(
	ref: React.RefObject<HTMLMediaElement | null>,
	track: LocalVideoTrack | RemoteTrack | null,
) {
	useEffect(() => {
		const el = ref.current;
		if (!el || !track) return;
		track.attach(el as HTMLMediaElement);
		return () => {
			track.detach(el as HTMLMediaElement);
		};
	}, [ref, track]);
}

function VideoTile({
	track,
	mirrored,
	className,
}: {
	track: LocalVideoTrack | RemoteTrack | null;
	mirrored?: boolean;
	className?: string;
}) {
	const ref = useRef<HTMLVideoElement>(null);
	useAttach(ref, track);
	return (
		<video
			ref={ref}
			autoPlay
			playsInline
			// Local preview must stay muted or the caller hears themselves.
			muted={mirrored}
			className={clsx(
				"h-full w-full object-cover",
				// Selfie view: people expect their own image to behave like a
				// mirror. The remote feed is never flipped.
				mirrored && "-scale-x-100",
				className,
			)}
		/>
	);
}

/** Remote audio has to live in the DOM or the call has no sound. */
function RemoteAudio({ track }: { track: RemoteTrack | null }) {
	const ref = useRef<HTMLAudioElement>(null);
	useAttach(ref, track);
	return <audio ref={ref} autoPlay className="hidden" />;
}

function useElapsed(startedAt: number | null) {
	const [now, setNow] = useState(() => Date.now());
	useEffect(() => {
		if (!startedAt) return;
		const id = setInterval(() => setNow(Date.now()), 1000);
		return () => clearInterval(id);
	}, [startedAt]);
	if (!startedAt) return null;
	const total = Math.max(0, Math.floor((now - startedAt) / 1000));
	const m = Math.floor(total / 60);
	const s = total % 60;
	return `${m}:${s.toString().padStart(2, "0")}`;
}

const END_COPY: Record<string, string> = {
	declined: "Call declined",
	ended: "Call ended",
	cancelled: "Call cancelled",
	unanswered: "No answer",
	busy: "They're on another call",
	failed: "Call failed",
};

function statusLine(
	status: string,
	isIncoming: boolean,
	isVideo: boolean,
	endReason: string | null,
	elapsed: string | null,
) {
	if (status === "ended") return END_COPY[endReason ?? "ended"] ?? "Call ended";
	if (status === "connected") return elapsed ?? "Connected";
	if (status === "connecting") return "Connecting…";
	if (isIncoming) return isVideo ? "Incoming video call" : "Incoming voice call";
	return "Calling…";
}

/** Round control button. `tone` picks the affordance, not a raw colour. */
function ControlButton({
	label,
	onClick,
	tone = "neutral",
	active = true,
	size = "lg",
	children,
}: {
	label: string;
	onClick: () => void;
	tone?: "neutral" | "danger" | "success";
	active?: boolean;
	size?: "sm" | "lg";
	children: React.ReactNode;
}) {
	return (
		<button
			type="button"
			aria-label={label}
			title={label}
			onClick={onClick}
			className={clsx(
				"flex items-center justify-center rounded-pill transition-colors cursor-pointer",
				size === "lg" ? "h-14 w-14" : "h-10 w-10",
				tone === "danger" && "bg-danger text-primary hover:opacity-90",
				tone === "success" && "bg-success text-page hover:opacity-90",
				tone === "neutral" &&
					(active
						? "bg-raised text-primary hover:bg-hairline"
						: // "Off" reads as a filled, inverted chip — the same
							// language mute buttons use on phones.
							"bg-primary text-page hover:opacity-90"),
			)}
		>
			{children}
		</button>
	);
}

export function CallSurface() {
	const call = useCall();
	const {
		status,
		isIncoming,
		isVideo,
		peer,
		minimized,
		startedAt,
		endReason,
		micOn,
		camOn,
		remoteMuted,
		remoteVideoOn,
		poorConnection,
		error,
	} = call;

	const elapsed = useElapsed(startedAt);
	const open = status !== "idle";

	// Read straight off the manager: every track change is accompanied by a
	// state notify, so this re-reads on exactly the renders that matter.
	const localVideo = callManager.localVideoTrack;
	const remoteVideo = callManager.remoteVideo;
	const remoteAudio = callManager.remoteAudio;

	const showVideoStage = isVideo && (remoteVideoOn || camOn);
	const line = statusLine(status, isIncoming, isVideo, endReason, elapsed);

	if (!open || !peer) return null;

	const avatar = peer.avatar || DEFAULT_AVATAR;

	return (
		<>
			<RemoteAudio track={remoteAudio} />

			<AnimatePresence mode="wait">
				{minimized ? (
					<motion.div
						key="dock"
						initial={{ opacity: 0, y: 8, scale: 0.98 }}
						animate={{ opacity: 1, y: 0, scale: 1 }}
						exit={{ opacity: 0, y: 8, scale: 0.98 }}
						transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
						className="fixed bottom-4 right-4 z-modal w-[268px] overflow-hidden rounded-xl border border-hairline bg-surface shadow-nav"
					>
						<button
							type="button"
							onClick={() => call.setMinimized(false)}
							aria-label="Expand call"
							className="block w-full cursor-pointer text-left"
						>
							<div className="relative h-[124px] w-full bg-sunken">
								{showVideoStage && remoteVideo ? (
									<VideoTile track={remoteVideo} />
								) : (
									<div className="flex h-full w-full items-center justify-center">
										<Image
											src={avatar}
											alt=""
											width={48}
											height={48}
											className="h-12 w-12 rounded-pill object-cover"
										/>
									</div>
								)}
								<span className="absolute right-2 top-2 rounded-pill bg-scrim px-2 py-0.5 text-[11px] text-primary">
									<CornersOut size={12} weight="bold" className="inline" />
								</span>
							</div>
						</button>

						<div className="flex items-center gap-2 px-3 py-2.5">
							<div className="min-w-0 flex-1">
								<p className="truncate text-[13px] font-medium text-primary">
									{peer.name}
								</p>
								<p className="text-[11px] tabular-nums text-muted">{line}</p>
							</div>
							<ControlButton
								label={micOn ? "Mute microphone" : "Unmute microphone"}
								onClick={call.toggleMic}
								active={micOn}
								size="sm"
							>
								{micOn ? (
									<Microphone size={17} weight="fill" />
								) : (
									<MicrophoneSlash size={17} weight="fill" />
								)}
							</ControlButton>
							<ControlButton
								label="End call"
								onClick={call.endCall}
								tone="danger"
								size="sm"
							>
								<PhoneDisconnect size={17} weight="fill" />
							</ControlButton>
						</div>
					</motion.div>
				) : (
					<motion.div
						key="full"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
						className="fixed inset-0 z-modal flex items-center justify-center bg-scrim p-4"
					>
						<motion.div
							initial={{ opacity: 0, y: 8, scale: 0.98 }}
							animate={{ opacity: 1, y: 0, scale: 1 }}
							exit={{ opacity: 0, y: 8, scale: 0.98 }}
							transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
							className={clsx(
								"relative flex w-full flex-col overflow-hidden rounded-xl border border-hairline bg-surface shadow-nav",
								showVideoStage
									? "h-[min(86vh,720px)] max-w-4xl"
									: "max-w-sm px-6 py-8",
							)}
						>
							{/* Minimize is available the moment there is a call to
							    keep running in the background. */}
							{status !== "ended" && (
								<button
									type="button"
									onClick={() => call.setMinimized(true)}
									aria-label="Minimize call"
									className={clsx(
										"absolute right-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-pill transition-colors cursor-pointer",
										showVideoStage
											? "bg-scrim text-primary hover:bg-raised"
											: "text-muted hover:bg-raised hover:text-primary",
									)}
								>
									<CornersIn size={18} weight="bold" />
								</button>
							)}

							{showVideoStage ? (
								<div className="relative flex-1 bg-sunken">
									{remoteVideo && remoteVideoOn ? (
										<VideoTile track={remoteVideo} />
									) : (
										<div className="flex h-full w-full flex-col items-center justify-center gap-3">
											<Image
												src={avatar}
												alt=""
												width={96}
												height={96}
												className="h-24 w-24 rounded-pill object-cover"
											/>
											<p className="text-sm text-muted">
												{peer.name}'s camera is off
											</p>
										</div>
									)}

									{/* Self view, picture-in-picture. */}
									{camOn && localVideo && (
										<div className="absolute bottom-4 right-4 h-[132px] w-[99px] overflow-hidden rounded-lg border border-hairline bg-sunken shadow-nav">
											<VideoTile track={localVideo} mirrored />
										</div>
									)}

									<div className="absolute left-4 top-4 flex items-center gap-2">
										<span className="rounded-pill bg-scrim px-2.5 py-1 text-[13px] font-medium text-primary">
											{peer.name}
										</span>
										{remoteMuted && (
											<span className="flex items-center gap-1 rounded-pill bg-scrim px-2.5 py-1 text-[11px] text-muted">
												<MicrophoneSlash size={13} weight="fill" />
												Muted
											</span>
										)}
										{poorConnection && (
											<span className="flex items-center gap-1 rounded-pill bg-scrim px-2.5 py-1 text-[11px] text-warning">
												<WifiSlash size={13} weight="fill" />
												Weak connection
											</span>
										)}
									</div>

									<span className="absolute bottom-4 left-4 rounded-pill bg-scrim px-2.5 py-1 text-[13px] tabular-nums text-primary">
										{line}
									</span>
								</div>
							) : (
								<div className="flex flex-col items-center text-center">
									<div className="relative">
										<Image
											src={avatar}
											alt=""
											width={112}
											height={112}
											className="h-28 w-28 rounded-pill object-cover"
										/>
										{status === "ringing" && (
											// A slow breathing ring, not a spinner — it says
											// "waiting on a person", not "loading".
											<motion.span
												aria-hidden
												className="absolute inset-0 rounded-pill border-2 border-brand"
												animate={{ opacity: [0.7, 0, 0.7], scale: [1, 1.18, 1] }}
												transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
											/>
										)}
									</div>

									<h2 className="mt-5 font-display text-xl font-semibold text-primary">
										{peer.name}
									</h2>
									<p className="mt-1 text-sm tabular-nums text-muted">{line}</p>
									{peer.username && (
										<p className="mt-0.5 text-[13px] text-subtle">
											@{peer.username}
										</p>
									)}

									{remoteMuted && status === "connected" && (
										<p className="mt-2 flex items-center gap-1 text-[13px] text-muted">
											<MicrophoneSlash size={14} weight="fill" />
											{peer.name} is muted
										</p>
									)}
									{poorConnection && (
										<p className="mt-2 flex items-center gap-1 text-[13px] text-warning">
											<WifiSlash size={14} weight="fill" />
											Weak connection
										</p>
									)}
									{error && (
										<p className="mt-2 text-[13px] text-danger">{error}</p>
									)}
								</div>
							)}

							{/* Controls */}
							<div
								className={clsx(
									"flex items-center justify-center gap-3",
									showVideoStage
										? "border-t border-hairline bg-surface px-4 py-4"
										: "mt-8",
								)}
							>
								{status === "ringing" && isIncoming ? (
									<>
										<ControlButton
											label="Decline call"
											onClick={call.declineCall}
											tone="danger"
										>
											<PhoneDisconnect size={24} weight="fill" />
										</ControlButton>
										<ControlButton
											label="Accept call"
											onClick={call.acceptCall}
											tone="success"
										>
											<Phone size={24} weight="fill" />
										</ControlButton>
									</>
								) : status === "ended" ? (
									<p className="text-sm text-muted">{line}</p>
								) : (
									<>
										<ControlButton
											label={micOn ? "Mute microphone" : "Unmute microphone"}
											onClick={call.toggleMic}
											active={micOn}
										>
											{micOn ? (
												<Microphone size={22} weight="fill" />
											) : (
												<MicrophoneSlash size={22} weight="fill" />
											)}
										</ControlButton>
										<ControlButton
											label={camOn ? "Turn camera off" : "Turn camera on"}
											onClick={call.toggleCam}
											active={camOn}
										>
											{camOn ? (
												<VideoCamera size={22} weight="fill" />
											) : (
												<VideoCameraSlash size={22} weight="fill" />
											)}
										</ControlButton>
										<ControlButton
											label="End call"
											onClick={call.endCall}
											tone="danger"
										>
											<PhoneDisconnect size={24} weight="fill" />
										</ControlButton>
									</>
								)}
							</div>
						</motion.div>
					</motion.div>
				)}
			</AnimatePresence>
		</>
	);
}
