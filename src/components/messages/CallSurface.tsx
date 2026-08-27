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
import clsx from "clsx";
import { useEffect, useRef, useState } from "react";
import type { LocalVideoTrack, RemoteTrack } from "livekit-client";

import { useCall } from "@/providers/CallProvider";
import { callManager } from "@/lib/call-manager";
import { DEFAULT_AVATAR } from "@/const";
import { SafeAvatar } from "@/components/ui/SafeAvatar";

/**
 * The one on-screen surface for a call, in both of its states:
 *  - **maximized** — a full modal (video fills it, voice shows the avatar)
 *  - **minimized** — a picture-in-picture dock in the corner, so the call
 *    keeps running while you read the rest of the app
 *
 * Both render from the same state, so minimizing never tears down media —
 * it only changes where the tracks are painted.
 *
 * **A call is a media surface, so it is fixed-dark in both themes** — the same
 * ruling as the live page and the media editors. Chrome comes from the
 * fixed-white glass family (`glass-dock` / `glass-chip` / `glass-ink` /
 * `glass-cta`), never from theme tokens, which would invert underneath the
 * picture in light mode. No borders, no drop shadows, no gradients: depth is
 * fill contrast only. The end-call button is the one red control on the
 * surface; everything else is a glass chip, and an engaged toggle (muted mic,
 * camera off) inverts to the flat-white `glass-cta`.
 */

/** The one easing. */
const EASE = [0.2, 0, 0, 1] as const;

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

/**
 * Three breathing dots. The states people stare at — ringing, connecting —
 * need something alive next to the words, or a stalled call and a working one
 * look identical. Opacity only.
 */
function PendingDots({ className }: { className?: string }) {
	return (
		<span aria-hidden className={clsx("inline-flex items-center gap-[3px]", className)}>
			{[0, 1, 2].map((i) => (
				<motion.span
					key={i}
					className="h-[3px] w-[3px] rounded-pill bg-current"
					animate={{ opacity: [0.25, 1, 0.25] }}
					transition={{
						duration: 1.4,
						repeat: Number.POSITIVE_INFINITY,
						ease: "easeInOut",
						delay: i * 0.16,
					}}
				/>
			))}
		</span>
	);
}

/**
 * "Weak connection" — the other state people stare at. It pulses instead of
 * going amber: status ink is a theme token and this surface is fixed-dark.
 */
function WeakChip({ compact }: { compact?: boolean }) {
	return (
		<motion.span
			className={clsx(
				"flex items-center gap-1.5 rounded-pill glass-chip-canvas backdrop-blur-md glass-ink",
				compact ? "h-6 px-2 text-[11px]" : "h-7 px-2.5 text-[12px] font-medium",
			)}
			animate={{ opacity: [1, 0.55, 1] }}
			transition={{ duration: 1.8, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
		>
			<WifiSlash size={compact ? 12 : 14} weight="fill" />
			Weak connection
		</motion.span>
	);
}

/**
 * Round control button. `tone` picks the affordance, not a raw colour:
 * `danger` is the single red control on the surface, `cta` is the flat-white
 * glass CTA, `neutral` is a glass chip that inverts to the CTA fill when the
 * toggle it owns is engaged (muted, camera off) — the language phones use.
 */
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
	tone?: "neutral" | "danger" | "cta";
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
				"flex shrink-0 items-center justify-center rounded-pill transition-colors cursor-pointer",
				// Hit targets never drop below 40×40, whatever the glyph does.
				size === "lg" ? "h-14 w-14" : "h-10 w-10",
				tone === "danger" && "bg-danger text-white hover:opacity-90",
				tone === "cta" && "glass-cta",
				tone === "neutral" && (active ? "glass-chip" : "glass-cta"),
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
	const pending = status === "ringing" || status === "connecting";

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
						transition={{ duration: 0.26, ease: EASE }}
						className="group fixed bottom-4 right-4 z-modal w-[228px] overflow-hidden rounded-2xl glass-dock backdrop-blur-2xl backdrop-saturate-150"
					>
						{/* The whole dock is the expand target — a PiP tile you tap to
						    come back. The two controls sit above it. */}
						<button
							type="button"
							onClick={() => call.setMinimized(false)}
							aria-label="Expand call"
							className="absolute inset-0 cursor-pointer"
						/>

						<div className="pointer-events-none relative">
							<div className="relative h-[128px] w-full overflow-hidden glass-well">
								{showVideoStage && remoteVideo ? (
									<VideoTile track={remoteVideo} />
								) : (
									<div className="flex h-full w-full items-center justify-center">
										<SafeAvatar
											src={avatar}
											width={52}
											height={52}
											className="h-[52px] w-[52px] rounded-pill object-cover"
										/>
									</div>
								)}

								{/* Expand affordance: reads as a control, brightens with
								    the dock so the whole tile is obviously tappable. */}
								<span className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-pill glass-chip-canvas backdrop-blur-md glass-ink transition-colors group-hover:bg-white/25">
									<CornersOut size={13} weight="bold" />
								</span>

								{poorConnection && (
									<span className="absolute bottom-2 left-2">
										<WeakChip compact />
									</span>
								)}
								{!micOn && !poorConnection && (
									<span className="absolute bottom-2 left-2 flex h-6 items-center gap-1 rounded-pill glass-chip-canvas backdrop-blur-md px-2 text-[11px] glass-ink">
										<MicrophoneSlash size={12} weight="fill" />
										Muted
									</span>
								)}
							</div>

							<div className="flex items-center gap-1.5 px-2.5 py-2">
								<div className="min-w-0 flex-1">
									<p className="truncate text-[12.5px] font-semibold glass-ink">
										{peer.name}
									</p>
									<p className="flex items-center gap-1.5 text-[11px] tabular-nums glass-ink-dim">
										<span className="truncate">{line}</span>
										{pending && <PendingDots />}
									</p>
								</div>
								<div className="pointer-events-auto flex items-center gap-1">
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
							</div>
						</div>
					</motion.div>
				) : (
					<motion.div
						key="full"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.2, ease: EASE }}
						className="fixed inset-0 z-modal flex items-center justify-center glass-scrim p-3 sm:p-4"
					>
						<motion.div
							initial={{ opacity: 0, y: 8, scale: 0.98 }}
							animate={{ opacity: 1, y: 0, scale: 1 }}
							exit={{ opacity: 0, y: 8, scale: 0.98 }}
							transition={{ duration: 0.26, ease: EASE }}
							className={clsx(
								"relative flex w-full flex-col overflow-hidden rounded-2xl",
								showVideoStage
									? // The picture is the ground; nothing sits behind it.
										"h-[min(88vh,760px)] max-w-4xl glass-well"
									: "max-w-[380px] glass-dock backdrop-blur-2xl backdrop-saturate-150",
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
										"absolute right-3 top-3 z-20 flex h-10 w-10 items-center justify-center rounded-pill transition-colors cursor-pointer glass-ink",
										showVideoStage
											? "glass-chip-canvas backdrop-blur-md"
											: "glass-chip",
									)}
								>
									<CornersIn size={18} weight="bold" />
								</button>
							)}

							{showVideoStage ? (
								<div className="relative h-full w-full">
									{remoteVideo && remoteVideoOn ? (
										<VideoTile track={remoteVideo} />
									) : (
										<div className="flex h-full w-full flex-col items-center justify-center gap-4 px-6 text-center">
											<SafeAvatar
												src={avatar}
												width={104}
												height={104}
												className="h-[104px] w-[104px] rounded-pill object-cover"
											/>
											<p className="flex items-center gap-2 text-[14px] glass-ink-dim">
												{status === "connected"
													? `${peer.name}'s camera is off`
													: line}
												{pending && <PendingDots />}
											</p>
										</div>
									)}

									{/* Identity and state, top-left, over the picture. */}
									<div className="absolute left-3 top-3 z-10 flex max-w-[calc(100%-72px)] flex-wrap items-center gap-1.5">
										<span className="flex h-8 items-center gap-2 rounded-pill glass-chip-canvas backdrop-blur-md px-3 text-[12.5px] font-semibold glass-ink">
											<span className="truncate">{peer.name}</span>
											<span className="font-medium tabular-nums glass-ink-dim">
												{line}
											</span>
											{pending && <PendingDots className="glass-ink-dim" />}
										</span>
										{remoteMuted && (
											<span className="flex h-7 items-center gap-1.5 rounded-pill glass-chip-canvas backdrop-blur-md px-2.5 text-[12px] glass-ink">
												<MicrophoneSlash size={13} weight="fill" />
												Muted
											</span>
										)}
										{poorConnection && <WeakChip />}
									</div>

									{/* Self view, picture-in-picture. Parked above the
									    control bar so the two never collide. */}
									{camOn && localVideo && (
										<div className="absolute bottom-[86px] right-3 z-10 h-[124px] w-[93px] overflow-hidden rounded-xl glass-well">
											<VideoTile track={localVideo} mirrored />
											{!micOn && (
												<span className="absolute bottom-1.5 left-1.5 flex h-6 w-6 items-center justify-center rounded-pill glass-chip-canvas backdrop-blur-md glass-ink">
													<MicrophoneSlash size={12} weight="fill" />
												</span>
											)}
										</div>
									)}

									{error && (
										<div className="absolute inset-x-0 bottom-[86px] z-10 flex justify-center px-4">
											<span className="rounded-pill bg-danger px-3 py-1.5 text-[12.5px] font-medium text-white">
												{error}
											</span>
										</div>
									)}

									{/* Controls float on their own glass bar — narrow
									    enough that the picture keeps the frame. */}
									<div className="absolute inset-x-0 bottom-0 z-10 flex justify-center p-3">
										<div className="flex items-center gap-2.5 rounded-pill glass-dock backdrop-blur-xl backdrop-saturate-150 px-3 py-2">
											<Controls
												call={call}
												status={status}
												isIncoming={isIncoming}
												micOn={micOn}
												camOn={camOn}
												line={line}
											/>
										</div>
									</div>
								</div>
							) : (
								<>
									<div className="flex flex-col items-center px-6 pb-8 pt-12 text-center">
										<div className="relative">
											{status === "ringing" && (
												// A slow breathing halo, not a spinner — it says "waiting on a
												// person", not "loading". A soft fill rather than a ring: there
												// are no borders on this surface.
												<motion.span
													aria-hidden
													className="absolute -inset-2 rounded-pill bg-white/20"
													animate={{ opacity: [0.5, 0, 0.5], scale: [0.94, 1.14, 0.94] }}
													transition={{
														duration: 2,
														repeat: Number.POSITIVE_INFINITY,
														ease: "easeOut",
													}}
												/>
											)}
											<SafeAvatar
												src={avatar}
												width={112}
												height={112}
												className="relative h-28 w-28 rounded-pill object-cover"
											/>
										</div>

										<h2 className="mt-5 font-display text-xl font-semibold glass-ink">
											{peer.name}
										</h2>
										<p className="mt-1.5 flex items-center gap-2 text-sm tabular-nums glass-ink-dim">
											{line}
											{pending && <PendingDots />}
										</p>
										{peer.username && (
											<p className="mt-0.5 text-[13px] glass-ink-faint">
												@{peer.username}
											</p>
										)}

										{remoteMuted && status === "connected" && (
											<p className="mt-3 flex items-center gap-1.5 rounded-pill glass-chip px-2.5 py-1 text-[12px]">
												<MicrophoneSlash size={13} weight="fill" />
												{peer.name} is muted
											</p>
										)}
										{poorConnection && (
											<span className="mt-3">
												<WeakChip />
											</span>
										)}
										{error && (
											<p className="mt-3 rounded-pill bg-danger px-3 py-1.5 text-[12.5px] font-medium text-white">
												{error}
											</p>
										)}
									</div>

									{/* The glass bar, full width at the foot of the panel. */}
									<div className="glass-tray flex items-center justify-center gap-3 px-5 py-5">
										<Controls
											call={call}
											status={status}
											isIncoming={isIncoming}
											micOn={micOn}
											camOn={camOn}
											line={line}
										/>
									</div>
								</>
							)}
						</motion.div>
					</motion.div>
				)}
			</AnimatePresence>
		</>
	);
}

/**
 * The control set, identical on the video bar and the voice bar so the two
 * states share one muscle memory. Incoming rings swap it for decline/accept;
 * an ended call swaps it for the reason.
 */
function Controls({
	call,
	status,
	isIncoming,
	micOn,
	camOn,
	line,
}: {
	call: ReturnType<typeof useCall>;
	status: string;
	isIncoming: boolean;
	micOn: boolean;
	camOn: boolean;
	line: string;
}) {
	if (status === "ringing" && isIncoming) {
		return (
			<>
				<ControlButton
					label="Decline call"
					onClick={call.declineCall}
					tone="danger"
				>
					<PhoneDisconnect size={24} weight="fill" />
				</ControlButton>
				<ControlButton label="Accept call" onClick={call.acceptCall} tone="cta">
					<Phone size={24} weight="fill" />
				</ControlButton>
			</>
		);
	}

	if (status === "ended") {
		return <p className="px-2 text-sm glass-ink-dim">{line}</p>;
	}

	return (
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
			<ControlButton label="End call" onClick={call.endCall} tone="danger">
				<PhoneDisconnect size={24} weight="fill" />
			</ControlButton>
		</>
	);
}
