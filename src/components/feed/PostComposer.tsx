"use client";

import dynamic from "next/dynamic";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import Image from "next/image";
import {
	Image as ImageIcon,
	Smile,
	Send,
	X,
	User,
	Link2,
	Plus,
	FileText,
} from "lucide-react";
import { VanishingPlaceholder } from "@/components/ui/VanishingPlaceholder";
import { useT } from "@/i18n/client";
import { useUser } from "@clerk/nextjs";
import { createPostAction } from "@/lib/post.actions";
import { postFormDirect } from "@/lib/upload-direct";
import { getSubscriptionAction } from "@/lib/subscription.actions";
import { getCommunitiesAction } from "@/lib/community.actions";
import {
	AudienceLock,
	AudiencePicker,
	type AudienceCommunity,
} from "@/components/community/AudiencePicker";
import { useToast } from "@/components/ui/Toast/ToastContext";
import { compressImage } from "@/lib/image-compress";
import { analyzeAudioFile } from "@/lib/audio-analyze";
import { cutAudioPreview, makeTinyThumb } from "@/lib/sale-teasers";
import { useAtomValue } from "jotai";
import { userAtom } from "@/store/user.atom";
import { SafeAvatar } from "@/components/ui/SafeAvatar";
import { RecordVoiceSheet } from "@/components/feed/RecordVoiceSheet";
import { useAtom, useSetAtom } from "jotai";
import {
	draftsAtom,
	draftsOpenAtom,
	pendingDraftAtom,
} from "@/store/drafts.atom";
import EmojiPicker, { type EmojiClickData, Theme } from "emoji-picker-react";
import { useTheme } from "next-themes";
import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { MusicNote, LockSimple, Microphone as MicrophoneIcon, PencilSimple } from "@phosphor-icons/react";
// Loaded on first open, not on page load: the editors are the heaviest
// client code in the app and they render only when someone opens one. The
// host renders them conditionally, so next/dynamic defers the chunk until
// that first render.
const MediaEditor = dynamic(
	() => import("@/components/editor/MediaEditor"),
	{ ssr: false },
);
const VideoEditor = dynamic(
	() => import("@/components/editor/VideoEditor"),
	{ ssr: false },
);
import type { EditDocument } from "@/lib/editor/document";
import { suggestCategories } from "@/lib/categories";
import { POST_CHAR_BUDGET } from "@/const";
import {
	MentionAutocomplete,
	type MentionUser,
} from "@/components/feed/MentionAutocomplete";
import {
	MentionInput,
	type MentionInputHandle,
} from "@/components/feed/MentionInput";

interface PostComposerProps {
	onPostSuccess?: (post?: any) => void;
	onPostStart?: () => void;
	/**
	 * Rendered inside a community: the audience is fixed to it and the picker
	 * becomes a static "Posting in <name>" line.
	 */
	community?: AudienceCommunity;
}

interface MediaItem {
	url: string;
	file: File;
	type: "image" | "video" | "audio";
	// Editor state: `file` is what gets posted; the untouched original plus
	// the edit document stay behind so re-opening the editor is non-destructive.
	originalFile?: File;
	editDoc?: EditDocument;
}

// The FREE tier's limit — the floor, not the law. Paid tiers buy longer
// posts (postCharBudget: 280 / 1000 / 2000 / 2500), and the gateway
// enforces the real number; the ring below reads it from the same shared
// entitlements fetch the video and audio caps ride.
const MAX_LENGTH = POST_CHAR_BUDGET;

/**
 * Character-budget ring: gold while comfortable, status/warning inside the
 * last 10%, status/danger at/over the limit. Count (tabular) appears only
 * once the warning tier starts — quiet until it matters.
 */
const CharacterRing = ({
	length,
	budget,
}: {
	length: number;
	budget: number;
}) => {
	const remaining = budget - length;
	const pct = Math.min(length / budget, 1);
	const radius = 8;
	const circumference = 2 * Math.PI * radius;
	const tone =
		remaining < 0
			? "text-danger"
			: remaining <= 28
				? "text-warning"
				: "text-gold";

	if (length === 0) return null;

	return (
		<div className="flex items-center gap-2">
			{remaining <= 28 && (
				<span
					className={clsx(
						"font-sans text-[13px] font-medium tabular-nums",
						tone,
					)}
					aria-live="polite"
				>
					{remaining}
				</span>
			)}
			<svg
				width="20"
				height="20"
				viewBox="0 0 20 20"
				aria-hidden="true"
				className={clsx("-rotate-90", tone)}
			>
				<circle
					cx="10"
					cy="10"
					r={radius}
					fill="none"
					strokeWidth="2"
					stroke="var(--ws-bg-track)"
				/>
				<circle
					cx="10"
					cy="10"
					r={radius}
					fill="none"
					strokeWidth="2"
					stroke="currentColor"
					strokeLinecap="round"
					strokeDasharray={circumference}
					strokeDashoffset={circumference * (1 - pct)}
					className="transition-[stroke-dashoffset]"
				/>
			</svg>
		</div>
	);
};

/**
 * Whether the signed-in member may sell posts (Gold only), fetched once per
 * session. UX-only — the gateway 403s a non-Gold sale regardless; this just
 * keeps the toggle out of composers it would only disappoint.
 */
/**
 * Duration of a picked video, from the metadata the browser already reads.
 *
 * Resolves null when the browser cannot parse the container — HEVC off an
 * iPhone is the everyday case — and the caller must treat that as "unknown",
 * never as a reason to block the post. It also resolves null on a deadline:
 * neither `loadedmetadata` nor `error` is guaranteed to fire, and without this
 * the promise simply never settled.
 */
function readVideoDuration(file: File): Promise<number | null> {
	return new Promise((resolve) => {
		const url = URL.createObjectURL(file);
		const el = document.createElement("video");
		let settled = false;
		const done = (value: number | null) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			URL.revokeObjectURL(url);
			resolve(value);
		};
		const timer = setTimeout(() => done(null), 5_000);
		el.preload = "metadata";
		el.onloadedmetadata = () =>
			done(Number.isFinite(el.duration) ? el.duration : null);
		el.onerror = () => done(null);
		el.src = url;
	});
}

/** The composer's slice of this account's entitlements. One request per page
 *  load, shared by every composer instance. */
let limitsPromise: Promise<{
	canSell: boolean;
	videoMaxSeconds: number | null;
	audioMaxSeconds: number | null;
	charBudget: number;
}> | null = null;
function fetchComposerLimits() {
	limitsPromise ??= getSubscriptionAction()
		.then((res) =>
			res.success
				? {
						canSell: Boolean(res.data.entitlements?.canSellPosts),
						videoMaxSeconds:
							res.data.entitlements?.videoMaxSeconds ?? null,
						audioMaxSeconds:
							res.data.entitlements?.audioPostMaxSeconds ?? 60,
						charBudget:
							res.data.entitlements?.postCharBudget ?? MAX_LENGTH,
					}
				: {
						canSell: false,
						videoMaxSeconds: null,
						audioMaxSeconds: 60,
						charBudget: MAX_LENGTH,
					},
		)
		.catch(() => ({
			canSell: false,
			videoMaxSeconds: null,
			audioMaxSeconds: 60,
			charBudget: MAX_LENGTH,
		}));
	return limitsPromise;
}

export const PostComposer = ({
	onPostSuccess,
	onPostStart,
	community,
}: PostComposerProps) => {
	const t = useT();
	// Marketing psychology: the prompt rotates so the empty box keeps asking
	// a different question. Rotation pauses once the person starts typing.
	const PROMPTS = [
		"composer.prompt1",
		"composer.prompt2",
		"composer.prompt3",
		"composer.prompt4",
	];
	const { user } = useUser();
	// The composer wears the APP profile's picture — the same shared userAtom
	// every other surface reads — with Clerk's image only as the pre-hydration
	// fallback. It used to read Clerk's imageUrl directly, so an avatar set in
	// Edit profile never showed here.
	const profileUser = useAtomValue(userAtom);
	const [content, setContent] = useState("");
	// Where this post goes. null = the public timeline.
	const [audience, setAudience] = useState<AudienceCommunity | null>(
		community ?? null,
	);
	const [myCommunities, setMyCommunities] = useState<AudienceCommunity[]>([]);
	// Paid post: the author's asking price, in dollars as typed. Kept as a
	// string so "5." survives mid-keystroke; parsed once at submit. The 50¢
	// floor and $1,000 ceiling are enforced by the gateway — the UI only
	// keeps the button honest.
	const [selling, setSelling] = useState(false);
	const [canSell, setCanSell] = useState(false);
	const [videoSeconds, setVideoSeconds] = useState<number | null>(null);
	const [videoLimit, setVideoLimit] = useState<number | null>(null);
	// Voice-note attachment: measured once at attach; blur is the poster's
	// call and defaults on (plan artifact spec).
	const [audioMeta, setAudioMeta] = useState<{
		durationSec: number;
		peaks: number[];
	} | null>(null);
	const [audioBlurBg, setAudioBlurBg] = useState(true);
	const [audioLimit, setAudioLimit] = useState<number>(60);
	const [charBudget, setCharBudget] = useState<number>(MAX_LENGTH);
	const [recordOpen, setRecordOpen] = useState(false);
	// A file picked from disk enters the same finishing sheet the recorder
	// ends in — background choice and listen-back happen THERE, in view,
	// not on a chip after the modal is gone.
	const [pendingAudioFile, setPendingAudioFile] = useState<File | null>(null);

	useEffect(() => {
		let cancelled = false;
		fetchComposerLimits().then((limits) => {
			if (cancelled) return;
			setCanSell(limits.canSell);
			setVideoLimit(limits.videoMaxSeconds);
			setAudioLimit(limits.audioMaxSeconds ?? 60);
			setCharBudget(limits.charBudget ?? MAX_LENGTH);
		});
		return () => {
			cancelled = true;
		};
	}, []);
	const [salePrice, setSalePrice] = useState("");
	// The storefront title — what non-buyers see instead of "Paid post".
	// Required when selling; the gateway refuses a titleless listing too.
	const [saleTitle, setSaleTitle] = useState("");
	const [saleHidePreview, setSaleHidePreview] = useState(false);
	const salePriceMinor = selling
		? Math.round(Number.parseFloat(salePrice || "0") * 100)
		: 0;
	const saleInvalid =
		selling && (salePriceMinor < 50 || salePriceMinor > 100_000);
	const saleTitleMissing = selling && !saleTitle.trim();

	useEffect(() => {
		setAudience(community ?? null);
	}, [community]);

	useEffect(() => {
		// Only the free composer needs the list; a locked one already knows.
		if (community) return;
		let cancelled = false;
		void getCommunitiesAction().then((res) => {
			if (cancelled || !res.success) return;
			setMyCommunities(
				(res.communities ?? [])
					.filter((c: any) => c.joined)
					.map((c: any) => ({
						id: String(c.id),
						name: c.name,
						slug: c.slug,
						avatar: c.avatar || undefined,
					})),
			);
		});
		return () => {
			cancelled = true;
		};
	}, [community]);
	// The @token the caret is sitting in, if any: drives the mention typeahead.
	const [mention, setMention] = useState<{
		query: string;
		start: number;
		end: number;
	} | null>(null);

	// Everyone picked from the typeahead, kept so a badge can be rebuilt from a
	// restored draft. Who is actually tagged is DERIVED from the text below.
	const [taggedUserPool, setTaggedUserPool] = useState<MentionUser[]>([]);

	// The editor turns the @token into an atomic inline badge and serializes it
	// back to `@username`, so `content` stays a plain string for everything
	// downstream (drafts, char budget, link preview, the post payload).
	const insertMention = (user: MentionUser) => {
		editorRef.current?.insertMention(user);
		setMention(null);
		setTaggedUserPool((prev) =>
			prev.some((u) => u._id === user._id) ? prev : [...prev, user],
		);
	};
	const [isPosting, setIsPosting] = useState(false);
	const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
	const [editingIndex, setEditingIndex] = useState<number | null>(null);
	const [showEmojiPicker, setShowEmojiPicker] = useState(false);

	// A picked user counts as tagged only while their @handle is still in the
	// draft. Usernames are [A-Za-z0-9_] so they need no regex escaping.
	const taggedUsers = useMemo(
		() =>
			taggedUserPool.filter((u) =>
				new RegExp(`(^|\\s)@${u.username}\\b`, "i").test(content),
			),
		[taggedUserPool, content],
	);

	// Link Preview State
	const [linkPreview, setLinkPreview] = useState<any>(null);
	const [isFetchingPreview, setIsFetchingPreview] = useState(false);
	const lastCheckedUrl = useRef<string | null>(null);

	const fileInputRef = useRef<HTMLInputElement>(null);
	const emojiPickerRef = useRef<HTMLDivElement>(null);
	const editorRef = useRef<MentionInputHandle>(null);
	const { toast } = useToast();
	// One door for audio, whether it came from the picker or the recorder:
	// validate, decode for duration + peaks, become THE attachment.
	const attachAudioFile = useCallback(
		async (audioFile: File): Promise<boolean> => {
			if (audioFile.size > 15 * 1024 * 1024) {
				toast("Voice notes are capped at 15MB", { type: "error" });
				return false;
			}
			const meta = await analyzeAudioFile(audioFile);
			if (!meta) {
				toast("Couldn't read that audio file", { type: "error" });
				return false;
			}
			if (meta.durationSec > audioLimit + 1) {
				toast(
					`Your plan allows voice posts up to ${audioLimit}s — this one is ${meta.durationSec}s`,
					{ type: "error" },
				);
				return false;
			}
			setMediaItems((prev) => {
				prev.forEach((m) => URL.revokeObjectURL(m.url));
				return [
					{
						url: URL.createObjectURL(audioFile),
						file: audioFile,
						type: "audio",
					},
				];
			});
			setAudioMeta(meta);
			return true;
		},
		[audioLimit, toast],
	);

	// Picker follows the app theme instead of hardcoding dark.
	const { resolvedTheme } = useTheme();

	/**
	 * Topics this post will be filed under.
	 *
	 * Derived, not stored: the suggestion list is recomputed from the debounced
	 * draft and `removedTopics` is the only state, so a topic the author
	 * dismissed can never re-appear as they keep typing. The ids ride along on
	 * the post and are what the feed ranker matches against each reader's
	 * interests — without them the interest boost has nothing to match, which
	 * is exactly the state this composer was in.
	 */
	const [debouncedDraft, setDebouncedDraft] = useState("");
	const [removedTopics, setRemovedTopics] = useState<string[]>([]);
	useEffect(() => {
		const timer = setTimeout(() => setDebouncedDraft(content), 250);
		return () => clearTimeout(timer);
	}, [content]);
	const suggestedTopics = useMemo(
		() =>
			debouncedDraft.trim().length < 3
				? []
				: suggestCategories(debouncedDraft, { limit: 3 }).filter(
						(c) => !removedTopics.includes(c.id),
					),
		[debouncedDraft, removedTopics],
	);

	// Detect links in content
	useEffect(() => {
		if (mediaItems.length > 0) {
			setLinkPreview(null);
			return;
		}

		const urlRegex = /(https?:\/\/[^\s]+)/g;
		const match = content.match(urlRegex);

		if (match && match[0]) {
			const url = match[0];
			if (url !== lastCheckedUrl.current) {
				lastCheckedUrl.current = url;
				fetchPreview(url);
			}
		} else {
			setLinkPreview(null);
			lastCheckedUrl.current = null;
		}
	}, [content, mediaItems.length]);

	const fetchPreview = async (url: string) => {
		setIsFetchingPreview(true);
		try {
			// Dynamically import action to avoid server-client issues if not handled
			const { getLinkPreviewAction } = await import("@/lib/post.actions");
			const res = await getLinkPreviewAction(url);
			if (res.success && res.data.title) {
				setLinkPreview(res.data);
			}
		} catch (error) {
			console.error("Failed to fetch preview", error);
		} finally {
			setIsFetchingPreview(false);
		}
	};

	// Close emoji picker when clicking outside
	useEffect(() => {
		function handleClickOutside(event: MouseEvent) {
			if (
				emojiPickerRef.current &&
				!emojiPickerRef.current.contains(event.target as Node)
			) {
				setShowEmojiPicker(false);
			}
		}
		document.addEventListener("mousedown", handleClickOutside);
		return () => {
			document.removeEventListener("mousedown", handleClickOutside);
		};
	}, []);

	// Draft persistence — a refresh or accidental navigation shouldn't eat a
	// half-written post. Text only; object URLs can't survive a reload.
	// The clear branch is gated on having SEEN content, so the effect's
	// initial empty-content run (and StrictMode's double-run) can never
	// delete a stored draft before the restore lands.
	const DRAFT_KEY = "ws-social-draft";
	// The people, stored next to the text: a draft restores `@handle` strings,
	// and without their avatars those can only come back as plain text.
	const DRAFT_MENTIONS_KEY = "ws-social-draft-mentions";
	const draftHadContentRef = useRef(false);
	useEffect(() => {
		try {
			const saved = localStorage.getItem(DRAFT_KEY);
			if (!saved) return;
			let known: MentionUser[] = [];
			try {
				const raw = localStorage.getItem(DRAFT_MENTIONS_KEY);
				if (raw) known = JSON.parse(raw);
			} catch {}
			setContent((prev) => prev || saved);
			setTaggedUserPool(known);
			editorRef.current?.setText(saved, known);
		} catch {}
	}, []);
	useEffect(() => {
		try {
			if (content) {
				draftHadContentRef.current = true;
				localStorage.setItem(DRAFT_KEY, content);
				localStorage.setItem(
					DRAFT_MENTIONS_KEY,
					JSON.stringify(taggedUserPool),
				);
			} else if (draftHadContentRef.current) {
				localStorage.removeItem(DRAFT_KEY);
				localStorage.removeItem(DRAFT_MENTIONS_KEY);
			}
		} catch {}
	}, [content, taggedUserPool]);

	// Named drafts — the autosave above is crash recovery for ONE in-flight
	// post; these are the ones you deliberately keep.
	const [drafts, setDrafts] = useAtom(draftsAtom);
	const setDraftsOpen = useSetAtom(draftsOpenAtom);
	const [pendingDraft, setPendingDraft] = useAtom(pendingDraftAtom);

	useEffect(() => {
		if (pendingDraft === null) return;
		setContent(pendingDraft);
		editorRef.current?.setText(pendingDraft, taggedUserPool);
		setPendingDraft(null);
		setTimeout(() => editorRef.current?.focus(), 0);
	}, [pendingDraft, setPendingDraft]);

	const saveDraft = () => {
		const text = content.trim();
		if (!text) return;
		setDrafts((prev) =>
			[
				{
					id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
					content: text,
					updatedAt: Date.now(),
				},
				...prev,
			].slice(0, 50),
		);
		setContent("");
		editorRef.current?.setText("");
		setTaggedUserPool([]);
		try {
			localStorage.removeItem(DRAFT_KEY);
			localStorage.removeItem(DRAFT_MENTIONS_KEY);
		} catch {}
		toast(t("drafts.saved"), { type: "success" });
	};

	// Blob URLs never survived unmount (navigating away leaked every preview).
	// Mirror the current URLs in a ref so the unmount sweep sees the live set.
	const mediaUrlsRef = useRef<string[]>([]);
	useEffect(() => {
		mediaUrlsRef.current = mediaItems.map((item) => item.url);
	}, [mediaItems]);
	useEffect(
		() => () => {
			mediaUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
		},
		[],
	);

	// Mirror of the gateway's multer/controller caps (post.routes.ts /
	// createPost). Checked here so an oversized pick fails in one frame with
	// a clear message instead of after uploading 50MB to earn a 413.
	const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
	const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

	const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
		// Disable if link preview exists
		if (linkPreview) return;

		if (e.target.files) {
			const files = Array.from(e.target.files);
			// One voice note max, exclusive like video: a post is one thing.
			const audioFile = files.find((f) => f.type.startsWith("audio/"));
			if (audioFile) {
				setPendingAudioFile(audioFile);
				setRecordOpen(true);
				if (fileInputRef.current) fileInputRef.current.value = "";
				return;
			}
			// One video max, never mixed with images: a picked video replaces
			// everything; once a video is attached, further picks are ignored.
			const video = files.find((f) => f.type.startsWith("video/"));
			if (mediaItems.some((m) => m.type === "video")) {
				if (fileInputRef.current) fileInputRef.current.value = "";
				return;
			}
			if (video) {
				if (video.size > MAX_VIDEO_BYTES) {
					toast("Videos are capped at 50MB", { type: "error" });
					if (fileInputRef.current) fileInputRef.current.value = "";
					return;
				}
				// Video length is a tier perk, so the gateway has to be told how
				// long this clip is. Measured here because the browser already
				// decodes the metadata for the preview; the failure path leaves
				// it undefined and the gateway rejects rather than guesses.
				void readVideoDuration(video).then((secs) => {
					setVideoSeconds(secs);
					if (secs && videoLimit && secs > videoLimit) {
						toast(
							`Your plan allows videos up to ${videoLimit}s — this one is ${Math.round(secs)}s`,
							{ type: "error" },
						);
					}
				});
				setMediaItems([
					{
						url: URL.createObjectURL(video),
						file: video,
						type: "video",
					},
				]);
				if (fileInputRef.current) fileInputRef.current.value = "";
				return;
			}
			const oversized = files.filter(
				(f) =>
					!f.type.startsWith("video/") && f.size > MAX_IMAGE_BYTES,
			);
			if (oversized.length > 0) {
				toast("Images are capped at 8MB each", { type: "error" });
			}
			const remainingSlots = 4 - mediaItems.length;
			const filesToProcess = files
				.filter((f) => f.size <= MAX_IMAGE_BYTES)
				.slice(0, remainingSlots);

			// Compress before anything else sees the file: the preview, the
			// draft and the eventual upload all ride the light version.
			const prepared = await Promise.all(
				filesToProcess.map(async (file) =>
					file.type.startsWith("video/")
						? file
						: await compressImage(file),
				),
			);
			const newItems: MediaItem[] = prepared.map((file) => ({
				url: URL.createObjectURL(file),
				file: file,
				type: file.type.startsWith("video/") ? "video" : "image",
			}));

			setMediaItems((prev) => [...prev, ...newItems]);
			if (fileInputRef.current) fileInputRef.current.value = "";
		}
	};

	// Paste an image (screenshot, copied file) straight into the composer.
	const handlePaste = async (e: React.ClipboardEvent) => {
		const pasted = Array.from(e.clipboardData.files).filter((f) =>
			f.type.startsWith("image/"),
		);
		if (pasted.length === 0 || linkPreview) return;
		e.preventDefault();
		const files = pasted.filter((f) => f.size <= MAX_IMAGE_BYTES);
		if (files.length < pasted.length) {
			toast("Images are capped at 8MB each", { type: "error" });
			if (files.length === 0) return;
		}
		const remainingSlots = 4 - mediaItems.length;
		const compressed = await Promise.all(
			files.slice(0, remainingSlots).map(compressImage),
		);
		const newItems: MediaItem[] = compressed.map((file) => ({
			url: URL.createObjectURL(file),
			file,
			type: "image",
		}));
		if (newItems.length > 0) {
			setMediaItems((prev) => [...prev, ...newItems]);
			toast(newItems.length > 1 ? "Images attached" : "Image attached", {
				type: "success",
			});
		}
	};

	const removeMedia = (index: number) => {
		setMediaItems((prev) => {
			const newItems = [...prev];
			URL.revokeObjectURL(newItems[index].url);
			newItems.splice(index, 1);
			return newItems;
		});
	};

	const removeLinkPreview = () => {
		setLinkPreview(null);
		lastCheckedUrl.current = "IGNORE"; // Helper to prevent re-fetching immediately if URL is still there
	};

	const onEmojiClick = (emojiData: EmojiClickData) => {
		editorRef.current?.insertText(emojiData.emoji);
	};

	const isOverLimit = content.length > charBudget;

	const handleSubmit = async () => {
		if ((!content.trim() && mediaItems.length === 0) || isPosting) return;
		if (isOverLimit) return;

		onPostStart?.();
		setIsPosting(true);
		try {
			const formData = new FormData();
			formData.append("content", content);

			// The gateway verifies membership before accepting this.
			if (audience) formData.append("community", audience.id);
			if (selling && !saleInvalid) {
				formData.append("salePriceUsdMinor", String(salePriceMinor));
				formData.append("saleTitle", saleTitle.trim().slice(0, 80));
				if (saleHidePreview) formData.append("saleHideTeaser", "true");
				// Teaser assets, cut HERE in the seller's browser: a 24px thumb
				// of the first visual (real colours, unrecoverable detail) and
				// the first 15s of a voice post. The paywall then never has to
				// ship a real asset to tease with.
				const firstVisual = saleHidePreview
					? undefined
					: mediaItems.find(
							(m) => m.type === "image" || m.type === "video",
						);
				if (firstVisual) {
					const thumb = await makeTinyThumb(firstVisual.file);
					if (thumb) formData.append("salePreviewThumb", thumb);
				}
				const voiceItem = saleHidePreview
					? undefined
					: mediaItems.find((m) => m.type === "audio");
				if (voiceItem) {
					const preview = await cutAudioPreview(voiceItem.file, 15);
					if (preview) formData.append("salePreviewAudio", preview);
				}
			}

			mediaItems.forEach((item) => {
				if (item.type === "audio") {
					formData.append("audio", item.file);
					if (audioMeta) {
						formData.append(
							"audioDurationSeconds",
							String(audioMeta.durationSec),
						);
						formData.append("audioPeaks", JSON.stringify(audioMeta.peaks));
					}
					formData.append("audioBlurBg", audioBlurBg ? "true" : "false");
				} else if (item.type === "video") {
					formData.append("video", item.file);
					if (videoSeconds) {
						formData.append("videoDurationSeconds", String(Math.round(videoSeconds)));
					}
				} else {
					formData.append("images", item.file);
				}
			});

			// Alt text from the editor's Alt tab. The gateway ignores unknown
			// body fields today (post images are bare URL strings), so this is
			// the forward-compatible seam: when the post model grows media
			// metadata, the transport is already here.
			if (mediaItems.some((item) => item.editDoc?.alt)) {
				formData.append(
					"imageAlts",
					JSON.stringify(mediaItems.map((item) => item.editDoc?.alt ?? "")),
				);
			}

			if (linkPreview && mediaItems.length === 0) {
				formData.append("linkPreview", JSON.stringify(linkPreview));
			}

			// Taxonomy ids for the ranker. The gateway sanitizes and caps these
			// server-side; this is the signal that lets the feed match a post
			// to a reader's interests at all.
			if (suggestedTopics.length > 0) {
				formData.append(
					"categories",
					JSON.stringify(suggestedTopics.map((c) => c.id)),
				);
			}

			// Tagged users, resolved to ids client-side so the gateway does not
			// have to re-parse @handles out of the body to know who to notify
			// (in-app + email). Username rides along because the gateway's
			// notification payload addresses people by handle.
			if (taggedUsers.length > 0) {
				formData.append(
					"mentions",
					JSON.stringify(
						taggedUsers.map((u) => ({
							userId: u._id,
							username: u.username,
						})),
					),
				);
			}

			// Media rides direct to the gateway (one upload, no function
			// timeout); a text-only post keeps the server-action path.
			const result =
				mediaItems.length > 0
					? await postFormDirect("/api/posts", formData)
					: await createPostAction(formData);

			if (result.success) {
				setContent("");
				setDebouncedDraft("");
				setRemovedTopics([]);
				editorRef.current?.setText("");
				// Revoke AFTER React commits the cleared state — a synchronous
				// revoke leaves the still-mounted preview tiles pointing at
				// dead blob: URLs for a frame (broken-image flash).
				const postedUrls = mediaItems.map((item) => item.url);
				setTimeout(() => {
					postedUrls.forEach((url) => URL.revokeObjectURL(url));
				}, 1000);
				setMediaItems([]);
				setSelling(false);
				setSalePrice("");
				setTaggedUserPool([]);
				setLinkPreview(null);
				lastCheckedUrl.current = null;
				setShowEmojiPicker(false);
				toast("Post published!", { type: "success" });
				onPostSuccess?.(result.data);
			} else {
				toast(result.message || "Failed to post", { type: "error" });
			}
		} catch (error) {
			toast("Something went wrong", { type: "error" });
		} finally {
			setIsPosting(false);
		}
	};

	// Same padding rhythm as PostCard, so the composer reads as the first row
	// of the feed rather than a separate panel.
	return (
		<div className="px-4 py-3 sm:px-6 sm:py-4 relative">
			<RecordVoiceSheet
				open={recordOpen}
				maxSeconds={audioLimit}
				avatar={(profileUser as any)?.avatar || user?.imageUrl}
				initialFile={pendingAudioFile}
				onClose={() => {
					setRecordOpen(false);
					setPendingAudioFile(null);
				}}
				onDone={(f, opts) => {
					setAudioBlurBg(opts.blurBg);
					void attachAudioFile(f);
				}}
			/>
			<div className="flex gap-2.5 sm:gap-4">
				<div className="shrink-0">
					<div className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-pill overflow-hidden border border-hairline bg-raised">
						<SafeAvatar
							src={(profileUser as any)?.avatar || user?.imageUrl}
							alt={(profileUser as any)?.username || "You"}
							eager
						/>
					</div>
				</div>
				<div className="flex-1 w-full min-w-0">
					<div className="relative">
					{!content && (
						<span className="pointer-events-none absolute left-0 top-0 h-8 w-full">
							<VanishingPlaceholder
								texts={PROMPTS.map((k) => t(k))}
								font="600 18px 'Public Sans', sans-serif"
							/>
						</span>
					)}
					<MentionInput
						id="post-composer-input"
						ref={editorRef}
						ariaLabel="Write a post"
						onChange={setContent}
						onQueryChange={setMention}
						onPaste={handlePaste}
						className="w-full bg-transparent text-lg text-primary outline-none min-h-[42px] sm:min-h-[60px] font-medium leading-relaxed font-sans whitespace-pre-wrap break-words"
					/>
					{mention && (
						<MentionAutocomplete
							query={mention.query}
							onPick={insertMention}
							onDismiss={() => setMention(null)}
						/>
					)}
					</div>

					{/* Media Preview Grid */}
					{mediaItems.length > 0 && (
						<div
							className={clsx(
								"grid gap-2 mt-3 mb-2 rounded-xl overflow-hidden relative",
								// Photos always get the 2-up grid so the add-more
								// tile can ride alongside; only a lone video goes
								// full-width.
								mediaItems[0].type === "video"
									? "grid-cols-1"
									: "grid-cols-2",
							)}
						>
							{mediaItems.map((item, index) => (
								<div
									key={item.url}
									className={clsx(
										"relative bg-surface border border-hairline",
										item.type === "video" &&
											mediaItems.length === 1
											? "aspect-video"
											: "aspect-square",
									)}
								>
									{item.type === "audio" ? (
										// biome-ignore lint/a11y/useKeyWithClickEvents: the X beside it is the keyboard path
										<div
											className="absolute inset-0 flex cursor-pointer items-center gap-2 bg-sunken px-3"
											onClick={() => {
												setPendingAudioFile(item.file);
												setRecordOpen(true);
											}}
											title="Edit voice note"
										>
											<span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-pill bg-primary text-page">
												<MusicNote size={14} weight="fill" />
											</span>
											<span className="flex h-8 flex-1 items-center gap-[2px]">
												{(audioMeta?.peaks ?? []).slice(0, 32).map((v, i) => (
													<span
														key={i}
														className="w-full flex-1 rounded-pill bg-primary/40"
														style={{ height: `${Math.max(12, (v / 127) * 100)}%` }}
													/>
												))}
											</span>
											<span className="shrink-0 font-sans text-[11px] tabular-nums text-muted">
												{audioMeta
													? `${Math.floor(audioMeta.durationSec / 60)}:${String(audioMeta.durationSec % 60).padStart(2, "0")}`
													: ""}
											</span>
											<span
												className={clsx(
													"shrink-0 rounded-pill px-2 py-0.5 font-sans text-[10.5px] font-semibold",
													audioBlurBg
														? "bg-brand/15 text-gold"
														: "bg-raised text-muted",
												)}
											>
												{audioBlurBg ? "Blurred" : "Flat"}
											</span>
										</div>
									) : item.type === "video" ? (
										// eslint-disable-next-line jsx-a11y/media-has-caption
										<video
											src={item.url}
											className="absolute inset-0 w-full h-full object-cover"
											muted
											playsInline
										/>
									) : (
										<Image
											src={item.url}
											alt="Preview"
											fill
											className="object-cover"
										/>
									)}
									<div className="absolute top-1.5 right-1.5 flex gap-1.5">
										{/* MIME decides which editor mounts below 
										    images get the Studio sheet, videos the
										    trim sheet. */}
										<button
											type="button"
											onClick={() => setEditingIndex(index)}
											aria-label={
												item.file.type.startsWith("video/")
													? "Edit video"
													: "Edit image"
											}
											className="flex h-10 w-10 items-center justify-center bg-page/60 hover:bg-page/80 rounded-pill text-primary transition-colors"
										>
											<PencilSimple size={16} weight="bold" />
										</button>
										<button
											type="button"
											onClick={() => removeMedia(index)}
											aria-label="Remove attachment"
											className="flex h-10 w-10 items-center justify-center bg-page/60 hover:bg-page/80 rounded-pill text-primary transition-colors"
										>
											<X className="w-4 h-4" />
										</button>
									</div>
								</div>
							))}
							{/* Chain photos: an explicit add tile, not a hunt
							    for the toolbar icon. 4 slots total. */}
							{mediaItems[0].type !== "video" &&
								mediaItems.length < 4 && (
									<button
										type="button"
										onClick={() =>
											fileInputRef.current?.click()
										}
										disabled={isPosting}
										aria-label="Add more photos"
										className="relative aspect-square border border-dashed border-hairline bg-sunken/30 hover:bg-raised/50 flex flex-col items-center justify-center gap-1.5 text-muted hover:text-primary transition-colors cursor-pointer"
									>
										<Plus className="w-6 h-6" />
										<span className="text-[12px] font-sans font-medium tabular-nums">
											Add photos · {4 - mediaItems.length}{" "}
											left
										</span>
									</button>
								)}
						</div>
					)}

					{/* Link Preview Card */}
					{linkPreview && mediaItems.length === 0 && (
						<div className="mt-3 mb-2 rounded-xl border border-hairline overflow-hidden bg-surface/50 relative group">
							{/* Reveal-on-hover is unreachable on touch there is no
							    hover state to enter. Always visible below sm. */}
							<button
								type="button"
								onClick={removeLinkPreview}
								aria-label="Remove link preview"
								className="absolute top-1.5 right-1.5 flex h-10 w-10 items-center justify-center bg-page/60 hover:bg-page/80 rounded-pill text-primary transition-opacity z-10 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
							>
								<X className="w-4 h-4" />
							</button>
							{linkPreview.image && (
								<div className="aspect-video relative w-full bg-surface border-b border-hairline/50">
									<img
										src={linkPreview.image}
										alt={linkPreview.title}
										className="absolute inset-0 w-full h-full object-cover"
										onError={(e) => {
											e.currentTarget.style.display = "none";
										}}
									/>
								</div>
							)}
							<div className="p-3">
								<h3 className="text-sm font-bold text-primary line-clamp-1 font-sans mb-0.5">
									{linkPreview.title}
								</h3>
								<p className="text-[13px] text-muted line-clamp-2 font-sans mb-1">
									{linkPreview.description}
								</p>
								<div className="flex items-center gap-1 text-[11px] text-muted font-sans">
									<Link2 className="w-3 h-3" />
									<span>{linkPreview.domain}</span>
								</div>
							</div>
						</div>
					)}

					{isFetchingPreview && (
						<div className="mt-3 mb-2 p-4 rounded-xl border border-hairline bg-surface/10 flex items-center justify-center gap-2 text-muted font-sans text-[13px]">
							<div className="w-3 h-3 border-2 border-subtle/30 border-t-subtle rounded-full animate-spin" />
							Fetching preview...
						</div>
					)}

					{(community || myCommunities.length > 0) && (
						<div className="mt-2 flex items-center">
							{community ? (
								<AudienceLock community={community} />
							) : (
								<AudiencePicker
									communities={myCommunities}
									value={audience}
									onChange={setAudience}
								/>
							)}
						</div>
					)}

					{/* Topics, derived from the draft. Removable — dismissing one
					    records it in removedTopics so re-typing can't bring it
					    back. These ids are what the ranker matches against each
					    reader's interests. */}
					{suggestedTopics.length > 0 && (
						<div className="mt-2 flex flex-wrap items-center gap-1.5">
							<span className="font-sans text-[12px] text-subtle">
								Topics
							</span>
							{suggestedTopics.map((topic) => (
								<span
									key={topic.id}
									className="inline-flex h-7 items-center gap-1 rounded-pill bg-raised/60 pl-2.5 pr-1 font-sans text-[12px] text-muted"
								>
									{topic.label}
									<button
										type="button"
										onClick={() =>
											setRemovedTopics((prev) => [...prev, topic.id])
										}
										aria-label={`Remove ${topic.label}`}
										className="flex h-5 w-5 items-center justify-center rounded-pill text-subtle transition-colors hover:bg-raised hover:text-primary"
									>
										<X size={11} />
									</button>
								</span>
							))}
						</div>
					)}

					{/* Sell this post: a quiet row until armed, then the price field
					    appears inline with the split spelled out — the 60/40 is shown
					    to the SELLER here, never to the buyer on the paywall. */}
					{canSell && (
					<div className="mt-2 flex flex-wrap items-center gap-2">
						<button
							type="button"
							onClick={() => setSelling((v) => !v)}
							aria-pressed={selling}
							className={clsx(
								// Bigger on phones (owner: the sell entry was easy to miss on
								// mobile); desktop keeps the quieter row.
								"flex h-10 items-center gap-2 rounded-pill px-4 font-sans text-[13.5px] font-semibold transition-colors cursor-pointer sm:h-9 sm:gap-1.5 sm:px-3 sm:text-[12.5px]",
								// Money wears money/credit green, never the brand
								// accent (owner ruling 2026-08-31).
								selling
									? "bg-credit/[0.14] text-credit"
									: "bg-raised/50 text-muted hover:bg-raised hover:text-primary",
							)}
						>
							<LockSimple size={15} weight={selling ? "fill" : "bold"} />
							{selling ? t("composer.sellingOn") : t("composer.sellPost")}
						</button>
						{selling && (
							<>
								<input
									type="text"
									value={saleTitle}
									onChange={(e) => setSaleTitle(e.target.value.slice(0, 80))}
									placeholder="Title buyers will see"
									aria-label="Paid post title"
									className={clsx(
										"h-9 w-full min-w-0 flex-1 basis-full rounded-pill border bg-sunken px-3.5 font-sans text-[13px] text-primary outline-none transition-colors placeholder:text-subtle sm:basis-auto",
										saleTitleMissing && salePrice
											? "border-danger/50"
											: "border-hairline focus:border-credit/60",
									)}
								/>
								<label className="flex h-9 items-center gap-1 rounded-pill bg-sunken border border-hairline px-3 font-sans text-[13px] text-primary focus-within:border-credit/60 transition-colors">
									<span className="text-muted">$</span>
									<input
										type="text"
										inputMode="decimal"
										value={salePrice}
										onChange={(e) =>
											setSalePrice(
												e.target.value.replace(/[^0-9.]/g, ""),
											)
										}
										placeholder="5.00"
										aria-label={t("composer.sellPrice")}
										className="w-16 bg-transparent outline-none placeholder:text-subtle tabular-nums"
									/>
								</label>
								<span
									className={clsx(
										"font-sans text-[11.5px]",
										saleInvalid && salePrice ? "text-danger" : "text-subtle",
									)}
								>
									{saleInvalid && salePrice
										? t("composer.sellBounds")
										: t("composer.sellSplit")}
								</span>
								{/* Some sellers don't want a taste out there at all
								    (owner ask): title + honest counts only. */}
								<button
									type="button"
									onClick={() => setSaleHidePreview((v) => !v)}
									aria-pressed={saleHidePreview}
									className={clsx(
										"flex h-9 cursor-pointer items-center gap-1.5 rounded-pill px-3 font-sans text-[12px] font-medium transition-colors",
										saleHidePreview
											? "bg-credit/[0.14] text-credit"
											: "bg-sunken text-muted hover:bg-raised",
									)}
								>
									<LockSimple size={12} weight={saleHidePreview ? "fill" : "regular"} />
									{saleHidePreview ? "Preview hidden" : "Hide preview"}
								</button>
							</>
						)}
					</div>
					)}

					<div className="flex items-center justify-between mt-1 pt-2 sm:mt-2 sm:pt-3 border-t border-hairline/60">
						<div className="flex items-center gap-2 relative">
							{/* Faded word-chips from sm up: the toolbar says what it does.
							    Below sm the words come off — three labelled chips plus the
							    ring and CTA need ~500px, the row has ~275 — leaving 44px
							    icon-only targets. Go Live moved out to the create FAB. */}
							<button
								type="button"
								onClick={() => !linkPreview && fileInputRef.current?.click()}
								disabled={!!linkPreview}
								aria-label={t("composer.media")}
								title={t("composer.media")}
								className={clsx(
									"flex h-10 w-10 items-center justify-center rounded-pill transition-colors",
									linkPreview
										? "bg-raised/40 text-subtle cursor-not-allowed"
										: "bg-raised/50 text-muted hover:bg-raised hover:text-primary cursor-pointer",
								)}
							>
								<ImageIcon className="h-[18px] w-[18px] shrink-0" />
							</button>
							<button
								type="button"
								onClick={() => !linkPreview && setRecordOpen(true)}
								disabled={!!linkPreview}
								aria-label="Record a voice note"
								title="Voice note"
								className={clsx(
									"flex h-10 w-10 items-center justify-center rounded-pill transition-colors",
									linkPreview
										? "bg-raised/40 text-subtle cursor-not-allowed"
										: "bg-raised/50 text-muted hover:bg-raised hover:text-primary cursor-pointer",
								)}
							>
								<MicrophoneIcon className="h-[18px] w-[18px] shrink-0" size={18} />
							</button>
							<input
								type="file"
								ref={fileInputRef}
								className="hidden"
								accept="image/*,video/*,audio/*"
								multiple
								onChange={handleImageSelect}
								disabled={isPosting || mediaItems.length >= 4 || !!linkPreview}
							/>

							<button
								type="button"
								onClick={() => setShowEmojiPicker(!showEmojiPicker)}
								aria-label={t("composer.emoji")}
								title={t("composer.emoji")}
								className={clsx(
									"flex h-10 w-10 justify-center sm:h-9 sm:w-auto sm:justify-start sm:px-3.5 items-center gap-2 rounded-pill font-sans text-[13px] font-medium transition-colors cursor-pointer",
									showEmojiPicker
										? "bg-raised text-primary"
										: "bg-raised/50 text-muted hover:bg-raised hover:text-primary",
								)}
							>
								<Smile className="h-[18px] w-[18px] shrink-0" />
							</button>

							{content.trim() && (
								<button
									type="button"
									onClick={saveDraft}
									aria-label={t("composer.saveDraft")}
									title={t("composer.saveDraft")}
									className="flex h-10 w-10 items-center justify-center rounded-pill bg-raised/50 text-muted hover:bg-raised hover:text-primary transition-colors cursor-pointer"
								>
									<FileText className="h-[18px] w-[18px] shrink-0" />
								</button>
							)}

							{/* Drafts stay reachable here the FAB only appears once you
							    have scrolled past this composer. */}
							{!content.trim() && drafts.length > 0 && (
								<button
									type="button"
									onClick={() => setDraftsOpen(true)}
									aria-label={t("drafts.title")}
									className="flex h-10 items-center gap-1.5 rounded-pill px-3 bg-raised/50 text-muted hover:bg-raised hover:text-primary font-sans text-[12.5px] font-medium transition-colors cursor-pointer"
								>
									<FileText className="h-[18px] w-[18px] shrink-0" />
									<span className="tabular-nums">{drafts.length}</span>
								</button>
							)}

							{/* Emoji Picker Popover below sm it centres in the viewport
							    instead of anchoring (a fixed 320px block anchored 72px in
							    ran off the right edge on a 320-375px screen). */}
							{showEmojiPicker && (
								<div
									className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 sm:absolute sm:left-0 sm:top-12 sm:translate-x-0 sm:translate-y-0 w-[min(320px,calc(100vw-2rem))] max-h-[70dvh] z-dropdown animate-rise ws-emoji-picker"
									ref={emojiPickerRef}
								>
									<EmojiPicker
										onEmojiClick={onEmojiClick}
										theme={
											resolvedTheme === "light"
												? Theme.LIGHT
												: Theme.DARK
										}
										width="100%"
										height={360}
										lazyLoadEmojis={true}
									/>
								</div>
							)}
						</div>

						<div className="flex items-center gap-3">
							<CharacterRing length={content.length} budget={charBudget} />
							<button
							onClick={handleSubmit}
							disabled={
								(!content.trim() && mediaItems.length === 0) ||
								isPosting ||
								isOverLimit ||
								saleInvalid ||
								saleTitleMissing
							}
							type="button"
							className={clsx(
								// h-11 on touch (44px target), the DS's 36px pill from sm up.
								"px-4 sm:px-[18px] h-10 sm:h-9 shrink-0 rounded-pill font-semibold text-[13px] font-sans transition-colors flex items-center gap-2 cursor-pointer",
								(!content.trim() && mediaItems.length === 0) ||
									isPosting ||
									isOverLimit ||
									saleInvalid ||
									saleTitleMissing
									? "bg-raised text-subtle cursor-not-allowed opacity-50"
									: "bg-brand text-brand-on hover:bg-brand-active",
							)}
						>
							{isPosting ? (
								<div className="w-4 h-4 border-2 border-brand-on/30 border-t-brand-on rounded-full animate-spin" />
							) : (
								<>
									<span className="uppercase">{t("composer.post")}</span>
									<Send className="w-3 h-3" />
								</>
							)}
							</button>
						</div>
					</div>
				</div>
			</div>

			{/* Per-tile editors the MIME decides which sheet mounts. Save swaps
			    the posted File in place; images keep the original + edit doc so
			    re-opening is non-destructive. URL side effects stay OUTSIDE the
			    state updater (StrictMode double-invokes updaters). */}
			{editingIndex !== null &&
				mediaItems[editingIndex] &&
				(mediaItems[editingIndex].file.type.startsWith("video/") ? (
					<VideoEditor
						file={
							mediaItems[editingIndex].originalFile ??
							mediaItems[editingIndex].file
						}
						onClose={() => setEditingIndex(null)}
						onSave={(file) => {
							const old = mediaItems[editingIndex];
							if (!old) {
								setEditingIndex(null);
								return;
							}
							URL.revokeObjectURL(old.url);
							const url = URL.createObjectURL(file);
							setMediaItems((prev) => {
								const next = [...prev];
								next[editingIndex] = {
									url,
									file,
									type: "video",
									originalFile: old.originalFile ?? old.file,
								};
								return next;
							});
							setEditingIndex(null);
						}}
					/>
				) : (
					<MediaEditor
						file={
							mediaItems[editingIndex].originalFile ??
							mediaItems[editingIndex].file
						}
						doc={mediaItems[editingIndex].editDoc}
						allowAlt
						onClose={() => setEditingIndex(null)}
						onSave={({ file, doc }) => {
							const old = mediaItems[editingIndex];
							if (!old) {
								setEditingIndex(null);
								return;
							}
							URL.revokeObjectURL(old.url);
							const url = URL.createObjectURL(file);
							setMediaItems((prev) => {
								const next = [...prev];
								next[editingIndex] = {
									url,
									file,
									type: "image",
									originalFile: old.originalFile ?? old.file,
									editDoc: doc,
								};
								return next;
							});
							setEditingIndex(null);
						}}
					/>
				))}
		</div>
	);
};
