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
	StopCircle,
	X,
	Plus,
	UserPlus,
	ArrowLeft,
	MessageCircle,
	MessageSquarePlus,
} from "lucide-react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import axios from "axios";
import { useUser, useAuth } from "@clerk/nextjs";
import { useChannel, ChannelProvider } from "ably/react";
import EmojiPicker, { Theme } from "emoji-picker-react";
import { useTheme } from "next-themes";
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
import { useAtom } from "jotai";
import { messageCacheAtom } from "@/store/messageCache";
import NewConversationModal from "./NewConversationModal";

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
			<div className="relative w-64 h-64 rounded-lg overflow-hidden mb-1 bg-sunken flex items-center justify-center border border-hairline">
				<div className="flex flex-col items-center gap-2">
					<div className="w-8 h-8 rounded-full border-2 border-raised border-t-brand animate-spin" />
					<span className="text-xs font-sans tabular-nums text-muted">{progress}%</span>
				</div>
			</div>
		);
	}

	return (
		<div
			onClick={onClick}
			className={clsx(
				"relative w-64 mb-1 rounded-lg overflow-hidden cursor-zoom-in hover:opacity-95 transition-opacity",
				isTemp && "opacity-70",
			)}
		>
			{isTemp && (
				<div className="absolute inset-0 z-10 bg-page/20 animate-pulse" />
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
	initialConversations = [],
}: {
	initialConversationId?: string;
	initialConversations?: Conversation[];
}) => {
	const { user } = useUser();
	const { getToken } = useAuth();
	const { isConnected } = useRealtime();
	const router = useRouter();

	const [myProfileId, setMyProfileId] = useState<string | null>(null);
	const [conversations, setConversations] =
		useState<Conversation[]>(initialConversations);
	const [activeConversation, setActiveConversation] =
		useState<Conversation | null>(() => {
			if (initialConversationId && initialConversations.length > 0) {
				return (
					initialConversations.find((c) => c._id === initialConversationId) ||
					null
				);
			}
			return null;
		});
	const [messageCache, setMessageCache] = useAtom(messageCacheAtom);
	const messages = activeConversation
		? messageCache[activeConversation._id] || []
		: [];
	const [messageInput, setMessageInput] = useState("");
	const [searchQuery, setSearchQuery] = useState("");
	const [isLoadingConversations, setIsLoadingConversations] = useState(
		initialConversations.length === 0,
	);
	const [isLoadingMessages, setIsLoadingMessages] = useState(false);
	const [showAttachMenu, setShowAttachMenu] = useState(false);
	const [showEmojiPicker, setShowEmojiPicker] = useState(false);
	// Picker follows the app theme instead of hardcoding dark.
	const { resolvedTheme } = useTheme();
	const [showNewConversationModal, setShowNewConversationModal] = useState(false);

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

			setMessageCache((prev) => ({
				...prev,
				[activeConversation._id]: [
					...(prev[activeConversation._id] || []),
					optimisticMessage,
				],
			}));
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

			setMessageCache((prev) => ({
				...prev,
				[activeConversation._id]: (prev[activeConversation._id] || []).map(
					(m) => (m._id === tempId ? response.data : m),
				),
			}));
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
		// Use cache if available
		if (messageCache[conversationId]?.length > 0) {
			scrollToBottom("auto");
			// Optional: Background refresh could go here if needed
			return;
		}

		try {
			setIsLoadingMessages(true);
			// setMessages([]); // No longer needed with cache
			const token = await getToken();
			const response = await axios.get(
				`${API_URL}/api/messages/${conversationId}`,
				{
					headers: { Authorization: `Bearer ${token}` },
				},
			);
			setMessageCache((prev) => ({
				...prev,
				[conversationId]: response.data,
			}));
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

			// 1. Update Messages if current chat is open (or even if not, update cache!)
			// Update cache for the conversationId regardless of active state
			setMessageCache((prev) => {
				const currentMessages = prev[conversationId] || [];
				if (currentMessages.find((m) => m._id === newMessage._id)) return prev;
				return {
					...prev,
					[conversationId]: [...currentMessages, newMessage],
				};
			});

			if (currentActiveId === conversationId) {
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

		setMessageCache((prev) => ({
			...prev,
			[activeConversation._id]: [
				...(prev[activeConversation._id] || []),
				optimisticMessage,
			],
		}));
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

			setMessageCache((prev) => {
				const currentMsgs = prev[activeConversation._id] || [];
				const realExists = currentMsgs.find((m) => m._id === response.data._id);
				if (realExists) {
					return {
						...prev,
						[activeConversation._id]: currentMsgs.filter(
							(m) => m._id !== tempId,
						),
					};
				}
				return {
					...prev,
					[activeConversation._id]: currentMsgs.map((m) =>
						m._id === tempId ? response.data : m,
					),
				};
			});
		} catch (error) {
			console.error("Failed to send", error);
			toast.error("Failed to send message");
			setMessageCache((prev) => ({
				...prev,
				[activeConversation._id]: (prev[activeConversation._id] || []).filter(
					(m) => m._id !== tempId,
				),
			}));
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
			if (initialConversations.length === 0) {
				fetchConversations();
			}
		}
	}, [user]);

	useEffect(() => {
		if (activeConversation) fetchMessages(activeConversation._id);
	}, [activeConversation?._id]); // Only trigger when ID changes

	return (
		<div className="flex h-[calc(100vh-2px)] bg-page text-primary">
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
					// Pane swap is a display toggle — width animation is a layout
					// property, off the opacity/transform motion budget.
					"w-full md:w-[400px] border-r border-hairline flex flex-col",
					activeConversation ||
						(conversations.length === 0 && !isLoadingConversations)
						? "hidden md:flex"
						: "flex",
				)}
			>
				<div className="p-4 border-b border-hairline">
					<h1 className="font-display text-lg font-semibold mb-4">Messages</h1>
					<div className="relative">
						<Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-subtle" />
						<input
							type="text"
							placeholder="Search Direct Messages"
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							ref={searchInputRef}
							className="w-full bg-surface border border-hairline rounded-pill pl-10 pr-4 py-2 text-sm text-primary placeholder:text-subtle focus:border-brand/60 outline-none transition-colors"
						/>
					</div>
				</div>

				<div className="flex-1 overflow-y-auto">
					{isLoadingConversations ? (
						<div className="p-4 text-center text-muted font-sans text-sm">Loading conversations...</div>
					) : conversations.length === 0 ? (
						<div className="p-6 text-center text-muted font-sans text-sm">
							No conversations yet. Start one and it lands here.
						</div>
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
									onClick={() => {
										setActiveConversation(conv);
										router.push(`/messages/${conv._id}`);
									}}
									className={clsx(
										"w-full p-4 flex gap-3 hover:bg-surface border-b border-hairline/50 transition-colors cursor-pointer",
										activeConversation?._id === conv._id &&
											"bg-surface border-l-2 border-l-brand",
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
											<div className="absolute -top-1 -right-1 w-3 h-3 bg-brand rounded-full border-2 border-page" />
										)}
									</div>
									<div className="flex-1 text-left truncate">
										<div className="flex justify-between items-center">
											<span className="font-semibold text-sm truncate">
												{conv.otherParticipant.firstName}{" "}
												{conv.otherParticipant.lastName}
											</span>
											<span className="text-xs text-muted tabular-nums">
												{conv.lastMessageAt
													? format(new Date(conv.lastMessageAt), "MMM d")
													: ""}
											</span>
										</div>
										<p
											className={clsx(
												"text-sm truncate",
												conv.unreadCount > 0
													? "text-primary font-semibold"
													: "text-muted",
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
					<div className="h-16 border-b border-hairline flex items-center justify-between px-4 md:px-6">
						<div className="flex items-center gap-3">
							<button
								onClick={() => setActiveConversation(null)}
								className="md:hidden w-10 h-10 -ml-2 flex items-center justify-center rounded-pill text-muted hover:text-primary hover:bg-raised transition-colors"
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
								<h2 className="font-semibold text-sm">
									{activeConversation.otherParticipant.firstName}{" "}
									{activeConversation.otherParticipant.lastName}
								</h2>
								<p className="text-xs text-muted">
									@{activeConversation.otherParticipant.username}
								</p>
							</div>
						</div>
						<div className="flex gap-1 text-muted">
							<button
								type="button"
								aria-label="Start voice call"
								className="w-10 h-10 flex items-center justify-center rounded-pill hover:bg-raised hover:text-primary transition-colors cursor-pointer"
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
							>
								<Phone className="w-5 h-5" />
							</button>
							<button
								type="button"
								aria-label="Start video call"
								className="w-10 h-10 flex items-center justify-center rounded-pill hover:bg-raised hover:text-primary transition-colors cursor-pointer"
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
							>
								<Video className="w-5 h-5" />
							</button>
							<button
							type="button"
							aria-label="Conversation info"
							className="w-10 h-10 flex items-center justify-center rounded-pill hover:bg-raised hover:text-primary transition-colors cursor-pointer"
						>
							<Info className="w-5 h-5" />
						</button>
						</div>
					</div>

					<div className="flex-1 overflow-y-auto p-6 space-y-4 bg-sunken/30">
						{isLoadingMessages && (
							<div className="text-center text-muted font-sans text-sm">
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
											"max-w-[70%] rounded-xl px-4 py-2",
											isMe
												? "bg-brand text-brand-on"
												: "bg-raised text-primary",
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
									<span className="text-xs text-muted mt-1 block tabular-nums">
										{format(new Date(m.createdAt), "h:mm a")}
									</span>
								</div>
							);
						})}
						<div ref={messagesEndRef} />
					</div>

					<div className="p-4 border-t border-hairline bg-page">
						{/* Preview Area */}
						{selectedFile && previewUrl && (
							<div className="mb-2 relative inline-block">
								<div className="relative rounded-lg overflow-hidden border border-hairline">
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
									className="absolute -top-2 -right-2 bg-raised rounded-pill p-1 text-muted hover:text-primary border border-hairline transition-colors"
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
										initial={{ opacity: 0, y: 8, scale: 0.98 }}
										animate={{ opacity: 1, y: 0, scale: 1 }}
										exit={{ opacity: 0, y: 8, scale: 0.98 }}
										transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
										className="absolute bottom-16 left-0 bg-surface border border-hairline rounded-xl p-2 flex gap-4 shadow-nav z-dropdown"
									>
										<button
											onClick={() => {
												if (fileInputRef.current) {
													fileInputRef.current.accept = "image/*";
													fileInputRef.current.click();
												}
												setShowAttachMenu(false);
											}}
											className="flex flex-col items-center gap-2 p-3 hover:bg-raised rounded-lg transition-colors min-w-[80px] cursor-pointer"
										>
											<div className="w-10 h-10 rounded-pill bg-raised flex items-center justify-center border border-hairline">
												<ImageIcon className="w-5 h-5 text-primary" />
											</div>
											<span className="text-xs text-muted">Photo</span>
										</button>
										<button
											onClick={() => {
												if (fileInputRef.current) {
													fileInputRef.current.accept = "video/*";
													fileInputRef.current.click();
												}
												setShowAttachMenu(false);
											}}
											className="flex flex-col items-center gap-2 p-3 hover:bg-raised rounded-lg transition-colors min-w-[80px] cursor-pointer"
										>
											<div className="w-10 h-10 rounded-pill bg-raised flex items-center justify-center border border-hairline">
												<Video className="w-5 h-5 text-primary" />
											</div>
											<span className="text-xs text-muted">Video</span>
										</button>
									</motion.div>
								)}
							</AnimatePresence>

							{/* Plus Button */}
							<button
								onClick={() => setShowAttachMenu(!showAttachMenu)}
								className={clsx(
									// Colors + the 45° rotate only (transform is in-budget).
									"p-3 rounded-pill transition-[transform,background-color,color]",
									showAttachMenu
										? "bg-primary text-page rotate-45"
										: "bg-surface text-muted border border-hairline hover:text-primary hover:bg-raised",
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
								<div className="flex-1 bg-surface border border-hairline rounded-pill h-[56px] flex items-center px-6 gap-4">
									{/* Recording dot — sanctioned live-state loop (06-motion):
										    opacity-only pulse while recording is active. */}
										<div className="w-3 h-3 rounded-full bg-danger animate-pulse" />
									<div className="flex-1 font-sans tabular-nums text-primary">
										{Math.floor(recordingDuration / 60)}:
										{(recordingDuration % 60).toString().padStart(2, "0")}
									</div>
									<button
										onClick={cancelRecording}
										className="text-muted hover:text-primary transition-colors cursor-pointer"
									>
										Cancel
									</button>
									<button
										onClick={stopRecording}
										className="p-2 bg-primary text-page rounded-pill hover:bg-muted transition-colors cursor-pointer"
									>
										<Send className="w-4 h-4" />
									</button>
								</div>
							) : (
								/* Text Input Pill */
								<div className="flex-1 bg-surface border border-hairline rounded-xl flex items-center px-4 py-2 gap-2 focus-within:border-brand/60 transition-colors">
									<textarea
										value={messageInput}
										onChange={(e) => setMessageInput(e.target.value)}
										onKeyDown={(e) =>
											e.key === "Enter" &&
											!e.shiftKey &&
											(e.preventDefault(), sendMessage())
										}
										placeholder="Type a message..."
										className="flex-1 bg-transparent border-none outline-none text-primary placeholder:text-subtle resize-none max-h-[100px] py-3"
										rows={1}
										style={{ minHeight: "24px" }}
									/>

									{/* Right Side Icons */}
									<div className="flex items-center gap-2">
										<div className="relative">
											<Smile
												onClick={() => setShowEmojiPicker(!showEmojiPicker)}
												className="w-6 h-6 text-muted cursor-pointer hover:text-primary transition-colors"
											/>
											{showEmojiPicker && (
												<div className="absolute bottom-12 right-0 z-dropdown animate-rise ws-emoji-picker">
													<EmojiPicker
														theme={
															resolvedTheme === "light"
																? Theme.LIGHT
																: Theme.DARK
														}
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
												className="p-2 bg-brand text-brand-on rounded-pill hover:bg-brand-active transition-colors disabled:opacity-50 cursor-pointer"
											>
												<Send className="w-4 h-4" />
											</button>
										) : (
											<Mic
												onClick={startRecording}
												className="w-6 h-6 text-muted cursor-pointer hover:text-primary transition-colors"
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
						"flex-1 flex flex-col items-center justify-center text-muted p-8",
						conversations.length > 0 ? "hidden md:flex" : "flex",
					)}
				>
					<div className="max-w-md flex flex-col items-center text-center space-y-6">
						<div className="flex h-16 w-16 items-center justify-center rounded-pill bg-raised">
							<MessageCircle
								className="h-[26px] w-[26px] text-muted"
								strokeWidth={2}
							/>
						</div>
						<div className="space-y-2">
							<h3 className="font-display text-lg font-semibold text-primary">
								Select a conversation or start a new one
							</h3>
							<p className="text-sm text-muted">
								Choose from your existing conversations or start a new chat
							</p>
						</div>
						<button
							type="button"
							onClick={() => setShowNewConversationModal(true)}
							className="flex items-center gap-2 px-6 py-3 bg-brand text-brand-on font-semibold rounded-pill hover:bg-brand-active transition-colors cursor-pointer"
						>
							<UserPlus className="w-5 h-5" />
							New Conversation
						</button>
					</div>
				</div>
			)}

			{/* New Conversation Modal */}
			<NewConversationModal
				isOpen={showNewConversationModal}
				onClose={() => setShowNewConversationModal(false)}
				currentUserId={user?.id || ""}
				onConversationStarted={(conversationId) => {
					fetchConversations();
					router.push(`/messages/${conversationId}`);
				}}
			/>
		</div>
	);
};

export default MessageBox;
