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
	/** One entry per remote VIDEO track, keyed by track sid. Co-live parity:
	 *  a merged stage publishes 2+ camera feeds into the room, and the old
	 *  single-<video> slot attached them all to one element — last publisher
	 *  won and viewers saw one arbitrary face. Each track now owns a tile
	 *  and the grid splits the stage the way Xtreme's own viewer does. */
	const [videoTracks, setVideoTracks] = useState<{ sid: string; track: any }[]>(
		[],
	);
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
				if (track.kind === Track.Kind.Video) {
					const sid = String(track.sid ?? Math.random());
					setVideoTracks((prev) =>
						prev.some((v) => v.sid === sid)
							? prev
							: [...prev, { sid, track }],
					);
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
				if (track.kind === Track.Kind.Video) {
					const sid = String(track.sid ?? "");
					setVideoTracks((prev) => {
						const next = prev.filter((v) => v.sid !== sid);
						// A guest leaving mid-stage must not blank the host.
						if (next.length === 0) setState("waiting");
						return next;
					});
				}
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
			setVideoTracks([]);
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

	// The stage grid: 1 feed full-bleed; 2 stack; 3-4 quarter. Matches the
	// split Xtreme's studio composes, so a merged co-live reads the same in
	// both viewers.
	const n = videoTracks.length;
	return (
		<div className="absolute inset-0 bg-black">
			<div
				className={clsx(
					"pointer-events-none absolute inset-0 grid gap-px transition-opacity",
					state === "playing" ? "opacity-100" : "opacity-0",
					n <= 1 && "grid-cols-1 grid-rows-1",
					n === 2 && "grid-cols-1 grid-rows-2",
					n >= 3 && "grid-cols-2 grid-rows-2",
				)}
			>
				{videoTracks.map((v) => (
					<StageTile
						key={v.sid}
						track={v.track}
						solo={n === 1}
					/>
				))}
			</div>
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

/** One publisher's feed. Solo keeps the classic contain letterbox; a split
 *  stage covers each cell so the grid reads as one composed stage rather
 *  than floating letterboxed rectangles. */
function StageTile({ track, solo }: { track: any; solo: boolean }) {
	const ref = useRef<HTMLVideoElement>(null);
	useEffect(() => {
		const el = ref.current;
		if (!el) return;
		track.attach(el);
		return () => {
			track.detach(el);
		};
	}, [track]);
	return (
		// eslint-disable-next-line jsx-a11y/media-has-caption
		<video
			ref={ref}
			autoPlay
			playsInline
			muted
			className={clsx(
				"h-full w-full",
				solo ? "object-contain" : "object-cover",
			)}
		/>
	);
}
