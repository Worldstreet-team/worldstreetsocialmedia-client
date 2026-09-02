"use client";

import { formatCompact } from "@/lib/utils";
import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import clsx from "clsx";
import {
	ArrowSquareOut,
	ArrowsInSimple,
	ArrowsOutSimple,
	Microphone,
	MicrophoneSlash,
	StopCircle,
	VideoCamera,
	VideoCameraSlash,
} from "@phosphor-icons/react";
import { useAtom } from "jotai";
import { useRealtime } from "@/components/providers/RealtimeProvider";
import { liveSessionAtom } from "@/store/live.atom";
import {
	endStreamAction,
	getMyActiveStreamAction,
	getViewerTokenAction,
} from "@/lib/live.actions";
import { XSTREAM_WEB_URL } from "@/const";
import { useT } from "@/i18n/client";
import { useToast } from "@/components/ui/Toast/ToastContext";
import { LiveChatPanel } from "@/components/live/LiveChatPanel";
import { useAtomValue } from "jotai";
import { userAtom } from "@/store/user.atom";
import type { Room } from "livekit-client";

/**
 * The floating broadcast dock: while a native go-live session is active,
 * socials IS the studio. A draggable glass card pins the local preview with
 * LIVE badge, elapsed clock and viewer count; expandable into a larger
 * panel with the full control row. Publishing runs here — LiveKit connects
 * on mount, camera/mic (or screen) tracks publish from this page, and End
 * tears everything down on both sides. No redirect anywhere.
 */
export function LiveDock() {
	const t = useT();
	const { toast } = useToast();
	const [session, setSession] = useAtom(liveSessionAtom);
	const me = useAtomValue(userAtom);
	const { client: ably } = useRealtime();
	const [liveRoom, setLiveRoom] = useState<Room | null>(null);
	const [expanded, setExpanded] = useState(false);
	const [micOn, setMicOn] = useState(true);
	const [camOn, setCamOn] = useState(true);
	const [viewers, setViewers] = useState(0);
	const [elapsed, setElapsed] = useState(0);
	const [connecting, setConnecting] = useState(true);
	const [publishError, setPublishError] = useState<string | null>(null);
	const [ending, setEnding] = useState(false);
	// Offset from bottom-right, nudged up in an effect (never in the initial
	// state — a `typeof window` branch there renders a different inline style
	// on server and client, which is a hydration mismatch).
	const [pos, setPos] = useState({ x: 24, y: 24 });
	const nudgedRef = useRef(false);
	useEffect(() => {
		// Below md the fixed bottom tab bar owns the last ~80px of the
		// viewport, so the dock clears it instead of sitting on top of it.
		if (nudgedRef.current) return;
		nudgedRef.current = true;
		if (window.matchMedia("(max-width: 767px)").matches) {
			setPos((p) => (p.y === 24 ? { ...p, y: 96 } : p));
		}
	}, []);
	const roomRef = useRef<Room | null>(null);
	const videoRef = useRef<HTMLVideoElement>(null);
	// Reclaim: a page reload wipes client state, but the stream stays live on
	// Xstream. If this account owns an active stream and no session exists,
	// rebuild one. The token route grants the owner publish rights, so the
	// dock reconnects, republishes, and End works again.
	const recoveringRef = useRef(false);
	useEffect(() => {
		if (session || recoveringRef.current) return;
		recoveringRef.current = true;
		(async () => {
			try {
				const mine = await getMyActiveStreamAction();
				if (!mine.success || !mine.stream) return;
				const tok = await getViewerTokenAction(mine.stream.id);
				if (!tok.success || !tok.token) return;
				setSession({
					streamId: mine.stream.id,
					roomName: mine.stream.roomName,
					token: tok.token,
					url: tok.livekitUrl,
					title: mine.stream.title,
					category: mine.stream.category,
					source: mine.stream.source,
				});
			} finally {
				recoveringRef.current = false;
			}
		})();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [session]);

	// Heartbeat: every 30s confirm the stream is still live on the server.
	// Ably is the fast path, this is the guarantee. Without it a dropped
	// realtime connection leaves a dock claiming to be live forever.
	useEffect(() => {
		if (!session) return;
		const beat = setInterval(async () => {
			const mine = await getMyActiveStreamAction();
			if (!mine.success) return; // network blip, keep the dock
			if (!mine.stream || mine.stream.id !== session.streamId) {
				roomRef.current?.disconnect();
				setSession(null);
			}
		}, 30_000);
		return () => clearInterval(beat);
	}, [session, setSession]);

	// Ending in one tab must end it everywhere. The gateway publishes to the
	// Ably "live" channel, so any other window holding this session drops it
	// instead of showing a dock that can never be ended.
	useEffect(() => {
		if (!ably || !session) return;
		const channel = ably.channels.get("live");
		const onEnded = (msg: { data?: { streamId?: string } }) => {
			if (msg?.data?.streamId === session.streamId) {
				roomRef.current?.disconnect();
				setSession(null);
			}
		};
		void channel.subscribe("ended", onEnded);
		return () => channel.unsubscribe("ended", onEnded);
	}, [ably, session, setSession]);

	const dragRef = useRef<{
		startX: number;
		startY: number;
		baseX: number;
		baseY: number;
	} | null>(null);

	// ── LiveKit connect + publish, once per session ───────────────────────
	useEffect(() => {
		if (!session) return;
		let cancelled = false;
		let room: Room | null = null;

		(async () => {
			try {
			const { Room: LKRoom, RoomEvent, Track } = await import(
				"livekit-client"
			);
			room = new LKRoom({ adaptiveStream: true, dynacast: true });
			roomRef.current = room;

			const syncViewers = () => {
				// Everyone in the room minus the broadcaster.
				setViewers(room ? room.remoteParticipants.size : 0);
			};
			room.on(RoomEvent.ParticipantConnected, syncViewers);
			room.on(RoomEvent.ParticipantDisconnected, syncViewers);
			// A publisher whose peer connection dies keeps the dock looking
			// live while the server reconciles the stream to ended and viewers
			// stare at "waiting for the broadcaster". Say it out loud instead.
			room.on(RoomEvent.Disconnected, () => {
				if (!cancelled) setPublishError(t("dock.disconnected"));
			});
			room.on(RoomEvent.Reconnecting, () => {
				if (!cancelled) setPublishError(t("dock.reconnecting"));
			});
			room.on(RoomEvent.Reconnected, () => {
				if (!cancelled) setPublishError(null);
			});
			room.on(RoomEvent.LocalTrackPublished, (pub) => {
				if (
					pub.source === Track.Source.Camera ||
					pub.source === Track.Source.ScreenShare
				) {
					const el = videoRef.current;
					if (el && pub.track) pub.track.attach(el);
				}
			});

			// Relay-only ICE: direct UDP to LiveKit dies on some networks and
			// took the publisher down mid-stream; TURN over TLS 443 holds.
			await room.connect(session.url, session.token, { rtcConfig: { iceTransportPolicy: "relay" } });
			if (cancelled) return;

			// Publish, then CONFIRM. A silent publish failure used to leave the
			// dock looking live while the server, seeing no broadcaster in the
			// room, reconciled the stream to ended — viewers just saw a black
			// player. Verify a video track actually went out.
			if (session.source === "screen") {
				await room.localParticipant.setScreenShareEnabled(true);
			} else {
				await room.localParticipant.setCameraEnabled(true);
			}
			await room.localParticipant.setMicrophoneEnabled(true);

			const published = room.localParticipant.videoTrackPublications.size;
			if (published === 0) {
				throw new Error("No video track was published");
			}

			syncViewers();
			setConnecting(false);
			setPublishError(null);
			setLiveRoom(room);
			} catch (err) {
				// Surface it: the import, the connect and the publish can all
				// fail, and every one of them used to fail invisibly.
				console.error("[LiveDock] broadcast failed:", err);
				if (!cancelled) {
					setPublishError(
						err instanceof Error ? err.message : "Broadcast failed",
					);
					setConnecting(false);
					toast(t("dock.connectFailed"), { type: "error" });
				}
			}
		})();

		const clock = setInterval(() => setElapsed((v) => v + 1), 1000);
		return () => {
			cancelled = true;
			clearInterval(clock);
			room?.disconnect();
			roomRef.current = null;
			setLiveRoom(null);
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [session?.streamId]);

	// ── drag (from the header handle) ─────────────────────────────────────
	const onDragStart = (e: React.PointerEvent) => {
		dragRef.current = {
			startX: e.clientX,
			startY: e.clientY,
			baseX: pos.x,
			baseY: pos.y,
		};
		(e.target as HTMLElement).setPointerCapture(e.pointerId);
	};
	const onDragMove = (e: React.PointerEvent) => {
		const d = dragRef.current;
		if (!d) return;
		// Anchored bottom-right: dragging left/up increases the offsets. The x
		// clamp keys off the dock's own 264px width so a phone still gets the
		// full track (the old innerWidth-200 left ~175px of travel at 375px).
		setPos({
			x: Math.max(
				8,
				Math.min(
					Math.max(8, window.innerWidth - 272),
					d.baseX + (d.startX - e.clientX),
				),
			),
			y: Math.max(
				8,
				Math.min(window.innerHeight - 120, d.baseY + (d.startY - e.clientY)),
			),
		});
	};
	const onDragEnd = () => {
		dragRef.current = null;
	};

	const toggleMic = async () => {
		const room = roomRef.current;
		if (!room) return;
		const next = !micOn;
		await room.localParticipant.setMicrophoneEnabled(next);
		setMicOn(next);
	};
	const toggleCam = async () => {
		const room = roomRef.current;
		if (!room || session?.source !== "camera") return;
		const next = !camOn;
		await room.localParticipant.setCameraEnabled(next);
		setCamOn(next);
	};

	const endStream = async () => {
		if (!session || ending) return;
		setEnding(true);
		try {
			// The end call is the cross-platform handshake: Xstream flips the
			// stream off and relays "ended" to the gateway. If it fails the
			// stream stays live over there, so failure keeps the dock open
			// with a retry instead of pretending it worked.
			let res = await endStreamAction(session.streamId);
			if (!res.success) res = await endStreamAction(session.streamId);
			if (!res.success) {
				setPublishError(t("dock.endFailed"));
				toast(res.message ?? t("dock.endFailed"), { type: "error" });
				return;
			}
			roomRef.current?.disconnect();
			setSession(null);
			setExpanded(false);
			setElapsed(0);
			setMicOn(true);
			setCamOn(true);
			setConnecting(true);
			toast(t("dock.ended"), { type: "success" });
		} finally {
			setEnding(false);
		}
	};

	if (!session || typeof document === "undefined") return null;

	const mins = Math.floor(elapsed / 60);
	const clockLabel = `${String(mins).padStart(2, "0")}:${String(elapsed % 60).padStart(2, "0")}`;

	return createPortal(
		<AnimatePresence>
			<motion.div
				initial={{ opacity: 0, y: 16, scale: 0.96 }}
				animate={{ opacity: 1, y: 0, scale: 1 }}
				exit={{ opacity: 0, y: 16, scale: 0.96 }}
				transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
				className={clsx(
					"fixed z-toast glass-panel backdrop-blur-2xl backdrop-saturate-150 overflow-hidden select-none",
					expanded ? "w-[720px] max-w-[94vw]" : "w-[264px]",
				)}
				style={{ right: pos.x, bottom: pos.y }}
			>
				{/* drag handle header */}
				<div
					onPointerDown={onDragStart}
					onPointerMove={onDragMove}
					onPointerUp={onDragEnd}
					className="flex items-center gap-2 px-3 h-9 cursor-grab active:cursor-grabbing touch-none bg-black/45 backdrop-blur-xl backdrop-saturate-150"
				>
					<span className="flex items-center gap-1.5 rounded-pill bg-danger px-2 h-5 text-[10px] font-bold tracking-wide text-white font-sans">
						<span className="relative flex h-1.5 w-1.5">
							<span className="absolute inline-flex h-full w-full rounded-pill bg-white opacity-70 animate-ping" />
							<span className="relative inline-flex h-1.5 w-1.5 rounded-pill bg-white" />
						</span>
						LIVE
					</span>
					<span className="glass-ink-dim font-sans text-[11.5px] tabular-nums">
						{clockLabel}
					</span>
					<span className="glass-ink-dim font-sans text-[11.5px] tabular-nums">
						· {formatCompact(viewers)} {t("dock.watching")}
					</span>
					<button
						type="button"
						onClick={() => setExpanded((v) => !v)}
						aria-label={expanded ? t("dock.collapse") : t("dock.expand")}
						className="ml-auto flex h-7 w-7 items-center justify-center rounded-pill glass-chip cursor-pointer"
					>
						{expanded ? (
							<ArrowsInSimple size={13} weight="bold" />
						) : (
							<ArrowsOutSimple size={13} weight="bold" />
						)}
					</button>
				</div>

				<div
					className={clsx(
						expanded &&
							"grid grid-cols-1 sm:grid-cols-[1fr_280px] sm:grid-rows-[auto_1fr]",
					)}
				>
				<div className="min-w-0">
				{/* preview */}
				<div className="relative bg-black aspect-video">
					{/* eslint-disable-next-line jsx-a11y/media-has-caption */}
					<video
						ref={videoRef}
						autoPlay
						playsInline
						muted
						className={clsx(
							"absolute inset-0 w-full h-full object-cover",
							session.source === "camera" && "[transform:scaleX(-1)]",
						)}
					/>
					{connecting && !publishError && (
						<div className="absolute inset-0 flex items-center justify-center gap-2 glass-ink-dim font-sans text-[12px]">
							<span className="h-3 w-3 rounded-pill border-2 border-white/25 border-t-white/80 animate-spin" />
							{t("dock.connecting")}
						</div>
					)}
					{publishError && (
						<div className="absolute inset-0 flex flex-col items-center justify-center gap-1 px-4 text-center">
							<span className="font-sans text-[12px] font-semibold text-danger">
								{t("dock.connectFailed")}
							</span>
							<span className="font-sans text-[10.5px] glass-ink-faint">
								{publishError}
							</span>
						</div>
					)}
					{!camOn && session.source === "camera" && !connecting && (
						<div className="absolute inset-0 flex items-center justify-center glass-ink-dim">
							<VideoCameraSlash size={22} />
						</div>
					)}
				</div>

				{/* expanded details */}
				{expanded && (
					<div className="px-3.5 pt-3 pb-1">
						<p className="glass-ink font-sans text-[13.5px] font-semibold truncate">
							{session.title}
						</p>
						<p className="glass-ink-faint font-sans text-[11.5px] truncate">
							{session.category}
						</p>
					</div>
				)}

				{/* controls */}
				<div className="flex items-center gap-1.5 p-2.5 bg-black/55 backdrop-blur-xl backdrop-saturate-150">
					<button
						type="button"
						onClick={toggleMic}
						aria-label={t("dock.mic")}
						className={clsx(
							"flex h-9 w-9 items-center justify-center rounded-pill cursor-pointer transition-colors",
							micOn
								? "bg-white/[0.09] hover:bg-white/[0.18] glass-ink"
								: "bg-danger text-white",
						)}
					>
						{micOn ? (
							<Microphone size={15} />
						) : (
							<MicrophoneSlash size={15} weight="fill" />
						)}
					</button>
					{session.source === "camera" && (
						<button
							type="button"
							onClick={toggleCam}
							aria-label={t("dock.cam")}
							className={clsx(
								"flex h-9 w-9 items-center justify-center rounded-pill cursor-pointer transition-colors",
								camOn
									? "bg-white/[0.09] hover:bg-white/[0.18] glass-ink"
									: "bg-danger text-white",
							)}
						>
							{camOn ? (
								<VideoCamera size={15} />
							) : (
								<VideoCameraSlash size={15} weight="fill" />
							)}
						</button>
					)}
					<a
						href={`/live?tab=live&s=${session.streamId}`}
						target="_blank"
						rel="noopener noreferrer"
						aria-label={t("golive.obs.open")}
						className="flex h-9 w-9 items-center justify-center rounded-pill bg-white/[0.09] hover:bg-white/[0.18] glass-ink transition-colors"
					>
						<ArrowSquareOut size={15} />
					</a>
					<button
						type="button"
						onClick={endStream}
						disabled={ending}
						className="ml-auto flex items-center gap-1.5 h-9 px-4 rounded-pill bg-danger text-white font-sans text-[12.5px] font-semibold hover:brightness-110 transition-[filter] cursor-pointer disabled:opacity-50 shadow-[0_4px_14px_-4px_rgb(239_68_68/0.8)]"
					>
						<StopCircle size={15} weight="fill" />
						{ending ? t("golive.starting") : t("dock.end")}
					</button>
				</div>
				</div>

				{expanded && (
					<LiveChatPanel
						streamId={session.streamId}
						room={liveRoom}
						glass
						me={
							me?.username
								? { username: me.username, avatar: me.avatar ?? "" }
								: null
						}
						className="hidden sm:flex glass-well rounded-[13px] overflow-hidden max-h-[430px]"
					/>
				)}
				</div>
			</motion.div>
		</AnimatePresence>,
		document.body,
	);
}
