"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
	RiMicFill,
	RiMicOffFill,
	RiPhoneFill,
	RiVideoOnFill,
	RiVideoOffFill,
	RiCameraSwitchLine,
	RiFullscreenExitLine,
	RiFullscreenLine,
	RiWifiOffLine,
	RiCloseLine,
} from "@remixicon/react";
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

/** One person on the group grid: their video, or an initial with their name. */
function GridTile({
	name,
	videoTrack,
	micMuted,
	speaking,
	mirrored,
	isSelf,
}: {
	name: string;
	videoTrack: LocalVideoTrack | RemoteTrack | null;
	micMuted: boolean;
	speaking: boolean;
	mirrored?: boolean;
	isSelf?: boolean;
}) {
	return (
		<div
			className={clsx(
				"relative overflow-hidden rounded-xl glass-well",
				// The speaker glow: an inset ring, opacity-only, never a border.
				speaking && "ring-2 ring-[#EAB308]/80",
			)}
		>
			{videoTrack ? (
				<VideoTile track={videoTrack} mirrored={mirrored} />
			) : (
				<div className="flex h-full w-full items-center justify-center">
					<span className="flex h-14 w-14 items-center justify-center rounded-pill glass-chip text-[20px] font-semibold glass-ink">
						{(name || "?").slice(0, 1).toUpperCase()}
					</span>
				</div>
			)}
			<span className="absolute bottom-1.5 left-1.5 flex max-w-[calc(100%-12px)] items-center gap-1 rounded-pill glass-chip-canvas backdrop-blur-md px-2 py-0.5 text-[11px] glass-ink">
				{micMuted && <RiMicOffFill size={11} />}
				<span className="truncate">{isSelf ? "You" : name}</span>
			</span>
		</div>
	);
}

/**
 * The group stage (owner ruling 2026-09-02): everyone in one grid, video or
 * initial, gold ring on whoever is speaking, every remote mic attached to
 * its own audio element. Ten seats — 2 columns to 5x2.
 */
function GroupStage({
	micOn,
	camOn,
	facing,
	localVideo,
}: {
	micOn: boolean;
	camOn: boolean;
	facing: "user" | "environment";
	localVideo: LocalVideoTrack | null;
}) {
	const people = callManager.remoteParticipantsInfo;
	const total = people.length + 1;
	const cols = total <= 2 ? 1 : total <= 4 ? 2 : 3;
	return (
		<div className="h-full w-full p-2 pb-[84px]">
			<div
				className="grid h-full w-full gap-2"
				style={{
					gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
					gridAutoRows: "1fr",
				}}
			>
				<GridTile
					name="You"
					isSelf
					videoTrack={camOn ? localVideo : null}
					micMuted={!micOn}
					speaking={false}
					mirrored={facing === "user"}
				/>
				{people.map((p) => (
					<GridTile
						key={p.identity}
						name={p.name}
						videoTrack={p.videoTrack}
						micMuted={p.micMuted}
						speaking={p.speaking}
					/>
				))}
			</div>
		</div>
	);
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
			<RiWifiOffLine size={compact ? 12 : 14} />
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

/**
 * Dev-only harness: `?callpreview=voice|video|ring|dock|rejoin` forces the
 * surface into a state so the UI can be seen and styled without ringing a
 * real person. `ring` exercises the incoming-call toast (ringing + incoming
 * renders the compact card, not the full modal); `rejoin` shows the
 * call-interrupted pill. Compiled out of production builds by the NODE_ENV
 * guard.
 */
function usePreviewState() {
	const [preview, setPreview] = useState<string | null>(null);
	useEffect(() => {
		if (process.env.NODE_ENV === "production") return;
		const read = () =>
			setPreview(
				new URLSearchParams(window.location.search).get("callpreview"),
			);
		read();
		window.addEventListener("popstate", read);
		return () => window.removeEventListener("popstate", read);
	}, []);
	if (!preview) return null;
	const base = {
		isGroup: false,
		groupCaller: null as null | {
			id: string;
			name: string;
			avatar: string;
			username: string;
		},
		participantCount: 0,
		peer: {
			id: "preview",
			name: "Greg Osimiri",
			username: "GreggWS",
			avatar: "",
		},
		conversationId: "preview",
		error: null,
		remoteMuted: false,
		poorConnection: preview === "weak",
		minimized: preview === "dock",
		micOn: true,
		camOn: preview === "video",
		remoteVideoOn: false,
		isIncoming: preview === "ring",
		isVideo: preview === "video" || preview === "dock",
		endReason: null,
		rejoinable: null as null | {
			conversationId: string;
			isVideo: boolean;
			peer: { id: string; name: string; avatar: string; username: string };
			startedAt: number;
		},
	};
	if (preview === "ring")
		// Incoming is spelled "ringing" + isIncoming in the real state union.
		return { ...base, status: "ringing" as const, startedAt: null };
	if (preview === "groupring")
		return {
			...base,
			status: "ringing" as const,
			startedAt: null,
			isIncoming: true,
			isGroup: true,
			peer: { ...base.peer, name: "Design Guild", username: "" },
			groupCaller: {
				id: "x",
				name: "Thy Richfield",
				avatar: "",
				username: "richiee",
			},
		};
	if (preview === "group")
		return {
			...base,
			status: "connected" as const,
			startedAt: Date.now() - 154_000,
			isGroup: true,
			participantCount: 3,
			peer: { ...base.peer, name: "Design Guild", username: "" },
		};
	if (preview === "rejoin")
		return {
			...base,
			status: "idle" as const,
			startedAt: null,
			rejoinable: {
				conversationId: "preview",
				isVideo: false,
				peer: base.peer,
				startedAt: Date.now() - 90_000,
			},
		};
	if (preview === "connecting")
		return { ...base, status: "connecting" as const, startedAt: null };
	return {
		...base,
		status: "connected" as const,
		startedAt: Date.now() - 154_000,
	};
}

/**
 * Does this device have more than one camera?
 *
 * Asked once, after mount, and never during render — `enumerateDevices` is
 * async and returns nothing useful before permission is granted, which is why
 * this runs while a call is up rather than at import time. Labels stay empty
 * without permission, but the COUNT is honest, and the count is all this needs.
 */
function useHasMultipleCameras(active: boolean) {
	const [many, setMany] = useState(false);
	useEffect(() => {
		if (!active || !navigator.mediaDevices?.enumerateDevices) return;
		let cancelled = false;
		navigator.mediaDevices
			.enumerateDevices()
			.then((devices) => {
				if (cancelled) return;
				setMany(devices.filter((d) => d.kind === "videoinput").length > 1);
			})
			.catch(() => {
				// Refused or unsupported: no flip control, rather than one that
				// throws when tapped.
			});
		return () => {
			cancelled = true;
		};
	}, [active]);
	return many;
}

/**
 * How far the docked call may travel from its bottom-right home.
 *
 * The dock is `fixed bottom-4 right-4`, so dragging moves it in negative x and
 * y. Constraints are recomputed on resize and on rotate — without that, a
 * dock parked top-left in landscape ends up off screen when the phone turns
 * back, with no way to reach it.
 */
function useDockBounds(active: boolean, w: number, h: number) {
	const [bounds, setBounds] = useState({ left: 0, right: 0, top: 0, bottom: 0 });
	useEffect(() => {
		if (!active) return;
		const measure = () =>
			setBounds({
				left: -Math.max(0, window.innerWidth - w - 16),
				right: 0,
				top: -Math.max(0, window.innerHeight - h - 16),
				bottom: 0,
			});
		measure();
		window.addEventListener("resize", measure);
		window.addEventListener("orientationchange", measure);
		return () => {
			window.removeEventListener("resize", measure);
			window.removeEventListener("orientationchange", measure);
		};
	}, [active, w, h]);
	return bounds;
}

export function CallSurface() {
	const call = useCall();
	const previewState = usePreviewState();
	const {
		status,
		isIncoming,
		isVideo,
		peer,
		isGroup,
		groupCaller,
		participantCount,
		minimized,
		startedAt,
		endReason,
		micOn,
		camOn,
		facing,
		switchingCam,
		remoteMuted,
		remoteVideoOn,
		poorConnection,
		error,
		rejoinable,
	} = (previewState as unknown as typeof call) ?? call;

	const elapsed = useElapsed(startedAt);
	const open = status !== "idle";

	// Read straight off the manager: every track change is accompanied by a
	// state notify, so this re-reads on exactly the renders that matter.
	const localVideo = callManager.localVideoTrack;
	const remoteVideo = callManager.remoteVideo;
	const remoteAudio = callManager.remoteAudio;

	const showVideoStage = isVideo && (remoteVideoOn || camOn);
	const hasMultipleCameras = useHasMultipleCameras(camOn);
	// 228x196 is the dock's own box (tile + control strip).
	const dockBounds = useDockBounds(minimized, 228, 196);
	// A drag ends with a click on whatever was under the finger, which would
	// expand the call every time someone moved it. Set on drag, read and
	// cleared by the expand handler.
	const draggedRef = useRef(false);
	let line = statusLine(status, isIncoming, isVideo, endReason, elapsed);
	if (isGroup) {
		if (status === "ringing" && isIncoming)
			line = isVideo ? "Incoming group video call" : "Incoming group call";
		else if (status === "connected")
			line = `${elapsed ?? ""} · ${participantCount + 1} in call`.replace(/^ · /, "");
	}
	const pending = status === "ringing" || status === "connecting";

	// An unanswered incoming ring is a toast, not a takeover: the compact
	// card sits top-right with no scrim so the app stays usable underneath.
	// Accepting flips the status, and the full surface takes over as always.
	const incomingToast = status === "ringing" && isIncoming;

	if (!open || !peer) {
		// Nothing live — but a reload may have left a call to pick back up.
		return (
			<AnimatePresence>
				{!open && rejoinable ? <RejoinPill /> : null}
			</AnimatePresence>
		);
	}

	const avatar = peer.avatar || DEFAULT_AVATAR;

	return (
		<>
			{/* Audio lives HERE, not in the stage: minimizing a group call
			    must never silence nine people. */}
			{isGroup ? (
				callManager.remoteParticipantsInfo.map((p) =>
					p.audioTrack ? (
						<RemoteAudio key={`ga-${p.identity}`} track={p.audioTrack} />
					) : null,
				)
			) : (
				<RemoteAudio track={remoteAudio} />
			)}

			<AnimatePresence mode="wait">
				{incomingToast ? (
					<motion.div
						key="ringcard"
						initial={{ opacity: 0, y: -12 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -12 }}
						transition={{ duration: 0.26, ease: EASE }}
						className="fixed right-4 top-4 z-modal w-[340px] rounded-2xl glass-dock backdrop-blur-2xl backdrop-saturate-150 p-3"
					>
						<div className="flex items-center gap-3">
							<SafeAvatar
								src={avatar}
								width={44}
								height={44}
								className="h-11 w-11 shrink-0 rounded-pill object-cover"
							/>
							<div className="min-w-0 flex-1">
								<p className="truncate text-[13.5px] font-semibold glass-ink">
									{peer.name}
								</p>
								<p className="flex items-center gap-1.5 text-[12px] glass-ink-dim">
									<span className="truncate">
										{isGroup && groupCaller
											? `${groupCaller.name} · ${line}`
											: line}
									</span>
									<PendingDots />
								</p>
							</div>
							<div className="flex shrink-0 items-center gap-1.5">
								<ControlButton
									label="Decline call"
									onClick={call.declineCall}
									tone="danger"
									size="sm"
								>
									<RiPhoneFill size={18} />
								</ControlButton>
								<ControlButton
									label="Accept call"
									onClick={call.acceptCall}
									tone="cta"
									size="sm"
								>
									<RiPhoneFill size={18} />
								</ControlButton>
							</div>
						</div>
					</motion.div>
				) : minimized ? (
					<motion.div
						key="dock"
						initial={{ opacity: 0, y: 8, scale: 0.98 }}
						animate={{ opacity: 1, y: 0, scale: 1 }}
						exit={{ opacity: 0, y: 8, scale: 0.98 }}
						transition={{ duration: 0.26, ease: EASE }}
						drag
						dragConstraints={dockBounds}
						dragMomentum={false}
						dragElastic={0.05}
						onDragStart={() => {
							draggedRef.current = true;
						}}
						onDragEnd={() => {
							// Cleared a frame later: the synthetic click from this
							// gesture has to see the flag still set.
							setTimeout(() => {
								draggedRef.current = false;
							}, 0);
						}}
						className="group fixed bottom-4 right-4 z-modal w-[228px] cursor-grab touch-none overflow-hidden rounded-2xl glass-dock backdrop-blur-2xl backdrop-saturate-150 active:cursor-grabbing"
					>
						{/* The whole dock is the expand target — a PiP tile you tap to
						    come back. The two controls sit above it. */}
						<button
							type="button"
							onClick={() => {
								if (draggedRef.current) return;
								call.setMinimized(false);
							}}
							aria-label="Expand call"
							className="absolute inset-0 cursor-pointer"
						/>

						<div className="pointer-events-none relative">
							<div className="relative h-[128px] w-full overflow-hidden glass-well">
								{showVideoStage && remoteVideo ? (
									<VideoTile track={remoteVideo} />
								) : isGroup ? (
									<div className="flex h-full w-full flex-col items-center justify-center gap-1">
										<span className="flex h-[44px] w-[44px] items-center justify-center rounded-pill glass-chip text-[16px] font-semibold glass-ink">
											{(peer.name || "G").slice(0, 1).toUpperCase()}
										</span>
										<span className="text-[10.5px] glass-ink-dim">
											{participantCount + 1} in call
										</span>
									</div>
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
									<RiFullscreenLine size={13} />
								</span>

								{poorConnection && (
									<span className="absolute bottom-2 left-2">
										<WeakChip compact />
									</span>
								)}
								{!micOn && !poorConnection && (
									<span className="absolute bottom-2 left-2 flex h-6 items-center gap-1 rounded-pill glass-chip-canvas backdrop-blur-md px-2 text-[11px] glass-ink">
										<RiMicOffFill size={12} />
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
											<RiMicFill size={17} />
										) : (
											<RiMicOffFill size={17} />
										)}
									</ControlButton>
									<ControlButton
										label="End call"
										onClick={call.endCall}
										tone="danger"
										size="sm"
									>
										<RiPhoneFill size={17} />
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
								showVideoStage || (isGroup && status === "connected")
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
									<RiFullscreenExitLine size={18} />
								</button>
							)}

							{isGroup && status === "connected" ? (
								<div className="relative h-[min(88vh,760px)] w-full">
									<GroupStage
										micOn={micOn}
										camOn={camOn}
										facing={facing}
										localVideo={localVideo}
									/>
									{/* Identity + state over the grid, same chip. */}
									<div className="absolute left-3 top-3 z-10 flex max-w-[calc(100%-72px)] flex-wrap items-center gap-1.5">
										<span className="flex h-8 items-center gap-2 rounded-pill glass-chip-canvas backdrop-blur-md px-3 text-[12.5px] font-semibold glass-ink">
											<span className="truncate">{peer.name}</span>
											<span className="font-medium tabular-nums glass-ink-dim">
												{line}
											</span>
										</span>
										{poorConnection && <WeakChip />}
									</div>
									{error && (
										<div className="absolute inset-x-0 bottom-[86px] z-10 flex justify-center px-4">
											<span className="rounded-pill bg-danger px-3 py-1.5 text-[12.5px] font-medium text-white">
												{error}
											</span>
										</div>
									)}
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
							) : showVideoStage ? (
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
												<RiMicOffFill size={13} />
												Muted
											</span>
										)}
										{poorConnection && <WeakChip />}
									</div>

									{/* Self view, picture-in-picture. Parked above the
									    control bar so the two never collide. */}
									{camOn && localVideo && (
										<div className="absolute bottom-[86px] right-3 z-10 h-[124px] w-[93px] overflow-hidden rounded-xl glass-well">
											{/* Mirrored only for the front camera. The back
											    camera shows the world, and mirroring the
											    world is just wrong — text in shot reads
											    backwards. */}
											<VideoTile
												track={localVideo}
												mirrored={facing === "user"}
											/>
											{/* Flip lives on the self-view, because that is
											    the thing it changes. Touch only: a laptop
											    has one camera and the control would be a
											    button that does nothing. */}
											{hasMultipleCameras && (
												<button
													type="button"
													onClick={call.flipCamera}
													disabled={switchingCam}
													aria-label="Switch camera"
													className="absolute right-1.5 top-1.5 flex h-7 w-7 cursor-pointer items-center justify-center rounded-pill glass-chip-canvas backdrop-blur-md glass-ink transition-opacity disabled:opacity-50"
												>
													<RiCameraSwitchLine size={13} />
												</button>
											)}
											{!micOn && (
												<span className="absolute bottom-1.5 left-1.5 flex h-6 w-6 items-center justify-center rounded-pill glass-chip-canvas backdrop-blur-md glass-ink">
													<RiMicOffFill size={12} />
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
												<RiMicOffFill size={13} />
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
					<RiPhoneFill size={24} />
				</ControlButton>
				<ControlButton label="Accept call" onClick={call.acceptCall} tone="cta">
					<RiPhoneFill size={24} />
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
					<RiMicFill size={22} />
				) : (
					<RiMicOffFill size={22} />
				)}
			</ControlButton>
			<ControlButton
				label={camOn ? "Turn camera off" : "Turn camera on"}
				onClick={call.toggleCam}
				active={camOn}
			>
				{camOn ? (
					<RiVideoOnFill size={22} />
				) : (
					<RiVideoOffFill size={22} />
				)}
			</ControlButton>
			<ControlButton label="End call" onClick={call.endCall} tone="danger">
				<RiPhoneFill size={24} />
			</ControlButton>
		</>
	);
}

/**
 * The reload lifeline. A call was connected, the page reloaded, and the
 * manager found the interrupted-call record — this pill offers the way back
 * without ever auto-joining (rejoining unannounced with a live mic is the
 * user's decision). Sits where the minimized dock lives, since that is where
 * an ongoing call belongs on screen. Talks to the manager directly: the
 * provider's context adds nothing here, and this component already reads the
 * manager for tracks.
 */
function RejoinPill() {
	return (
		<motion.div
			key="rejoin"
			initial={{ opacity: 0, y: 8, scale: 0.98 }}
			animate={{ opacity: 1, y: 0, scale: 1 }}
			exit={{ opacity: 0, y: 8, scale: 0.98 }}
			transition={{ duration: 0.26, ease: EASE }}
			className="fixed bottom-4 right-4 z-modal flex items-center gap-2 rounded-pill glass-dock backdrop-blur-2xl backdrop-saturate-150 py-1.5 pl-4 pr-1.5"
		>
			<span className="text-[12.5px] font-medium glass-ink">
				Call interrupted
			</span>
			<button
				type="button"
				onClick={() => void callManager.rejoin()}
				className="flex h-10 cursor-pointer items-center rounded-pill glass-cta px-3.5 text-[12.5px] font-semibold transition-colors"
			>
				Rejoin
			</button>
			<button
				type="button"
				aria-label="Dismiss"
				title="Dismiss"
				onClick={() => callManager.dismissRejoin()}
				className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-pill glass-chip transition-colors glass-ink"
			>
				<RiCloseLine size={16} />
			</button>
		</motion.div>
	);
}
