import { atom } from "jotai";

// Define Message type to match what's used in components
interface UserProfile {
	_id: string;
	firstName: string;
	lastName: string;
	username: string;
	avatar: string;
}

export interface Message {
	/** Present when this message replies to a story. */
	storyRef?: { story: string; thumbnail: string; authorUsername: string };
	_id: string;
	conversationId: string;
	sender: UserProfile;
	content: string;
	// "call" is a finished call logged into the thread, not something typed.
	type: "text" | "image" | "video" | "audio" | "file" | "call" | "payment";
	/** USD minor units, payment messages only. */
	amountMinor?: number;
	/** Voice-note length, so a quoted voice note can say how long it is. */
	durationSec?: number;
	mediaUrl?: string;
	/**
	 * The message this one answers, populated one level deep by the gateway.
	 * A reply to a reply quotes only its immediate parent, so nothing nests.
	 */
	replyTo?: {
		_id: string;
		content: string;
		type: Message["type"];
		mediaUrl?: string;
		durationSec?: number;
		sender?: { username?: string; firstName?: string; lastName?: string };
	} | null;
	createdAt: string;
	/** Sender-generated dedup id — the stable list key across the
	 *  optimistic→server swap (W1). */
	clientKey?: string;
	width?: number;
	height?: number;
	thumbhash?: string;
	peaks?: number[];
	/** Multi-image sends cluster under one groupKey (register 63). */
	groupKey?: string;
	/** Transient, sender's tab only: upload progress 0..1. */
	uploadPct?: number;
	/** Transient, sender's tab only: send failed, retry offered. */
	failed?: boolean;
}

// Map conversationId -> Message[]
export type MessageCache = Record<string, Message[]>;

// The main atom holding the cache
export const messageCacheAtom = atom<MessageCache>({});

// Helper to update specific conversation
export const updateConversationCacheAtom = atom(
	null,
	(
		get,
		set,
		{
			conversationId,
			messages,
		}: { conversationId: string; messages: Message[] },
	) => {
		const currentCache = get(messageCacheAtom);
		set(messageCacheAtom, {
			...currentCache,
			[conversationId]: messages,
		});
	},
);

export const unreadMessagesCountAtom = atom(0);

/**
 * The thread currently on screen, or null.
 *
 * The badge used to suppress on any /messages path, which meant a message
 * arriving in thread B while you read thread A was silently dropped.
 */
export const activeConversationIdAtom = atom<string | null>(null);

// Helper to append a single message
export const addMessageToCacheAtom = atom(
	null,
	(get, set, { message }: { message: Message }) => {
		const currentCache = get(messageCacheAtom);
		const conversationId = message.conversationId;
		const currentMessages = currentCache[conversationId] || [];

		// Deduplicate
		if (currentMessages.find((m: Message) => m._id === message._id)) return;

		set(messageCacheAtom, {
			...currentCache,
			[conversationId]: [...currentMessages, message],
		});
	},
);
