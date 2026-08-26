"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import type { Room } from "livekit-client";
import { getViewerTokenAction } from "@/lib/live.actions";
import { useT } from "@/i18n/client";

/**
 * Inline live playback for a vertical-feed slide. Connects to the stream's
 * LiveKit room only while the slide is active, plays video and audio in
 * place, and hands the connected room up so the chat drawer can share it.
 * Ends in place: the slide flips to an ended state and the user keeps
 * scrolling.
 */
export function LiveSlidePlayer({
	streamId,
	active,
	muted,
	onRoom,
	onViewers,
}: {
	streamId: string;
	active: boolean;
	muted: boolean;
	onRoom?: (room: Room | null) => void;
	onViewers?: (n: number) => void;
}) {
	const t = useT();
	const [state, setState] = useState<
		"idle" | "connecting" | "playing" | "waiting" | "ended"
	>("idle");
	const videoRef = useRef<HTMLVideoElement>(null);
	const audioElsRef = useRef<HTMLElement[]>([]);
	const roomRef = useRef<Room | null>(null);

	useEffect(() => {
		if (!active) return;
		let cancelled = false;
		let room: Room | null = null;
		setState("connecting");

		(async () => {
			const tok = await getViewerTokenAction(streamId);
			if (cancelled) return;
			if (!tok.success || !tok.token) {
				setState("ended");
				return;
			}
			const { Room: LKRoom, RoomEvent, Track } = await import(
				"livekit-client"
			);
			room = new LKRoom({ adaptiveStream: true });
			roomRef.current = room;

			const attach = (track: any) => {
				if (track.kind === Track.Kind.Video && videoRef.current) {
					track.attach(videoRef.current);
					setState("playing");
				}
				if (track.kind === Track.Kind.Audio) {
					const el = track.attach();
					audioElsRef.current.push(el);
					document.body.appendChild(el);
				}
			};
			room.on(RoomEvent.TrackSubscribed, attach);
			room.on(RoomEvent.TrackUnsubscribed, (track) => {
				track.detach().forEach((el: HTMLElement) => el.remove());
				if (track.kind === Track.Kind.Video) setState("waiting");
			});
			const syncViewers = () =>
				onViewers?.(room ? room.remoteParticipants.size : 0);
			room.on(RoomEvent.ParticipantConnected, syncViewers);
			room.on(RoomEvent.ParticipantDisconnected, syncViewers);
			room.on(RoomEvent.Disconnected, () => {
				if (!cancelled) setState("ended");
			});

			try {
				await room.connect(tok.livekitUrl, tok.token, {
					rtcConfig: { iceTransportPolicy: "relay" },
				});
				if (cancelled) {
					room.disconnect();
					return;
				}
				onRoom?.(room);
				syncViewers();
				let sawVideo = false;
				room.remoteParticipants.forEach((p) => {
					p.trackPublications.forEach((pub) => {
						if (pub.track && pub.isSubscribed) {
							if (pub.track.kind === Track.Kind.Video) sawVideo = true;
							attach(pub.track);
						}
					});
				});
				if (!sawVideo) setState("waiting");
			} catch {
				if (!cancelled) setState("ended");
			}
		})();

		return () => {
			cancelled = true;
			for (const el of audioElsRef.current) el.remove();
			audioElsRef.current = [];
			room?.disconnect();
			roomRef.current = null;
			onRoom?.(null);
			setState("idle");
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [active, streamId]);

	// Mute follows the surface control: audio elements live outside the video.
	useEffect(() => {
		for (const el of audioElsRef.current) {
			(el as HTMLMediaElement).muted = muted;
		}
	}, [muted, state]);

	return (
		<div className="absolute inset-0 bg-black">
			{/* eslint-disable-next-line jsx-a11y/media-has-caption */}
			<video
				ref={videoRef}
				autoPlay
				playsInline
				muted
				className={clsx(
					"absolute inset-0 h-full w-full object-contain transition-opacity",
					state === "playing" ? "opacity-100" : "opacity-0",
				)}
			/>
			{(state === "connecting" || state === "waiting") && (
				<div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
					<span className="h-7 w-7 rounded-pill border-2 border-white/20 border-t-white/75 animate-spin" />
					<p className="font-sans text-[13px] text-white/55">
						{state === "waiting" ? t("watch.waiting") : ""}
					</p>
				</div>
			)}
			{state === "ended" && (
				<div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5">
					<p className="font-sans text-[15px] font-semibold text-white/75">
						{t("watch.ended")}
					</p>
					<p className="font-sans text-[12.5px] text-white/45">
						{t("watch.keepScrolling")}
					</p>
				</div>
			)}
		</div>
	);
}
