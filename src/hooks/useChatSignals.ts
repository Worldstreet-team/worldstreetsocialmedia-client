"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useRealtime } from "@/components/providers/RealtimeProvider";

/**
 * The small realtime signals that make a chat feel like a conversation rather
 * than a form submission: is she online, is he typing, did it arrive, did they
 * read it.
 *
 * These ride a per-conversation Ably channel **client to client**. Routing an
 * "is typing" event through the gateway would make it slower than the typing
 * it is reporting, and it is ephemeral either way — there is nothing to store.
 * Real messages still fan out server-side on `user:*`, so the worst a forged
 * publish here can do is show a spurious typing bubble.
 *
 * Persisting "read" is MessageBox's existing `markAsRead` POST — this hook only
 * carries the realtime half, so the other side's ticks turn over immediately
 * instead of waiting on a write. Delivered is never persisted; it only has to
 * outlive the sender's tab.
 */

/** How long a typing bubble survives without a refresh from the other side.
 *  12s TTL against an 8s refresh is the platform-tuned pair (register 120):
 *  a third of the old wire volume, no flicker window. */
const TYPING_TTL_MS = 12_000;
/** Don't republish "still typing" more often than this. */
const TYPING_THROTTLE_MS = 8_000;
/** Idle this long and we announce that typing stopped. */
const TYPING_IDLE_MS = 3_000;

export interface ChatSignals {
	peerOnline: boolean;
	peerTyping: boolean;
	/** They are holding the mic right now — "recording audio…". */
	peerRecording: boolean;
	/** Peer's client acknowledged receipt of everything up to this time. */
	deliveredAt: number | null;
	/** Peer had read everything up to this time. */
	readAt: number | null;
	/** Call on every keystroke; throttling is handled here. */
	notifyTyping: () => void;
	/** Call when the draft is sent or cleared. */
	notifyStoppedTyping: () => void;
	/** Heartbeat while a voice note is being recorded (register 84). */
	notifyRecording: () => void;
	/** Call when an inbound message lands while the thread is open. */
	notifyDelivered: () => void;
	/** Tell the other side their messages have been read, now. */
	notifyRead: () => void;
	/** Broadcast a reaction change with the message's new reaction set. */
	notifyReaction: (
		messageId: string,
		reactions: { profile: string; emoji: string }[],
	) => void;
}

export function useChatSignals({
	conversationId,
	myProfileId,
	onReaction,
}: {
	conversationId: string | null;
	myProfileId: string | null;
	/** A peer changed a reaction; payload carries the message's full new
	 *  reaction set, so applying it is idempotent (register 133). */
	onReaction?: (e: {
		messageId: string;
		reactions: { profile: string; emoji: string }[];
	}) => void;
}): ChatSignals {
	const { client } = useRealtime();

	const [peerOnline, setPeerOnline] = useState(false);
	const [peerTyping, setPeerTyping] = useState(false);
	const [peerRecording, setPeerRecording] = useState(false);
	const [deliveredAt, setDeliveredAt] = useState<number | null>(null);
	const [readAt, setReadAt] = useState<number | null>(null);

	const channelRef = useRef<any>(null);
	const onReactionRef = useRef(onReaction);
	onReactionRef.current = onReaction;
	const typingClearRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const recordingClearRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const lastTypingSentRef = useRef(0);
	const idleRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	// Attach to the conversation channel: presence for "online", plain
	// messages for the ephemeral receipts.
	useEffect(() => {
		if (!client || !conversationId || !myProfileId) return;

		// A new thread starts with a clean slate — otherwise the previous
		// conversation's ticks bleed into this one.
		setPeerOnline(false);
		setPeerTyping(false);
		setPeerRecording(false);
		setDeliveredAt(null);
		setReadAt(null);

		const channel = client.channels.get(`conversation:${conversationId}`);
		channelRef.current = channel;

		const refreshPresence = async () => {
			try {
				const members = await channel.presence.get();
				setPeerOnline(
					members.some((m: any) => m.clientId && m.clientId !== myProfileId),
				);
			} catch {
				/* presence unavailable — treat as offline rather than guessing */
			}
		};

		const onSignal = (message: any) => {
			const from = message?.data?.from;
			if (!from || from === myProfileId) return;

			switch (message.name) {
				case "typing":
					setPeerTyping(true);
					setPeerRecording(false);
					if (typingClearRef.current) clearTimeout(typingClearRef.current);
					// Self-expiring: if their tab dies mid-word we don't strand a
					// typing bubble on screen forever.
					typingClearRef.current = setTimeout(
						() => setPeerTyping(false),
						TYPING_TTL_MS,
					);
					break;
				case "typing:stop":
					if (typingClearRef.current) clearTimeout(typingClearRef.current);
					if (recordingClearRef.current)
						clearTimeout(recordingClearRef.current);
					setPeerTyping(false);
					setPeerRecording(false);
					break;
				case "reaction":
					if (message.data?.messageId)
						onReactionRef.current?.({
							messageId: String(message.data.messageId),
							reactions: Array.isArray(message.data.reactions)
								? message.data.reactions
								: [],
						});
					break;
				case "recording":
					// Same lifecycle as typing: self-expiring, killed by an
					// explicit stop. One person is either typing or holding the
					// mic, never both.
					setPeerRecording(true);
					setPeerTyping(false);
					if (recordingClearRef.current)
						clearTimeout(recordingClearRef.current);
					recordingClearRef.current = setTimeout(
						() => setPeerRecording(false),
						TYPING_TTL_MS,
					);
					break;
				case "delivered":
					setDeliveredAt(message.data.at ?? Date.now());
					break;
				case "read":
					setReadAt(message.data.at ?? Date.now());
					// Reading implies delivery; without this a thread read on
					// another device can show "read" with no "delivered".
					setDeliveredAt((prev) => prev ?? message.data.at ?? Date.now());
					break;
			}
		};

		channel.subscribe(onSignal);
		channel.presence.subscribe(["enter", "leave", "present"], refreshPresence);
		void channel.presence.enter({}).catch(() => {});
		void refreshPresence();

		return () => {
			if (typingClearRef.current) clearTimeout(typingClearRef.current);
			if (recordingClearRef.current) clearTimeout(recordingClearRef.current);
			if (idleRef.current) clearTimeout(idleRef.current);
			try {
				channel.unsubscribe(onSignal);
				channel.presence.unsubscribe();
				void channel.presence.leave().catch(() => {});
			} catch {
				/* channel already detached */
			}
			channelRef.current = null;
		};
	}, [client, conversationId, myProfileId]);

	const publish = useCallback(
		(name: string, data: Record<string, unknown> = {}) => {
			if (!channelRef.current || !myProfileId) return;
			void channelRef.current
				// v marks the payload schema (register 127) so a future shape
				// change can coexist with clients in the field.
				.publish(name, { v: 1, from: myProfileId, at: Date.now(), ...data })
				.catch(() => {
					/* a dropped typing signal is not worth surfacing */
				});
		},
		[myProfileId],
	);

	const notifyStoppedTyping = useCallback(() => {
		if (idleRef.current) clearTimeout(idleRef.current);
		lastTypingSentRef.current = 0;
		publish("typing:stop");
	}, [publish]);

	const notifyTyping = useCallback(() => {
		const now = Date.now();
		if (now - lastTypingSentRef.current > TYPING_THROTTLE_MS) {
			lastTypingSentRef.current = now;
			publish("typing");
		}
		// Stopping is inferred from silence, so it needs its own timer.
		if (idleRef.current) clearTimeout(idleRef.current);
		idleRef.current = setTimeout(notifyStoppedTyping, TYPING_IDLE_MS);
	}, [publish, notifyStoppedTyping]);

	const notifyRecording = useCallback(() => {
		const now = Date.now();
		if (now - lastTypingSentRef.current > TYPING_THROTTLE_MS) {
			lastTypingSentRef.current = now;
			publish("recording");
		}
		if (idleRef.current) clearTimeout(idleRef.current);
		idleRef.current = setTimeout(notifyStoppedTyping, TYPING_IDLE_MS);
	}, [publish, notifyStoppedTyping]);

	const notifyReaction = useCallback(
		(
			messageId: string,
			reactions: { profile: string; emoji: string }[],
		) => {
			publish("reaction", { messageId, reactions });
		},
		[publish],
	);

	const notifyDelivered = useCallback(() => {
		publish("delivered");
	}, [publish]);

	const notifyRead = useCallback(() => {
		publish("read");
	}, [publish]);

	return {
		peerOnline,
		peerTyping,
		peerRecording,
		deliveredAt,
		readAt,
		notifyTyping,
		notifyStoppedTyping,
		notifyRecording,
		notifyDelivered,
		notifyRead,
		notifyReaction,
	};
}
