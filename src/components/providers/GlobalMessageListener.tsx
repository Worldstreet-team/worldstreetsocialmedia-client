"use client";

import { useEffect } from "react";
import { useAtom, useAtomValue } from "jotai";
import { usePathname } from "next/navigation";
import { toast } from "sonner";
import { unreadMessagesCountAtom } from "@/store/messageCache";
import { userAtom } from "@/store/user.atom";
import { useRealtime } from "./RealtimeProvider";

export default function GlobalMessageListener() {
	const { client, isConnected } = useRealtime();
	const user = useAtomValue(userAtom);
	const pathname = usePathname();
	const [, setUnreadCount] = useAtom(unreadMessagesCountAtom);

	useEffect(() => {
		if (!client || !isConnected || !user) return;

		const channelName = `user:${user._id}`;
		const channel = client.channels.get(channelName);

		const handleMessage = (message: any) => {
			if (message.name === "event" && message.data.type === "message:new") {
				const { message: newMessage } = message.data;

				// If we are NOT on the messages page, increment unread count and show toast
				if (!pathname.startsWith("/messages")) {
					setUnreadCount((prev: number) => prev + 1);

					const senderName = newMessage.sender.firstName
						? `${newMessage.sender.firstName} ${newMessage.sender.lastName}`
						: newMessage.sender.username;

					toast.info(`New message from ${senderName}`, {
						description: newMessage.content || "Sent an attachment",
						duration: 4000,
					});
				}
			}
		};

		channel.subscribe(handleMessage);

		return () => {
			channel.unsubscribe(handleMessage);
		};
	}, [client, isConnected, user, pathname, setUnreadCount]);

	return null;
}
