"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import {
	Search,
	Send,
	Smile,
	Image as ImageIcon,
	Info,
	Phone,
	Video,
	Mic,
	Trash2,
	StopCircle,
	X,
	Plus,
	UserPlus,
	ArrowLeft,
	MessageSquarePlus,
} from "lucide-react";
import clsx from "clsx";
import axios from "axios";
import { useUser, useAuth } from "@clerk/nextjs";
import { useChannel, ChannelProvider } from "ably/react";
import EmojiPicker, { Theme } from "emoji-picker-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useRealtime } from "../providers/RealtimeProvider";
import MediaModal from "../ui/MediaModal";
import { VoiceMessage } from "./VoiceMessage";
import { AnimatePresence, motion } from "framer-motion";
import { useCall } from "@/providers/CallProvider";
import { BACKEND_URL } from "@/const";

const API_URL = (process.env.NEXT_PUBLIC_API_URL || BACKEND_URL).replace(
	/\/api\/?$/,
	"",
);

// Helper component for conditional channel subscription
const UserMessageSubscription = ({
	channelName,
	onMessage,
}: {
	channelName: string;
	onMessage: (message: any) => void;
}) => {
	return (
		<ChannelProvider channelName={channelName}>
			<ChannelSubscriptionInner
				channelName={channelName}
				onMessage={onMessage}
			/>
		</ChannelProvider>
	);
};

const ChannelSubscriptionInner = ({
	channelName,
	onMessage,
}: {
	channelName: string;
	onMessage: (message: any) => void;
}) => {
	useChannel(channelName, onMessage);
	return null;
};

// Types
interface UserProfile {
	_id: string;
	firstName: string;
	lastName: string;
	username: string;
	avatar: string;
}

interface Message {
	_id: string;
	conversationId: string;
	sender: UserProfile;
	content: string;
	type: "text" | "image" | "video" | "audio" | "file";
	mediaUrl?: string;
	createdAt: string;
}

interface Conversation {
	_id: string;
	participants: UserProfile[];
	lastMessage?: Message;
	lastMessageAt: string;
	unreadCount: number;
	otherParticipant: UserProfile;
}

const Attachment = ({
	src,
	type,
	isMe,
	isTemp,
	onClick,
}: {
	src: string;
	type: "image" | "video";
	isMe: boolean;
	isTemp: boolean;
	onClick: () => void;
}) => {
	const [progress, setProgress] = useState(0);
	const [loaded, setLoaded] = useState(false);
	const [objectUrl, setObjectUrl] = useState<string | null>(null);

	useEffect(() => {
		// If it's me (sender), we assume we have the file or it's loading via shimmer
		if (isMe) {
			setLoaded(true);
			return;
		}

		let mounted = true;
		const fetchMedia = async () => {
			try {
				const response = await axios.get(src, {
					responseType: "blob",
					onDownloadProgress: (progressEvent) => {
						if (progressEvent.total) {
							const percent = Math.round(
								(progressEvent.loaded * 100) / progressEvent.total,
							);
							setProgress(percent);
						}
					},
				});
				if (mounted) {
					const url = URL.createObjectURL(response.data);
					setObjectUrl(url);
					setLoaded(true);
				}
			} catch (e) {
				console.error("Failed to load media", e);
				if (mounted) setLoaded(true); // Fallback to allow retry or show error
			}
		};

		fetchMedia();

		return () => {
			mounted = false;
			if (objectUrl) URL.revokeObjectURL(objectUrl);
		};
	}, [src, isMe]);

	const displaySrc = objectUrl || src;

	if (!loaded && !isMe) {
		return (
			<div className="relative w-64 h-64 rounded-lg overflow-hidden mb-1 bg-zinc-900 flex items-center justify-center border border-zinc-800">
				<div className="flex flex-col items-center gap-2">
					<div className="w-8 h-8 rounded-full border-2 border-zinc-700 border-t-yellow-500 animate-spin" />
					<span className="text-xs font-mono text-zinc-400">{progress}%</span>
				</div>
			</div>
		);
	}

	return (
		<div
			onClick={onClick}
			className={clsx(
				"relative w-64 mb-1 rounded-lg overflow-hidden cursor-zoom-in hover:opacity-95 transition-all",
				isTemp && "opacity-70",
			)}
		>
			{isTemp && (
				<div className="absolute inset-0 z-10 bg-black/20 animate-pulse" />
			)}
			{type === "image" ? (
				<div className="relative w-64 h-64">
					<img
						src={displaySrc}
						alt="attachment"
						className="w-full h-full object-cover"
					/>
				</div>
			) : (
				<video src={displaySrc} controls className="w-full max-h-64" />
			)}
		</div>
	);
};

export const MessageBox = ({
	initialConversationId,
}: {
	initialConversationId?: string;
}) => {
	const { user } = useUser();
	const { getToken } = useAuth();
	const { isConnected } = useRealtime();

	const [myProfileId, setMyProfileId] = useState<string | null>(null);
	const [conversations, setConversations] = useState<Conversation[]>([]);
	const [activeConversation, setActiveConversation] =
		useState<Conversation | null>(null);
	const [messages, setMessages] = useState<Message[]>([]);
	const [messageInput, setMessageInput] = useState("");
	const [searchQuery, setSearchQuery] = useState("");
	const [isLoadingConversations, setIsLoadingConversations] = useState(true);
	const [isLoadingMessages, setIsLoadingMessages] = useState(false);
	const [showAttachMenu, setShowAttachMenu] = useState(false);
	const [showEmojiPicker, setShowEmojiPicker] = useState(false);

	const messagesEndRef = useRef<HTMLDivElement>(null);
	const activeIdRef = useRef<string | null>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const searchInputRef = useRef<HTMLInputElement>(null);
	const mediaRecorderRef = useRef<MediaRecorder | null>(null);
	const audioChunksRef = useRef<Blob[]>([]);

	const [isRecording, setIsRecording] = useState(false);
	const [recordingDuration, setRecordingDuration] = useState(0);

	const [selectedFile, setSelectedFile] = useState<File | null>(null);
	const [previewUrl, setPreviewUrl] = useState<string | null>(null);
	const [isUploading, setIsUploading] = useState(false);

	const [isMediaModalOpen, setIsMediaModalOpen] = useState(false);
	const [currentMediaIndex, setCurrentMediaIndex] = useState(0);

	const allMedia = messages
		.filter((m) => m.type === "image" || m.type === "video")
		.map((m) => ({
			url: m.mediaUrl || "",
			type: m.type as "image" | "video",
			id: m._id,
		}));

	const handleMediaClick = (messageId: string) => {
		const index = allMedia.findIndex((m) => m.id === messageId);
		if (index !== -1) {
			setCurrentMediaIndex(index);
			setIsMediaModalOpen(true);
		}
	};

	// Timer for recording duration
	useEffect(() => {
		let interval: NodeJS.Timeout;
		if (isRecording) {
			interval = setInterval(() => {
				setRecordingDuration((prev) => prev + 1);
			}, 1000);
		} else {
			setRecordingDuration(0);
		}
		return () => clearInterval(interval);
	}, [isRecording]);

	const startRecording = async () => {
		try {
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
			const mediaRecorder = new MediaRecorder(stream);
			mediaRecorderRef.current = mediaRecorder;
			audioChunksRef.current = [];

			mediaRecorder.ondataavailable = (event) => {
				if (event.data.size > 0) {
					audioChunksRef.current.push(event.data);
				}
			};

			// Automatically send on stop
			mediaRecorder.onstop = async () => {
				const audioBlob = new Blob(audioChunksRef.current, {
					type: "audio/webm",
				});
				await sendAudioMessage(audioBlob);
				stream.getTracks().forEach((track) => track.stop()); // Stop mic access
			};

			mediaRecorder.start();
			setIsRecording(true);
		} catch (error) {
			console.error("Error accessing microphone:", error);
			toast.error("Microphone access denied");
		}
	};

	const stopRecording = () => {
		if (mediaRecorderRef.current && isRecording) {
			mediaRecorderRef.current.stop();
			setIsRecording(false);
		}
	};

	const cancelRecording = () => {
		if (mediaRecorderRef.current && isRecording) {
			// Override onstop to do nothing
			mediaRecorderRef.current.onstop = () => {
				const stream = mediaRecorderRef.current?.stream;
				stream?.getTracks().forEach((track) => track.stop());
			};
			mediaRecorderRef.current.stop();
			setIsRecording(false);
		}
	};

	const sendAudioMessage = async (audioBlob: Blob) => {
		if (!activeConversation || !myProfileId) return;

		const formData = new FormData();
		formData.append("file", audioBlob, "voice-note.webm");

		try {
			toast.info("Sending voice note...");
			const token = await getToken();

			// 1. Upload
			const uploadRes = await axios.post(
				`${API_URL}/api/messages/upload`,
				formData,
				{
					headers: {
						Authorization: `Bearer ${token}`,
						"Content-Type": "multipart/form-data",
					},
				},
			);

			const { url } = uploadRes.data;

			// 2. Send Message
			const tempId = `temp-${Date.now()}`;
			const optimisticMessage: Message = {
				_id: tempId,
				conversationId: activeConversation._id,
				sender: {
					_id: myProfileId,
					firstName: user?.firstName || "",
					lastName: user?.lastName || "",
					username: user?.username || "",
					avatar: user?.imageUrl || "",
				},
				content: "",
				type: "audio",
				mediaUrl: url,
				createdAt: new Date().toISOString(),
			};

			setMessages((prev) => [...prev, optimisticMessage]);
			scrollToBottom();

			const response = await axios.post(
				`${API_URL}/api/messages`,
				{
					conversationId: activeConversation._id,
					content: "",
					type: "audio",
					mediaUrl: url,
				},
				{ headers: { Authorization: `Bearer ${token}` } },
			);

			setMessages((prev) =>
				prev.map((m) => (m._id === tempId ? response.data : m)),
			);
		} catch (error) {
			console.error("Failed to send audio", error);
			toast.error("Failed to send voice note");
		}
	};

	// Sync ref with state so real-time listener stays updated
	useEffect(() => {
		activeIdRef.current = activeConversation?._id || null;
		if (activeConversation?._id) {
			markAsRead(activeConversation._id);
		}
	}, [activeConversation]);

	const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (file) {
			setSelectedFile(file);
			const url = URL.createObjectURL(file);
			setPreviewUrl(url);
		}
		if (fileInputRef.current) fileInputRef.current.value = "";
	};

	const clearSelectedFile = () => {
		setSelectedFile(null);
		if (previewUrl) {
			URL.revokeObjectURL(previewUrl);
			setPreviewUrl(null);
		}
	};

	const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
		setTimeout(() => {
			messagesEndRef.current?.scrollIntoView({ behavior });
		}, 100);
	}, []);

	const markAsRead = async (conversationId: string) => {
		try {
			const token = await getToken();
			await axios.post(
				`${API_URL}/api/messages/${conversationId}/read`,
				{},
				{
					headers: { Authorization: `Bearer ${token}` },
				},
			);
			setConversations((prev) =>
				prev.map((c) =>
					c._id === conversationId ? { ...c, unreadCount: 0 } : c,
				),
			);
		} catch (e) {
			console.error("Failed to mark as read", e);
		}
	};

	const fetchConversations = async () => {
		try {
			setIsLoadingConversations(true);
			const token = await getToken();
			const response = await axios.get(
				`${API_URL}/api/messages/conversations`,
				{
					headers: { Authorization: `Bearer ${token}` },
				},
			);
			setConversations(response.data);

			if (initialConversationId) {
				const target = response.data.find(
					(c: Conversation) => c._id === initialConversationId,
				);
				if (target) setActiveConversation(target);
			}
		} catch (error) {
			toast.error("Failed to load conversations");
		} finally {
			setIsLoadingConversations(false);
		}
	};

	const fetchMessages = async (conversationId: string) => {
		try {
			setIsLoadingMessages(true);
			setMessages([]); // Clear immediately to avoid "ghosting"
			const token = await getToken();
			const response = await axios.get(
				`${API_URL}/api/messages/${conversationId}`,
				{
					headers: { Authorization: `Bearer ${token}` },
				},
			);
			setMessages(response.data);
			scrollToBottom("auto");
		} catch (error) {
			toast.error("Failed to load messages");
		} finally {
			setIsLoadingMessages(false);
		}
	};

	const onMessage = useCallback((ablyMessage: any) => {
		if (
			ablyMessage.name === "event" &&
			ablyMessage.data.type === "message:new"
		) {
			const { message: newMessage, conversationId } = ablyMessage.data;
			const currentActiveId = activeIdRef.current;

			// 1. Update Messages if current chat is open
			if (currentActiveId === conversationId) {
				setMessages((prev) => {
					// Deduplicate by ID
					if (prev.find((m) => m._id === newMessage._id)) return prev;
					return [...prev, newMessage];
				});
				scrollToBottom();
				markAsRead(conversationId);
			}

			// 2. Update Conversation List (Move to top + Unread count)
			setConversations((prev) => {
				const index = prev.findIndex((c) => c._id === conversationId);
				if (index === -1) {
					fetchConversations(); // Handle completely new thread
					return prev;
				}

				const updated = [...prev];
				const conv = { ...updated[index] };
				conv.lastMessage = newMessage;
				conv.lastMessageAt = newMessage.createdAt;

				if (currentActiveId !== conversationId) {
					conv.unreadCount += 1;
				}

				updated.splice(index, 1);
				return [conv, ...updated];
			});
		}
	}, []);

	const sendMessage = async () => {
		if (
			(!messageInput.trim() && !selectedFile) ||
			!activeConversation ||
			!myProfileId ||
			isUploading
		)
			return;

		const tempId = `temp-${Date.now()}`;
		const content = messageInput;
		const currentFile = selectedFile;
		const currentPreview = previewUrl;

		// Determine optimistic type
		let optimisticType: "text" | "image" | "video" | "file" = "text";
		if (currentFile) {
			if (currentFile.type.startsWith("image")) optimisticType = "image";
			else if (currentFile.type.startsWith("video")) optimisticType = "video";
			else optimisticType = "file";
		}

		const optimisticMessage: Message = {
			_id: tempId,
			conversationId: activeConversation._id,
			sender: {
				_id: myProfileId,
				firstName: user?.firstName || "",
				lastName: user?.lastName || "",
				username: user?.username || "",
				avatar: user?.imageUrl || "",
			},
			content: content,
			type: optimisticType as any,
			mediaUrl: currentPreview || undefined,
			createdAt: new Date().toISOString(),
		};

		setMessages((prev) => [...prev, optimisticMessage]);
		scrollToBottom();
		setMessageInput("");
		clearSelectedFile();
		setIsUploading(true);

		try {
			const token = await getToken();
			let mediaUrl = "";
			let finalType = "text";

			// 1. Upload if file exists
			if (currentFile) {
				const formData = new FormData();
				formData.append("file", currentFile);
				const uploadRes = await axios.post(
					`${API_URL}/api/messages/upload`,
					formData,
					{
						headers: {
							Authorization: `Bearer ${token}`,
							"Content-Type": "multipart/form-data",
						},
					},
				);
				mediaUrl = uploadRes.data.url;
				const type = uploadRes.data.type;
				finalType = type.startsWith("image")
					? "image"
					: type.startsWith("video")
						? "video"
						: "file";
			}

			// 2. Send Message
			const response = await axios.post(
				`${API_URL}/api/messages`,
				{
					conversationId: activeConversation._id,
					content,
					type: currentFile ? finalType : "text",
					mediaUrl: mediaUrl || undefined,
				},
				{ headers: { Authorization: `Bearer ${token}` } },
			);

			setMessages((prev) => {
				// If the real message logic (Ably) already added the real message,
				// we should remove the temp message to avoid duplicates,
				// rather than matching temp -> real.
				const realExists = prev.find((m) => m._id === response.data._id);
				if (realExists) {
					return prev.filter((m) => m._id !== tempId);
				}
				// Otherwise, replace temp with real
				return prev.map((m) => (m._id === tempId ? response.data : m));
			});
		} catch (error) {
			console.error("Failed to send", error);
			toast.error("Failed to send message");
			setMessages((prev) => prev.filter((m) => m._id !== tempId));
		} finally {
			setIsUploading(false);
		}
	};
	// --- Call Logic (Global) ---
	const { startCall } = useCall();

	useEffect(() => {
		const fetchMe = async () => {
			const token = await getToken();
			const res = await axios.get(`${API_URL}/api/users/me`, {
				headers: { Authorization: `Bearer ${token}` },
			});
			setMyProfileId(res.data._id);
		};
		if (user) {
			fetchMe();
			fetchConversations();
		}
	}, [user]);

	useEffect(() => {
		if (activeConversation) fetchMessages(activeConversation._id);
	}, [activeConversation?._id]); // Only trigger when ID changes

	return (
		<div className="flex h-[calc(100vh-2px)] bg-black text-white">
			{myProfileId && isConnected && (
				<UserMessageSubscription
					channelName={`user:${myProfileId}`}
					onMessage={onMessage}
				/>
			)}
			<MediaModal
				isOpen={isMediaModalOpen}
				onClose={() => setIsMediaModalOpen(false)}
				media={allMedia}
				initialIndex={currentMediaIndex}
			/>

			{/* Sidebar */}
			<div
				className={clsx(
					"w-full md:w-[400px] border-r border-zinc-800 flex flex-col transition-all",
					activeConversation ||
						(conversations.length === 0 && !isLoadingConversations)
						? "hidden md:flex"
						: "flex",
				)}
			>
				<div className="p-4 border-b border-zinc-800">
					<h1 className="text-xl font-bold mb-4">Messages</h1>
					<div className="relative">
						<Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
						<input
							type="text"
							placeholder="Search Direct Messages"
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							ref={searchInputRef}
							className="w-full bg-zinc-900 border border-zinc-800 rounded-full pl-10 pr-4 py-2 text-sm focus:border-yellow-500 outline-none"
						/>
					</div>
				</div>

				<div className="flex-1 overflow-y-auto">
					{isLoadingConversations ? (
						<div className="p-4 text-center text-zinc-500">Loading...</div>
					) : (
						conversations
							.filter((c) =>
								`${c.otherParticipant.firstName} ${c.otherParticipant.lastName}`
									.toLowerCase()
									.includes(searchQuery.toLowerCase()),
							)
							.map((conv) => (
								<button
									key={conv._id}
									onClick={() => setActiveConversation(conv)}
									className={clsx(
										"w-full p-4 flex gap-3 hover:bg-zinc-900/50 border-b border-zinc-800/50 transition-all",
										activeConversation?._id === conv._id &&
											"bg-zinc-900 border-l-2 border-l-yellow-500",
									)}
								>
									<div className="relative">
										<Image
											src={conv.otherParticipant.avatar}
											alt="avatar"
											width={48}
											height={48}
											className="rounded-full"
										/>
										{conv.unreadCount > 0 && (
											<div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-500 rounded-full border-2 border-black" />
										)}
									</div>
									<div className="flex-1 text-left truncate">
										<div className="flex justify-between items-center">
											<span className="font-bold text-sm truncate">
												{conv.otherParticipant.firstName}{" "}
												{conv.otherParticipant.lastName}
											</span>
											<span className="text-xs text-zinc-500">
												{conv.lastMessageAt
													? format(new Date(conv.lastMessageAt), "MMM d")
													: ""}
											</span>
										</div>
										<p
											className={clsx(
												"text-sm truncate",
												conv.unreadCount > 0
													? "text-white font-bold"
													: "text-zinc-500",
											)}
										>
											{conv.lastMessage?.content || "No messages yet"}
										</p>
									</div>
								</button>
							))
					)}
				</div>
			</div>

			{/* Chat Area */}
			{activeConversation ? (
				<div className={clsx("flex-1 flex flex-col", "flex")}>
					<div className="h-16 border-b border-zinc-800 flex items-center justify-between px-4 md:px-6">
						<div className="flex items-center gap-3">
							<button
								onClick={() => setActiveConversation(null)}
								className="md:hidden text-zinc-400 hover:text-white"
							>
								<ArrowLeft className="w-5 h-5" />
							</button>
							<Image
								src={activeConversation.otherParticipant.avatar}
								alt="avatar"
								width={40}
								height={40}
								className="rounded-full"
							/>
							<div>
								<h2 className="font-bold text-sm">
									{activeConversation.otherParticipant.firstName}{" "}
									{activeConversation.otherParticipant.lastName}
								</h2>
								<p className="text-xs text-zinc-500">
									@{activeConversation.otherParticipant.username}
								</p>
							</div>
						</div>
						<div className="flex gap-4 text-zinc-400">
							<Phone
								className="w-5 h-5 cursor-pointer hover:text-white"
								onClick={() =>
									startCall(
										false,
										activeConversation?.otherParticipant._id || "",
										`${activeConversation.otherParticipant.firstName || ""} ${activeConversation.otherParticipant.lastName || ""}`,
										activeConversation.otherParticipant.avatar || "",
										false,
										{
											id: myProfileId || "",
											name: `${user?.firstName || ""} ${user?.lastName || ""}`,
											avatar: user?.imageUrl || "",
											username: user?.username || "",
										},
									)
								}
							/>
							<Video
								className="w-5 h-5 cursor-pointer hover:text-white"
								onClick={() =>
									startCall(
										true,
										activeConversation?.otherParticipant._id || "",
										`${activeConversation.otherParticipant.firstName || ""} ${activeConversation.otherParticipant.lastName || ""}`,
										activeConversation.otherParticipant.avatar || "",
										true,
										{
											id: myProfileId || "",
											name: `${user?.firstName || ""} ${user?.lastName || ""}`,
											avatar: user?.imageUrl || "",
											username: user?.username || "",
										},
									)
								}
							/>
							<Info className="w-5 h-5 cursor-pointer hover:text-white" />
						</div>
					</div>

					<div className="flex-1 overflow-y-auto p-6 space-y-4 bg-zinc-950/30">
						{isLoadingMessages && (
							<div className="text-center text-zinc-500">
								Loading history...
							</div>
						)}
						{messages.map((m) => {
							const isMe =
								m.sender._id === myProfileId || m._id.startsWith("temp-");
							return (
								<div
									key={m._id}
									className={clsx(
										"flex flex-col mb-4",
										isMe ? "items-end" : "items-start",
									)}
								>
									<div
										className={clsx(
											"max-w-[70%] rounded-2xl px-4 py-2",
											isMe
												? "bg-yellow-500 text-black"
												: "bg-zinc-800 text-white",
										)}
									>
										{m.type === "image" && m.mediaUrl && (
											<Attachment
												src={m.mediaUrl}
												type="image"
												isMe={isMe}
												isTemp={m._id.startsWith("temp-")}
												onClick={() => handleMediaClick(m._id)}
											/>
										)}
										{m.type === "video" && m.mediaUrl && (
											<Attachment
												src={m.mediaUrl}
												type="video"
												isMe={isMe}
												isTemp={m._id.startsWith("temp-")}
												onClick={() => handleMediaClick(m._id)}
											/>
										)}
										{m.type === "audio" && m.mediaUrl && (
											<div className="relative w-64 mb-1">
												<VoiceMessage src={m.mediaUrl} isMe={isMe} />
											</div>
										)}
										{m.content && (
											<p
												className={clsx(
													"text-sm leading-relaxed",
													m.mediaUrl && "mt-2",
												)}
											>
												{m.content}
											</p>
										)}
									</div>
									<span className="text-[10px] text-zinc-500 mt-1 block opacity-60">
										{format(new Date(m.createdAt), "h:mm a")}
									</span>
								</div>
							);
						})}
						<div ref={messagesEndRef} />
					</div>

					<div className="p-4 border-t border-zinc-800 bg-black">
						{/* Preview Area */}
						{selectedFile && previewUrl && (
							<div className="mb-2 relative inline-block">
								<div className="relative rounded-lg overflow-hidden border border-zinc-700">
									{selectedFile.type.startsWith("image") ? (
										<img
											src={previewUrl}
											alt="Preview"
											className="h-20 w-auto object-cover"
										/>
									) : (
										<video
											src={previewUrl}
											className="h-20 w-auto object-cover"
											controls={false}
										/>
									)}
								</div>
								<button
									onClick={clearSelectedFile}
									className="absolute -top-2 -right-2 bg-zinc-800 rounded-full p-1 text-zinc-400 hover:text-white border border-zinc-700"
								>
									<X className="w-3 h-3" />
								</button>
							</div>
						)}

						<div className="flex items-center gap-3 relative">
							{/* Attach Menu */}
							<AnimatePresence>
								{showAttachMenu && (
									<motion.div
										initial={{ opacity: 0, y: 10, scale: 0.95 }}
										animate={{ opacity: 1, y: 0, scale: 1 }}
										exit={{ opacity: 0, y: 10, scale: 0.95 }}
										className="absolute bottom-16 left-0 bg-zinc-900 border border-zinc-800 rounded-2xl p-2 flex gap-4 shadow-2xl z-50"
									>
										<button
											onClick={() => {
												if (fileInputRef.current) {
													fileInputRef.current.accept = "image/*";
													fileInputRef.current.click();
												}
												setShowAttachMenu(false);
											}}
											className="flex flex-col items-center gap-2 p-3 hover:bg-zinc-800 rounded-xl transition-colors min-w-[80px]"
										>
											<div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center border border-zinc-700">
												<ImageIcon className="w-5 h-5 text-purple-400" />
											</div>
											<span className="text-xs text-zinc-400">Photo</span>
										</button>
										<button
											onClick={() => {
												if (fileInputRef.current) {
													fileInputRef.current.accept = "video/*";
													fileInputRef.current.click();
												}
												setShowAttachMenu(false);
											}}
											className="flex flex-col items-center gap-2 p-3 hover:bg-zinc-800 rounded-xl transition-colors min-w-[80px]"
										>
											<div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center border border-zinc-700">
												<Video className="w-5 h-5 text-green-400" />
											</div>
											<span className="text-xs text-zinc-400">Video</span>
										</button>
									</motion.div>
								)}
							</AnimatePresence>

							{/* Plus Button */}
							<button
								onClick={() => setShowAttachMenu(!showAttachMenu)}
								className={clsx(
									"p-3 rounded-full transition-all duration-300",
									showAttachMenu
										? "bg-white text-black rotate-45"
										: "bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700",
								)}
							>
								<Plus className="w-6 h-6" />
							</button>

							{/* Hidden File Input */}
							<input
								type="file"
								ref={fileInputRef}
								className="hidden"
								accept="image/*,video/*" // Default, overridden by menu
								onChange={handleFileSelect}
							/>

							{/* Recording UI */}
							{isRecording ? (
								<div className="flex-1 bg-zinc-900 border border-zinc-800 rounded-3xl h-[56px] flex items-center px-6 gap-4">
									<div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
									<div className="flex-1 font-mono text-white">
										{Math.floor(recordingDuration / 60)}:
										{(recordingDuration % 60).toString().padStart(2, "0")}
									</div>
									<button
										onClick={cancelRecording}
										className="text-zinc-500 hover:text-white transition-colors"
									>
										Cancel
									</button>
									<button
										onClick={stopRecording}
										className="p-2 bg-white text-black rounded-full hover:scale-105 transition-transform"
									>
										<Send className="w-4 h-4" />
									</button>
								</div>
							) : (
								/* Text Input Pill */
								<div className="flex-1 bg-zinc-900 border border-zinc-800 rounded-3xl flex items-center px-4 py-2 gap-2 focus-within:border-zinc-700 transition-colors">
									<textarea
										value={messageInput}
										onChange={(e) => setMessageInput(e.target.value)}
										onKeyDown={(e) =>
											e.key === "Enter" &&
											!e.shiftKey &&
											(e.preventDefault(), sendMessage())
										}
										placeholder="Type a message..."
										className="flex-1 bg-transparent border-none outline-none text-white placeholder-zinc-500 resize-none max-h-[100px] py-3"
										rows={1}
										style={{ minHeight: "24px" }}
									/>

									{/* Right Side Icons */}
									<div className="flex items-center gap-2">
										<div className="relative">
											<Smile
												onClick={() => setShowEmojiPicker(!showEmojiPicker)}
												className="w-6 h-6 text-zinc-400 cursor-pointer hover:text-white transition-colors"
											/>
											{showEmojiPicker && (
												<div className="absolute bottom-12 right-0 z-50">
													<EmojiPicker
														theme={Theme.DARK}
														onEmojiClick={(e) =>
															setMessageInput((p) => p + e.emoji)
														}
													/>
												</div>
											)}
										</div>

										{messageInput.trim() || selectedFile ? (
											<button
												onClick={sendMessage}
												disabled={isUploading}
												className="p-2 bg-yellow-500 text-black rounded-full hover:bg-yellow-400 transition-colors disabled:opacity-50"
											>
												<Send className="w-4 h-4" />
											</button>
										) : (
											<Mic
												onClick={startRecording}
												className="w-6 h-6 text-zinc-400 cursor-pointer hover:text-white transition-colors"
											/>
										)}
									</div>
								</div>
							)}
						</div>
					</div>
				</div>
			) : (
				<div
					className={clsx(
						"flex-1 flex flex-col items-center justify-center text-zinc-500 p-8",
						conversations.length > 0 ? "hidden md:flex" : "flex",
					)}
				>
					<div className="max-w-md flex flex-col items-center text-center space-y-6">
						<img
							src="/images/messages-empty-state.png"
							alt="No messages"
							className="w-48 h-48 object-contain opacity-80"
						/>
						<div className="space-y-2">
							<h3 className="text-xl font-bold text-zinc-300">
								Select a conversation or start a new one
							</h3>
							<p className="text-sm text-zinc-500">
								Choose from your existing conversations or start a new chat
							</p>
						</div>
						<button
							onClick={() => searchInputRef.current?.focus()}
							className="flex items-center gap-2 px-6 py-3 bg-yellow-500 text-black font-bold rounded-full hover:bg-yellow-400 transition-colors"
						>
							<UserPlus className="w-5 h-5" />
							New Conversation
						</button>
					</div>
				</div>
			)}
		</div>
	);
};

export default MessageBox;
