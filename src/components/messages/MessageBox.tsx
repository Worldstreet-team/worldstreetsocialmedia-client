"use client";

import { UserBadges } from "@/components/ui/UserBadges";
import { useBackWithFallback } from "@/lib/nav";
import Link from "next/link";

import dynamic from "next/dynamic";

import {
	useState,
	useEffect,
	useRef,
	useCallback,
	useMemo,
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
import { Tabs } from "@/components/ui/Tabs";
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
import {
	ArrowBendUpLeft,
	CurrencyDollarSimple,
	PencilSimple,
	UserCirclePlus,
	Tray,
	CopySimple,
	ArrowCounterClockwise,
	X as XIcon,
} from "@phosphor-icons/react";
// Loaded on first open, not on page load: the editors are the heaviest
// client code in the app and they render only when someone opens one. The
// host renders them conditionally, so next/dynamic defers the chunk until
// that first render.
const MediaEditor = dynamic(
	() => import("@/components/editor/MediaEditor"),
	{ ssr: false },
);
import { VoiceMessage } from "./VoiceMessage";
import { ConversationList } from "./ConversationList";
import { StoriesRail } from "@/components/feed/StoriesRail";
import { GIPHY_KEY, GifPicker } from "./GifPicker";
import { AnimatePresence, motion } from "framer-motion";
import { useCall } from "@/providers/CallProvider";
import { useChatSignals } from "@/hooks/useChatSignals";
import { TypingIndicator } from "@/components/messages/TypingIndicator";
import { MessageTicks, tickStateFor } from "@/components/messages/MessageTicks";
import { ThreadList } from "@/components/messages/thread/ThreadList";
import {
	ComposerInput,
	type ComposerInputHandle,
} from "@/components/messages/thread/ComposerInput";
import type { VirtuosoHandle } from "react-virtuoso";
import { imageMeta } from "@/lib/media-meta";
import { ThreadBackdrop } from "@/components/messages/thread/ThreadBackdrop";
import { WallpaperSheet } from "@/components/messages/thread/WallpaperSheet";
import {
	DEFAULT_WALLPAPER,
	type WallpaperSetting,
} from "@/components/messages/thread/wallpaper";
import { CallLogRow } from "@/components/messages/CallLogRow";
import { SendMoneySheet } from "@/components/messages/SendMoneySheet";
import { PaymentBubble } from "@/components/messages/PaymentBubble";
import { BACKEND_ORIGIN } from "@/const";

const API_URL = BACKEND_ORIGIN;
import { useAtom, useSetAtom } from "jotai";
import { useAtomValue } from "jotai";
import { onlineIdsAtom } from "@/store/ui.atom";
import { userAtom } from "@/store/user.atom";
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

/** One line describing a quoted message, whatever kind it is. */
function quotedPreview(r: {
	content?: string;
	type?: string;
	durationSec?: number;
}): string {
	if (r.content?.trim()) return r.content.trim();
	switch (r.type) {
		case "image":
			return "Photo";
		case "video":
			return "Video";
		case "audio":
			return r.durationSec
				? `Voice note · ${Math.floor(r.durationSec / 60)}:${String(
						Math.round(r.durationSec % 60),
					).padStart(2, "0")}`
				: "Voice note";
		case "payment":
			return "Payment";
		default:
			return "Message";
	}
}

interface Message {
	_id: string;
	conversationId: string;
	sender: UserProfile;
	content: string;
	// "call" is a finished call logged into the thread, not something typed.
	type: "text" | "image" | "video" | "audio" | "file" | "call" | "payment";
	/** USD minor units, payment messages only. */
	amountMinor?: number;
	/** Voice-note length, so a quoted voice note can say how long it is. */
	durationSec?: number;
	mediaUrl?: string;
	/** Present when this message is a reply to a story. */
	storyRef?: { story: string; thumbnail: string; authorUsername: string };
	/**
	 * The message this one answers, populated one level deep by the gateway.
	 * A reply to a reply quotes only its immediate parent, so nothing nests.
	 */
	replyTo?: {
		_id: string;
		content: string;
		type: Message["type"];
		mediaUrl?: string;
		durationSec?: number;
		sender?: { username?: string; firstName?: string; lastName?: string };
	} | null;
	createdAt: string;
	/** Sender-generated dedup id; doubles as the STABLE list key across the
	 *  optimistic→server swap, so a confirmed send never remounts. */
	clientKey?: string;
	width?: number;
	height?: number;
	thumbhash?: string;
	peaks?: number[];
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

const displayNameOf = (u?: { firstName?: string; lastName?: string; username?: string }) =>
	[u?.firstName, u?.lastName].filter(Boolean).join(" ") || u?.username || "This account";

interface Conversation {
	_id: string;
	participants: UserProfile[];
	lastMessage?: Message;
	lastMessageAt: string;
	unreadCount: number;
	otherParticipant: UserProfile;
	/** Open messaging: a stranger's thread waits on the Requests shelf —
	 *  quiet, unbadged — until accepted (replying accepts). */
	isRequestForMe?: boolean;
	status?: "accepted" | "request";
	/** Member records with high-water read marks (gateway W1). */
	members?: {
		profile: string | { _id: string };
		readUpTo?: string;
		readUpToAt?: string;
	}[];
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
			<div className="relative w-full max-w-[256px] aspect-square rounded-lg overflow-hidden mb-1 bg-sunken flex items-center justify-center">
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
	const goBack = useBackWithFallback();

	const [myProfileId, setMyProfileId] = useState<string | null>(null);
	const conversationsRef = useRef<Conversation[]>([]);
	const [conversations, setConversations] =
		useState<Conversation[]>(initialConversations);
	conversationsRef.current = conversations;
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
	// Virtuoso backwards-pagination plumbing (register items 24-25).
	const [firstItemIndex, setFirstItemIndex] = useState(100000);
	const [pendingNew, setPendingNew] = useState(0);
	// W2 skin: per-thread wallpaper + the send pulse that rotates gradients.
	const [wallpaper, setWallpaper] = useState<WallpaperSetting>(DEFAULT_WALLPAPER);
	const [wallpaperOpen, setWallpaperOpen] = useState(false);
	const [sendPulse, setSendPulse] = useState(0);
	const hasMoreOlderRef = useRef(true);
	const loadingOlderRef = useRef(false);
	const atBottomRef = useRef(true);
	const lastMarkRef = useRef(0);
	const virtuosoRef = useRef<VirtuosoHandle | null>(null);
	const composerRef = useRef<ComposerInputHandle | null>(null);
	const messageCacheRef = useRef(messageCache);
	messageCacheRef.current = messageCache;
	const myProfileIdRef = useRef<string | null>(null);
	const [messageInput, setMessageInput] = useState("");
	/** The message the composer is currently answering, if any. */
	const [replyTarget, setReplyTarget] = useState<Message | null>(null);
	// The hold/right-click menu on a bubble: Reply, Copy. Position is where
	// the finger or cursor was; closes on any tap elsewhere or Escape.
	const [pendingDeleteConv, setPendingDeleteConv] =
		useState<Conversation | null>(null);
	const [msgMenu, setMsgMenu] = useState<{
		x: number;
		y: number;
		message: Message;
	} | null>(null);
	const msgMenuOpenedAt = useRef(0);
	useEffect(() => {
		if (!msgMenu) return;
		msgMenuOpenedAt.current = Date.now();
		// The finger lifting off a long-press fires a click ~instantly after
		// the menu opens — without this grace it closed itself before it was
		// ever seen.
		const close = () => {
			if (Date.now() - msgMenuOpenedAt.current < 350) return;
			setMsgMenu(null);
		};
		const key = (e: KeyboardEvent) => {
			if (e.key === "Escape") close();
		};
		window.addEventListener("click", close);
		window.addEventListener("keydown", key);
		return () => {
			window.removeEventListener("click", close);
			window.removeEventListener("keydown", key);
		};
	}, [msgMenu]);
	// Gestures live inside MessageBubble now (refs + direct style writes);
	// the parent no longer re-renders the thread per touchmove.
	/** Briefly highlighted after a jump, so the eye lands on the right bubble. */
	const [flashedId, setFlashedId] = useState<string | null>(null);

	/**
	 * Scroll to a quoted message and flash it.
	 *
	 * Only works for messages already rendered — the thread loads whole, so in
	 * practice that is all of them. A quote whose original is missing (deleted,
	 * or not yet loaded) simply does nothing rather than jumping somewhere
	 * arbitrary.
	 */
	// Escape backs out of a reply. Bound only while one is pending, so it never
	// competes with the modals and sheets that also listen for Escape.
	useEffect(() => {
		if (!replyTarget) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") setReplyTarget(null);
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [replyTarget]);

	const jumpToMessage = useCallback(
		(id: string) => {
			const conv = activeIdRef.current;
			const list = conv ? messageCacheRef.current[conv] || [] : [];
			const idx = list.findIndex((mm) => mm._id === id);
			if (idx < 0) return;
			virtuosoRef.current?.scrollToIndex({
				index: firstItemIndex + idx,
				align: "center",
				behavior: "smooth",
			});
			setFlashedId(id);
			setTimeout(() => setFlashedId((cur) => (cur === id ? null : cur)), 1200);
		},
		[firstItemIndex],
	);
	const [searchQuery, setSearchQuery] = useState("");
	const [isLoadingConversations, setIsLoadingConversations] = useState(
		initialConversations.length === 0,
	);
	const [isLoadingMessages, setIsLoadingMessages] = useState(false);
	const [showAttachMenu, setShowAttachMenu] = useState(false);
	const [showEmojiPicker, setShowEmojiPicker] = useState(false);
	const [showGifPicker, setShowGifPicker] = useState(false);
	const [showSendMoney, setShowSendMoney] = useState(false);
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
	// The PROFILE avatar, not Clerk's: they can differ, and every other
	// surface renders the profile one — an optimistic bubble that wears a
	// different face than your posts reads as someone else talking.
	const me = useAtomValue(userAtom);
	// Requests are OUT of the number on the nav — quiet by design. Their
	// shelf carries its own count instead.
	const inboxConversations = conversations.filter((c) => !c.isRequestForMe);
	const requestConversations = conversations.filter((c) => c.isRequestForMe);
	const [showRequests, setShowRequests] = useState(false);
	const totalUnread = inboxConversations.reduce(
		(n, c) => n + (c.unreadCount || 0),
		0,
	);

	const unsendMessage = useCallback(
		async (message: Message) => {
			// Optimistic: the bubble goes now; a failure puts it back.
			const convoId = activeIdRef.current;
			if (!convoId) return;
			setMessageCache((prev) => ({
				...prev,
				[convoId]: (prev[convoId] ?? []).filter(
					(m) => m._id !== message._id,
				),
			}));
			try {
				const token = await getToken();
				const r = await fetch(
					`${API_URL}/api/messages/message/${message._id}`,
					{
						method: "DELETE",
						headers: { Authorization: `Bearer ${token}` },
					},
				);
				if (!r.ok) throw new Error(String(r.status));
			} catch {
				setMessageCache((prev) => ({
					...prev,
					[convoId]: [...(prev[convoId] ?? []), message].sort(
						(a, b) =>
							new Date(a.createdAt).getTime() -
							new Date(b.createdAt).getTime(),
					),
				}));
				toast.error("Couldn't unsend that message");
			}
		},
		[getToken, setMessageCache],
	);

	const acceptRequest = useCallback(
		async (conversationId: string) => {
			try {
				const token = await getToken();
				await fetch(
					`${API_URL}/api/messages/conversations/${conversationId}/accept`,
					{
						method: "POST",
						headers: { Authorization: `Bearer ${token}` },
					},
				);
				setConversations((prev) =>
					prev.map((c) =>
						c._id === conversationId
							? { ...c, isRequestForMe: false, status: "accepted" }
							: c,
					),
				);
				setActiveConversation((prev) =>
					prev && prev._id === conversationId
						? { ...prev, isRequestForMe: false, status: "accepted" }
						: prev,
				);
			} catch {
				toast.error("Couldn't accept the request");
			}
		},
		[getToken],
	);

	const declineRequest = useCallback(
		async (conversationId: string) => {
			try {
				const token = await getToken();
				await fetch(
					`${API_URL}/api/messages/conversations/${conversationId}`,
					{
						method: "DELETE",
						headers: { Authorization: `Bearer ${token}` },
					},
				);
				setConversations((prev) =>
					prev.filter((c) => c._id !== conversationId),
				);
				setActiveConversation((prev) =>
					prev?._id === conversationId ? null : prev,
				);
			} catch {
				toast.error("Couldn't remove the conversation");
			}
		},
		[getToken],
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
						avatar: me?.avatar || user?.imageUrl || "",
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
		formData.append("conversationId", activeConversation._id);
		const tempId = `temp-${Date.now()}`;
		const clientKey =
			typeof crypto !== "undefined" && "randomUUID" in crypto
				? crypto.randomUUID()
				: `ck-${Date.now()}-${Math.random().toString(36).slice(2)}`;
		// Register item 20: the bubble exists BEFORE the upload — the only
		// send feedback used to be a toast while the network worked.
		const localUrl = URL.createObjectURL(audioBlob);
		const optimisticMessage: Message = {
			_id: tempId,
			clientKey,
			conversationId: activeConversation._id,
			sender: {
				_id: myProfileId,
				firstName: user?.firstName || "",
				lastName: user?.lastName || "",
				username: user?.username || "",
				avatar: me?.avatar || user?.imageUrl || "",
			},
			content: "",
			type: "audio",
			mediaUrl: localUrl,
			durationSec: recordingDuration,
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

		try {
			const token = await getToken();

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

			const key = uploadRes.data.key ?? uploadRes.data.url;

			const response = await axios.post(
				`${API_URL}/api/messages`,
				{
					conversationId: activeConversation._id,
					content: "",
					type: "audio",
					mediaUrl: key,
					// The recorder counts this anyway; sending it lets the inbox
					// preview say "0:23" instead of just "Voice note".
					durationSec: recordingDuration,
					clientKey,
				},
				{ headers: { Authorization: `Bearer ${token}` } },
			);

			setMessageCache((prev) => ({
				...prev,
				[activeConversation._id]: (prev[activeConversation._id] || []).map(
					(m) =>
						m._id === tempId
							? { ...response.data, clientKey }
							: m,
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
		virtuosoRef.current?.scrollToIndex({
			index: "LAST",
			behavior: behavior === "auto" ? "auto" : "smooth",
		});
	}, []);

	const markAsRead = async (conversationId: string, upTo?: string) => {
		// Batched: once per 1.5s per focus burst, not once per incoming
		// message (register item 13).
		const nowT = Date.now();
		if (nowT - lastMarkRef.current < 1500) return;
		lastMarkRef.current = nowT;
		try {
			const token = await getToken();
			await axios.post(
				`${API_URL}/api/messages/${conversationId}/read`,
				{ upTo },
				{
					headers: { Authorization: `Bearer ${token}` },
				},
			);
			// Badge math runs OUTSIDE the updater (StrictMode double-fire
			// class, register item 15).
			const cleared = conversationsRef.current.find(
				(c) => c._id === conversationId,
			);
			if (cleared?.unreadCount)
				setUnreadMessages((n) => Math.max(0, n - cleared.unreadCount));
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

	/** Newest-first union merge: server rows win, temps ride the tail. */
	const mergeMessages = (a: Message[], b: Message[]): Message[] => {
		const byId = new Map<string, Message>();
		for (const m of [...a, ...b]) {
			const k = m.clientKey ?? m._id;
			const prior = byId.get(k);
			// A server row (real _id) always beats an optimistic twin.
			if (!prior || prior._id.startsWith("temp-")) byId.set(k, m);
		}
		return [...byId.values()].sort((x, y) =>
			x.createdAt < y.createdAt ? -1 : x.createdAt > y.createdAt ? 1 : 0,
		);
	};

	const fetchMessages = async (conversationId: string) => {
		hasMoreOlderRef.current = true;
		setFirstItemIndex(100000);
		setPendingNew(0);
		const cached = messageCache[conversationId];
		if (cached?.length > 0) {
			// Register item 14: the cache paints instantly, the newest page
			// revalidates BEHIND it — missed-while-offline messages stop
			// being invisible for the whole session.
			void (async () => {
				try {
					const token = await getToken();
					const r = await axios.get(
						`${API_URL}/api/messages/${conversationId}?limit=50`,
						{ headers: { Authorization: `Bearer ${token}` } },
					);
					setMessageCache((prev) => ({
						...prev,
						[conversationId]: mergeMessages(
							prev[conversationId] || [],
							r.data,
						),
					}));
				} catch {
					// Silent: the cached copy is already on screen.
				}
			})();
			return;
		}

		try {
			setIsLoadingMessages(true);
			const token = await getToken();
			const response = await axios.get(
				`${API_URL}/api/messages/${conversationId}?limit=50`,
				{
					headers: { Authorization: `Bearer ${token}` },
				},
			);
			hasMoreOlderRef.current = response.data.length === 50;
			setMessageCache((prev) => ({
				...prev,
				[conversationId]: response.data,
			}));
		} catch (error) {
			toast.error("Failed to load messages");
		} finally {
			setIsLoadingMessages(false);
		}
	};

	/** Older page prepend — virtuoso preserves the visual position via the
	 *  shrinking firstItemIndex (register item 24). */
	const loadOlder = useCallback(async () => {
		const conv = activeIdRef.current;
		if (!conv || loadingOlderRef.current || !hasMoreOlderRef.current) return;
		const list = messageCacheRef.current[conv] || [];
		const oldest = list.find((m) => !m._id.startsWith("temp-"));
		if (!oldest) return;
		loadingOlderRef.current = true;
		try {
			const token = await getToken();
			const r = await axios.get(
				`${API_URL}/api/messages/${conv}?limit=50&before=${oldest._id}`,
				{ headers: { Authorization: `Bearer ${token}` } },
			);
			hasMoreOlderRef.current = r.data.length === 50;
			if (r.data.length > 0) {
				setMessageCache((prev) => ({
					...prev,
					[conv]: [...r.data, ...(prev[conv] || [])],
				}));
				setFirstItemIndex((i) => i - r.data.length);
			}
		} catch {
			// Scrolling further retries; no toast for a background page.
		} finally {
			loadingOlderRef.current = false;
		}
	}, [getToken]);

	const onMessage = useCallback((ablyMessage: any) => {
		if (
			ablyMessage.name === "event" &&
			ablyMessage.data.type === "message:unsent"
		) {
			// The other side took a message back — it vanishes in place, no
			// tombstone, exactly as if it had never landed.
			const { conversationId, messageId } = ablyMessage.data;
			setMessageCache((prev) => ({
				...prev,
				[conversationId]: (prev[conversationId] ?? []).filter(
					(m) => m._id !== messageId,
				),
			}));
			return;
		}
		if (
			ablyMessage.name === "event" &&
			ablyMessage.data.type === "message:read"
		) {
			// The peer's persisted high-water mark moved — hydrate ticks.
			const { conversationId, readerId, readUpTo } = ablyMessage.data;
			if (!readUpTo) return;
			const bump = (c: Conversation): Conversation =>
				c._id !== conversationId
					? c
					: {
							...c,
							members: (c.members ?? []).map((mm) => {
								const pid =
									typeof mm.profile === "string"
										? mm.profile
										: mm.profile?._id;
								return String(pid) === String(readerId)
									? { ...mm, readUpTo, readUpToAt: new Date().toISOString() }
									: mm;
							}),
						};
			setConversations((prev) => prev.map(bump));
			setActiveConversation((prev) => (prev ? bump(prev) : prev));
			return;
		}
		if (
			ablyMessage.name === "event" &&
			ablyMessage.data.type === "message:new"
		) {
			const { message: newMessage, conversationId } = ablyMessage.data;
			const currentActiveId = activeIdRef.current;
			const mine =
				String(newMessage?.sender?._id ?? newMessage?.sender) ===
				String(myProfileIdRef.current);

			setMessageCache((prev) => {
				const currentMessages = prev[conversationId] || [];
				// clientKey reconciliation: this device's own echo (or the
				// POST response racing the echo) replaces the optimistic
				// bubble IN PLACE — same key, no remount, no twin.
				if (newMessage.clientKey) {
					const ti = currentMessages.findIndex(
						(m) =>
							m.clientKey === newMessage.clientKey ||
							m._id === newMessage._id,
					);
					if (ti >= 0) {
						const copy = [...currentMessages];
						copy[ti] = { ...newMessage };
						return { ...prev, [conversationId]: copy };
					}
				}
				if (currentMessages.find((m) => m._id === newMessage._id)) return prev;
				return {
					...prev,
					[conversationId]: [...currentMessages, newMessage],
				};
			});

			if (currentActiveId === conversationId && !mine) {
				chatRef.current.notifyDelivered();
				if (atBottomRef.current) {
					// Reading it right now — one batched mark, receipts true.
					void markAsRead(conversationId, newMessage._id);
					chatRef.current.notifyRead();
				} else {
					// Never yank a reader who scrolled up — offer the pill.
					setPendingNew((n) => n + 1);
				}
			}

			// Register item 15: the refetch decision runs OUTSIDE the updater.
			const known = conversationsRef.current.some(
				(c) => c._id === conversationId,
			);
			if (!known) void fetchConversations();

			setConversations((prev) => {
				const index = prev.findIndex((c) => c._id === conversationId);
				if (index === -1) return prev;
				const updated = [...prev];
				const conv = { ...updated[index] };
				conv.lastMessage = newMessage;
				conv.lastMessageAt = newMessage.createdAt;
				if (currentActiveId !== conversationId && !mine) {
					conv.unreadCount += 1;
				}
				updated.splice(index, 1);
				return [conv, ...updated];
			});
		}
	}, []);

	const sendMessage = async (textArg?: string): Promise<boolean> => {
		const text = (textArg ?? "").trim();
		if (
			(!text && !selectedFile) ||
			!activeConversation ||
			!myProfileId ||
			isUploading
		)
			return false;

		const clientKey =
			typeof crypto !== "undefined" && "randomUUID" in crypto
				? crypto.randomUUID()
				: `ck-${Date.now()}-${Math.random().toString(36).slice(2)}`;
		const tempId = `temp-${Date.now()}`;
		const content = text;
		// Captured before the optimistic clear, so a fast second send cannot
		// attach this reply to the wrong message.
		const currentReply = replyTarget;
		chat.notifyStoppedTyping();
		const currentFile = selectedFile;
		const currentPreview = previewUrl;

		let optimisticType: "text" | "image" | "video" | "file" = "text";
		if (currentFile) {
			if (currentFile.type.startsWith("image")) optimisticType = "image";
			else if (currentFile.type.startsWith("video")) optimisticType = "video";
			else optimisticType = "file";
		}

		// Geometry + thumbhash at send (register item 26): the receiver
		// reserves the exact box and paints a placeholder from metadata.
		let meta: { width?: number; height?: number; thumbhash?: string } = {};
		if (currentFile && optimisticType === "image") {
			try {
				meta = await imageMeta(currentFile);
			} catch {
				// Geometry is an enhancement; the send never waits on it.
			}
		}

		const optimisticMessage: Message = {
			_id: tempId,
			clientKey,
			conversationId: activeConversation._id,
			sender: {
				_id: myProfileId,
				firstName: user?.firstName || "",
				lastName: user?.lastName || "",
				username: user?.username || "",
				avatar: me?.avatar || user?.imageUrl || "",
			},
			content: content,
			type: optimisticType as any,
			mediaUrl: currentPreview || undefined,
			...meta,
			replyTo: currentReply
				? {
						_id: currentReply._id,
						content: currentReply.content,
						type: currentReply.type,
						mediaUrl: currentReply.mediaUrl,
						durationSec: currentReply.durationSec,
						sender: currentReply.sender,
					}
				: null,
			createdAt: new Date().toISOString(),
		};

		setMessageCache((prev) => ({
			...prev,
			[activeConversation._id]: [
				...(prev[activeConversation._id] || []),
				optimisticMessage,
			],
		}));
		setPendingNew(0);
		scrollToBottom();
		setReplyTarget(null);
		clearSelectedFile();
		setIsUploading(true);

		try {
			const token = await getToken();
			let mediaUrl = "";
			let finalType = "text";

			if (currentFile) {
				const formData = new FormData();
				formData.append("file", currentFile);
				// Binds the upload to this thread so the gateway can enforce
				// membership at the door (register item 40).
				formData.append("conversationId", activeConversation._id);
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
				// Private bucket: STORE the key; the presigned url is only for
				// this tab's preview (register item 41).
				mediaUrl = uploadRes.data.key ?? uploadRes.data.url;
				const type = uploadRes.data.type;
				finalType = type.startsWith("image")
					? "image"
					: type.startsWith("video")
						? "video"
						: "file";
			}

			const response = await axios.post(
				`${API_URL}/api/messages`,
				{
					conversationId: activeConversation._id,
					content,
					type: currentFile ? finalType : "text",
					mediaUrl: mediaUrl || undefined,
					// The gateway drops this unless it names a message in THIS
					// thread, so a stale id degrades to a plain message.
					replyTo: currentReply?._id,
					clientKey,
					...meta,
				},
				{ headers: { Authorization: `Bearer ${token}` } },
			);

			setMessageCache((prev) => {
				const currentMsgs = prev[activeConversation._id] || [];
				const server = { ...response.data, clientKey };
				const already = currentMsgs.findIndex(
					(m) => m._id === server._id && m._id !== tempId,
				);
				if (already >= 0) {
					// The realtime echo beat the POST response; drop the temp.
					return {
						...prev,
						[activeConversation._id]: currentMsgs.filter(
							(m) => m._id !== tempId,
						),
					};
				}
				// Same clientKey key in the list — the bubble UPDATES in
				// place instead of remounting (register item 10).
				return {
					...prev,
					[activeConversation._id]: currentMsgs.map((m) =>
						m._id === tempId ? server : m,
					),
				};
			});
			// The wallpaper takes one breath per sent message (register 49).
			setSendPulse((n) => n + 1);
			return true;
		} catch (error: any) {
			if (error?.response?.status === 403) {
				toast.error(
					error?.response?.data?.message ||
						"You can't message this account — you need to be Allies first",
				);
			} else {
				console.error("Failed to send", error);
				toast.error(
					error?.response?.data?.message || "Failed to send message",
				);
			}
			setMessageCache((prev) => ({
				...prev,
				[activeConversation._id]: (prev[activeConversation._id] || []).filter(
					(m) => m._id !== tempId,
				),
			}));
			// The composer restores the draft when we report failure.
			return false;
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

	/** The peer's persisted read mark, for ticks that survive reload. */
	const peerReadUpTo = useMemo(() => {
		const peerId = activeConversation?.otherParticipant?._id;
		const mm = activeConversation?.members?.find((x) => {
			const pid = typeof x.profile === "string" ? x.profile : x.profile?._id;
			return String(pid) === String(peerId);
		});
		return mm?.readUpTo ? String(mm.readUpTo) : null;
	}, [activeConversation]);

	const handleAtBottom = useCallback((b: boolean) => {
		atBottomRef.current = b;
		if (b) {
			setPendingNew(0);
			const id = activeIdRef.current;
			if (id) void markAsRead(id);
		}
		// biome-ignore lint/correctness/useExhaustiveDependencies: refs + stable fns
	}, []);

	const replyAndFocus = useCallback((m: unknown) => {
		setReplyTarget(m as Message);
		composerRef.current?.focus();
	}, []);

	const bubbleHandlers = useMemo(
		() => ({
			onReply: replyAndFocus,
			onMenu: (x: number, y: number, m: unknown) =>
				setMsgMenu({ x, y, message: m as Message }),
			onJump: jumpToMessage,
			onMediaClick: handleMediaClick,
			onStory: (ref: { story: string; thumbnail: string; authorUsername: string }) =>
				void openStoryRef(ref),
			onCallBack: (video: boolean) => {
				if (!activeConversation) return;
				startCall({
					conversationId: activeConversation._id,
					peer: {
						id: activeConversation.otherParticipant?._id || "",
						name:
							`${activeConversation.otherParticipant?.firstName || ""} ${activeConversation.otherParticipant?.lastName || ""}`.trim() ||
							activeConversation.otherParticipant?.username ||
							"",
						avatar: activeConversation.otherParticipant?.avatar || "",
						username: activeConversation.otherParticipant?.username || "",
					},
					isVideo: video,
				});
			},
		}),
		// biome-ignore lint/correctness/useExhaustiveDependencies: identity by thread
		[replyAndFocus, jumpToMessage, activeConversation?._id],
	);

	useEffect(() => {
		const fetchMe = async () => {
			const token = await getToken();
			const res = await axios.get(`${API_URL}/api/users/me`, {
				headers: { Authorization: `Bearer ${token}` },
			});
			setMyProfileId(res.data._id);
			myProfileIdRef.current = res.data._id;
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

	useEffect(() => {
		const mine = activeConversation?.members?.find((mm) => {
			const pid = typeof mm.profile === "string" ? mm.profile : mm.profile?._id;
			return String(pid) === String(myProfileId);
		}) as { wallpaper?: WallpaperSetting } | undefined;
		setWallpaper(mine?.wallpaper ? { ...mine.wallpaper } : DEFAULT_WALLPAPER);
		// biome-ignore lint/correctness/useExhaustiveDependencies: identity by thread
	}, [activeConversation?._id, myProfileId]);

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
					"w-full md:w-[400px] shrink-0 min-w-0 md:bg-surface/40 flex flex-col",
					activeConversation ||
						(conversations.length === 0 && !isLoadingConversations)
						? "hidden md:flex"
						: "flex",
				)}
			>
				<div className="px-4 pb-1 pt-4">
					<div className="mb-3 flex items-center gap-2">
						{/* Phones only. On desktop the inbox sits inside the app
						    shell with the rail right there; on a phone it fills
						    the screen, and without this the only way out was the
						    browser's own back gesture. */}
						<button
							type="button"
							onClick={() => goBack("/")}
							aria-label={t("common.back")}
							className="-ml-2 flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-pill text-muted transition-colors hover:bg-chip hover:text-primary md:hidden"
						>
							<ArrowLeft className="h-5 w-5" />
						</button>
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
							<UserCirclePlus size={18} weight="bold" />
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
					<div className="px-2 pt-1">
						<StoriesRail />
					</div>
					{/* Primary / Requests as pill tabs (the one tab grammar).
					    Requests stay quiet — the badge lives HERE, inside
					    messages, never on the nav. The tab shows even when
					    empty so the place a stranger's opener waits is
					    discoverable before one ever arrives. */}
					<Tabs
						ariaLabel="Inbox sections"
						value={showRequests ? "requests" : "primary"}
						onChange={(k) => setShowRequests(k === "requests")}
						items={[
							{ key: "primary", label: "Primary" },
							{
								key: "requests",
								label: "Requests",
								Icon: Tray,
								badge: requestConversations.length,
							},
						]}
						className="px-4"
					/>
					<ConversationList
						conversations={
							(showRequests
								? requestConversations
								: inboxConversations) as any
						}
						loading={isLoadingConversations}
						query={searchQuery}
						activeId={activeConversation?._id}
						myProfileId={myProfileId}
						onOpen={(conv) => {
							setActiveConversation(conv as any);
							router.push(`/messages/${conv._id}`);
						}}
						onDelete={(conv) => {
							// A request declines instantly — that IS the gesture's
							// meaning there. An accepted thread is history for two
							// people; that gets a confirm before it burns.
							if ((conv as any).isRequestForMe) {
								void declineRequest(conv._id);
							} else {
								setPendingDeleteConv(conv as any);
							}
						}}
					/>
				</div>
			</div>

			{/* Chat Area */}
			{activeConversation ? (
				<div className="flex-1 min-w-0 flex flex-col">
					<div className="flex h-16 shrink-0 items-center justify-between gap-2 bg-page px-2 md:px-6">
						<div className="flex items-center gap-2 md:gap-3 min-w-0">
							<button
								type="button"
								onClick={() => {
									// The thread OPEN pushed /messages/<id>;
									// closing state-only left that URL (and a
									// ghost entry) behind — refresh reopened
									// the thread you had just left.
									setActiveConversation(null);
									goBack("/messages");
								}}
								aria-label="Back to conversations"
								className="md:hidden h-11 w-11 shrink-0 flex items-center justify-center rounded-pill text-muted hover:text-primary hover:bg-raised transition-colors"
							>
								<ArrowLeft className="w-5 h-5" />
							</button>
							{/* The face and the name open the profile. Tapping the
							    person you are talking to and having nothing happen is
							    the first thing anyone tries in a thread. */}
							<Link
								href={`/profile/${activeConversation.otherParticipant.username}`}
								className="flex min-w-0 items-center gap-2 rounded-xl px-1 py-1 transition-colors hover:bg-raised md:gap-3"
							>
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
								<h2 className="flex items-center gap-1 font-semibold text-sm truncate">
									<span className="min-w-0 truncate">
										{activeConversation.otherParticipant.firstName}{" "}
										{activeConversation.otherParticipant.lastName}
									</span>
									<UserBadges
										isVerified={
											(activeConversation.otherParticipant as any)
												.isVerified
										}
										verification={
											(activeConversation.otherParticipant as any)
												.verification
										}
										badges={
											(activeConversation.otherParticipant as any)
												.badges
										}
										size={14}
									/>
								</h2>
								{chat.peerTyping ? (
									<p className="text-xs text-gold truncate">typing…</p>
								) : peerOnline ? (
									// No dot here — the avatar already carries one, and
									// two green dots for one fact read as two facts.
									<p className="truncate text-xs text-muted">Online</p>
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
							</Link>
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
							<button
								type="button"
								aria-label="Chat appearance"
								title="Chat appearance"
								onClick={() => setWallpaperOpen(true)}
								className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-pill text-muted transition-colors hover:bg-chip hover:text-primary md:h-10 md:w-10"
							>
								<Info className="w-5 h-5" />
							</button>
						</div>
					</div>

					<div className="relative flex-1 min-h-0 flex flex-col">
						<ThreadBackdrop wallpaper={wallpaper} pulse={sendPulse} />
						<div className="relative z-10 flex min-h-0 flex-1 flex-col">
						{activeConversation.isRequestForMe && (
							<div className="shrink-0 px-4 pt-4">
								<div className="mx-auto max-w-[420px] rounded-xl bg-surface p-4 text-center">
									<p className="font-sans text-[13.5px] font-semibold text-primary">
										{displayNameOf(activeConversation.otherParticipant)}{" "}
										wants to message you
									</p>
									<p className="mt-1 font-sans text-[12px] text-muted">
										They won't know you've seen this until you accept —
										replying accepts too.
									</p>
									<div className="mt-3 flex justify-center gap-2">
										<button
											type="button"
											onClick={() =>
												void acceptRequest(activeConversation._id)
											}
											className="h-9 cursor-pointer rounded-pill bg-primary px-4 font-sans text-[12.5px] font-semibold text-page transition-colors hover:opacity-90"
										>
											Accept
										</button>
										<button
											type="button"
											onClick={() =>
												void declineRequest(activeConversation._id)
											}
											className="h-9 cursor-pointer rounded-pill bg-raised px-4 font-sans text-[12.5px] font-medium text-danger transition-colors hover:bg-chip"
										>
											Delete
										</button>
									</div>
								</div>
							</div>
						)}
						{isLoadingMessages && (
							<div className="shrink-0 py-3 text-center text-muted font-sans text-sm">
								Loading history...
							</div>
						)}
						<ThreadList
							ref={virtuosoRef}
							threadId={activeConversation._id}
							messages={messages as never}
							firstItemIndex={firstItemIndex}
							myProfileId={myProfileId ?? ""}
							flashedId={flashedId}
							peerName={
								activeConversation.otherParticipant?.firstName ||
								activeConversation.otherParticipant?.username ||
								""
							}
							peerTyping={chat.peerTyping}
							deliveredAt={chat.deliveredAt}
							readAt={chat.readAt}
							peerReadUpTo={peerReadUpTo}
							pendingNew={pendingNew}
							onLoadOlder={loadOlder}
							onAtBottomChange={handleAtBottom}
							onShowNew={() => scrollToBottom()}
							handlers={bubbleHandlers}
						/>
						</div>
					</div>

					{/* shrink-0 + pb-safe: the composer is the flex row that must never
					    be squeezed out, and it sits on the iOS home indicator. */}
					<div className="relative z-10 shrink-0 p-3 pt-1.5 sm:p-4 sm:pt-1.5 bg-page/85 pb-safe">
						{/* The thumb demarcator: a grabber pill marks where the
						    composer region begins, instead of a full-width rule. */}
						<span aria-hidden className="mx-auto mb-2 block h-1 w-9 rounded-pill bg-raised" />
						{/* What you are answering, above the input, with a way out.
						    Sending clears it; so does Escape, because a reply you
						    cannot cancel is a trap. */}
						{replyTarget && (
							<div className="mb-2 flex items-stretch gap-2 rounded-[7px] bg-sunken px-2.5 py-2">
								<span className="w-[2px] shrink-0 rounded-pill bg-brand" />
								<span className="flex min-w-0 flex-1 flex-col">
									<span className="truncate font-sans text-[11.5px] font-semibold text-muted">
										Replying to{" "}
										{replyTarget.sender?._id === myProfileId
											? "yourself"
											: `@${replyTarget.sender?.username ?? ""}`}
									</span>
									<span className="truncate font-sans text-[12.5px] text-subtle">
										{quotedPreview(replyTarget)}
									</span>
								</span>
								<button
									type="button"
									onClick={() => setReplyTarget(null)}
									aria-label="Cancel reply"
									className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-pill text-subtle transition-colors hover:bg-raised hover:text-primary"
								>
									<XIcon size={14} weight="bold" />
								</button>
							</div>
						)}
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
								<ComposerInput
										ref={composerRef}
										disabled={isUploading}
										hasAttachment={!!selectedFile}
										gifEnabled={Boolean(GIPHY_KEY)}
										onSend={(text) => sendMessage(text)}
										onTyping={chat.notifyTyping}
										onStopTyping={chat.notifyStoppedTyping}
										onAttach={() => fileInputRef.current?.click()}
										onMoney={() => setShowSendMoney(true)}
										onGif={() => setShowGifPicker(true)}
										onStartRecording={startRecording}
									/>
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
			{wallpaperOpen && activeConversation && (
				<WallpaperSheet
					conversationId={activeConversation._id}
					current={wallpaper}
					onClose={() => setWallpaperOpen(false)}
					onApplied={(w) => setWallpaper(w)}
				/>
			)}
			{activeConversation && (
				<SendMoneySheet
					open={showSendMoney}
					onClose={() => setShowSendMoney(false)}
					conversationId={activeConversation._id}
					peerName={
						activeConversation.otherParticipant?.firstName ||
						activeConversation.otherParticipant?.username ||
						"them"
					}
					peerHandle={activeConversation.otherParticipant?.username}
					// The transfer is appended locally rather than waiting for
					// the Ably round-trip — the sender should see their own
					// receipt the instant it clears.
					onSent={(m) => {
						if (!m?._id) return;
						setMessageCache((prev) => ({
							...prev,
							[activeConversation._id]: [
								...(prev[activeConversation._id] || []),
								m,
							],
						}));
					}}
				/>
			)}
			{pendingDeleteConv && (
				<div className="fixed inset-0 z-modal flex items-center justify-center">
					<button
						type="button"
						aria-label="Cancel"
						onClick={() => setPendingDeleteConv(null)}
						className="absolute inset-0 cursor-default bg-scrim"
					/>
					<div className="relative w-[320px] rounded-xl bg-surface p-5 shadow-nav animate-rise">
						<p className="font-sans text-[14.5px] font-semibold text-primary">
							Delete this conversation?
						</p>
						<p className="mt-1 font-sans text-[12.5px] text-muted">
							The whole thread is removed for both of you. This can't
							be undone.
						</p>
						<div className="mt-4 flex justify-end gap-2">
							<button
								type="button"
								onClick={() => setPendingDeleteConv(null)}
								className="h-9 cursor-pointer rounded-pill bg-raised px-4 font-sans text-[13px] font-medium text-primary transition-colors hover:bg-chip"
							>
								Keep
							</button>
							<button
								type="button"
								onClick={() => {
									void declineRequest(pendingDeleteConv._id);
									setPendingDeleteConv(null);
								}}
								className="h-9 cursor-pointer rounded-pill bg-danger px-4 font-sans text-[13px] font-semibold text-white transition-colors hover:opacity-90"
							>
								Delete
							</button>
						</div>
					</div>
				</div>
			)}

			{msgMenu && (
				<div
					role="menu"
					style={{
						left: Math.min(msgMenu.x, window.innerWidth - 180),
						top: Math.min(msgMenu.y, window.innerHeight - 120),
					}}
					className="fixed z-dropdown w-[170px] overflow-hidden rounded-xl card-depth py-1 animate-rise"
					onClick={(e) => e.stopPropagation()}
				>
					<button
						type="button"
						role="menuitem"
						onClick={() => {
							setReplyTarget(msgMenu.message);
							setMsgMenu(null);
						}}
						className="flex w-full cursor-pointer items-center gap-2.5 px-3.5 py-2.5 text-left font-sans text-[13px] font-medium text-primary transition-colors hover:bg-raised"
					>
						<ArrowBendUpLeft size={15} weight="bold" />
						Reply
					</button>
					{msgMenu.message.content && (
						<button
							type="button"
							role="menuitem"
							onClick={() => {
								void navigator.clipboard
									.writeText(msgMenu.message.content ?? "")
									.catch(() => {});
								setMsgMenu(null);
								toast.success("Copied");
							}}
							className="flex w-full cursor-pointer items-center gap-2.5 px-3.5 py-2.5 text-left font-sans text-[13px] font-medium text-primary transition-colors hover:bg-raised"
						>
							<CopySimple size={15} weight="bold" />
							Copy text
						</button>
					)}
					{(typeof msgMenu.message.sender === "string"
						? msgMenu.message.sender === myProfileId
						: (msgMenu.message.sender as any)?._id === myProfileId) && (
						<button
							type="button"
							role="menuitem"
							onClick={() => {
								void unsendMessage(msgMenu.message);
								setMsgMenu(null);
							}}
							className="flex w-full cursor-pointer items-center gap-2.5 px-3.5 py-2.5 text-left font-sans text-[13px] font-medium text-danger transition-colors hover:bg-raised"
						>
							<ArrowCounterClockwise size={15} weight="bold" />
							Unsend
						</button>
					)}
				</div>
			)}

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
