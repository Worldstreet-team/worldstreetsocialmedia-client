"use client";

import { useEffect } from "react";
import { useAtom, useAtomValue } from "jotai";
import { useToast } from "@/components/ui/Toast/ToastContext";
import {
	activeConversationIdAtom,
	unreadMessagesCountAtom,
} from "@/store/messageCache";
import { userAtom } from "@/store/user.atom";
import { useRealtime } from "./RealtimeProvider";

export default function GlobalMessageListener() {
	const { client, isConnected } = useRealtime();
	const user = useAtomValue(userAtom);
	const activeConversationId = useAtomValue(activeConversationIdAtom);
	const [, setUnreadCount] = useAtom(unreadMessagesCountAtom);
	const { toast } = useToast();

	useEffect(() => {
		if (!client || !isConnected || !user) return;

		const channel = client.channels.get(`user:${user._id}`);

		// Bare subscribe, so the event-name guard below is what keeps DM logic
		// from firing on notifications and story views, which share this channel.
		const handleMessage = (message: any) => {
			if (message.name !== "event" || message.data?.type !== "message:new") return;

			const { message: newMessage, conversationId } = message.data;

			// Own echo from another device/tab (W1 multi-device fanout): the
			// badge and toast are for the RECIPIENT, not the author.
			if (String(newMessage?.sender?._id) === String(user._id)) return;

			// Register item 18: while the inbox itself is on screen, the row
			// update IS the notification — a toast on top is noise.
			if (window.location.pathname.startsWith("/messages")) {
				if (conversationId !== activeConversationId) {
					setUnreadCount((n) => n + 1);
				}
				return;
			}

			// Suppressed only for the thread actually on screen. Keying off the
			// /messages path instead dropped every message that arrived while you
			// were reading a different conversation.
			if (conversationId && conversationId === activeConversationId) return;

			setUnreadCount((prev: number) => prev + 1);

			const senderName = newMessage?.sender?.firstName
				? `${newMessage.sender.firstName} ${newMessage.sender.lastName}`
				: (newMessage?.sender?.username ?? "");

			toast(`New message from ${senderName}`, { duration: 4000 });
		};

		channel.subscribe(handleMessage);
		return () => channel.unsubscribe(handleMessage);
	}, [client, isConnected, user, activeConversationId, setUnreadCount, toast]);

	return null;
}
