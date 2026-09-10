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
	Users,
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
import { usePreferences } from "@/components/providers/PreferencesProvider";
import EmojiPicker, { Theme } from "emoji-picker-react";
import { useT } from "@/i18n/client";
import { getUserStoriesAction } from "@/lib/stories.actions";
import { startConversationAction } from "@/lib/conversation.actions";
import { getFollowingAction } from "@/lib/user.actions";
import { StoryViewer, type RailEntry } from "@/components/feed/StoryViewer";
import { toast } from "sonner";
import { useToast } from "@/components/ui/Toast/ToastContext";
import { format } from "date-fns";
import { formatLastSeen, formatTimeAgo } from "@/lib/utils";
import { useRealtime } from "../providers/RealtimeProvider";
import MediaModal from "../ui/MediaModal";
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
import { AnimatePresence, motion } from "framer-motion";
import { useCall } from "@/providers/CallProvider";
import { useChatSignals } from "@/hooks/useChatSignals";
import { ThreadList } from "@/components/messages/thread/ThreadList";
import {
	type ChatTheme,
	type ThemeByMode,
	type ThemeScope,
	resolveTheme,
	themeVars,
} from "@/components/messages/theme/chatTheme";
import { ThemeBackdrop } from "@/components/messages/theme/ThemeBackdrop";
import { ThemeGallery } from "@/components/messages/theme/ThemeGallery";
import { ThemeStudio } from "@/components/messages/theme/ThemeStudio";
import {
	fetchGlobalTheme,
	saveChatTheme,
	saveGlobalTheme,
} from "@/components/messages/theme/themeApi";
import { RiPaletteLine } from "@remixicon/react";
import type { BubbleLift } from "@/components/messages/thread/MessageBubble";
import {
	ComposerInput,
	type ComposerInputHandle,
} from "@/components/messages/thread/ComposerInput";
import type { VirtuosoHandle } from "react-virtuoso";
import { imageMeta, videoMeta } from "@/lib/media-meta";
import { conversationIdentity } from "@/lib/conversation-identity";
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
	RiReplyLine,
	RiUserAddLine,
	RiFileCopyLine,
	RiRestartLine,
} from "@remixicon/react";
// Tray stays Phosphor: it feeds the shared Tabs component (feed tabs use it
// too), which is Phosphor-typed and drives its own active weight. The Remix
// swap is for the chat MESSAGE glyphs, not the tab chrome.
import { Tray } from "@phosphor-icons/react";
import { SendMoneySheet } from "@/components/messages/SendMoneySheet";
import { GroupSheet } from "@/components/messages/GroupSheet";
import { GroupCreateModal } from "@/components/messages/GroupCreateModal";
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
	kind?: "dm" | "group";
	name?: string;
	avatar?: string;
	memberCount?: number;
	myRole?: "owner" | "admin" | "member";
	/** Group lock: only admins may post while true (register 99). */
	adminsOnly?: boolean;
	/** Member records with high-water read marks (gateway W1). */
	members?: {
		profile: string | { _id: string };
		readUpTo?: string;
		readUpToAt?: string;
		/** My chat theme for THIS thread, per mode (theme pack 2026-09-10). */
		theme?: ThemeByMode;
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
	// The thread opens/closes with shallow pushStates, so browser
	// back/forward only change the address bar — this maps the URL back
	// onto thread state.
	useEffect(() => {
		const onPop = () => {
			const m = window.location.pathname.match(
				/\/messages\/([a-f0-9]{24})/i,
			);
			if (!m) {
				setActiveConversation(null);
				return;
			}
			const conv = conversationsRef.current.find((c) => c._id === m[1]);
			if (conv) setActiveConversation(conv);
		};
		window.addEventListener("popstate", onPop);
		return () => window.removeEventListener("popstate", onPop);
	}, []);
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
	// The chat theme pack (owner 2026-09-10). Global (profile) + per-chat
	// (member record); per-chat wins; both per mode. Painted as CSS
	// variables on the thread pane, so a theme change re-paints without
	// re-rendering a single memoised bubble.
	const [globalTheme, setGlobalTheme] = useState<ThemeByMode>({});
	const [themeSheet, setThemeSheet] = useState<null | "gallery" | { studio: ThemeScope }>(null);
	const [themeSaving, setThemeSaving] = useState(false);
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
		/** Sharp copy of the pressed bubble, painted above the scrim. */
		lift?: BubbleLift;
	} | null>(null);
	const msgMenuOpenedAt = useRef(0);
	const [menuPicker, setMenuPicker] = useState(false);
	const [groupSheetOpen, setGroupSheetOpen] = useState(false);
	const [showGroupCreate, setShowGroupCreate] = useState(false);
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
	const { prefs } = usePreferences();
	const themeMode = resolvedTheme === "light" ? "light" : "dark";
	const myMemberTheme = useMemo(() => {
		const mine = activeConversation?.members?.find((mm) => {
			const pid = typeof mm.profile === "string" ? mm.profile : mm.profile?._id;
			return String(pid) === String(myProfileId);
		});
		return mine?.theme;
	}, [activeConversation, myProfileId]);
	const chatTheme = useMemo(
		() => resolveTheme(myMemberTheme, globalTheme, themeMode),
		[myMemberTheme, globalTheme, themeMode],
	);
	const hasPicture = chatTheme.wallpaper.type !== "flat";
	// The inbox wears the PROFILE-wide theme, never one chat's: a per-chat
	// picture belongs to that chat. Flat by default, so the section stays
	// the app's own colour until someone chooses otherwise.
	const sectionTheme = useMemo(
		() => resolveTheme(undefined, globalTheme, themeMode),
		[globalTheme, themeMode],
	);
	const sectionHasPicture = sectionTheme.wallpaper.type !== "flat";
	useEffect(() => {
		let gone = false;
		void fetchGlobalTheme(getToken)
			.then((t) => {
				if (!gone) setGlobalTheme(t);
			})
			.catch(() => {});
		return () => {
			gone = true;
		};
	}, [getToken]);
	/** Save to this chat or everywhere; null = back to the house default. */
	const applyTheme = async (theme: ChatTheme | null, scope: ThemeScope) => {
		setThemeSaving(true);
		try {
			if (scope === "all") {
				setGlobalTheme(await saveGlobalTheme(getToken, themeMode, theme));
			} else if (activeConversation) {
				const convId = activeConversation._id;
				const next = await saveChatTheme(getToken, convId, themeMode, theme);
				const patchMembers = (c: Conversation): Conversation =>
					c._id !== convId
						? c
						: {
								...c,
								members: (c.members ?? []).map((mm) => {
									const pid =
										typeof mm.profile === "string" ? mm.profile : mm.profile?._id;
									return String(pid) === String(myProfileId)
										? { ...mm, theme: next }
										: mm;
								}),
							};
				setConversations((prev) => prev.map(patchMembers));
				setActiveConversation((prev) => (prev ? patchMembers(prev) : prev));
			}
			setThemeSheet(null);
		} catch {
			toast.error("Couldn't save the theme");
		} finally {
			setThemeSaving(false);
		}
	};
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
				const res = await fetch(
					`${API_URL}/api/messages/conversations/${conversationId}`,
					{
						method: "DELETE",
						headers: { Authorization: `Bearer ${token}` },
					},
				);
				if (!res.ok) {
					// The gateway said no (e.g. a non-owner deleting a group).
					// Mutating local state anyway made rows vanish and then
					// resurrect on the next fetch (audit finding 4).
					const body = await res.json().catch(() => null);
					toast.error(
						body?.message || "Couldn't remove the conversation",
					);
					return;
				}
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

	/** Leave a group from the list swipe — self-remove, then purge. */
	const leaveGroupFromList = useCallback(
		async (conversationId: string) => {
			const meId = myProfileIdRef.current;
			if (!meId) return;
			try {
				const token = await getToken();
				const res = await fetch(
					`${API_URL}/api/messages/groups/${conversationId}/members/${meId}`,
					{
						method: "DELETE",
						headers: { Authorization: `Bearer ${token}` },
					},
				);
				if (!res.ok) {
					const body = await res.json().catch(() => null);
					toast.error(body?.message || "Couldn't leave the group");
					return;
				}
				setConversations((prev) =>
					prev.filter((c) => c._id !== conversationId),
				);
				setMessageCache((prev) => {
					const { [conversationId]: _gone, ...rest } = prev;
					return rest;
				});
				setActiveConversation((prev) =>
					prev?._id === conversationId ? null : prev,
				);
			} catch {
				toast.error("Couldn't leave the group");
			}
		},
		[getToken],
	);

	const messagesEndRef = useRef<HTMLDivElement>(null);
	const activeIdRef = useRef<string | null>(null);
	/** True once any thread has been opened this mount (see fetchConversations). */
	const openedOnceRef = useRef(false);
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
	// Unread count at the moment the thread opened — the divider anchors to
	// it; the list's own count is zeroed by mark-read a beat later.
	// biome-ignore lint/correctness/useExhaustiveDependencies: captured per open
	const unreadAtOpen = useMemo(
		() => activeConversation?.unreadCount ?? 0,
		[activeConversation?._id],
	);
	const [recording, setRecording] = useState<RecorderStart | null>(null);
	// The send flight (owner pick): the composer's text lifts out of the
	// field, becomes a bubble and lands at the bottom of the thread.
	const [flight, setFlight] = useState<{
		key: string;
		text: string;
		from: { left: number; top: number; width: number; height: number };
		to: { left: number; top: number; width: number };
	} | null>(null);
	const threadPaneRef = useRef<HTMLDivElement | null>(null);
	// Failed TEXT sends keep their bubble (owner pick); this remembers what
	// to resend when the red mark is tapped.
	const textRetryRef = useRef(
		new Map<string, { text: string; convId: string; replyTo: Message | null }>(),
	);
	// Empty inbox = people you follow, one tap from a first message (owner
	// pick: "suggested people" instead of a lone empty note).
	const [suggested, setSuggested] = useState<any[] | null>(null);
	const [startingWith, setStartingWith] = useState<string | null>(null);
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
		const t = textRetryRef.current.get(clientKey);
		if (t) {
			textRetryRef.current.delete(clientKey);
			removeByClientKey(t.convId, clientKey);
			void sendText(t.text, t.convId, t.replyTo);
			return;
		}
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
		if (activeConversation?._id) openedOnceRef.current = true;
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
			// Skeletons belong to the FIRST load only. Every refresh — a
			// rename, a lock flip, a member add, an incoming message —
			// called this and flipped the whole inbox back to placeholders,
			// so a one-tap action looked like a page reload (owner
			// 2026-09-02). A refresh now repaints in place.
			if (conversationsRef.current.length === 0)
				setIsLoadingConversations(true);
			const token = await getToken();
			const response = await axios.get(
				`${API_URL}/api/messages/conversations`,
				{
					headers: { Authorization: `Bearer ${token}` },
				},
			);
			setConversations(response.data);

			// Warm the top of the inbox (register 35, the part that matters):
			// the newest page of the first few uncached threads loads quietly
			// now, so tapping between chats paints instantly instead of
			// flashing a loading state. Fire-and-forget, absent-only writes —
			// an open thread's fresher cache always wins.
			void (async () => {
				const targets = (response.data as Conversation[])
					.slice(0, 8)
					.filter((c) => !(messageCache[c._id]?.length > 0));
				await Promise.all(
					targets.map(async (c) => {
						try {
							const r = await axios.get(
								`${API_URL}/api/messages/${c._id}?limit=30`,
								{ headers: { Authorization: `Bearer ${token}` } },
							);
							setMessageCache((prev) =>
								prev[c._id]?.length
									? prev
									: { ...prev, [c._id]: r.data },
							);
						} catch {
							/* a cold thread just loads on open like before */
						}
					}),
				);
			})();

			// Re-sync the thread that is actually OPEN. Opens are shallow
			// pushStates, so the mount-time route param goes stale; keying
			// on it flipped the pane back to the URL's thread on every
			// refetch (group rename, add, lock...). The prop only picks the
			// first thread when nothing has been opened yet.
			const wantId =
				activeIdRef.current ??
				(openedOnceRef.current ? null : initialConversationId);
			if (wantId) {
				const target = response.data.find(
					(c: Conversation) => c._id === wantId,
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
		if (ablyMessage?.data?.type === "theme:updated") {
			// Another tab or device saved the profile theme.
			void fetchGlobalTheme(getToken).then(setGlobalTheme).catch(() => {});
			return;
		}
		if (
			ablyMessage.name === "event" &&
			(ablyMessage.data.type === "conversation:deleted" ||
				ablyMessage.data.type === "conversation:removed")
		) {
			// The owner deleted the group. Open clients drop it in place
			// instead of ghosting on a dead id.
			const goneId = String(ablyMessage.data.conversationId ?? "");
			setConversations((prev) => prev.filter((c) => c._id !== goneId));
			setMessageCache((prev) => {
				const { [goneId]: _gone, ...rest } = prev;
				return rest;
			});
			if (activeIdRef.current === goneId) {
				setActiveConversation(null);
				if (ablyMessage.data.type === "conversation:deleted")
					toast.error("This group was deleted");
				else if (!ablyMessage.data.left)
					toast.error("You were removed from the group");
			}
			return;
		}
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
			// A system row IS a group change (rename, add, remove, lock,
			// role). Refetch so the header, roster, mention candidates and
			// the composer lock reflect it for every member, not only the
			// actor whose sheet refetched (audit 2026-09-10).
			if (!known || newMessage?.type === "system")
				void fetchConversations();

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
		// Where the text is now and where the bubble will land — measured
		// before React moves anything.
		const fromRect = composerRef.current?.getRect();
		const paneRect = threadPaneRef.current?.getBoundingClientRect();
		if (fromRect && paneRect && text && !isGroupThread) {
			const width = Math.min(fromRect.width, 280);
			setFlight({
				key: clientKey,
				text,
				from: { left: fromRect.left, top: fromRect.top, width: fromRect.width, height: fromRect.height },
				to: { left: paneRect.right - width - 24, top: paneRect.bottom - 48, width },
			});
		}
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
			// The bubble STAYS (owner pick): red mark + tap to retry, instead of
			// vanishing into a toast and reappearing in the composer.
			patchByClientKey(convId, clientKey, { failed: true });
			textRetryRef.current.set(clientKey, {
				text,
				convId,
				replyTo: currentReply,
			});
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
			// The conversation channel is publish-open to any signed-in
			// client, so only a sender who is actually in this thread may
			// paint a reaction (audit 2026-09-10).
			const conv = conversationsRef.current.find((c) => c._id === convId);
			if (conv && e.from) {
				const allowed =
					(conv as any).kind === "group"
						? new Set(
								((conv as any).members ?? [])
									.filter((m: any) => !m.leftAt)
									.map((m: any) => String(m.profile?._id ?? m.profile)),
							)
						: new Set([
								String(conv.otherParticipant?._id ?? ""),
								String(myProfileId ?? ""),
							]);
				if (!allowed.has(e.from)) return;
			}
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

	const headerIdentity = useMemo(
		() => conversationIdentity(activeConversation as any),
		[activeConversation],
	);
	const isGroupThread = headerIdentity.kind === "group";

	/** Did I LEAVE this group? History stays readable; writes are gone. */
	const iLeftGroup = useMemo(() => {
		if (!isGroupThread || !activeConversation || !myProfileId) return false;
		const mine = (activeConversation.members ?? []).find((m) => {
			const pid =
				typeof m.profile === "string" ? m.profile : m.profile?._id;
			return String(pid) === String(myProfileId);
		}) as { leftAt?: string } | undefined;
		return !mine || Boolean(mine.leftAt);
	}, [isGroupThread, activeConversation, myProfileId]);

	/** Active roster minus me — money targets, @mention candidates. */
	const groupRoster = useMemo(() => {
		if (!isGroupThread || !activeConversation) return [];
		const activeIds = new Set(
			(activeConversation.members ?? [])
				.filter((m) => !(m as { leftAt?: string }).leftAt)
				.map((m) =>
					String(
						typeof m.profile === "string" ? m.profile : m.profile?._id,
					),
				),
		);
		return (activeConversation.participants ?? [])
			.filter(
				(p) =>
					activeIds.has(String(p._id)) &&
					String(p._id) !== String(myProfileId),
			)
			.map((p) => ({
				id: String(p._id),
				name:
					`${p.firstName ?? ""} ${p.lastName ?? ""}`.trim() ||
					p.username ||
					"Member",
				username: p.username,
				avatar: p.avatar,
			}));
	}, [isGroupThread, activeConversation, myProfileId]);

	/** "Alice is typing…", "Alice and Bob are typing…", then "several
	 *  people…" — names, never "someone" (owner 2026-09-02, register 106). */
	const groupActivityLine = useCallback(
		(typers: { id: string; kind: "typing" | "recording" }[]) => {
			if (typers.length === 0) return null;
			const names = typers
				.map(
					(t) =>
						groupRoster.find((m) => m.id === t.id)?.name?.split(" ")[0],
				)
				.filter(Boolean) as string[];
			if (names.length === 1)
				return typers[0].kind === "recording"
					? `${names[0]} is recording audio…`
					: `${names[0]} is typing…`;
			if (names.length === 2)
				return `${names[0]} and ${names[1]} are typing…`;
			if (names.length > 2) return "several people are typing…";
			// Roster miss (someone just added): stay generic rather than wrong.
			return typers[0].kind === "recording"
				? "recording audio…"
				: "typing…";
		},
		[groupRoster],
	);

	/** The persisted read mark that drives ticks (survives reload).
	 *  DM: the peer's mark. GROUP: the MINIMUM across the other active
	 *  members — gold means read by ALL, the WhatsApp rule. The live
	 *  one-member `readAt` signal is deliberately ignored in groups: one
	 *  reader out of nine must not light the gold tick (audit finding 9). */
	const peerReadUpTo = useMemo(() => {
		if (isGroupThread) {
			const marks = (activeConversation?.members ?? [])
				.filter((x) => {
					const pid =
						typeof x.profile === "string" ? x.profile : x.profile?._id;
					return (
						!(x as { leftAt?: string }).leftAt &&
						String(pid) !== String(myProfileId)
					);
				})
				.map((x) => (x.readUpTo ? String(x.readUpTo) : null));
			if (marks.length === 0 || marks.some((m) => m === null))
				return null;
			return (marks as string[]).sort()[0];
		}
		const peerId = activeConversation?.otherParticipant?._id;
		const mm = activeConversation?.members?.find((x) => {
			const pid = typeof x.profile === "string" ? x.profile : x.profile?._id;
			return String(pid) === String(peerId);
		});
		return mm?.readUpTo ? String(mm.readUpTo) : null;
	}, [activeConversation, isGroupThread, myProfileId]);

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
			onMenu: (x: number, y: number, m: unknown, lift?: BubbleLift) =>
				setMsgMenu({ x, y, message: m as Message, lift }),
			onJump: jumpToMessage,
			onMediaClick: handleMediaClick,
			onRetryUpload: retryUpload,
			onCancelUpload: cancelUpload,
			onReact: reactTo,
			onStory: (ref: { story: string; thumbnail: string; authorUsername: string }) =>
				void openStoryRef(ref),
			onCallBack: (video: boolean) => {
				if (!activeConversation) return;
				// Same branch as the header buttons: a group call-back was
				// placing a DM-shaped call into the room, so the first
				// member to decline ended it for everyone (audit 2026-09-10).
				if ((activeConversation as any).kind === "group") {
					startCall({
						conversationId: activeConversation._id,
						peer: {
							id: activeConversation._id,
							name: headerIdentity.title,
							avatar: headerIdentity.avatar,
							username: "",
						},
						isVideo: video,
						isGroup: true,
					});
					return;
				}
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


	return (
		// 100dvh, not 100vh: on mobile 100vh is the address-bar-expanded height,
		// so the composer sat below the fold until the bar collapsed.
		<div
			style={themeVars(sectionTheme)}
			className="relative flex h-[100dvh] bg-page text-primary overflow-hidden"
		>
			{/* The section's own ground, when the profile theme has one. */}
			<ThemeBackdrop wallpaper={sectionTheme.wallpaper} />
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

			{/* Sidebar. On a phone it stays mounted UNDER the thread pane;
			    open/close is static (owner 2026-09-06) — no parallax slide. */}
			<div
				className={clsx(
					"relative z-10 flex w-full shrink-0 min-w-0 flex-col md:w-[360px]",
					sectionHasPicture && "bg-page/70",
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
							<span className="flex h-5 min-w-5 items-center justify-center rounded-pill bg-brand px-1.5 font-sans text-[calc(11px*var(--ws-fs))] font-bold tabular-nums text-brand-on">
								{totalUnread}
							</span>
						)}
						{/* One segmented pill (owner 2026-09-06): the paired controls
						    share a card split by a hairline — not two floating
						    chips. No outer border; the fill is the same faint
						    white wash as the active chat chip. */}
						<span className="ml-auto flex items-center overflow-hidden rounded-pill bg-primary/10">
							<button
								type="button"
								onClick={() => setShowGroupCreate(true)}
								aria-label="New group"
								title="New group"
								className="flex h-9 w-11 cursor-pointer items-center justify-center text-muted transition-colors hover:bg-chip hover:text-primary"
							>
								<Users className="h-[18px] w-[18px]" />
							</button>
							<span aria-hidden className="h-5 w-px bg-hairline" />
							<button
								type="button"
								onClick={() => setShowNewConversationModal(true)}
								aria-label={t("messages.newChat")}
								className="flex h-9 w-11 cursor-pointer items-center justify-center text-muted transition-colors hover:bg-chip hover:text-primary"
							>
								<RiUserAddLine size={19} />
							</button>
						</span>
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
							// Same faint white wash as the control pills and the
							// active chat chip — one fill across the header.
							className="h-9 w-full rounded-pill bg-primary/10 pl-10 pr-4 text-base text-primary outline-none transition-colors placeholder:text-subtle focus:bg-primary/15 sm:text-sm"
						/>
					</div>
				</div>

				{/* pb-nav: the conversation list is the one messages view where the
				    fixed mobile bottom nav is still on screen. */}
				<div className="flex-1 overflow-y-auto overscroll-contain pb-nav md:pb-0">
					{/* Stories of the people you're aligned with — messaging is
					    where you already are when you want to reply to one. */}
					{prefs.messaging.inboxStories && (
						<div className="px-2 pt-1">
							<StoriesRail />
						</div>
					)}
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
					{conversations.length === 0 && !isLoadingConversations && (
						<SuggestedPeople
							myProfileId={myProfileId ?? ""}
							people={suggested}
							onLoad={() => {
								if (suggested !== null || !myProfileId) return;
								setSuggested([]);
								void getFollowingAction(myProfileId).then((r: any) =>
									setSuggested(Array.isArray(r?.data) ? r.data : []),
								);
							}}
							startingWith={startingWith}
							onMessage={async (u) => {
								setStartingWith(u._id);
								const r: any = await startConversationAction(u._id);
								setStartingWith(null);
								const id = r?.data?._id ?? r?.data?.conversation?._id;
								if (r?.success && id) {
									router.push(`/messages/${id}`);
									router.refresh();
								} else {
									toast.error(r?.message || "Couldn't start that chat");
								}
							}}
						/>
					)}
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
							// Shallow open: router.push remounts the root
							// template (app/template.tsx) and the whole page
							// skeletons. Swap the URL by hand; Next syncs
							// usePathname without a navigation.
							setActiveConversation(conv as any);
							const base = window.location.pathname.replace(
								/\/messages(\/.*)?$/,
								"/messages",
							);
							window.history.pushState(
								{ wsChat: conv._id },
								"",
								`${base}/${conv._id}`,
							);
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

			{/* Chat Area. Open and close are STATIC (owner 2026-09-06): the
			    pane appears and disappears in place — no push, no slide.
			    The desktop class stays md:relative and NOT md:static:
			    ThemeBackdrop is absolute inset-0 and needs this pane as its
			    positioned ancestor; static let it resolve against the whole
			    MessageBox and paint over the inbox list. */}
			{activeConversation ? (
				<div
					key={activeConversation._id}
					style={themeVars(chatTheme)}
					className="absolute inset-0 z-10 flex min-w-0 flex-col bg-page md:relative md:inset-auto md:z-auto md:flex-1 md:border-l md:border-hairline"
				>
					{/* This chat's picture (per-chat theme, else the profile's).
					    Only the message list floats on it: the header and the
					    composer keep a band of the page colour, or the chrome
					    reads as mush over the photograph. */}
					<ThemeBackdrop wallpaper={chatTheme.wallpaper} />
					<div className={clsx("relative z-10 flex h-14 shrink-0 items-center justify-between gap-2 border-b border-hairline/60 px-2 md:px-5", hasPicture && "bg-page/80")}>
						<div className="flex items-center gap-2 md:gap-3 min-w-0">
							<button
								type="button"
								onClick={() => {
									// Shallow, like the open: clear the pane and put
									// the inbox URL back without a navigation, so
									// the list is exactly as you left it.
									setActiveConversation(null);
									const base = window.location.pathname.replace(
										/\/messages(\/.*)?$/,
										"/messages",
									);
									window.history.pushState({}, "", base);
								}}
								aria-label="Back to conversations"
								className="md:hidden h-11 w-11 shrink-0 flex items-center justify-center rounded-pill text-muted hover:text-primary hover:bg-raised transition-colors"
							>
								<ArrowLeft className="w-5 h-5" />
							</button>
							{/* The face and the name open the profile. Tapping the
							    person you are talking to and having nothing happen is
							    the first thing anyone tries in a thread. */}
							{/* DM header links to the peer's profile; a group header
							    opens the member sheet — a group has no one profile. */}
							{isGroupThread ? (
								<button
									type="button"
									onClick={() => !iLeftGroup && setGroupSheetOpen(true)}
									className="flex min-w-0 items-center gap-2 rounded-xl px-1 py-1 text-left transition-colors hover:bg-raised md:gap-3"
								>
									<span className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-pill bg-raised">
										{headerIdentity.avatar ? (
											<SafeAvatar
												src={headerIdentity.avatar}
												width={36}
												height={36}
												className="h-9 w-9 rounded-pill object-cover"
												alt="group"
											/>
										) : (
											<Users className="h-5 w-5 text-muted" />
										)}
									</span>
									<div className="min-w-0">
										<h2 className="truncate font-semibold text-[calc(15px*var(--ws-fs))]">
											{headerIdentity.title}
										</h2>
										{chat.typers.length > 0 ? (
											<p className="truncate text-xs text-gold">
												{groupActivityLine(chat.typers)}
											</p>
										) : (
											<p className="truncate text-xs text-muted">
												{headerIdentity.memberCount ?? 0} members
											</p>
										)}
									</div>
								</button>
							) : (
								<Link
									href={`/profile/${activeConversation.otherParticipant?.username ?? ""}`}
									className="flex min-w-0 items-center gap-2 rounded-xl px-1 py-1 transition-colors hover:bg-raised md:gap-3"
								>
								<span className="relative shrink-0">
									<SafeAvatar
										src={activeConversation.otherParticipant?.avatar}
										width={36}
										height={36}
										className="h-9 w-9 rounded-pill object-cover"
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
									<h2 className="flex items-center gap-1 font-semibold text-[calc(15px*var(--ws-fs))] truncate">
										<span className="min-w-0 truncate">
											{activeConversation.otherParticipant?.firstName}{" "}
											{activeConversation.otherParticipant?.lastName}
										</span>
										<UserBadges
											isVerified={
												(activeConversation.otherParticipant as any)
													?.isVerified
											}
											verification={
												(activeConversation.otherParticipant as any)
													?.verification
											}
											badges={
												(activeConversation.otherParticipant as any)
													?.badges
											}
											size={14}
										/>
									</h2>
									{!isConnected ? (
										<p className="truncate text-xs text-danger">
											Waiting for network…
										</p>
									) : chat.peerRecording ? (
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
											@{activeConversation.otherParticipant?.username}
										</p>
									)}
								</div>
								</Link>
							)}
						</div>
					<button
							type="button"
							onClick={() => setThemeSheet("gallery")}
							aria-label="Chat theme"
							title="Chat theme"
							className="mr-1.5 flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-pill text-muted transition-colors hover:bg-primary/10 hover:text-primary"
						>
							<RiPaletteLine size={20} />
						</button>
					{/* Audio | video as ONE segmented pill (owner 2026-09-06):
						    no outer border, the faint white wash as fill, a
						    hairline between the segments. */}
						<div className="flex shrink-0 items-center overflow-hidden rounded-pill bg-primary/10 text-muted">
							{isGroupThread && (
								<>
									<button
										type="button"
										aria-label="Start group voice call"
										className="flex h-10 w-12 cursor-pointer items-center justify-center text-muted transition-colors hover:bg-chip hover:text-primary"
										onClick={() =>
											startCall({
												conversationId: activeConversation._id,
												peer: {
													id: activeConversation._id,
													name: headerIdentity.title,
													avatar: headerIdentity.avatar,
													username: "",
												},
												isVideo: false,
												isGroup: true,
											})
										}
									>
										<Phone className="w-5 h-5" />
									</button>
									<span aria-hidden className="h-5 w-px bg-hairline" />
									<button
										type="button"
										aria-label="Start group video call"
										className="flex h-10 w-12 cursor-pointer items-center justify-center text-muted transition-colors hover:bg-chip hover:text-primary"
										onClick={() =>
											startCall({
												conversationId: activeConversation._id,
												peer: {
													id: activeConversation._id,
													name: headerIdentity.title,
													avatar: headerIdentity.avatar,
													username: "",
												},
												isVideo: true,
												isGroup: true,
											})
										}
									>
										<Video className="w-5 h-5" />
									</button>
								</>
							)}
							{!isGroupThread && (
							<>
							<button
								type="button"
								aria-label="Start voice call"
								className="flex h-10 w-12 cursor-pointer items-center justify-center text-muted transition-colors hover:bg-chip hover:text-primary"
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
							<span aria-hidden className="h-5 w-px bg-hairline" />
							<button
								type="button"
								aria-label="Start video call"
								className="flex h-10 w-12 cursor-pointer items-center justify-center text-muted transition-colors hover:bg-chip hover:text-primary"
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
							</>
							)}
						</div>
					</div>

					<div
						ref={threadPaneRef}
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
						{dragOver && (
							<div className="pointer-events-none absolute inset-2 z-20 flex items-center justify-center rounded-xl border-2 border-dashed border-brand bg-page/60">
								<span className="rounded-pill bg-raised px-4 py-2 font-sans text-[calc(13px*var(--ws-fs))] font-semibold text-primary">
									Drop to send
								</span>
							</div>
						)}
						<div className="relative z-10 flex min-h-0 flex-1 flex-col">
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
							isGroup={isGroupThread}
							deliveredAt={isGroupThread ? null : chat.deliveredAt}
							readAt={isGroupThread ? null : chat.readAt}
							peerReadUpTo={peerReadUpTo}
							pendingNew={pendingNew}
							loading={isLoadingMessages}
							peerAvatar={activeConversation.otherParticipant?.avatar}
							myAvatar={me?.avatar || user?.imageUrl || undefined}
							peer={{
								name: headerIdentity.title,
								username: activeConversation.otherParticipant?.username,
								avatar: headerIdentity.avatar,
							}}
							unreadAtOpen={unreadAtOpen}
							onLoadOlder={loadOlder}
							onAtBottomChange={handleAtBottom}
							onShowNew={() => scrollToBottom()}
							handlers={bubbleHandlers}
						/>
						</div>
					</div>

					{/* shrink-0 + pb-safe: the composer is the flex row that must never
					    be squeezed out, and it sits on the iOS home indicator. */}
					<div className={clsx("relative z-10 shrink-0 px-3 pb-safe pt-2 sm:px-4", hasPicture && "bg-page/80")}>
						{/* What you are answering, above the input, with a way out.
						    Sending clears it; so does Escape, because a reply you
						    cannot cancel is a trap. */}
						{replyTarget && (
							/* Same modern quote grammar as the bubbles: soft inset
							   chip, gold name, no border bar. */
							<div className="mb-2 flex items-center gap-2 rounded-[10px] bg-sunken px-3 py-2">
								<span className="flex min-w-0 flex-1 flex-col gap-0.5">
									<span className="truncate font-sans text-[calc(11.5px*var(--ws-fs))] font-semibold text-gold">
										Replying to{" "}
										{replyTarget.sender?._id === myProfileId
											? "yourself"
											: `@${replyTarget.sender?.username ?? ""}`}
									</span>
									<span className="truncate font-sans text-[calc(12.5px*var(--ws-fs))] text-subtle">
										{quotedPreview(replyTarget)}
									</span>
								</span>
								<button
									type="button"
									onClick={() => setReplyTarget(null)}
									aria-label="Cancel reply"
									className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-pill text-subtle transition-colors hover:bg-raised hover:text-primary"
								>
									<RiCloseLine size={15} />
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
									<span className="block truncate font-sans text-[calc(12px*var(--ws-fs))] font-semibold text-primary">
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
								<span className="shrink-0 font-sans text-[calc(11px*var(--ws-fs))] tabular-nums text-muted">
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
										className="mt-2 w-full rounded-[7px] bg-transparent px-1.5 py-1 font-sans text-[calc(13px*var(--ws-fs))] text-primary outline-none placeholder:text-subtle"
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

						{activeConversation.isRequestForMe ? (
							// The decision sits where the reply would (owner pick,
							// Instagram): a slim bar in the composer's place.
							<div className="flex items-center gap-2 rounded-xl bg-raised/70 px-3 py-2">
								<span className="min-w-0 flex-1 font-sans text-[calc(12px*var(--ws-fs))] text-muted">
									Accept to reply. They won't know you've seen this.
								</span>
								<button
									type="button"
									onClick={() => void declineRequest(activeConversation._id)}
									className="h-8 shrink-0 cursor-pointer rounded-pill px-3 font-sans text-[calc(12px*var(--ws-fs))] font-medium text-danger transition-colors hover:bg-chip"
								>
									Delete
								</button>
								<button
									type="button"
									onClick={() => void acceptRequest(activeConversation._id)}
									className="h-8 shrink-0 cursor-pointer rounded-pill bg-brand px-3.5 font-sans text-[calc(12px*var(--ws-fs))] font-semibold text-brand-on transition-colors hover:bg-brand-active"
								>
									Accept
								</button>
							</div>
						) : iLeftGroup ? (
							<div className="flex h-[52px] items-center justify-center rounded-2xl bg-raised/70 px-4">
								<span className="font-sans text-[calc(13px*var(--ws-fs))] text-muted">
									You left this group
								</span>
							</div>
						) : isGroupThread &&
						activeConversation.adminsOnly &&
						activeConversation.myRole === "member" ? (
							<div className="flex h-[52px] items-center justify-center rounded-2xl bg-raised/70 px-4">
								<span className="font-sans text-[calc(13px*var(--ws-fs))] text-muted">
									Only admins can send messages in this group
								</span>
							</div>
						) : (
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
								mentionCandidates={
									isGroupThread ? groupRoster : undefined
								}
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
						)}
					</div>
				</div>
			) : (
				<div
					key="empty"
					className={clsx(
						"flex-1 flex flex-col items-center justify-center text-muted p-8",
						"hidden md:flex",
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

			{/* The send flight (owner pick): text lifts from the field, rounds
			    into a bubble and lands where the optimistic bubble appears. */}
			<AnimatePresence>
				{flight && (
					<motion.div
						key={flight.key}
						initial={{
							left: flight.from.left,
							top: flight.from.top,
							width: flight.from.width,
							borderRadius: 999,
							backgroundColor: "rgba(34,184,214,0)",
							opacity: 0.95,
						}}
						animate={{
							left: flight.to.left,
							top: flight.to.top,
							width: flight.to.width,
							borderRadius: 22,
							backgroundColor: "var(--chat-accent, var(--ws-brand-primary))",
							opacity: 1,
						}}
						exit={{ opacity: 0, transition: { duration: 0.1 } }}
						transition={{ duration: 0.32, ease: [0.2, 0, 0, 1] }}
						onAnimationComplete={() => setFlight(null)}
						className="pointer-events-none fixed z-modal max-h-24 overflow-hidden px-4 py-2.5 font-sans text-sm leading-relaxed text-white"
					>
						{flight.text}
					</motion.div>
				)}
			</AnimatePresence>

			{/* New Conversation Modal */}
			<GifPicker
				open={showGifPicker}
				onClose={() => setShowGifPicker(false)}
				onPick={(url) => void sendGif(url)}
			/>
						{groupSheetOpen && activeConversation && isGroupThread && myProfileId && (
				<GroupSheet
					open={groupSheetOpen}
					onClose={() => setGroupSheetOpen(false)}
					conversationId={activeConversation._id}
					name={headerIdentity.title}
					avatar={headerIdentity.avatar}
					adminsOnly={Boolean(activeConversation.adminsOnly)}
					currentClerkId={user?.id || ""}
					members={(activeConversation.members ?? []) as any}
					participants={(activeConversation.participants ?? []) as any}
					myProfileId={myProfileId}
					onChanged={() => {
						setGroupSheetOpen(false);
						void fetchConversations();
					}}
					onLeft={() => {
						// Purge NOW — the refetch confirms, but stale local state
						// is exactly how a left group reopened with a live
						// composer (audit finding 3).
						const goneId = activeConversation._id;
						setConversations((prev) =>
							prev.filter((c) => c._id !== goneId),
						);
						setMessageCache((prev) => {
							const { [goneId]: _gone, ...rest } = prev;
							return rest;
						});
						setActiveConversation(null);
						void fetchConversations();
						goBack("/messages");
					}}
				/>
			)}
			<GroupCreateModal
				isOpen={showGroupCreate}
				onClose={() => setShowGroupCreate(false)}
				currentUserId={user?.id || ""}
				onCreated={(cid) => {
					void fetchConversations();
					router.push(`/messages/${cid}`);
				}}
			/>
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
					members={isGroupThread ? groupRoster : undefined}
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
					<div className="relative w-[320px] rounded-xl bg-surface p-5 shadow-nav animate-pop">
						<p className="font-sans text-[calc(14.5px*var(--ws-fs))] font-semibold text-primary">
							{pendingDeleteConv.kind === "group"
								? pendingDeleteConv.myRole === "owner"
									? "Delete this group?"
									: "Leave this group?"
								: "Delete this conversation?"}
						</p>
						<p className="mt-1 font-sans text-[calc(12.5px*var(--ws-fs))] text-muted">
							{pendingDeleteConv.kind === "group"
								? pendingDeleteConv.myRole === "owner"
									? "The group and its messages are removed for everyone. This can't be undone."
									: "You'll stop receiving messages. The group keeps going without you."
								: "The whole thread is removed for both of you. This can't be undone."}
						</p>
						<div className="mt-4 flex justify-end gap-2">
							<button
								type="button"
								onClick={() => setPendingDeleteConv(null)}
								className="h-9 cursor-pointer rounded-pill bg-raised px-4 font-sans text-[calc(13px*var(--ws-fs))] font-medium text-primary transition-colors hover:bg-chip"
							>
								Keep
							</button>
							<button
								type="button"
								onClick={() => {
									// Swipe on a group row means LEAVE unless you
									// own it — deletion is the owner's call
									// (audit finding 4, the platform norm).
									if (
										pendingDeleteConv.kind === "group" &&
										pendingDeleteConv.myRole !== "owner"
									) {
										void leaveGroupFromList(
											pendingDeleteConv._id,
										);
									} else {
										void declineRequest(pendingDeleteConv._id);
									}
									setPendingDeleteConv(null);
								}}
								className="h-9 cursor-pointer rounded-pill bg-danger px-4 font-sans text-[calc(13px*var(--ws-fs))] font-semibold text-white transition-colors hover:opacity-90"
							>
								{pendingDeleteConv.kind === "group" &&
								pendingDeleteConv.myRole !== "owner"
									? "Leave"
									: "Delete"}
							</button>
						</div>
					</div>
				</div>
			)}

			{msgMenu && (() => {
				// Long-press grammar (owner pick, Instagram): the thread dims
				// and blurs; the PRESSED bubble is repainted sharp above the
				// scrim (its live DOM sits under the blur), with the reaction
				// bar hugging its top edge and the actions its bottom.
				const vw = window.innerWidth;
				const vh = window.innerHeight;
				const r = msgMenu.lift?.rect;
				const alignRight = msgMenu.lift?.mine ?? false;
				const barLeft = r
					? Math.max(8, Math.min(alignRight ? r.left + r.width - 292 : r.left, vw - 300))
					: Math.max(8, Math.min(msgMenu.x - 120, vw - 300));
				const barTop = r
					? Math.max(8, r.top - 54)
					: Math.max(8, msgMenu.y - 62);
				const menuLeft = r
					? Math.max(8, Math.min(alignRight ? r.left + r.width - 190 : r.left, vw - 198))
					: Math.min(msgMenu.x, vw - 200);
				const menuTop = r
					? Math.min(r.top + r.height + 8, vh - 260)
					: Math.min(msgMenu.y + 8, vh - 220);
				return (
				<div className="fixed inset-0 z-modal" onClick={() => setMsgMenu(null)}>
					<div className="absolute inset-0 bg-black/45 backdrop-blur-[2px] animate-pop" />
					{msgMenu.lift && (
						<div
							aria-hidden
							className="pointer-events-none absolute animate-pop"
							style={{
								left: r!.left,
								top: r!.top,
								width: r!.width,
								height: r!.height,
							}}
							// Our own already-rendered markup, captured verbatim —
							// React escaped the message text on first render.
							dangerouslySetInnerHTML={{ __html: msgMenu.lift.html }}
						/>
					)}
					{!msgMenu.message._id.startsWith("temp-") && (
						<div
							style={{
								left: barLeft,
								top: barTop,
							}}
							className="absolute flex items-center gap-0.5 rounded-pill card-depth px-1.5 py-1 animate-pop"
							onClick={(e) => e.stopPropagation()}
						>
							{QUICK_REACTIONS.map((emoji) => (
								<button
									key={emoji}
									type="button"
									onClick={() => {
										reactTo(msgMenu.message, emoji);
										setMsgMenu(null);
									}}
									aria-label={`React ${emoji}`}
									className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-pill text-[calc(20px*var(--ws-fs))] transition-transform hover:scale-125"
								>
									{emoji}
								</button>
							))}
							<button
								type="button"
								onClick={() => setMenuPicker((v) => !v)}
								aria-label="More reactions"
								className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-pill text-muted transition-colors hover:bg-raised hover:text-primary"
							>
								<Plus className="h-4 w-4" />
							</button>
						</div>
					)}
				<div
					role="menu"
					style={{
						left: menuLeft,
						top: menuTop,
					}}
					className="absolute w-[190px] overflow-hidden rounded-xl card-depth animate-pop"
					onClick={(e) => e.stopPropagation()}
				>
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
						className="flex w-full cursor-pointer items-center gap-2.5 px-3.5 py-2.5 text-left font-sans text-[calc(13px*var(--ws-fs))] font-medium text-primary transition-colors hover:bg-raised"
					>
						<RiReplyLine size={16} />
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
							className="flex w-full cursor-pointer items-center gap-2.5 px-3.5 py-2.5 text-left font-sans text-[calc(13px*var(--ws-fs))] font-medium text-primary transition-colors hover:bg-raised"
						>
							<RiFileCopyLine size={16} />
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
							className="flex w-full cursor-pointer items-center gap-2.5 px-3.5 py-2.5 text-left font-sans text-[calc(13px*var(--ws-fs))] font-medium text-danger transition-colors hover:bg-raised"
						>
							<RiRestartLine size={16} />
							Unsend
						</button>
					)}
				</div>
					</div>
				</div>
				);
			})()}

			{themeSheet === "gallery" && activeConversation && (
				<ThemeGallery
					mode={themeMode}
					current={chatTheme}
					isGroup={isGroupThread}
					saving={themeSaving}
					onClose={() => setThemeSheet(null)}
					onApply={(t, scope) => void applyTheme(t, scope)}
					onReset={(scope) => void applyTheme(null, scope)}
					onAdvanced={(scope) => setThemeSheet({ studio: scope })}
				/>
			)}
			{themeSheet && themeSheet !== "gallery" && activeConversation && (
				<ThemeStudio
					mode={themeMode}
					initial={chatTheme}
					scope={themeSheet.studio}
					conversationId={activeConversation._id}
					isGroup={isGroupThread}
					saving={themeSaving}
					onClose={() => setThemeSheet(null)}
					onSave={(t, scope) => void applyTheme(t, scope)}
				/>
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

/**
 * Empty inbox (owner pick): the people you follow, one tap from a first
 * message. Loads on first render, renders nothing while there's no one.
 */
function SuggestedPeople({
	myProfileId,
	people,
	onLoad,
	startingWith,
	onMessage,
}: {
	myProfileId: string;
	people: any[] | null;
	onLoad: () => void;
	startingWith: string | null;
	onMessage: (u: any) => void;
}) {
	useEffect(() => {
		onLoad();
		// biome-ignore lint/correctness/useExhaustiveDependencies: once
	}, [myProfileId]);
	const rows = (people ?? []).filter((u) => u && u._id !== myProfileId).slice(0, 12);
	if (rows.length === 0) return null;
	return (
		<div className="px-2 pb-3 animate-pop">
			<p className="px-2 pb-1.5 pt-2 font-sans text-[calc(11px*var(--ws-fs))] font-semibold uppercase tracking-[0.12em] text-subtle">
				People you follow
			</p>
			{rows.map((u) => (
				<div key={u._id} className="flex items-center gap-3 rounded-xl px-2 py-2">
					<span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-pill bg-raised">
						<SafeAvatar src={u.avatar} eager />
					</span>
					<span className="min-w-0 flex-1">
						<span className="block truncate font-sans text-[calc(14px*var(--ws-fs))] font-semibold text-primary">
							{[u.firstName, u.lastName].filter(Boolean).join(" ") || u.username}
						</span>
						{u.username && (
							<span className="block truncate font-sans text-[calc(12px*var(--ws-fs))] text-muted">
								@{u.username}
							</span>
						)}
					</span>
					<button
						type="button"
						disabled={startingWith === u._id}
						onClick={() => onMessage(u)}
						className="h-8 shrink-0 cursor-pointer rounded-pill bg-raised px-3.5 font-sans text-[calc(12px*var(--ws-fs))] font-semibold text-primary transition-colors hover:bg-chip disabled:opacity-60"
					>
						{startingWith === u._id ? "…" : "Message"}
					</button>
				</div>
			))}
		</div>
	);
}
