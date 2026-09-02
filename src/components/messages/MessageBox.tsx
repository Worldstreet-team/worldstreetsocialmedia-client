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
import {
	Search,
	Info,
	Phone,
	Video,
	UserPlus,
	Plus,
	ArrowLeft,
	MessageCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { Badge } from "@/components/ui/Badge";
import { Tabs } from "@/components/ui/Tabs";
import { SafeAvatar } from "@/components/ui/SafeAvatar";
import axios from "axios";
import { useUser, useAuth } from "@clerk/nextjs";
import { useChannel, ChannelProvider } from "ably/react";
import { useTheme } from "next-themes";
import EmojiPicker, { Theme } from "emoji-picker-react";
import { useT } from "@/i18n/client";
import { getUserStoriesAction } from "@/lib/stories.actions";
import { StoryViewer, type RailEntry } from "@/components/feed/StoryViewer";
import { toast } from "sonner";
import { useToast } from "@/components/ui/Toast/ToastContext";
import { format } from "date-fns";
import { formatLastSeen, formatTimeAgo } from "@/lib/utils";
import { useRealtime } from "../providers/RealtimeProvider";
import MediaModal from "../ui/MediaModal";
import {
	ArrowBendUpLeft,
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
import { ConversationList } from "./ConversationList";
import { StoriesRail } from "@/components/feed/StoriesRail";
import { GIPHY_KEY, GifPicker } from "./GifPicker";
import { motion } from "framer-motion";
import { useCall } from "@/providers/CallProvider";
import { useChatSignals } from "@/hooks/useChatSignals";
import { ThreadList } from "@/components/messages/thread/ThreadList";
import {
	ComposerInput,
	type ComposerInputHandle,
} from "@/components/messages/thread/ComposerInput";
import type { VirtuosoHandle } from "react-virtuoso";
import { imageMeta, videoMeta } from "@/lib/media-meta";
import { compressImage } from "@/lib/image-compress";
import { postJsonDirect, sendFormProgress } from "@/lib/upload-direct";
import {
	VoiceRecorder,
	type RecorderStart,
	type VoiceMeta,
} from "@/components/messages/thread/VoiceRecorder";
import {
	subscribeVoicePlayback,
	toggleVoicePlayback,
	type VoicePlaybackState,
} from "./VoiceMessage";
import {
	RiAddLine,
	RiCloseLine,
	RiHdLine,
	RiPauseFill,
	RiPencilLine,
	RiPlayFill,
	RiVoiceprintFill,
} from "@remixicon/react";
import { ThreadBackdrop } from "@/components/messages/thread/ThreadBackdrop";
import { WallpaperSheet } from "@/components/messages/thread/WallpaperSheet";
import {
	DEFAULT_WALLPAPER,
	type WallpaperSetting,
} from "@/components/messages/thread/wallpaper";
import { SendMoneySheet } from "@/components/messages/SendMoneySheet";
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
/** A file waiting in the composer tray (register 62-63). */
interface PendingAttachment {
	id: string;
	file: File;
	previewUrl: string;
	kind: "image" | "video" | "audio";
	caption: string;
	width?: number;
	height?: number;
	thumbhash?: string;
	durationSec?: number;
	peaks?: number[];
}

/** The WhatsApp-six (register 134); the plus opens the full picker. */
const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

const newKey = () =>
	typeof crypto !== "undefined" && "randomUUID" in crypto
		? crypto.randomUUID()
		: `ck-${Date.now()}-${Math.random().toString(36).slice(2)}`;

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
	/** Multi-image sends cluster under one groupKey (register 63). */
	groupKey?: string;
	/** Transient, sender's tab only: upload progress 0..1. */
	uploadPct?: number;
	/** Transient, sender's tab only: send failed, retry offered. */
	failed?: boolean;
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
	const [menuPicker, setMenuPicker] = useState(false);
	useEffect(() => {
		if (!msgMenu) setMenuPicker(false);
	}, [msgMenu]);

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
	// ── The composer tray: up to 8 files queued before a send ──
	const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
	const [selectedAttId, setSelectedAttId] = useState<string | null>(null);
	const [editingAttId, setEditingAttId] = useState<string | null>(null);
	// HD chip (register 66): a lighter compression cap, never the original.
	const [hdSend, setHdSend] = useState(false);
	const hdRef = useRef(false);
	const [dragOver, setDragOver] = useState(false);
	// Voice recorder overlay; the start descriptor carries the hold gesture.
	const [recording, setRecording] = useState<RecorderStart | null>(null);
	// In-flight upload handles + everything needed to retry a failed send.
	const uploadAbortRef = useRef(new Map<string, AbortController>());
	const retryRef = useRef(
		new Map<
			string,
			{
				att: PendingAttachment;
				caption: string;
				convId: string;
				groupKey?: string;
				replyToId?: string;
				key?: string;
			}
		>(),
	);
	// Mini player (register 88): what the voice store says is playing.
	const [voiceBar, setVoiceBar] = useState<VoicePlaybackState | null>(null);
	const voiceBarThrottleRef = useRef(0);

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

	useEffect(() => {
		try {
			const hd = localStorage.getItem("ws-dm-hd") === "1";
			setHdSend(hd);
			hdRef.current = hd;
		} catch {
			/* storage unavailable */
		}
	}, []);

	const toggleHd = () => {
		setHdSend((v) => {
			hdRef.current = !v;
			try {
				localStorage.setItem("ws-dm-hd", !v ? "1" : "0");
			} catch {}
			return !v;
		});
	};

	// The playback store publishes per frame while a note plays; the mini
	// player only needs id/playing edges immediately and time twice a second.
	useEffect(
		() =>
			subscribeVoicePlayback((st) => {
				const now = Date.now();
				setVoiceBar((prev) => {
					if (
						prev?.id !== st.id ||
						prev?.playing !== st.playing ||
						now - voiceBarThrottleRef.current > 500
					) {
						voiceBarThrottleRef.current = now;
						return { ...st };
					}
					return prev;
				});
			}),
		[],
	);

	// ── The upload pipeline (registers 20, 68, 69, 93): every media send —
	// image, clip, voice note — is one machine: optimistic bubble with a
	// progress ring, retry that keeps the bubble, cancel that removes it. ──

	/** Merge fields into the cached message carrying this clientKey. */
	const patchByClientKey = (
		convId: string,
		clientKey: string,
		fields: Partial<Message>,
	) => {
		setMessageCache((prev) => ({
			...prev,
			[convId]: (prev[convId] || []).map((m) =>
				m.clientKey === clientKey ? { ...m, ...fields } : m,
			),
		}));
	};

	const removeByClientKey = (convId: string, clientKey: string) => {
		setMessageCache((prev) => ({
			...prev,
			[convId]: (prev[convId] || []).filter(
				(m) => m.clientKey !== clientKey,
			),
		}));
	};

	/** Optimistic bubble + retry registration; upload runs separately. */
	const queueAttachment = (
		att: PendingAttachment,
		caption: string,
		convId: string,
		groupKey?: string,
		replyToMsg?: Message | null,
	) => {
		const clientKey = att.id;
		const optimistic: Message = {
			_id: `temp-${clientKey}`,
			clientKey,
			conversationId: convId,
			sender: {
				_id: myProfileId ?? "",
				firstName: user?.firstName || "",
				lastName: user?.lastName || "",
				username: user?.username || "",
				avatar: me?.avatar || user?.imageUrl || "",
			},
			content: caption,
			type: att.kind,
			mediaUrl: att.previewUrl,
			width: att.width,
			height: att.height,
			thumbhash: att.thumbhash,
			durationSec: att.durationSec,
			peaks: att.peaks,
			groupKey,
			uploadPct: 0,
			replyTo: replyToMsg
				? {
						_id: replyToMsg._id,
						content: replyToMsg.content,
						type: replyToMsg.type,
						mediaUrl: replyToMsg.mediaUrl,
						durationSec: replyToMsg.durationSec,
						sender: replyToMsg.sender,
					}
				: null,
			createdAt: new Date().toISOString(),
		};
		setMessageCache((prev) => ({
			...prev,
			[convId]: [...(prev[convId] || []), optimistic],
		}));
		retryRef.current.set(clientKey, {
			att,
			caption,
			convId,
			groupKey,
			replyToId: replyToMsg?._id,
		});
	};

	const runAttachmentUpload = async (clientKey: string): Promise<boolean> => {
		const job = retryRef.current.get(clientKey);
		if (!job) return false;
		patchByClientKey(job.convId, clientKey, {
			failed: undefined,
			uploadPct: job.key ? 1 : 0,
		});
		if (!job.key) {
			let file = job.att.file;
			if (job.att.kind === "image") {
				file = await compressImage(
					file,
					hdRef.current
						? {
								maxEdge: 4096,
								quality: 0.9,
								skipUnderBytes: 1024 * 1024,
							}
						: undefined,
				);
			}
			const fd = new FormData();
			fd.append("file", file, file.name || "attachment");
			fd.append("conversationId", job.convId);
			const ctl = new AbortController();
			uploadAbortRef.current.set(clientKey, ctl);
			let lastPct = 0;
			const up = await sendFormProgress("/api/messages/upload", fd, {
				onProgress: (pct) => {
					// ~16 cache writes per upload, not one per network event.
					if (pct - lastPct >= 0.06 || pct >= 1) {
						lastPct = pct;
						patchByClientKey(job.convId, clientKey, {
							uploadPct: pct,
						});
					}
				},
				signal: ctl.signal,
			});
			uploadAbortRef.current.delete(clientKey);
			if (!up.success) {
				if (up.aborted) {
					removeByClientKey(job.convId, clientKey);
					retryRef.current.delete(clientKey);
					return false;
				}
				patchByClientKey(job.convId, clientKey, {
					failed: true,
					uploadPct: undefined,
				});
				return false;
			}
			job.key = up.data.key ?? up.data.url;
		}
		// The write itself rides direct JSON — a media send mid-deploy must
		// not die with a server-action id.
		const res = await postJsonDirect("/api/messages", {
			conversationId: job.convId,
			content: job.caption,
			type: job.att.kind,
			mediaUrl: job.key,
			clientKey,
			replyTo: job.replyToId,
			width: job.att.width,
			height: job.att.height,
			thumbhash: job.att.thumbhash,
			durationSec: job.att.durationSec,
			peaks: job.att.peaks,
			groupKey: job.groupKey,
		});
		if (!res.success) {
			patchByClientKey(job.convId, clientKey, {
				failed: true,
				uploadPct: undefined,
			});
			toast.error(res.message || "Failed to send");
			return false;
		}
		const server = res.data as Message;
		setMessageCache((prev) => ({
			...prev,
			[job.convId]: (prev[job.convId] || []).map((m) => {
				if (m.clientKey !== clientKey) return m;
				// Keep the LOCAL preview when the server echoes a bare key:
				// the blob in memory beats a not-yet-signed R2 key, and the
				// next fetch swaps in a presigned URL anyway.
				const mediaUrl = server.mediaUrl?.includes("://")
					? server.mediaUrl
					: m.mediaUrl;
				return {
					...server,
					clientKey,
					mediaUrl,
					uploadPct: undefined,
					failed: undefined,
				};
			}),
		}));
		retryRef.current.delete(clientKey);
		setSendPulse((n) => n + 1);
		return true;
	};

	const retryUpload = useCallback((clientKey: string) => {
		void runAttachmentUpload(clientKey);
		// biome-ignore lint/correctness/useExhaustiveDependencies: refs + setters only
	}, []);

	const cancelUpload = useCallback((clientKey: string) => {
		const ctl = uploadAbortRef.current.get(clientKey);
		if (ctl) {
			ctl.abort();
			return;
		}
		const job = retryRef.current.get(clientKey);
		if (job) {
			removeByClientKey(job.convId, clientKey);
			retryRef.current.delete(clientKey);
		}
		// biome-ignore lint/correctness/useExhaustiveDependencies: refs + setters only
	}, []);

	/** Voice notes ride the same machinery as any attachment (register 93). */
	const sendVoiceNote = async (blob: Blob, meta: VoiceMeta) => {
		if (!activeConversation || !myProfileId) return;
		const convId = activeConversation._id;
		const ext = meta.mime.includes("mp4") ? "m4a" : "webm";
		const att: PendingAttachment = {
			id: newKey(),
			file: new File([blob], `voice-note.${ext}`, { type: meta.mime }),
			previewUrl: URL.createObjectURL(blob),
			kind: "audio",
			caption: "",
			durationSec: meta.durationSec,
			peaks: meta.peaks,
		};
		queueAttachment(att, "", convId);
		setPendingNew(0);
		scrollToBottom();
		await runAttachmentUpload(att.id);
	};

	/**
	 * GIFs re-host to R2 on send (register 71): a third-party CDN URL in a
	 * thread leaks every reader's IP to GIPHY and dies whenever they prune.
	 * The optimistic bubble paints from the CDN instantly; the stored copy
	 * is ours. If the fetch fails the hotlink still sends — a GIF that
	 * works today beats a principled empty bubble.
	 */
	const sendGif = async (url: string) => {
		if (!activeConversation || !myProfileId) return;
		const convId = activeConversation._id;
		const clientKey = newKey();
		setMessageCache((prev) => ({
			...prev,
			[convId]: [
				...(prev[convId] || []),
				{
					_id: `temp-${clientKey}`,
					clientKey,
					conversationId: convId,
					sender: {
						_id: myProfileId,
						firstName: user?.firstName || "",
						lastName: user?.lastName || "",
						username: user?.username || "",
						avatar: me?.avatar || user?.imageUrl || "",
					},
					content: "",
					type: "image" as const,
					mediaUrl: url,
					uploadPct: 0,
					createdAt: new Date().toISOString(),
				},
			],
		}));
		setPendingNew(0);
		scrollToBottom();
		let mediaUrl = url;
		try {
			const r = await fetch(url);
			if (r.ok) {
				const blob = await r.blob();
				if (blob.size > 0 && blob.size <= 15 * 1024 * 1024) {
					const fd = new FormData();
					fd.append(
						"file",
						new File([blob], "gif.gif", {
							type: blob.type || "image/gif",
						}),
					);
					fd.append("conversationId", convId);
					const up = await sendFormProgress(
						"/api/messages/upload",
						fd,
						{
							onProgress: (pct) =>
								patchByClientKey(convId, clientKey, {
									uploadPct: pct,
								}),
						},
					);
					if (up.success) mediaUrl = up.data.key ?? up.data.url;
				}
			}
		} catch {
			/* hotlink fallback */
		}
		const res = await postJsonDirect("/api/messages", {
			conversationId: convId,
			content: "",
			type: "image",
			mediaUrl,
			clientKey,
		});
		if (!res.success) {
			toast.error(res.message || "Failed to send GIF");
			removeByClientKey(convId, clientKey);
			return;
		}
		const server = res.data as Message;
		setMessageCache((prev) => ({
			...prev,
			[convId]: (prev[convId] || []).map((m) =>
				m.clientKey === clientKey
					? {
							...server,
							clientKey,
							// The CDN copy is already painted; keep it until a
							// fetch delivers the presigned R2 read.
							mediaUrl: server.mediaUrl?.includes("://")
								? server.mediaUrl
								: url,
							uploadPct: undefined,
						}
					: m,
			),
		}));
		setSendPulse((n) => n + 1);
	};

	// Sync ref with state so real-time listener stays updated
	useEffect(() => {
		activeIdRef.current = activeConversation?._id || null;
		if (activeConversation?._id) {
			markAsRead(activeConversation._id);
			chatRef.current.notifyRead();
		}
	}, [activeConversation]);

	/**
	 * Files enter the tray from the picker, paste, or drag-drop (register
	 * 75) — one intake, up to 8 (register 63). Geometry and thumbhash are
	 * probed in the background so a queued file is ready by send time.
	 */
	const addFiles = useCallback(
		(incoming: File[]) => {
			const media = incoming.filter((f) =>
				/^(image|video)\//.test(f.type),
			);
			if (media.length === 0) return;
			const room = 8 - attachments.length;
			if (media.length > room)
				toast.error("Up to 8 attachments per send");
			const accepted = media.slice(0, Math.max(0, room));
			if (accepted.length === 0) return;
			const items: PendingAttachment[] = accepted.map((f) => ({
				id: newKey(),
				file: f,
				previewUrl: URL.createObjectURL(f),
				kind: f.type.startsWith("image") ? "image" : "video",
				caption: "",
			}));
			setAttachments((prev) => [...prev, ...items]);
			setSelectedAttId(items[items.length - 1].id);
			for (const item of items) {
				void (async () => {
					try {
						const meta =
							item.kind === "image"
								? await imageMeta(item.file)
								: await videoMeta(item.file);
						setAttachments((prev) =>
							prev.map((a) =>
								a.id === item.id ? { ...a, ...meta } : a,
							),
						);
					} catch {
						/* geometry is a garnish */
					}
				})();
			}
		},
		[attachments.length],
	);

	const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
		addFiles(Array.from(e.target.files ?? []));
		if (fileInputRef.current) fileInputRef.current.value = "";
	};

	// Pre-send edit: the Studio sheet swaps the attachment in place, so the
	// upload path is untouched. Geometry re-probes — the crop changed it.
	const applyEditedAttachment = (id: string, file: File) => {
		setAttachments((prev) =>
			prev.map((a) => {
				if (a.id !== id) return a;
				URL.revokeObjectURL(a.previewUrl);
				return {
					...a,
					file,
					previewUrl: URL.createObjectURL(file),
					width: undefined,
					height: undefined,
					thumbhash: undefined,
				};
			}),
		);
		setEditingAttId(null);
		void (async () => {
			try {
				const meta = await imageMeta(file);
				setAttachments((prev) =>
					prev.map((a) => (a.id === id ? { ...a, ...meta } : a)),
				);
			} catch {
				/* geometry is a garnish */
			}
		})();
	};

	const removeAttachment = (id: string) => {
		setAttachments((prev) => {
			const target = prev.find((a) => a.id === id);
			if (target) URL.revokeObjectURL(target.previewUrl);
			return prev.filter((a) => a.id !== id);
		});
		setSelectedAttId((sel) => (sel === id ? null : sel));
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

	/**
	 * Text-only send. `waitFor` sequences a trailing text under a media
	 * batch: the bubble paints immediately, the POST waits its turn so both
	 * sides read the thread in the same order.
	 */
	const sendText = async (
		text: string,
		convId: string,
		currentReply: Message | null,
		waitFor?: Promise<unknown>,
	): Promise<boolean> => {
		const clientKey = newKey();
		const tempId = `temp-${clientKey}`;
		const optimisticMessage: Message = {
			_id: tempId,
			clientKey,
			conversationId: convId,
			sender: {
				_id: myProfileId ?? "",
				firstName: user?.firstName || "",
				lastName: user?.lastName || "",
				username: user?.username || "",
				avatar: me?.avatar || user?.imageUrl || "",
			},
			content: text,
			type: "text",
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
			[convId]: [...(prev[convId] || []), optimisticMessage],
		}));
		setPendingNew(0);
		scrollToBottom();

		try {
			if (waitFor) await waitFor.catch(() => {});
			const token = await getToken();
			const response = await axios.post(
				`${API_URL}/api/messages`,
				{
					conversationId: convId,
					content: text,
					type: "text",
					// The gateway drops this unless it names a message in THIS
					// thread, so a stale id degrades to a plain message.
					replyTo: currentReply?._id,
					clientKey,
				},
				{ headers: { Authorization: `Bearer ${token}` } },
			);

			setMessageCache((prev) => {
				const currentMsgs = prev[convId] || [];
				const server = { ...response.data, clientKey };
				const already = currentMsgs.findIndex(
					(m) => m._id === server._id && m._id !== tempId,
				);
				if (already >= 0) {
					// The realtime echo beat the POST response; drop the temp.
					return {
						...prev,
						[convId]: currentMsgs.filter((m) => m._id !== tempId),
					};
				}
				// Same clientKey key in the list — the bubble UPDATES in
				// place instead of remounting (register item 10).
				return {
					...prev,
					[convId]: currentMsgs.map((m) =>
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
				[convId]: (prev[convId] || []).filter((m) => m._id !== tempId),
			}));
			// The composer restores the draft when we report failure.
			return false;
		}
	};

	const sendMessage = async (textArg?: string): Promise<boolean> => {
		const text = (textArg ?? "").trim();
		if (
			(!text && attachments.length === 0) ||
			!activeConversation ||
			!myProfileId
		)
			return false;
		const convId = activeConversation._id;
		// Captured before the optimistic clear, so a fast second send cannot
		// attach this reply to the wrong message.
		const currentReply = replyTarget;
		chat.notifyStoppedTyping();
		setReplyTarget(null);

		if (attachments.length > 0) {
			const queue = attachments;
			setAttachments([]);
			setSelectedAttId(null);
			setEditingAttId(null);
			// One message per file, clustered under one groupKey (register 63).
			const groupKey = queue.length > 1 ? newKey() : undefined;
			let textUsed = false;
			for (let i = 0; i < queue.length; i++) {
				let caption = queue[i].caption.trim();
				if (!caption && i === 0 && text) {
					caption = text;
					textUsed = true;
				}
				queueAttachment(
					queue[i],
					caption,
					convId,
					groupKey,
					i === 0 ? currentReply : null,
				);
			}
			setPendingNew(0);
			scrollToBottom();
			// Uploads run serially so rows land in tray order; the bubbles
			// are already all on screen with their rings.
			const chain = (async () => {
				for (const att of queue) await runAttachmentUpload(att.id);
			})();
			if (text && !textUsed)
				void sendText(text, convId, null, chain);
			return true;
		}

		return sendText(text, convId, currentReply);
	};

	// --- Call Logic (Global) ---
	const { startCall } = useCall();

	/**
	 * Toggle MY reaction (register 132-134): optimistic replace-on-re-react
	 * mirroring the gateway, live hop on the conversation channel, then the
	 * persisting POST — whose answer is authoritative.
	 */
	const reactTo = useCallback(
		(mRaw: unknown, emoji: string) => {
			const m = mRaw as Message;
			const convId = activeIdRef.current;
			const meId = myProfileIdRef.current;
			if (!convId || !meId || m._id.startsWith("temp-")) return;
			const cur =
				(messageCache[convId] || []).find((x) => x._id === m._id)
					?.reactions ?? [];
			const mine = cur.find((r) => r.profile === meId);
			const next = cur.filter((r) => r.profile !== meId);
			if (!mine || mine.emoji !== emoji)
				next.push({ profile: meId, emoji });
			setMessageCache((prev) => ({
				...prev,
				[convId]: (prev[convId] || []).map((x) =>
					x._id === m._id ? { ...x, reactions: next } : x,
				),
			}));
			chatRef.current.notifyReaction?.(m._id, next);
			void postJsonDirect(`/api/messages/message/${m._id}/react`, {
				emoji,
			}).then((res) => {
				if (res.success && Array.isArray(res.data?.reactions)) {
					const reactions = res.data.reactions.map(
						(r: { profile: unknown; emoji: string }) => ({
							profile: String(r.profile),
							emoji: r.emoji,
						}),
					);
					setMessageCache((prev) => ({
						...prev,
						[convId]: (prev[convId] || []).map((x) =>
							x._id === m._id ? { ...x, reactions } : x,
						),
					}));
				}
			});
		},
		// biome-ignore lint/correctness/useExhaustiveDependencies: refs carry the rest
		[messageCache, setMessageCache],
	);

	// Typing / presence / receipts. Ephemeral signals go client-to-client on the
	// conversation channel; only "read" is persisted.
	const chat = useChatSignals({
		conversationId: activeConversation?._id ?? null,
		myProfileId: myProfileId ?? null,
		onReaction: (e) => {
			const convId = activeIdRef.current;
			if (!convId) return;
			setMessageCache((prev) => ({
				...prev,
				[convId]: (prev[convId] || []).map((m) =>
					m._id === e.messageId ? { ...m, reactions: e.reactions } : m,
				),
			}));
		},
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

	const selectedAtt =
		attachments.find(
			(a) => a.id === (selectedAttId ?? attachments[0]?.id),
		) ?? null;
	const editingAtt = attachments.find((a) => a.id === editingAttId) ?? null;

	const bubbleHandlers = useMemo(
		() => ({
			onReply: replyAndFocus,
			onMenu: (x: number, y: number, m: unknown) =>
				setMsgMenu({ x, y, message: m as Message }),
			onJump: jumpToMessage,
			onMediaClick: handleMediaClick,
			onRetryUpload: retryUpload,
			onCancelUpload: cancelUpload,
			onReact: reactTo,
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
		[replyAndFocus, jumpToMessage, retryUpload, cancelUpload, reactTo, activeConversation?._id],
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
								{chat.peerRecording ? (
									<p className="truncate text-xs text-gold">
										recording audio…
									</p>
								) : chat.peerTyping ? (
									<p className="text-xs text-gold truncate">typing…</p>
								) : peerOnline ? (
									// No dot here — the avatar already carries one, and
									// two green dots for one fact read as two facts.
									<p className="truncate text-xs text-muted">Online</p>
								) : (activeConversation.otherParticipant as any)
										?.lastSeenAt ? (
									<p className="truncate text-xs text-muted">
										Seen{" "}
										{formatLastSeen(
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

					<div
						className="relative flex-1 min-h-0 flex flex-col"
						onDragOver={(e) => {
							if (e.dataTransfer.types.includes("Files")) {
								e.preventDefault();
								setDragOver(true);
							}
						}}
						onDragLeave={(e) => {
							if (e.currentTarget === e.target) setDragOver(false);
						}}
						onDrop={(e) => {
							e.preventDefault();
							setDragOver(false);
							addFiles(Array.from(e.dataTransfer.files ?? []));
						}}
					>
						<ThreadBackdrop wallpaper={wallpaper} pulse={sendPulse} />
						{dragOver && (
							<div className="pointer-events-none absolute inset-2 z-20 flex items-center justify-center rounded-xl border-2 border-dashed border-brand bg-page/60">
								<span className="rounded-pill bg-raised px-4 py-2 font-sans text-[13px] font-semibold text-primary">
									Drop to send
								</span>
							</div>
						)}
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
							peerRecording={chat.peerRecording}
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
						{/* Mini player (register 88): the note keeps playing while you
						    scroll or read; the bar keeps its controls in reach. */}
						{voiceBar?.id && voiceBar.playing && (
							<div className="mb-2 flex items-center gap-2 rounded-[10px] bg-raised/90 px-2 py-1.5">
								<RiVoiceprintFill size={16} className="ml-1 shrink-0 text-gold" />
								<button
									type="button"
									onClick={() => voiceBar.id && jumpToMessage(voiceBar.id)}
									className="min-w-0 flex-1 cursor-pointer text-left"
								>
									<span className="block truncate font-sans text-[12px] font-semibold text-primary">
										Voice note
									</span>
									<span className="mt-1 block h-[3px] w-full overflow-hidden rounded-pill bg-chip">
										<span
											className="block h-full rounded-pill bg-brand"
											style={{
												width: `${voiceBar.duration > 0 ? Math.min(100, (voiceBar.time / voiceBar.duration) * 100) : 0}%`,
											}}
										/>
									</span>
								</button>
								<span className="shrink-0 font-sans text-[11px] tabular-nums text-muted">
									{Math.floor(voiceBar.time / 60)}:
									{String(Math.floor(voiceBar.time % 60)).padStart(2, "0")}
								</span>
								<button
									type="button"
									onClick={toggleVoicePlayback}
									aria-label="Pause voice note"
									className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-pill text-primary transition-colors hover:bg-chip"
								>
									<RiPauseFill size={18} />
								</button>
							</div>
						)}
						{/* The tray (register 62-63): thumbs, per-image caption for
						    the selected one, HD chip, and the editor a tap away. */}
						{attachments.length > 0 && (
							<div className="mb-2 rounded-xl bg-sunken/80 p-2">
								<div className="flex items-center gap-2 overflow-x-auto pb-0.5">
									{attachments.map((att) => (
										<div
											key={att.id}
											onClick={() => setSelectedAttId(att.id)}
											className={clsx(
												"relative h-[72px] w-[72px] shrink-0 cursor-pointer overflow-hidden rounded-[10px] bg-raised",
												selectedAtt?.id === att.id
													? "ring-2 ring-brand"
													: "ring-1 ring-hairline",
											)}
										>
											{att.kind === "image" ? (
												// eslint-disable-next-line @next/next/no-img-element
												<img
													src={att.previewUrl}
													alt=""
													className="h-full w-full object-cover"
												/>
											) : (
												<video
													src={att.previewUrl}
													muted
													playsInline
													className="h-full w-full object-cover"
												/>
											)}
											{att.caption.trim() && (
												<span className="absolute inset-x-0 bottom-0 h-[3px] bg-brand/80" />
											)}
											<button
												type="button"
												onClick={(e) => {
													e.stopPropagation();
													removeAttachment(att.id);
												}}
												aria-label="Remove attachment"
												className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-pill bg-scrim text-primary transition-colors hover:bg-page"
											>
												<RiCloseLine size={14} />
											</button>
											{att.kind === "image" && (
												<button
													type="button"
													onClick={(e) => {
														e.stopPropagation();
														setEditingAttId(att.id);
													}}
													aria-label="Edit image"
													className="absolute bottom-1 right-1 flex h-7 w-7 items-center justify-center rounded-pill bg-scrim text-primary transition-colors hover:bg-page"
												>
													<RiPencilLine size={13} />
												</button>
											)}
										</div>
									))}
									{attachments.length < 8 && (
										<button
											type="button"
											onClick={() => fileInputRef.current?.click()}
											aria-label="Add another file"
											className="flex h-[72px] w-11 shrink-0 cursor-pointer items-center justify-center rounded-[10px] bg-raised text-muted transition-colors hover:bg-chip hover:text-primary"
										>
											<RiAddLine size={18} />
										</button>
									)}
									{/* HD = a lighter cap, never the original (register 66). */}
									<button
										type="button"
										onClick={toggleHd}
										aria-pressed={hdSend}
										aria-label="Send in higher quality"
										title="Send in higher quality"
										className={clsx(
											"ml-auto flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center self-center rounded-pill transition-colors",
											hdSend
												? "bg-brand text-brand-on"
												: "bg-raised text-muted hover:text-primary",
										)}
									>
										<RiHdLine size={16} />
									</button>
								</div>
								{selectedAtt && (
									<input
										value={selectedAtt.caption}
										onChange={(e) =>
											setAttachments((prev) =>
												prev.map((a) =>
													a.id === selectedAtt.id
														? { ...a, caption: e.target.value }
														: a,
												),
											)
										}
										placeholder={
											attachments.length > 1
												? `Caption for item ${attachments.findIndex((a) => a.id === selectedAtt.id) + 1} of ${attachments.length}`
												: "Add a caption…"
										}
										className="mt-2 w-full rounded-[7px] bg-transparent px-1.5 py-1 font-sans text-[13px] text-primary outline-none placeholder:text-subtle"
									/>
								)}
							</div>
						)}

						{editingAtt && (
							<MediaEditor
								file={editingAtt.file}
								title="Edit image"
								onClose={() => setEditingAttId(null)}
								onSave={({ file }) =>
									applyEditedAttachment(editingAtt.id, file)
								}
							/>
						)}

						<div className="relative flex items-center gap-2 sm:gap-3">
							{/* Hidden File Input */}
							<input
								type="file"
								ref={fileInputRef}
								className="hidden"
								multiple
								accept="image/*,video/*"
								onChange={handleFileSelect}
							/>
							<ComposerInput
								ref={composerRef}
								disabled={false}
								hasAttachment={attachments.length > 0}
								gifEnabled={Boolean(GIPHY_KEY)}
								onSend={(text) => sendMessage(text)}
								onTyping={chat.notifyTyping}
								onStopTyping={chat.notifyStoppedTyping}
								onAttach={() => fileInputRef.current?.click()}
								onMoney={() => setShowSendMoney(true)}
								onGif={() => setShowGifPicker(true)}
								onFiles={addFiles}
								onRecordStart={(startPoint) => setRecording(startPoint)}
							/>
							{/* The recorder overlays the pill; gesture listeners live
							    on window, so this mount order is never fragile. */}
							{recording && (
								<VoiceRecorder
									start={recording}
									onSend={(blob, meta) => {
										setRecording(null);
										void sendVoiceNote(blob, meta);
									}}
									onClose={() => setRecording(null)}
									onError={(msg) => toast.error(msg)}
									onSignal={chat.notifyRecording}
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
					className="fixed z-dropdown w-[190px] overflow-hidden rounded-xl card-depth animate-rise"
					onClick={(e) => e.stopPropagation()}
				>
					{/* Quick-react row (register 134): the six, then a plus for
					    the full picker. A temp bubble can't be reacted to. */}
					{!msgMenu.message._id.startsWith("temp-") && (
						<div className="flex items-center gap-0.5 border-b border-hairline px-1.5 py-1.5">
							{QUICK_REACTIONS.map((emoji) => (
								<button
									key={emoji}
									type="button"
									onClick={() => {
										reactTo(msgMenu.message, emoji);
										setMsgMenu(null);
									}}
									aria-label={`React ${emoji}`}
									className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-pill text-[17px] transition-colors hover:bg-raised"
								>
									{emoji}
								</button>
							))}
							<button
								type="button"
								onClick={() => setMenuPicker((v) => !v)}
								aria-label="More reactions"
								className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-pill text-muted transition-colors hover:bg-raised hover:text-primary"
							>
								<Plus className="h-4 w-4" />
							</button>
						</div>
					)}
					{menuPicker && (
						<div className="border-b border-hairline p-1 ws-emoji-picker">
							<EmojiPicker
								theme={
									resolvedTheme === "light" ? Theme.LIGHT : Theme.DARK
								}
								width="100%"
								height={320}
								lazyLoadEmojis
								onEmojiClick={(e) => {
									reactTo(msgMenu.message, e.emoji);
									setMsgMenu(null);
								}}
							/>
						</div>
					)}
					<div className="py-1">
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
