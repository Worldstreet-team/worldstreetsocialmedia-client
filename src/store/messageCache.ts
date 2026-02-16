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
	_id: string;
	conversationId: string;
	sender: UserProfile;
	content: string;
	type: "text" | "image" | "video" | "audio" | "file";
	mediaUrl?: string;
	createdAt: string;
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
