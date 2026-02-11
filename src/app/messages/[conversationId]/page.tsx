"use client";

import { useState, useEffect, useRef, use } from "react";
import { useSocket } from "@/context/SocketContext";
import { useAtomValue } from "jotai";
import { userAtom } from "@/store/user.atom";
import {
	getMessagesAction,
	sendMessageAction,
	startConversationAction,
} from "@/lib/conversation.actions";
import { getProfileByUsernameAction } from "@/lib/user.actions";
import { useRouter } from "next/navigation";
import Image from "next/image";

interface UserType {
	_id: string;
	username: string;
	avatar?: string;
}

interface MessageType {
	_id: string;
	conversationId: string;
	sender: UserType;
	content: string;
	createdAt: string;
	type: "text" | "image" | "audio";
	isOptimistic?: boolean;
}

export default function ChatWindow({
	params,
}: {
	params: Promise<{ conversationId: string }>;
}) {
	const { conversationId } = use(params);
	const router = useRouter();
	const { socket } = useSocket();
	const user = useAtomValue(userAtom);
	const [messages, setMessages] = useState<MessageType[]>([]);
	const [newMessage, setNewMessage] = useState("");
	const [resolvingParameters, setResolvingParameters] = useState(true);
	const [activeConversationId, setActiveConversationId] = useState<
		string | null
	>(null);
	const messagesEndRef = useRef<HTMLDivElement>(null);

	// Resolve conversationId/username
	useEffect(() => {
		const resolveConversation = async () => {
			setResolvingParameters(true);
			const isObjectId = /^[0-9a-fA-F]{24}$/.test(conversationId);

			if (isObjectId) {
				setActiveConversationId(conversationId);
				setResolvingParameters(false);
			} else {
				// Assume it's a username
				const profileRes = await getProfileByUsernameAction(conversationId);
				if (profileRes.success && profileRes.data) {
					const convRes = await startConversationAction(profileRes.data.userId); // userId is usually on profile
					if (convRes.success || convRes._id) {
						const realId = convRes._id || convRes.data?._id;
						if (realId) {
							router.replace(`/messages/${realId}`);
							return;
						}
					}
				}
				setResolvingParameters(false);
			}
		};
		resolveConversation();
	}, [conversationId, router]);

	const scrollToBottom = () => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	};

	useEffect(() => {
		scrollToBottom();
	}, [messages]);

	// Fetch initial messages
	useEffect(() => {
		if (!activeConversationId) return;

		const fetchMessages = async () => {
			const res = await getMessagesAction(activeConversationId);
			if (res.success) {
				setMessages(res.data);
			}
		};
		fetchMessages();
	}, [activeConversationId]);

	// Join conversation room on mount
	useEffect(() => {
		if (socket && activeConversationId) {
			socket.emit("join_conversation", activeConversationId);

			const handleNewMessage = (message: MessageType) => {
				setMessages((prev) => {
					if (prev.some((m) => m._id === message._id)) return prev;
					return [...prev, message];
				});
			};

			socket.on("new_message", handleNewMessage);

			return () => {
				socket.emit("leave_conversation", activeConversationId);
				socket.off("new_message", handleNewMessage);
			};
		}
	}, [socket, activeConversationId]);

	const handleSendMessage = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!newMessage.trim() || !activeConversationId) return;

		// Optimistic update
		const tempId = Date.now().toString();
		const optimisticMessage: MessageType = {
			_id: tempId,
			conversationId: activeConversationId,
			sender: {
				_id: user?.userId || "me",
				username: user?.username || "me",
				avatar: user?.avatar,
			},
			content: newMessage,
			createdAt: new Date().toISOString(),
			type: "text",
			isOptimistic: true,
		};

		setMessages((prev) => [...prev, optimisticMessage]);
		const contentToSend = newMessage;
		setNewMessage("");

		const res = await sendMessageAction(activeConversationId, contentToSend);

		if (res.success) {
			setMessages((prev) => prev.map((m) => (m._id === tempId ? res.data : m)));
		} else {
			setMessages((prev) => prev.filter((m) => m._id !== tempId));
			alert("Failed to send message");
		}
	};

	if (!user || resolvingParameters)
		return (
			<div className="flex items-center justify-center h-full">
				<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
			</div>
		);

	return (
		<div className="flex flex-col h-full w-full bg-white">
			{/* Header */}
			<div className="px-4 py-3 h-[53px] flex items-center justify-between sticky top-0 bg-white/90 backdrop-blur-sm z-10 border-b border-gray-100">
				<h1 className="text-lg font-bold">Chat</h1>
				<button
					className="material-symbols-outlined text-[22px] text-gray-500 hover:text-black transition-colors"
					type="button"
				>
					info
				</button>
			</div>

			{/* Messages Area */}
			<div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
				{messages.map((msg, index) => {
					const isMe =
						msg.sender._id === user?.userId || msg.sender._id === "me";
					const isLastFromUser =
						index === messages.length - 1 ||
						messages[index + 1]?.sender._id !== msg.sender._id;

					return (
						<div
							key={msg._id}
							className={`flex ${isMe ? "justify-end" : "justify-start"} items-end group`}
						>
							{!isMe && (
								<div className="w-8 h-8 mr-2 mb-1 shrink-0">
									{isLastFromUser && (
										<div
											className="w-8 h-8 rounded-full bg-gray-200 bg-cover bg-center"
											style={{
												backgroundImage: `url('${msg.sender.avatar || "https://upload.wikimedia.org/wikipedia/commons/7/7c/Profile_avatar_placeholder_large.png"}')`,
											}}
										/>
									)}
								</div>
							)}
							<div
								className={`max-w-[75%] px-4 py-3 rounded-3xl relative text-[15px] leading-5 ${
									isMe
										? "bg-primary text-white rounded-br-sm"
										: "bg-[#EFF3F4] text-black rounded-bl-sm"
								} ${!isLastFromUser ? (isMe ? "rounded-br-3xl mb-0.5" : "rounded-bl-3xl mb-0.5") : "mb-2"}`}
							>
								<p>{msg.content}</p>
								{/* Tooltip timestamp could act here, but simple one for now */}
								<span
									className={`text-[10px] absolute -bottom-4 ${isMe ? "right-1 text-gray-400" : "left-1 text-gray-400"} opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap`}
								>
									{new Date(msg.createdAt).toLocaleTimeString([], {
										hour: "2-digit",
										minute: "2-digit",
									})}
								</span>
							</div>
						</div>
					);
				})}
				<div ref={messagesEndRef} />
			</div>

			{/* Input Area */}
			<div className="p-3 border-t border-gray-100 bg-white pb-6">
				<form
					onSubmit={handleSendMessage}
					className="flex gap-2 items-center bg-[#EFF3F4] rounded-full px-4 py-1"
				>
					<button
						type="button"
						className="text-primary p-2 hover:bg-blue-50 rounded-full transition-colors shrink-0"
					>
						<span className="material-symbols-outlined text-[20px]">image</span>
					</button>
					<button
						type="button"
						className="text-primary p-2 hover:bg-blue-50 rounded-full transition-colors shrink-0"
					>
						<span className="material-symbols-outlined text-[20px]">mic</span>
					</button>
					<input
						value={newMessage}
						onChange={(e) => setNewMessage(e.target.value)}
						placeholder="Start a new message"
						className="flex-1 bg-transparent outline-none py-3 text-[15px] placeholder-gray-500 text-black min-w-0"
						onKeyDown={(e) => {
							if (e.key === "Enter" && !e.shiftKey) {
								e.preventDefault();
								//@ts-ignore
								handleSendMessage(e);
							}
						}}
					/>
					<button
						type="submit"
						disabled={!newMessage.trim()}
						className={`p-2 rounded-full transition-colors shrink-0 flex items-center justify-center ${
							newMessage.trim()
								? "text-primary hover:bg-blue-50"
								: "text-gray-400"
						}`}
					>
						<span className="material-symbols-outlined text-[20px]">send</span>
					</button>
				</form>
			</div>
		</div>
	);
}
