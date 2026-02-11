"use client";

import { SocketProvider } from "@/context/SocketContext";
import ConversationList from "@/components/messages/ConversationList";

export default function MessagesLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<SocketProvider>
			<div className="flex h-screen w-full">
				{/* Conversation List is included within the layout so it persists */}
				<ConversationList />

				{/* The 'children' will be the chat window or the empty state */}
				<main className="flex-1 hidden md:flex h-full">{children}</main>
			</div>
		</SocketProvider>
	);
}
