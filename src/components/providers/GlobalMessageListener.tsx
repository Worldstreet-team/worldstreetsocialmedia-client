"use client";

import { useChannel } from "ably/react";
import { useAtom, useAtomValue } from "jotai";
import { usePathname } from "next/navigation";
import { toast } from "sonner";
import { unreadMessagesCountAtom } from "@/store/messageCache";
import { userAtom } from "@/store/user.atom";
import { useRealtime } from "./RealtimeProvider";

export default function GlobalMessageListener() {
	const user = useAtomValue(userAtom);
	const pathname = usePathname();
	const { isConnected } = useRealtime();
	const [, setUnreadCount] = useAtom(unreadMessagesCountAtom);

	useChannel(user && isConnected ? `user:${user._id}` : "dummy", (message) => {
		if (!user) return;
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
	});

	return null;
}
