"use client";

import { useState, useEffect, useRef, useCallback,
	Fragment,
} from "react";
import { VideoPlayer } from "@/components/ui/VideoPlayer";
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
	Play,} from "lucide-react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { Badge } from "@/components/ui/Badge";
import { SafeAvatar } from "@/components/ui/SafeAvatar";
import axios from "axios";
import { useUser, useAuth } from "@clerk/nextjs";
import { useChannel, ChannelProvider } from "ably/react";
import EmojiPicker, { Theme } from "emoji-picker-react";
import { useTheme } from "next-themes";
import { useT } from "@/i18n/client";
import { getUserStoriesAction } from "@/lib/stories.actions";
import { StoryViewer, type RailEntry } from "@/components/feed/StoryViewer";
import { toast } from "sonner";
import { useToast } from "@/components/ui/Toast/ToastContext";
import { format } from "date-fns";
import { formatTimeAgo } from "@/lib/utils";
import { useRealtime } from "../providers/RealtimeProvider";
import MediaModal from "../ui/MediaModal";
import { PencilSimple } from "@phosphor-icons/react";
import MediaEditor from "@/components/editor/MediaEditor";
import { VoiceMessage } from "./VoiceMessage";
import { ConversationList } from "./ConversationList";
import { StoriesRail } from "@/components/feed/StoriesRail";
import { GIPHY_KEY, GifPicker } from "./GifPicker";
import { AnimatePresence, motion } from "framer-motion";
import { useCall } from "@/providers/CallProvider";
import { useChatSignals } from "@/hooks/useChatSignals";
import { TypingIndicator } from "@/components/messages/TypingIndicator";
import { MessageTicks, tickStateFor } from "@/components/messages/MessageTicks";
import { CallLogRow } from "@/components/messages/CallLogRow";
import { BACKEND_ORIGIN } from "@/const";

const API_URL = BACKEND_ORIGIN;
import { useAtom, useSetAtom } from "jotai";
import { useAtomValue } from "jotai";
import { onlineIdsAtom } from "@/store/ui.atom";
import { activeConversationIdAtom, messageCacheAtom, unreadMessagesCountAtom } from "@/store/messageCache";
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
	// "call" is a finished call logged into the thread, not something typed.
	type: "text" | "image" | "video" | "audio" | "file" | "call";
	mediaUrl?: string;
	/** Present when this message is a reply to a story. */
	storyRef?: { story: string; thumbnail: string; authorUsername: string };
	createdAt: string;
}

/**
 * "Today" / "Yesterday" / a date. Read months later, a bare "h:mm a" on every
 * bubble tells you the time of day and nothing about the day.
 */
/**
 * Links in messages are links. Full RichText (cashtags, mentions, hashtag
 * routing) belongs to posts; a DM needs exactly one thing — a pasted URL you
 * can tap — so this is a five-line split, not a dependency on the feed.
 */
const URL_RE = /(https?:\/\/[^\s<]+)/g;
function linkify(text: string) {
	return text.split(URL_RE).map((part, i) =>
		URL_RE.test(part) ? (
			<a
				// biome-ignore lint/suspicious/noArrayIndexKey: static split of one string
				key={i}
				href={part}
				target="_blank"
				rel="noopener noreferrer"
				className="break-all underline underline-offset-2 opacity-90 hover:opacity-100"
				onClick={(e) => e.stopPropagation()}
			>
				{part}
			</a>
		) : (
			part
		),
	);
}

function dayLabel(iso: string) {
	const d = new Date(iso);
	const today = new Date();
	const yday = new Date();
	yday.setDate(today.getDate() - 1);
	if (d.toDateString() === today.toDateString()) return "Today";
	if (d.toDateString() === yday.toDateString()) return "Yesterday";
	return format(d, d.getFullYear() === today.getFullYear() ? "MMM d" : "MMM d, yyyy");
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
	const [retryKey, setRetryKey] = useState(0);
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
			// w-full + max-w so the tile shrinks with the bubble instead of
			// forcing it wider than the message pane on small screens.
			<div className="relative w-full max-w-[256px] aspect-square rounded-lg overflow-hidden mb-1 bg-sunken flex items-center justify-center border border-hairline">
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
				"relative w-full max-w-[280px] cursor-zoom-in overflow-hidden rounded-xl transition-opacity hover:opacity-95",
				isTemp && "opacity-70",
			)}
		>
			{isTemp && (
				<div className="absolute inset-0 z-10 bg-page/20 animate-pulse" />
			)}
			{type === "image" ? (
				<div className="relative w-full aspect-square bg-sunken">
					{/* R2 is eventually consistent: the URL the upload returns can
					    404 for a beat, and the browser's broken-image glyph made a
					    just-sent picture look failed. Retry quietly instead. */}
					<img
						key={retryKey}
						src={displaySrc}
						alt="attachment"
						className="h-full w-full object-cover"
						onError={() => {
							if (retryKey < 4)
								setTimeout(
									() => setRetryKey((k) => k + 1),
									600 * (retryKey + 1),
								);
						}}
					/>
				</div>
			) : (
				/* A tile, not an inline player. The full control bar crammed into
				   a 256px bubble was unreadable; the lightbox is one tap away and
				   has room for real controls. */
				<div className="relative w-full bg-sunken">
					{/* eslint-disable-next-line jsx-a11y/media-has-caption */}
					<video
						src={`${displaySrc}#t=0.1`}
						preload="metadata"
						muted
						playsInline
						className="max-h-64 w-full object-cover"
					/>
					<span className="absolute inset-0 flex items-center justify-center">
						<span className="flex h-12 w-12 items-center justify-center rounded-pill bg-scrim text-primary">
							<Play className="ml-0.5 h-5 w-5" fill="currentColor" />
						</span>
					</span>
				</div>
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
	const t = useT();
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
	const setUnreadMessages = useSetAtom(unreadMessagesCountAtom);
	const setActiveConversationId = useSetAtom(activeConversationIdAtom);
	// A story opened from a reply thumbnail. Fetched on click rather than
	// stored on the message: the ref outlives the story, so availability has
	// to be answered at tap time.
	const [storyEntry, setStoryEntry] = useState<RailEntry | null>(null);
	const { toast: appToast } = useToast();

	const openStoryRef = async (ref: {
		story: string;
		authorUsername: string;
	}) => {
		const res = await getUserStoriesAction(ref.authorUsername);
		const entry = res.entry;
		if (entry?.stories?.some((st: any) => String(st.id) === ref.story)) {
			setStoryEntry(entry);
		} else {
			appToast(t("story.expired"), { type: "error" });
		}
	};
	// Tell the global listener which thread is on screen, so it suppresses the
	// badge for this conversation only.
	useEffect(() => {
		setActiveConversationId(activeConversation?._id ?? null);
		return () => setActiveConversationId(null);
	}, [activeConversation?._id, setActiveConversationId]);

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
	const [showGifPicker, setShowGifPicker] = useState(false);
	// Picker follows the app theme instead of hardcoding dark.
	const { resolvedTheme } = useTheme();
	const [showNewConversationModal, setShowNewConversationModal] = useState(false);
	// The header count is the sum of the rows, derived — never its own state.
	// A second copy of a number that is already on screen is a number that
	// will disagree with it.
	// Global presence first, thread presence second. The per-conversation set
	// only contains people who have THIS thread open, so on its own it read
	// "offline" for someone plainly using the app in another tab.
	const onlineIds = useAtomValue(onlineIdsAtom);
	const totalUnread = conversations.reduce(
		(n, c) => n + (c.unreadCount || 0),
		0,
	);

	const messagesEndRef = useRef<HTMLDivElement>(null);
	const activeIdRef = useRef<string | null>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const searchInputRef = useRef<HTMLInputElement>(null);
	const mediaRecorderRef = useRef<MediaRecorder | null>(null);
	const audioChunksRef = useRef<Blob[]>([]);

	const [isRecording, setIsRecording] = useState(false);
	const [recordingDuration, setRecordingDuration] = useState(0);

	const [selectedFile, setSelectedFile] = useState<File | null>(null);
	const [editingAttachment, setEditingAttachment] = useState(false);
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


	/** A GIF is just an image message whose URL lives on GIPHY's CDN. */
	const sendGif = async (url: string) => {
		if (!activeConversation || !myProfileId) return;
		const tempId = `temp-${Date.now()}`;
		setMessageCache((prev) => ({
			...prev,
			[activeConversation._id]: [
				...(prev[activeConversation._id] || []),
				{
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
					type: "image",
					mediaUrl: url,
					createdAt: new Date().toISOString(),
				},
			],
		}));
		scrollToBottom();
		try {
			const token = await getToken();
			const response = await axios.post(
				`${API_URL}/api/messages`,
				{
					conversationId: activeConversation._id,
					content: "",
					type: "image",
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
		} catch (error: any) {
			toast.error(error?.response?.data?.message || "Failed to send GIF");
			setMessageCache((prev) => ({
				...prev,
				[activeConversation._id]: (prev[activeConversation._id] || []).filter(
					(m) => m._id !== tempId,
				),
			}));
		}
	};

	const sendAudioMessage = async (audioBlob: Blob) => {
		if (!activeConversation || !myProfileId) return;

		const formData = new FormData();
		formData.append("file", audioBlob, "voice-note.webm");
		// Outside the try so the catch can roll the optimistic bubble back.
		const tempId = `temp-${Date.now()}`;

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
					// The recorder counts this anyway; sending it lets the inbox
					// preview say "0:23" instead of just "Voice note".
					durationSec: recordingDuration,
				},
				{ headers: { Authorization: `Bearer ${token}` } },
			);

			setMessageCache((prev) => ({
				...prev,
				[activeConversation._id]: (prev[activeConversation._id] || []).map(
					(m) => (m._id === tempId ? response.data : m),
				),
			}));
		} catch (error: any) {
			console.error("Failed to send audio", error);
			// The gateway refuses with a sentence worth reading — "You can
			// only message or call people who follow you back" is a rule, and
			// a generic "failed" sends the user off debugging their mic.
			toast.error(
				error?.response?.data?.message || "Failed to send voice note",
			);
			// The optimistic bubble stayed in the thread on failure, so a
			// refused voice note LOOKED sent and silently never arrived.
			setMessageCache((prev) => ({
				...prev,
				[activeConversation._id]: (prev[activeConversation._id] || []).filter(
					(m) => m._id !== tempId,
				),
			}));
		}
	};

	// Sync ref with state so real-time listener stays updated
	useEffect(() => {
		activeIdRef.current = activeConversation?._id || null;
		if (activeConversation?._id) {
			markAsRead(activeConversation._id);
			chatRef.current.notifyRead();
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

	// Pre-send edit: the Studio sheet swaps the attachment in place, so the
	// existing upload path (POST /api/messages/upload) is untouched.
	const applyEditedAttachment = (file: File) => {
		if (previewUrl) URL.revokeObjectURL(previewUrl);
		setSelectedFile(file);
		setPreviewUrl(URL.createObjectURL(file));
		setEditingAttachment(false);
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
			// Drop this thread's share of the nav badge too. Patching only the
			// local row left the badge stuck until a reload.
			setConversations((prev) => {
				const cleared = prev.find((c) => c._id === conversationId);
				if (cleared?.unreadCount)
					setUnreadMessages((n) => Math.max(0, n - cleared.unreadCount));
				return prev.map((c) =>
					c._id === conversationId ? { ...c, unreadCount: 0 } : c,
				);
			});
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
				// Their message reached a client that is showing it — both
				// receipts are true at the same instant.
				chatRef.current.notifyDelivered();
				chatRef.current.notifyRead();
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
		chat.notifyStoppedTyping();
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
		} catch (error: any) {
			console.error("Failed to send", error);
			// Same rule as the voice path: a 403 carries the actual reason.
			toast.error(error?.response?.data?.message || "Failed to send message");
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

	// Typing / presence / receipts. Ephemeral signals go client-to-client on the
	// conversation channel; only "read" is persisted.
	const chat = useChatSignals({
		conversationId: activeConversation?._id ?? null,
		myProfileId: myProfileId ?? null,
	});
	const peerOnline =
		chat.peerOnline ||
		(!!activeConversation?.otherParticipant?._id &&
			onlineIds.has(activeConversation.otherParticipant._id));
	const chatRef = useRef(chat);
	chatRef.current = chat;

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
		// 100dvh, not 100vh: on mobile 100vh is the address-bar-expanded height,
		// so the composer sat below the fold until the bar collapsed.
		<div className="flex h-[100dvh] bg-page text-primary overflow-hidden">
			{myProfileId && isConnected && (
				<UserMessageSubscription
					channelName={`user:${myProfileId}`}
					onMessage={onMessage}
				/>
			)}
			{storyEntry && (
				<StoryViewer entry={storyEntry} onClose={() => setStoryEntry(null)} />
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
					"w-full md:w-[400px] shrink-0 min-w-0 border-r border-hairline flex flex-col",
					activeConversation ||
						(conversations.length === 0 && !isLoadingConversations)
						? "hidden md:flex"
						: "flex",
				)}
			>
				<div className="border-b border-hairline px-4 pb-3 pt-4">
					<div className="mb-3 flex items-center gap-2">
						<h1 className="font-display text-lg font-semibold">
							{t("nav.messages")}
						</h1>
						{totalUnread > 0 && (
							<span className="flex h-5 min-w-5 items-center justify-center rounded-pill bg-brand px-1.5 font-sans text-[11px] font-bold tabular-nums text-brand-on">
								{totalUnread}
							</span>
						)}
						<button
							type="button"
							onClick={() => setShowNewConversationModal(true)}
							aria-label={t("messages.newChat")}
							className="ml-auto flex h-9 w-9 cursor-pointer items-center justify-center rounded-pill bg-chip text-muted transition-colors hover:text-primary"
						>
							<PencilSimple size={16} weight="bold" />
						</button>
					</div>
					<div className="relative">
						<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
						<input
							type="text"
							placeholder={t("messages.searchPlaceholder")}
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							ref={searchInputRef}
							// text-base below sm stops iOS zooming the pane on focus.
							className="w-full rounded-pill bg-sunken py-2.5 pl-10 pr-4 text-base text-primary outline-none transition-colors placeholder:text-subtle focus:bg-raised sm:text-sm"
						/>
					</div>
				</div>

				{/* pb-nav: the conversation list is the one messages view where the
				    fixed mobile bottom nav is still on screen. */}
				<div className="flex-1 overflow-y-auto overscroll-contain pb-nav md:pb-0">
					{/* Stories of the people you're aligned with — messaging is
					    where you already are when you want to reply to one. */}
					<div className="border-b border-hairline px-2 pt-2">
						<StoriesRail />
					</div>
					<ConversationList
						conversations={conversations as any}
						loading={isLoadingConversations}
						query={searchQuery}
						activeId={activeConversation?._id}
						myProfileId={myProfileId}
						onOpen={(conv) => {
							setActiveConversation(conv as any);
							router.push(`/messages/${conv._id}`);
						}}
					/>
				</div>
			</div>

			{/* Chat Area */}
			{activeConversation ? (
				<div className="flex-1 min-w-0 flex flex-col">
					<div className="flex h-16 shrink-0 items-center justify-between gap-2 border-b border-hairline bg-page/80 px-2 backdrop-blur-xl md:px-6">
						<div className="flex items-center gap-2 md:gap-3 min-w-0">
							<button
								type="button"
								onClick={() => setActiveConversation(null)}
								aria-label="Back to conversations"
								className="md:hidden h-11 w-11 shrink-0 flex items-center justify-center rounded-pill text-muted hover:text-primary hover:bg-raised transition-colors"
							>
								<ArrowLeft className="w-5 h-5" />
							</button>
							<span className="relative shrink-0">
								<SafeAvatar
									src={activeConversation.otherParticipant.avatar}
									width={40}
									height={40}
									className="h-10 w-10 rounded-pill object-cover"
									alt="avatar"
								/>
								{/* The dot belongs on the face, not in a line of text
								    below it — it is the first thing you look for. */}
								{peerOnline && (
									<span
										aria-hidden
										className="absolute bottom-0 right-0 h-3 w-3 rounded-pill bg-success ring-2 ring-page"
									/>
								)}
							</span>
							<div className="min-w-0">
								<h2 className="font-semibold text-sm truncate">
									{activeConversation.otherParticipant.firstName}{" "}
									{activeConversation.otherParticipant.lastName}
								</h2>
								{chat.peerTyping ? (
									<p className="text-xs text-gold truncate">typing…</p>
								) : peerOnline ? (
									<p className="flex items-center gap-1.5 text-xs text-muted truncate">
										<span className="h-1.5 w-1.5 shrink-0 rounded-pill bg-success" />
										Online
									</p>
								) : (activeConversation.otherParticipant as any)
										?.lastSeenAt ? (
									<p className="truncate text-xs text-muted">
										Last seen{" "}
										{formatTimeAgo(
											(activeConversation.otherParticipant as any)
												.lastSeenAt,
										)}
									</p>
								) : (
									<p className="text-xs text-muted truncate">
										@{activeConversation.otherParticipant.username}
									</p>
								)}
							</div>
						</div>
						<div className="flex shrink-0 text-muted">
							<button
								type="button"
								aria-label="Start voice call"
								className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-pill text-muted transition-colors hover:bg-chip hover:text-primary md:h-10 md:w-10"
								onClick={() =>
									startCall({
										conversationId: activeConversation._id,
										peer: {
											id: activeConversation.otherParticipant?._id || "",
											name:
												`${activeConversation.otherParticipant?.firstName || ""} ${activeConversation.otherParticipant?.lastName || ""}`.trim() ||
												activeConversation.otherParticipant?.username ||
												"",
											avatar: activeConversation.otherParticipant?.avatar || "",
											username:
												activeConversation.otherParticipant?.username || "",
										},
										isVideo: false,
									})
								}
							>
								<Phone className="w-5 h-5" />
							</button>
							<button
								type="button"
								aria-label="Start video call"
								className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-pill text-muted transition-colors hover:bg-chip hover:text-primary md:h-10 md:w-10"
								onClick={() =>
									startCall({
										conversationId: activeConversation._id,
										peer: {
											id: activeConversation.otherParticipant?._id || "",
											name:
												`${activeConversation.otherParticipant?.firstName || ""} ${activeConversation.otherParticipant?.lastName || ""}`.trim() ||
												activeConversation.otherParticipant?.username ||
												"",
											avatar: activeConversation.otherParticipant?.avatar || "",
											username:
												activeConversation.otherParticipant?.username || "",
										},
										isVideo: true,
									})
								}
							>
								<Video className="w-5 h-5" />
							</button>
						</div>
					</div>

					<div className="flex-1 min-h-0 overflow-y-auto overscroll-contain bg-sunken/30 px-4 py-4 sm:p-6">
						{isLoadingMessages && (
							<div className="text-center text-muted font-sans text-sm">
								Loading history...
							</div>
						)}
						{messages.map((m, mi) => {
							const isMe =
								m.sender._id === myProfileId || m._id.startsWith("temp-");
							const prev = messages[mi - 1];
							const next = messages[mi + 1];
							// A day separator wherever the calendar turns over, so a
							// thread read months later still says when things happened.
							const showDay =
								!prev ||
								new Date(prev.createdAt).toDateString() !==
									new Date(m.createdAt).toDateString();
							// A run is the same person inside five minutes. Without
							// this, five quick lines rendered as five separate events,
							// each with its own timestamp — the visual weight of a
							// conversation that never happened that way.
							const sameRunAsPrev =
								!!prev &&
								prev.type !== "call" &&
								(prev.sender._id === m.sender._id ||
									(isMe && prev._id.startsWith("temp-"))) &&
								!showDay &&
								new Date(m.createdAt).getTime() -
									new Date(prev.createdAt).getTime() <
									5 * 60 * 1000;
							const endsRun =
								!next ||
								next.type === "call" ||
								next.sender._id !== m.sender._id ||
								new Date(next.createdAt).getTime() -
									new Date(m.createdAt).getTime() >=
									5 * 60 * 1000 ||
								new Date(next.createdAt).toDateString() !==
									new Date(m.createdAt).toDateString();
							// A call isn't something either side said, so it gets a
							// centred chip instead of a bubble on one shore.
							if (m.type === "call") {
								return (
									<CallLogRow
										key={m._id}
										content={m.content}
										at={m.createdAt}
										onCallBack={(video) =>
											startCall({
												conversationId: activeConversation._id,
												peer: {
													id: activeConversation.otherParticipant?._id || "",
													name:
														`${activeConversation.otherParticipant?.firstName || ""} ${activeConversation.otherParticipant?.lastName || ""}`.trim() ||
														activeConversation.otherParticipant?.username ||
														"",
													avatar:
														activeConversation.otherParticipant?.avatar || "",
													username:
														activeConversation.otherParticipant?.username ||
														"",
												},
												isVideo: video,
											})
										}
									/>
								);
							}
							return (
								<Fragment key={m._id}>
									{showDay && (
										<div className="flex justify-center py-2">
											<span className="rounded-pill bg-raised px-3 py-1 font-sans text-[11px] font-semibold text-muted">
												{dayLabel(m.createdAt)}
											</span>
										</div>
									)}
								<div
									className={clsx(
										"flex flex-col",
										sameRunAsPrev ? "mt-0.5" : "mt-4",
										isMe ? "items-end" : "items-start",
									)}
								>
									<div
										className={clsx(
											// 70% of a 272px pane is 190px — too narrow to
											// hold a sentence without shredding it. Phones
											// get 85%, desktop keeps the original ratio.
											"max-w-[85%] sm:max-w-[70%] min-w-0 overflow-hidden rounded-xl",
											// Media IS the bubble: a picture wrapped in a
											// coloured card with padding read as a picture
											// in an envelope. Text keeps the padded fill.
											(m.type === "image" || m.type === "video") &&
												!m.content
												? "p-0"
												: "px-3.5 py-2 sm:px-4",
											// Run-aware corners: inside a run, the corners that
											// face the neighbouring bubble flatten, so a burst
											// reads as one utterance in parts — the messenger
											// grammar — instead of a stack of identical pills.
											isMe
												? [
														(m.type === "image" || m.type === "video") &&
														!m.content
															? "text-brand-on"
															: "bg-brand text-brand-on",
														sameRunAsPrev && "rounded-tr-[4px]",
														!endsRun && "rounded-br-[4px]",
													]
												: [
														(m.type === "image" || m.type === "video") &&
														!m.content
															? "text-primary"
															: "bg-raised text-primary",
														sameRunAsPrev && "rounded-tl-[4px]",
														!endsRun && "rounded-bl-[4px]",
													],
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
											// Was a hard w-64 (256px) inside a bubble that can
											// only be ~190px wide on a 320px screen — it blew
											// the bubble out of the pane.
											<div className="relative w-full max-w-[256px] mb-1">
												<VoiceMessage src={m.mediaUrl} isMe={isMe} />
											</div>
										)}
										{m.storyRef && (
											<button
												type="button"
												onClick={() =>
													m.storyRef && void openStoryRef(m.storyRef)
												}
												className="relative mb-1.5 block h-40 w-28 cursor-pointer overflow-hidden rounded-lg border border-current/15 transition-opacity hover:opacity-90"
												aria-label={t("story.viewStory")}
											>
												{/* eslint-disable-next-line @next/next/no-img-element */}
												<img
													src={m.storyRef.thumbnail}
													alt=""
													className="h-full w-full object-cover"
												/>
												<span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#0c0a09]/85 to-transparent px-2 pb-1.5 pt-5 text-left font-sans text-[10px] font-semibold text-[#fafaf9]/90">
													{t("story.viewStory")}
												</span>
											</button>
										)}
										{m.content && (
											<p
												className={clsx(
													// break-words: a pasted URL with no spaces
													// used to widen the bubble past the pane.
													"text-sm leading-relaxed break-words whitespace-pre-wrap",
													m.mediaUrl && "mt-2",
												)}
											>
												{linkify(m.content)}
											</p>
										)}
									</div>
									{/* One stamp per run, on its last line. A time under
									    every bubble is noise the eye has to step over. */}
									{endsRun && (
										<span className="mt-1 flex items-center gap-1 font-sans text-[11px] tabular-nums text-subtle">
											{format(new Date(m.createdAt), "h:mm a")}
											{isMe && (
												<MessageTicks
													state={tickStateFor({
														id: m._id,
														createdAt: m.createdAt,
														deliveredAt: chat.deliveredAt,
														readAt: chat.readAt,
													})}
												/>
											)}
										</span>
									)}
								</div>
								</Fragment>
							);
						})}
						{chat.peerTyping && <TypingIndicator />}
						<div ref={messagesEndRef} />
					</div>

					{/* shrink-0 + pb-safe: the composer is the flex row that must never
					    be squeezed out, and it sits on the iOS home indicator. */}
					<div className="shrink-0 p-3 sm:p-4 border-t border-hairline bg-page pb-safe">
						{/* Preview Area */}
						{selectedFile && previewUrl && (
							<div className="mb-2 relative inline-block">
								<div className="relative overflow-hidden rounded-xl bg-sunken">
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
									type="button"
									onClick={clearSelectedFile}
									aria-label="Remove attachment"
									className="absolute -right-2.5 -top-2.5 flex h-9 w-9 items-center justify-center rounded-pill bg-raised text-muted transition-colors hover:text-primary"
								>
									<X className="w-3.5 h-3.5" />
								</button>
 {/* Images only the editor can't decode video. */}
								{selectedFile.type.startsWith("image/") && (
									<button
										type="button"
										onClick={() => setEditingAttachment(true)}
										aria-label="Edit image"
										className="absolute -left-2.5 -top-2.5 flex h-9 w-9 items-center justify-center rounded-pill bg-raised text-muted transition-colors hover:text-primary"
									>
										<PencilSimple size={15} weight="bold" />
									</button>
								)}
							</div>
						)}

						{editingAttachment && selectedFile && (
							<MediaEditor
								file={selectedFile}
								title="Edit image"
								onClose={() => setEditingAttachment(false)}
								onSave={({ file }) => applyEditedAttachment(file)}
							/>
						)}

						<div className="flex items-center gap-2 sm:gap-3 relative">

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
								<div className="flex h-[56px] min-w-0 flex-1 items-center gap-2 rounded-pill bg-sunken px-3 sm:gap-4 sm:px-6">
									{/* Recording dot sanctioned live-state loop (06-motion):
										    opacity-only pulse while recording is active. */}
										<div className="w-3 h-3 shrink-0 rounded-full bg-danger animate-pulse" />
									<div className="flex-1 min-w-0 font-sans tabular-nums text-primary text-sm sm:text-base">
										{Math.floor(recordingDuration / 60)}:
										{(recordingDuration % 60).toString().padStart(2, "0")}
									</div>
									<button
										type="button"
										onClick={cancelRecording}
										className="shrink-0 h-11 px-2 flex items-center text-sm text-muted hover:text-primary transition-colors cursor-pointer"
									>
										Cancel
									</button>
									<button
										type="button"
										onClick={stopRecording}
										aria-label="Send voice message"
										className="flex h-10 w-10 shrink-0 items-center justify-center bg-primary text-page rounded-pill hover:bg-muted transition-colors cursor-pointer"
									>
										<Send className="w-4 h-4" />
									</button>
								</div>
							) : (
								/* A fill that lifts on focus. The bordered card read as
								   a form field in an app that has none anywhere else. */
								<div className="flex min-w-0 flex-1 items-end gap-1 rounded-2xl bg-sunken py-1.5 pl-1.5 pr-2 transition-colors focus-within:bg-raised sm:gap-2">
									{/* Attach lives INSIDE the pill. A row of loose parts —
									    plus, field, icons — read as a toolbar; a messenger
									    composer is one object with everything in reach. */}
									<button
										type="button"
										// Straight to the picker. The photo/video tile menu
										// was one extra tap that answered a question the OS
										// file sheet already asks.
										onClick={() => fileInputRef.current?.click()}
										aria-label="Attach a file"
										className="mb-0.5 flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-pill text-muted transition-colors hover:bg-chip hover:text-primary"
									>
										<Plus className="w-5 h-5" />
									</button>
									<textarea
										value={messageInput}
										onChange={(e) => {
											setMessageInput(e.target.value);
											if (e.target.value) chat.notifyTyping();
											else chat.notifyStoppedTyping();
										}}
										onKeyDown={(e) =>
											e.key === "Enter" &&
											!e.shiftKey &&
											(e.preventDefault(), sendMessage())
										}
										placeholder="Type a message..."
										// text-base: a sub-16px message field is the classic
										// iOS "page zooms in when you start typing" trigger.
										className="flex-1 min-w-0 bg-transparent border-none outline-none text-base text-primary placeholder:text-subtle resize-none max-h-[100px] py-2.5"
										rows={1}
										style={{ minHeight: "24px" }}
									/>

									{/* Right Side Icons */}
									<div className="flex items-center shrink-0">
										{GIPHY_KEY && (
											<button
												type="button"
												onClick={() => setShowGifPicker(true)}
												aria-label="Send a GIF"
												className="flex h-10 cursor-pointer items-center justify-center rounded-pill px-1.5 font-sans text-[11px] font-bold tracking-wide text-muted transition-colors hover:bg-chip hover:text-primary"
											>
												GIF
											</button>
										)}
										<div className="relative">
											<button
												type="button"
												onClick={() => setShowEmojiPicker(!showEmojiPicker)}
												aria-label="Insert emoji"
												className="flex h-10 w-10 items-center justify-center rounded-pill text-muted hover:text-primary hover:bg-raised transition-colors cursor-pointer"
											>
												<Smile className="w-6 h-6" />
											</button>
											{showEmojiPicker && (
												// The default picker is ~350px wide anchored to
												// the right edge of a field that starts ~60px in
												// — it ran off both sides on a phone. Clamp to
												// the viewport and let it fill that width.
												<div className="fixed left-1/2 bottom-24 -translate-x-1/2 sm:absolute sm:left-auto sm:bottom-12 sm:right-0 sm:translate-x-0 w-[min(320px,calc(100vw-1.5rem))] z-dropdown animate-rise ws-emoji-picker">
													<EmojiPicker
														theme={
															resolvedTheme === "light"
																? Theme.LIGHT
																: Theme.DARK
														}
														width="100%"
														height={360}
														lazyLoadEmojis={true}
														onEmojiClick={(e) =>
															setMessageInput((p) => p + e.emoji)
														}
													/>
												</div>
											)}
										</div>

										{messageInput.trim() || selectedFile ? (
											<button
												type="button"
												onClick={sendMessage}
												disabled={isUploading}
												aria-label="Send message"
												className="flex h-9 w-9 items-center justify-center bg-brand text-brand-on rounded-pill hover:bg-brand-active transition-colors disabled:opacity-50 cursor-pointer"
											>
												<Send className="w-4 h-4" />
											</button>
										) : (
											<button
												type="button"
												onClick={startRecording}
												aria-label="Record a voice message"
												className="flex h-10 w-10 items-center justify-center rounded-pill text-muted hover:text-primary hover:bg-raised transition-colors cursor-pointer"
											>
												<Mic className="w-6 h-6" />
											</button>
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
								{t("messages.selectTitle")}
							</h3>
							<p className="text-sm text-muted">
								{t("messages.selectCaption")}
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
			<GifPicker
				open={showGifPicker}
				onClose={() => setShowGifPicker(false)}
				onPick={(url) => void sendGif(url)}
			/>
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
