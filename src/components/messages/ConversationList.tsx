"use client";

import { useSocket } from "@/context/SocketContext";
import MessageIcon from "@/assets/icons/MessageIcon";
import { useState, useEffect, useCallback } from "react";
import { getConversationsAction } from "@/lib/conversation.actions";
import { useAtomValue } from "jotai";
import { userAtom } from "@/store/user.atom";
import { useRouter } from "next/navigation";

// Define strict types
interface UserType {
	_id: string;
	firstName?: string;
	lastName?: string;
	username: string;
	avatar?: string;
}

interface MessageType {
	_id: string;
	conversationId: string;
	sender: UserType;
	content: string;
	createdAt: string;
}

interface ConversationType {
	_id: string;
	participants: UserType[];
	lastMessage?: MessageType;
	updatedAt: string;
}

export default function ConversationList() {
	const { socket } = useSocket();
	const user = useAtomValue(userAtom);
	const router = useRouter();
	const [conversations, setConversations] = useState<ConversationType[]>([]);
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);

	const fetchConversations = useCallback(async () => {
		setLoading(true);
		const res = await getConversationsAction();
		if (res.success) {
			setConversations(res.data);
		}
		setLoading(false);
	}, []);

	useEffect(() => {
		if (user) {
			fetchConversations();
		}
	}, [user, fetchConversations]);

	useEffect(() => {
		if (!socket) return;

		// Listen for new messages to update last message preview and reorder
		const handleNewMessage = (newMessage: MessageType) => {
			setConversations((prev) => {
				const conversationIndex = prev.findIndex(
					(c) => c._id === newMessage.conversationId,
				);
				if (conversationIndex === -1) {
					// New conversation or not in list? Reload for now or fetch single
					fetchConversations();
					return prev;
				}

				const updatedConversation = {
					...prev[conversationIndex],
					lastMessage: newMessage,
					updatedAt: new Date().toISOString(),
				};

				// Move to top
				const newList = [...prev];
				newList.splice(conversationIndex, 1);
				return [updatedConversation, ...newList];
			});
		};

		socket.on("new_message", handleNewMessage);
		return () => {
			socket.off("new_message", handleNewMessage);
		};
	}, [socket, fetchConversations]);

	const handleSelectConversation = (id: string) => {
		setSelectedId(id);
		router.push(`/messages/${id}`);
	};

	const getOtherParticipant = (participants: UserType[]) => {
		return participants.find((p) => p._id !== user?.userId) || participants[0];
	};

	return (
		<div className="w-full md:w-[390px] border-r border-border-gray flex flex-col h-full bg-white">
			<div className="px-4 py-3 h-[53px] flex items-center justify-between sticky top-0 bg-white/80 backdrop-blur-md z-10">
				<h1 className="text-xl font-bold">Messages</h1>
				<div className="flex gap-2">
					<button
						className="w-9 h-9 hover:bg-black/10 rounded-full flex items-center justify-center transition-colors"
						type="button"
					>
						<span className="material-symbols-outlined text-[20px]">
							settings
						</span>
					</button>
					<button
						className="w-9 h-9 hover:bg-black/10 rounded-full flex items-center justify-center transition-colors"
						type="button"
					>
						<MessageIcon size={{ width: "20", height: "20" }} color="black" />
					</button>
				</div>
			</div>

			<div className="px-4 py-2">
				<div className="relative group">
					<div className="absolute left-3 top-1/2 -translate-y-1/2 text-search-icon group-focus-within:text-primary transition-colors">
						<span className="material-symbols-outlined text-[18px]">
							search
						</span>
					</div>
					<input
						type="text"
						placeholder="Search Direct Messages"
						className="w-full bg-search-bg rounded-full py-2 pl-10 pr-4 outline-none border border-transparent focus:bg-white focus:border-primary/50 transition-all placeholder:text-text-light text-[15px]"
					/>
				</div>
			</div>

			<div className="overflow-y-auto flex-1">
				{loading ? (
					<div className="p-4 text-center text-text-light">
						Loading conversations...
					</div>
				) : conversations.length === 0 ? (
					<div className="p-4 text-center text-text-light">
						No conversations yet.
					</div>
				) : (
					conversations.map((conv) => {
						const otherUser = getOtherParticipant(conv.participants);
						return (
							<div
								key={conv._id}
								onClick={() => handleSelectConversation(conv._id)}
								onKeyDown={(e) => {
									if (e.key === "Enter" || e.key === " ") {
										handleSelectConversation(conv._id);
									}
								}}
								tabIndex={0}
								role="button"
								className={`px-4 py-3 hover:bg-black/3 transition-colors cursor-pointer flex gap-3 ${selectedId === conv._id ? "border-r-2 border-primary bg-black/3" : ""}`}
							>
								<div
									className="w-10 h-10 rounded-full bg-cover bg-center flex-shrink-0"
									style={{
										backgroundImage: `url('${otherUser.avatar || "https://upload.wikimedia.org/wikipedia/commons/7/7c/Profile_avatar_placeholder_large.png"}')`,
									}}
								></div>
								<div className="flex-1 min-w-0 flex flex-col justify-center">
									<div className="flex justify-between items-baseline">
										<div className="flex items-center gap-1 truncate">
											<span className="font-bold text-[15px] truncate">
												{otherUser.firstName} {otherUser.lastName}
											</span>
											<span className="text-text-light text-[15px] truncate">
												@{otherUser.username}
											</span>
										</div>
										<span className="text-text-light text-[13px] flex-shrink-0">
											{conv.lastMessage
												? new Date(
														conv.lastMessage.createdAt,
													).toLocaleDateString()
												: ""}
										</span>
									</div>
									<div className="text-text-light text-[15px] truncate">
										{conv.lastMessage
											? conv.lastMessage.content
											: "Start a conversation"}
									</div>
								</div>
							</div>
						);
					})
				)}
			</div>
		</div>
	);
}
