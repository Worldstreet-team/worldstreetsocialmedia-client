"use client";

import { formatCompact, formatTimeAgo } from "@/lib/utils";
import { useBackWithFallback } from "@/lib/nav";
import {
	BookmarkSimple,
	Broadcast,
	ChatCircle,
	ChatsCircle,
	Eye,
	Heart,
	PaperPlaneTilt,
	Plus,
	SpeakerSimpleHigh,
	SpeakerSimpleX,
	X,
	CaretDown,
	CaretUp,
	MusicNotesSimple,
	SealCheck,
	UsersThree,
} from "@phosphor-icons/react";
import clsx from "clsx";
import { syncUrlIfStillOn } from "@/lib/url-sync";
import { followUserDirect, unfollowUserDirect } from "@/lib/upload-direct";
import { AnimatePresence, motion } from "framer-motion";
import { useAtom, useAtomValue } from "jotai";
import type { Room } from "livekit-client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
	Suspense,
	useCallback,
	useEffect,
	useRef,
	useState,
	useSyncExternalStore,
} from "react";
import {
	peekHandle,
	requestHandle,
	subscribeMentions,
} from "@/lib/mentionCache";
import { LiveChatPanel } from "@/components/live/LiveChatPanel";
import { LeftSidebar } from "@/components/layout/LeftSidebar";
import { LiveSlidePlayer } from "@/components/live/LiveSlidePlayer";
import { LiveAdBanner } from "@/components/live/LiveAdBanner";
import { useToast } from "@/components/ui/Toast/ToastContext";
import { DEFAULT_AVATAR, XSTREAM_API_URL } from "@/const";
import { useLiveEvents } from "@/hooks/useLiveNow";
import { useVideoBuffer } from "@/hooks/useVideoBuffer";
import { useT } from "@/i18n/client";
import { demoStreetSlides } from "@/lib/demoSeed";
import { getVideoFeedAction } from "@/lib/feed.actions";
import { getStreamAction, listLiveStreamsAction } from "@/lib/live.actions";
import {
	pop,
	press,
	reveal,
	staggerItem,
	staggerParentFast,
	swap,
} from "@/lib/motion-presets";
import {
	bookmarkPostAction,
	getPostCommentsAction,
	likePostAction,
	replyToPostAction,
	unbookmarkPostAction,
	unlikePostAction,
} from "@/lib/post.actions";
import { track } from "@/lib/telemetry";
import { followingIdsAtom } from "@/store/ui.atom";
import { userAtom } from "@/store/user.atom";
import { SafeAvatar } from "@/components/ui/SafeAvatar";

type Tab = "street" | "live";

interface Slide {
	key: string;
	postId?: string;
	authorId?: string;
	/** Server truth for whether the viewer already follows this author. */
	authorIsFollowing?: boolean;
	username: string;
	/** Display name; the handle when they have none. */
	name?: string;
	verified?: boolean;
	createdAt?: string;
	/** The community it was posted in, as a chip over the caption. */
	community?: { name: string; slug: string };
	avatar: string;
	content: string;
	videoUrl?: string;
	streamId?: string;
	liveTitle?: string;
	category?: string;
	likes: number;
	replies: number;
	isLiked: boolean;
	isBookmarked: boolean;
}

interface CommentRow {
	id: string;
	username: string;
	avatar: string;
	content: string;
	timestamp: string;
}

const fmt = (n: number) =>
	n < 1000 ? String(n) : `${(n / 1000).toFixed(1).replace(/\.0$/, "")}K`;

/** A count that rolls when it changes. Keyed by the SHOWN text, so 1,204
 *  becoming 1,205 under "1.2K" does not move, and never on first paint. */
function Roll({ value, className }: { value: string; className?: string }) {
	return (
		<span className={clsx("relative inline-flex overflow-hidden", className)}>
			<AnimatePresence mode="popLayout" initial={false}>
				<motion.span key={value} {...swap} className="inline-block">
					{value}
				</motion.span>
			</AnimatePresence>
		</span>
	);
}

/**
 * The clip's own light behind it (owner 2026-10-16): the playing video,
 * copied into a tiny canvas a few times a second and blown up under a heavy
 * blur, so the space around the stage (and the letterbox on a phone) glows
 * with whatever is on screen. A cross-origin video only taints the canvas,
 * which still displays; nothing reads its pixels back. Active slide only.
 */
function AmbientGlow({ video, active }: { video: () => HTMLVideoElement | undefined; active: boolean }) {
	const ref = useRef<HTMLCanvasElement>(null);
	const [on, setOn] = useState(false);
	useEffect(() => {
		if (!active) {
			setOn(false);
			return;
		}
		const canvas = ref.current;
		const ctx = canvas?.getContext("2d");
		if (!canvas || !ctx) return;
		let id = 0;
		const draw = () => {
			const v = video();
			if (v && v.readyState >= 2 && document.visibilityState !== "hidden") {
				try {
					ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
					setOn(true);
				} catch {
					/* not decodable yet */
				}
			}
		};
		draw();
		id = window.setInterval(draw, 120);
		return () => window.clearInterval(id);
	}, [active, video]);
	return (
		<span aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
			<canvas
				ref={ref}
				width={36}
				height={64}
				className={clsx(
					"absolute inset-0 h-full w-full scale-125 object-cover blur-[60px] saturate-[1.7] transition-opacity duration-700",
					on ? "opacity-90" : "opacity-0",
				)}
			/>
			{/* Keeps the chrome and the captions readable over a bright clip. */}
			<span className="absolute inset-0 bg-black/30" />
		</span>
	);
}

/**
 * The hairline progress bar at the foot of a clip (Space v2, TikTok's
 * grammar). Reads the video it is given every frame while it is the one
 * playing; a bar on a neighbour would only ever sit at zero.
 */
function ProgressLine({ video, active }: { video: () => HTMLVideoElement | undefined; active: boolean }) {
	const bar = useRef<HTMLSpanElement>(null);
	useEffect(() => {
		if (!active) return;
		let raf = 0;
		const tick = () => {
			const v = video();
			if (v && bar.current && v.duration > 0) {
				bar.current.style.transform = `scaleX(${v.currentTime / v.duration})`;
			}
			raf = requestAnimationFrame(tick);
		};
		raf = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(raf);
	}, [active, video]);
	return (
		<span aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-[2px] bg-white/15">
			<span ref={bar} className="block h-full origin-left scale-x-0 bg-white/90" />
		</span>
	);
}

/**
 * The sound line under a caption: a note and the sound's name drifting
 * across, the way TikTok shows what you are hearing. Clips have no named
 * sounds yet, so it is the creator's original. Still while not playing.
 */
function SoundLine({ username, active }: { username: string; active: boolean }) {
	const text = `Original sound · @${username}`;
	return (
		<div className="mt-2.5 flex max-w-[260px] items-center gap-2 text-white">
			<MusicNotesSimple size={13} weight="bold" className="shrink-0" />
			<span className="relative min-w-0 flex-1 overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_8%,#000_85%,transparent)]">
				<motion.span
					className="flex w-max gap-10 whitespace-nowrap font-sans text-[calc(12.5px*var(--ws-fs))]"
					animate={active ? { x: ["0%", "-50%"] } : { x: "0%" }}
					transition={active ? { duration: 9, ease: "linear", repeat: Infinity } : { duration: 0.3 }}
				>
					<span>{text}</span>
					<span aria-hidden>{text}</span>
				</motion.span>
			</span>
		</div>
	);
}

/**
 * The sound disc at the foot of the rail: the creator's face on a record,
 * turning while the clip plays (TikTok's grammar, Space v2).
 */
function SoundDisc({ avatar, active }: { avatar: string; active: boolean }) {
	return (
		<motion.span
			aria-hidden
			animate={active ? { rotate: 360 } : { rotate: 0 }}
			transition={active ? { duration: 6, ease: "linear", repeat: Infinity } : { duration: 0.4 }}
			className="mt-1 flex h-11 w-11 items-center justify-center rounded-pill bg-[#1b1b1b] [background-image:repeating-radial-gradient(circle,#262626_0_1px,#161616_1px_3px)]"
		>
			<span className="relative block h-6 w-6 overflow-hidden rounded-pill">
				<SafeAvatar src={avatar} className="object-cover" />
			</span>
		</motion.span>
	);
}

/** A caption that opens in place on a tap, the way a post's "more" does. */
function Caption({ text }: { text: string }) {
	const [open, setOpen] = useState(false);
	const long = text.length > 90;
	return (
		<button
			type="button"
			onClick={() => long && setOpen((o) => !o)}
			className={clsx(
				"block w-full text-left font-sans text-[calc(14px*var(--ws-fs))] leading-snug text-white [text-shadow:0_1px_2px_rgb(0_0_0/0.5)]",
				long ? "cursor-pointer" : "cursor-default",
				!open && "line-clamp-2",
			)}
		>
			{text}
			{long && open && <span className="ml-1 font-semibold text-white/70">less</span>}
		</button>
	);
}

/** How often the live tab re-checks for new broadcasts when realtime is
 *  quiet. Long enough to be invisible, short enough that nobody waits. */
const LIVE_POLL_MS = 20_000;

function VerticalSurface() {
	const t = useT();
	const { toast } = useToast();
	const me = useAtomValue(userAtom);
	const search = useSearchParams();
	const [followedIds, setFollowedIds] = useAtom(followingIdsAtom);
	const [tab, setTab] = useState<Tab>(() =>
		search.get("tab") === "live" || search.get("s") ? "live" : "street",
	);
	const [slides, setSlides] = useState<Slide[]>([]);
	const [cursor, setCursor] = useState<string | null>(null);
	const [hasMore, setHasMore] = useState(true);
	const [active, setActive] = useState(0);
	// Mirrors for the room's data listener, which must not re-bind per slide.
	const activeRef = useRef(0);
	const slidesRef = useRef<Slide[]>([]);
	const [muted, setMuted] = useState(true);
	const [loading, setLoading] = useState(true);
	const [viewers, setViewers] = useState(0);
	/**
	 * Which slides are still fetching. A vertical feed that shows a black
	 * rectangle while bytes arrive reads as broken rather than loading, and
	 * the person flicks away from a clip that was about to play.
	 */
	const [buffering, setBuffering] = useState<Record<string, boolean>>({});
	/**
	 * The mounted `<video>` for each slide, so playback can be DRIVEN rather
	 * than declared.
	 *
	 * `autoPlay` only takes effect when an element loads. A slide one flick
	 * away is already mounted and already loaded, so scrolling onto it
	 * flipped `autoPlay` to true on an element that had long since finished
	 * loading — and nothing happened. The video simply sat on a still frame,
	 * which is the "it hangs" everyone was hitting: not a stall, a video that
	 * was never told to play.
	 */
	const videoEls = useRef<Map<string, HTMLVideoElement>>(new Map());
	// One stable getter per slide, so ProgressLine's effect doesn't restart
	// on every render.
	const getters = useRef<Map<string, () => HTMLVideoElement | undefined>>(new Map());
	const videoGetter = (key: string) => {
		let g = getters.current.get(key);
		if (!g) {
			g = () => videoEls.current.get(key);
			getters.current.set(key, g);
		}
		return g;
	};
	const markBuffering = useCallback(
		(key: string, value: boolean) =>
			setBuffering((prev) =>
				prev[key] === value ? prev : { ...prev, [key]: value },
			),
		[],
	);
	const [liveRoom, setLiveRoom] = useState<Room | null>(null);
	const [chatFor, setChatFor] = useState<Slide | null>(null);
	const [commentsFor, setCommentsFor] = useState<Slide | null>(null);
	const [comments, setComments] = useState<CommentRow[]>([]);
	const [commentsLoading, setCommentsLoading] = useState(false);
	const [draft, setDraft] = useState("");
	const [sending, setSending] = useState(false);
	const goBack = useBackWithFallback();
	const containerRef = useRef<HTMLDivElement>(null);
	const fetchingRef = useRef(false);
	const startedRef = useRef<Set<string>>(new Set());
	const deepLinkRef = useRef<string | null>(search.get("s") ?? search.get("v"));

	const mapPost = (p: any): Slide => ({
		key: `post-${p._id}`,
		postId: p._id,
		authorId: p.author?._id,
		authorIsFollowing: Boolean(p.author?.isFollowing),
		username: p.author?.username ?? "",
		name:
			[p.author?.firstName, p.author?.lastName].filter(Boolean).join(" ") ||
			p.author?.username ||
			"",
		verified: Boolean(p.author?.isVerified),
		createdAt: p.createdAt,
		community: p.community?.name ? { name: p.community.name, slug: p.community.slug } : undefined,
		avatar: p.author?.avatar || DEFAULT_AVATAR,
		content: p.content ?? "",
		videoUrl: p.videos?.[0],
		streamId: p.live?.status === "live" ? String(p.live.streamId) : undefined,
		liveTitle: p.live?.title,
		category: p.live?.category,
		likes: p.stats?.likes ?? 0,
		replies: p.stats?.replies ?? 0,
		isLiked: Boolean(p.isLiked),
		isBookmarked: Boolean(p.isBookmarked),
	});

	// ── data per tab ─────────────────────────────────────────────────────
	// Design-review mode (?demo=1): sample slides so the surface can be
	// judged with content in it. Chipped in the header, never the default.
	// Latched at mount — the shareable-URL sync rewrites the query string as
	// you scroll and would otherwise un-demo the page mid-review.
	const [demo] = useState(() => search.get("demo") === "1");

	const loadStreet = useCallback(
		async (cur: string | null) => {
			if (fetchingRef.current) return;
			fetchingRef.current = true;
			try {
				const res = await getVideoFeedAction(cur);
				const mapped =
					res.success && res.data ? res.data.posts.map(mapPost) : [];
				if (mapped.length > 0) {
					setSlides((prev) => {
						const seen = new Set(prev.map((sl: Slide) => sl.key));
						return [
							...prev,
							...mapped.filter((sl: Slide) => !seen.has(sl.key)),
						];
					});
				}
				if (res.success && res.data) {
					setCursor(res.data.nextCursor ?? null);
					setHasMore(Boolean(res.data.hasMore));
				}
			} finally {
				fetchingRef.current = false;
				setLoading(false);
			}
		},
		[],
	);

	/**
	 * `quiet` is the background pass: it merges rather than replaces and never
	 * touches the loading flag, so a stream that starts while you are watching
	 * simply appears further down the feed. A plain replace would rebuild the
	 * list under the viewer and restart whatever is playing.
	 */
	const loadLive = useCallback(async (quiet = false) => {
		if (fetchingRef.current) return;
		fetchingRef.current = true;
		try {
			const res = await listLiveStreamsAction();
			let mapped: Slide[] = res.streams.map((st: any) => ({
				key: `live-${st.id}`,
				username: st.username,
				avatar: st.avatar || DEFAULT_AVATAR,
				content: st.title,
				streamId: st.id,
				liveTitle: st.title,
				category: st.category,
				likes: Number(st.likes ?? 0),
				replies: 0,
				isLiked: false,
				isBookmarked: false,
			}));
			// Deep link to a stream that has already left the directory still
			// deserves a slide (it shows its ended state in place).
			const want = deepLinkRef.current;
			if (want && !mapped.some((s) => s.streamId === want)) {
				const info = await getStreamAction(want);
				if (info.success) {
					mapped = [
						{
							key: `live-${want}`,
							username: info.stream.streamer.username,
							avatar: info.stream.streamer.avatar || DEFAULT_AVATAR,
							content: info.stream.title,
							streamId: want,
							liveTitle: info.stream.title,
							category: info.stream.category,
							likes: Number((info.stream as any).likes ?? 0),
							replies: 0,
							isLiked: false,
							isBookmarked: false,
						},
						...mapped,
					];
				}
			}
			if (quiet) {
				setSlides((prev) => {
					// Nothing to preserve on the first pass.
					if (prev.length === 0) return mapped;
					const known = new Set(prev.map((s) => s.key));
					const fresh = mapped.filter((s) => !known.has(s.key));
					// Append only. Slides already on screen are left exactly
					// where they are — a stream that has since ended flips to
					// its ended state on its own inside LiveSlidePlayer, so
					// pulling it out of the list would only move the ground
					// under whoever is mid-scroll.
					return fresh.length ? [...prev, ...fresh] : prev;
				});
			} else {
				setSlides(mapped);
			}
			setHasMore(false);
		} finally {
			fetchingRef.current = false;
			if (!quiet) setLoading(false);
		}
	}, []);

	// The live tab is a presence list: rebuild it whenever someone starts or
	// stops, so it never shows a stream that is already over.
	useLiveEvents(() => {
		if (tab === "live") void loadLive(true);
	});

	/**
	 * Background discovery.
	 *
	 * Realtime (`useLiveEvents`) is the fast path, but it is not a guarantee:
	 * the Ably token round-trip can fail, a socket can drop, and someone can go
	 * live during either. This poll is the floor under that — it runs only on
	 * the live tab, pauses while the document is hidden (a backgrounded tab
	 * should not keep polling), and merges quietly so the viewer never sees it
	 * happen. It also fires once on becoming visible again, which is when the
	 * list is most likely to be stale.
	 */
	useEffect(() => {
		if (tab !== "live" || demo) return;

		let timer: ReturnType<typeof setInterval> | null = null;
		const start = () => {
			if (timer) return;
			timer = setInterval(() => void loadLive(true), LIVE_POLL_MS);
		};
		const stop = () => {
			if (!timer) return;
			clearInterval(timer);
			timer = null;
		};

		const onVisibility = () => {
			if (document.hidden) {
				stop();
			} else {
				void loadLive(true);
				start();
			}
		};

		if (!document.hidden) start();
		document.addEventListener("visibilitychange", onVisibility);
		return () => {
			stop();
			document.removeEventListener("visibilitychange", onVisibility);
		};
	}, [tab, demo, loadLive]);

	useEffect(() => {
		setCursor(null);
		setHasMore(true);
		setActive(0);
		containerRef.current?.scrollTo({ top: 0 });
		if (demo && tab === "street") {
			// Review seed paints instantly; real rows merge when the fetch lands.
			setSlides(
				demoStreetSlides().map((d) => ({
					...d,
					isLiked: false,
					isBookmarked: false,
				})),
			);
			setLoading(false);
		} else {
			setSlides([]);
			setLoading(true);
		}
		if (tab === "live") void loadLive();
		else void loadStreet(null);
	}, [tab, loadLive, loadStreet, demo]);

	useEffect(() => {
		activeRef.current = active;
	}, [active]);
	useEffect(() => {
		slidesRef.current = slides;
	}, [slides]);

	// ── active tracking + deep link positioning ──────────────────────────
	useEffect(() => {
		const root = containerRef.current;
		if (!root) return;
		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (entry.isIntersecting) {
						setActive(Number((entry.target as HTMLElement).dataset.index ?? 0));
					}
				}
			},
			{ root, threshold: 0.6 },
		);
		for (const el of root.querySelectorAll("[data-index]"))
			observer.observe(el);
		return () => observer.disconnect();
	}, [slides.length]);

	useEffect(() => {
		const want = deepLinkRef.current;
		if (!want || slides.length === 0) return;
		const idx = slides.findIndex(
			(s) => s.streamId === want || s.postId === want,
		);
		if (idx > 0) {
			containerRef.current
				?.querySelector(`[data-index="${idx}"]`)
				?.scrollIntoView();
		}
		if (idx >= 0) deepLinkRef.current = null;
	}, [slides]);

	// The stream's like count is shared with Xstream; seed it when a live
	// slide becomes the active one (the directory list doesn't carry it).
	useEffect(() => {
		const slide = slides[active];
		if (!slide?.streamId || slide.postId) return;
		let cancelled = false;
		(async () => {
			try {
				const token = await (window as any).Clerk?.session?.getToken();
				const res = await fetch(
					`${XSTREAM_API_URL}/v1/streams/${slide.streamId}/like`,
					{
						headers: token ? { Authorization: `Bearer ${token}` } : undefined,
					},
				);
				const body = await res.json().catch(() => null);
				if (!cancelled && body?.data) {
					patchSlide(slide.key, {
						likes: Number(body.data.likes ?? 0),
						isLiked: Boolean(body.data.liked),
					});
				}
			} catch {
				/* count stays at its listed value */
			}
		})();
		return () => {
			cancelled = true;
		};
		// biome-ignore lint/correctness/useExhaustiveDependencies: keyed by the active slide only.
	}, [active, slides[active]?.streamId]);

	// Likes fan out from the Xstream API into the room (server-side), so
	// every watcher's count moves together — whichever platform they're on.
	useEffect(() => {
		if (!liveRoom) return;
		let detach: (() => void) | null = null;
		let disposed = false;
		(async () => {
			const { RoomEvent } = await import("livekit-client");
			if (disposed) return;
			const handler = (payload: Uint8Array) => {
				try {
					const data = JSON.parse(new TextDecoder().decode(payload));
					if (data.__evt !== "like" || typeof data.likes !== "number")
						return;
					const slide = slidesRef.current[activeRef.current];
					if (slide?.streamId) {
						patchSlide(slide.key, { likes: data.likes });
					}
				} catch {
					/* not a like event */
				}
			};
			liveRoom.on(RoomEvent.DataReceived, handler);
			detach = () => liveRoom.off(RoomEvent.DataReceived, handler);
		})();
		return () => {
			disposed = true;
			detach?.();
		};
	}, [liveRoom]);

	// ── URL follows the active slide, so every slide is shareable ────────
	//
	// Raw `replaceState` rather than `router.replace`, because this fires on
	// every slide change and a real navigation would re-render the route and
	// restart whatever is playing.
	//
	// The pathname guard is belt and braces. `slides` is a dependency and the
	// background discovery pass hands back a new array every time it merges,
	// so this can re-run in the window after a link has started navigating
	// away but before the surface unmounts — and rewriting the URL there would
	// cancel the navigation silently. Once the router has moved on, leave the
	// URL alone.
	useEffect(() => {
		const slide = slides[active];
		if (!slide) return;
		if (window.location.pathname !== "/live") return;
		const params = new URLSearchParams();
		if (tab === "live") params.set("tab", "live");
		if (slide.streamId) params.set("s", slide.streamId);
		else if (slide.postId) params.set("v", slide.postId);
		if (demo) params.set("demo", "1");
		const qs = params.toString();
		const next = qs ? `/live?${qs}` : "/live";
		if (next === window.location.pathname + window.location.search) return;
		syncUrlIfStillOn(window.location.pathname, next);
	}, [active, slides, tab, demo]);

	// ── telemetry + tail prefetch ────────────────────────────────────────
	useEffect(() => {
		const slide = slides[active];
		if (!slide?.postId) return;
		const timer = setTimeout(() => {
			track({
				post: slide.postId,
				author: slide.authorId,
				action: "impression",
				surface: "vertical",
				position: active,
				meta: { mediaType: slide.streamId ? "live" : "video" },
			});
		}, 1000); // MRC: a continuous second in the viewport
		if (tab === "street" && hasMore && active >= slides.length - 3)
			void loadStreet(cursor);
		return () => clearTimeout(timer);
	}, [active, slides, hasMore, cursor, loadStreet, tab]);

	// The prefetch above pulls the next PAGE of slides; this pulls the next
	// slides' actual video bytes, so a flick lands on a playing frame rather
	// than on a black plate that then starts downloading.
	useVideoBuffer(
		slides.map((s) => s.videoUrl),
		active,
	);

	// Memoized deliberately: this is in the dependency list of effects that
	// fetch. As a plain function it was a new value on every render, so those
	// effects re-ran on every render — refetching in a loop and overwriting
	// optimistic state (a like would land, then immediately snap back).
	const patchSlide = useCallback((key: string, patch: Partial<Slide>) => {
		setSlides((prev) =>
			prev.map((s) => (s.key === key ? { ...s, ...patch } : s)),
		);
	}, []);

	// ── the active stream's like state ───────────────────────────────────
	//
	// The listing carries the total, but whether YOU have liked it is
	// per-viewer and only Xstream knows. Fetched for the active slide alone
	// rather than the whole rail: a stream you never reach costs nothing, and
	// this is one small request per broadcast you actually watch.
	const activeStreamId = slides[active]?.streamId;
	/**
	 * Which broadcaster handles are real accounts here.
	 *
	 * A live slide comes from Xstream, which has its own users — plenty of
	 * them have never made a WorldSpace profile. The handle was the only
	 * shared identifier, so Align was offered for everyone and, for those
	 * people, the follow resolved to nothing: the button flipped on, the
	 * request failed, and it flipped back with an error. An affordance for
	 * something that cannot happen.
	 *
	 * Reuses the mention resolver rather than adding a second one — it
	 * already batches a tick's worth of handles into one request and caches
	 * `null` for "no such account", which is exactly the answer needed here.
	 */
	// A STRING snapshot, not an object: getSnapshot must return something
	// that compares equal when nothing has changed, or the store re-renders
	// forever. One character per slide — resolved / absent / still unknown.
	useSyncExternalStore(
		subscribeMentions,
		() =>
			slides
				.map((s) => {
					if (!s.streamId || s.authorId || !s.username) return "-";
					const hit = peekHandle(s.username);
					return hit ? "1" : hit === null ? "0" : "?";
				})
				.join(""),
		() => "",
	);
	useEffect(() => {
		for (const s of slides) {
			// Post slides carry a real profile id already; only broadcasts
			// need resolving.
			if (s.streamId && !s.authorId && s.username) requestHandle(s.username);
		}
	}, [slides]);

	const activeSlideKey = slides[active]?.key;

	// Drive playback on every change of active slide: play the one on screen,
	// pause and rewind the rest. Rewinding matters — coming back to a slide
	// half-watched, with no controls to scrub, feels broken.
	useEffect(() => {
		for (const [key, el] of videoEls.current) {
			if (key === activeSlideKey) {
				// A rejected play() is normal (autoplay policy, or the element
				// was torn down mid-promise) and must not surface — but a
				// swipe is NOT a user activation, so once the viewer has
				// unmuted, iOS refuses this and the slide freezes on a still
				// frame. Retry muted; they can unmute with a tap
				// (iOS audit 2026-09-01).
				el.play().catch(() => {
					el.muted = true;
					el.play().catch(() => {});
				});
			} else if (!el.paused) {
				el.pause();
				el.currentTime = 0;
			}
		}
	}, [activeSlideKey]);
	const likeSyncedRef = useRef<string | null>(null);
	useEffect(() => {
		if (!activeStreamId || !activeSlideKey) return;
		// One sync per broadcast. Re-running would fight the optimistic
		// toggle: the fetch resolves after the tap and would put the old
		// answer back.
		if (likeSyncedRef.current === activeStreamId) return;
		likeSyncedRef.current = activeStreamId;
		let cancelled = false;
		(async () => {
			try {
				const token = await (window as any).Clerk?.session?.getToken();
				if (!token) return;
				const res = await fetch(
					`${XSTREAM_API_URL}/v1/streams/${activeStreamId}/like`,
					{ headers: { Authorization: `Bearer ${token}` } },
				);
				const body = await res.json().catch(() => null);
				if (cancelled || !body?.data) return;
				patchSlide(activeSlideKey, {
					likes: Number(body.data.likes ?? 0),
					isLiked: Boolean(body.data.liked),
				});
			} catch {
				// A rail that shows the listing's total is fine; leave it be.
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [activeStreamId, activeSlideKey, patchSlide]);

	const toggleLike = async (slide: Slide) => {
		// A live slide's heart is the STREAM's like, shared with Xstream —
		// it used to like the backing feed post, so hearts sent here never
		// reached Xstream's counter and theirs never reached ours.
		if (slide.streamId && !slide.postId) {
			const wasLiked = slide.isLiked;
			patchSlide(slide.key, {
				isLiked: !wasLiked,
				likes: Math.max(0, slide.likes + (wasLiked ? -1 : 1)),
			});
			try {
				const token = await (window as any).Clerk?.session?.getToken();
				if (!token) throw new Error("signed out");
				const res = await fetch(
					`${XSTREAM_API_URL}/v1/streams/${slide.streamId}/like`,
					{
						method: wasLiked ? "DELETE" : "POST",
						headers: { Authorization: `Bearer ${token}` },
					},
				);
				const body = await res.json().catch(() => null);
				if (body?.data) {
					patchSlide(slide.key, {
						likes: Number(body.data.likes ?? 0),
						isLiked: Boolean(body.data.liked),
					});
				}
			} catch {
				patchSlide(slide.key, {
					isLiked: wasLiked,
					likes: slide.likes,
				});
			}
			return;
		}
		if (!slide.postId) return;
		patchSlide(slide.key, {
			isLiked: !slide.isLiked,
			likes: slide.likes + (slide.isLiked ? -1 : 1),
		});
		if (slide.isLiked) await unlikePostAction(slide.postId);
		else await likePostAction(slide.postId);
	};

	const toggleBookmark = async (slide: Slide) => {
		if (!slide.postId) return;
		patchSlide(slide.key, { isBookmarked: !slide.isBookmarked });
		if (slide.isBookmarked) await unbookmarkPostAction(slide.postId);
		else await bookmarkPostAction(slide.postId);
	};

	const follow = async (slide: Slide) => {
		// A live stream comes from Xstream, which knows the broadcaster by its
		// own user id — meaningless to this gateway. The handle is the only
		// identifier both sides share, and the gateway resolves it. Before
		// this the button was simply inert on every live broadcast.
		const target = slide.authorId ?? slide.username;
		if (!target) return;
		// followingIdsAtom (and the session follow store) key on profile
		// _id everywhere else — a username entry can never match and only
		// pollutes both. Without a resolved id, the button still works, it
		// just can't feed the shared state.
		const keyable = Boolean(slide.authorId);
		if (keyable)
			setFollowedIds((prev) =>
				prev.includes(target) ? prev : [...prev, target],
			);
		const res = await followUserDirect(target);
		if (!res.success) {
			setFollowedIds((prev) => prev.filter((id) => id !== target));
			toast(res.message || t("rail.followFailed"), { type: "error" });
		}
	};

	const share = async (slide: Slide) => {
		const url = slide.streamId
			? `${window.location.origin}/live?s=${slide.streamId}`
			: `${window.location.origin}/live?v=${slide.postId}`;
		try {
			await navigator.clipboard.writeText(url);
			toast(t("vertical.copied"), { type: "success" });
		} catch {
			toast(t("promo.failed"), { type: "error" });
		}
	};

	const openComments = async (slide: Slide) => {
		if (!slide.postId) return;
		setCommentsFor(slide);
		setComments([]);
		setCommentsLoading(true);
		const res = await getPostCommentsAction(slide.postId);
		setCommentsLoading(false);
		if (res.success && Array.isArray(res.data)) {
			setComments(
				res.data.map((c: any) => ({
					id: c._id,
					username: c.author?.username ?? "",
					avatar: c.author?.avatar || DEFAULT_AVATAR,
					content: c.content ?? "",
					timestamp: c.createdAt
						? new Date(c.createdAt).toLocaleDateString(undefined, {
								month: "short",
								day: "numeric",
							})
						: "",
				})),
			);
		}
	};

	const sendComment = async () => {
		const content = draft.trim();
		if (!content || sending || !commentsFor?.postId) return;
		setSending(true);
		setDraft("");
		const res = await replyToPostAction(commentsFor.postId, content);
		setSending(false);
		if (res.success) {
			setComments((prev) => [
				...prev,
				{
					id: `local-${Date.now()}`,
					username: me?.username ?? "",
					avatar: me?.avatar || DEFAULT_AVATAR,
					content,
					timestamp: "",
				},
			]);
			patchSlide(commentsFor.key, { replies: commentsFor.replies + 1 });
		} else {
			setDraft(content);
			toast(res.message ?? t("chat.failed"), { type: "error" });
		}
	};

	const railBtn =
		// Bare glyphs over the video on phones, the way TikTok does it (owner
		// 2026-10-16); round glass buttons beside the stage on desktop.
		// Bare on desktop too (owner 2026-10-16, "less borders"): a plain
		// glyph that gets a soft disc under the pointer.
		// Desktop: solid soft discs so they read as live buttons beside the
		// stage, not faint glyphs (owner 2026-10-16, "looks disabled").
		"flex h-12 w-12 items-center justify-center rounded-pill transition-colors cursor-pointer [filter:drop-shadow(0_1px_3px_rgb(0_0_0/0.45))] lg:[filter:none] lg:bg-white/[0.14] lg:hover:bg-white/[0.22]";

	// `commentsFor` is a snapshot taken when the panel opened. Read the live
	// slide so the header count moves when a comment lands.
	const commentsCount = commentsFor
		? (slides.find((s) => s.key === commentsFor.key)?.replies ??
			commentsFor.replies)
		: 0;

	return (
		<div
			ref={containerRef}
			className="fixed inset-x-0 top-0 bottom-[calc(56px+var(--ws-safe-bottom))] md:bottom-0 lg:left-[264px] z-dropdown bg-black overflow-y-auto snap-y snap-mandatory [scrollbar-width:none]"
		>
			{/* The app's own sidebar stays on desktop (owner 2026-10-16): The
			    Space is a place in WorldSpace, not a separate app. */}
			<div className="fixed inset-y-0 left-0 z-modal hidden w-[264px] bg-page lg:block">
				<LeftSidebar />
			</div>
			{/* ── top chrome ── */}
			<div className="fixed top-0 inset-x-0 lg:left-[264px] z-modal flex items-center px-4 h-16 pt-safe box-content bg-gradient-to-b from-black/70 to-transparent pointer-events-none">
				{/* Back, not home: entering from Explore, a live-now row or a
				    deep link, the X used to dump you at "/" and stack a ghost
				    history entry. Fallback home only when there is no in-app
				    history below us. */}
				<button
					type="button"
					onClick={() => goBack("/")}
					aria-label="Close"
					className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-pill text-white [filter:drop-shadow(0_1px_3px_rgb(0_0_0/0.45))] hover:bg-white/[0.08] transition-colors cursor-pointer lg:invisible"
				>
					<X size={20} />
				</button>

				{/* Tabs as words with a short bar under the one you're on, the
				    way TikTok does it (owner 2026-10-16). */}
				<div className="flex-1 flex justify-center pointer-events-auto">
					<div className="flex items-center gap-6">
						{[
							{ key: "street" as Tab, label: t("vertical.tabStreet") },
							{ key: "live" as Tab, label: t("vertical.tabLive") },
						].map(({ key, label }) => (
							<button
								key={key}
								type="button"
								onClick={() => setTab(key)}
								className={clsx(
									"relative flex h-10 flex-col items-center justify-center font-sans text-[calc(16px*var(--ws-fs))] transition-colors cursor-pointer [text-shadow:0_1px_3px_rgb(0_0_0/0.4)]",
									tab === key ? "font-bold text-white" : "font-semibold text-white/75 hover:text-white",
								)}
							>
								<span className="flex items-center gap-1.5">
									{key === "live" && (
										<span className="relative flex h-1.5 w-1.5">
											<span
												className={clsx(
													"absolute inline-flex h-full w-full rounded-pill bg-danger opacity-70",
													tab === "live" && "animate-ping",
												)}
											/>
											<span className="relative inline-flex h-1.5 w-1.5 rounded-pill bg-danger" />
										</span>
									)}
									{label}
								</span>
								{tab === key && (
									<motion.span
										layoutId="street-tab"
										transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
										className="absolute -bottom-0.5 h-[3px] w-6 rounded-pill bg-white"
									/>
								)}
							</button>
						))}
					</div>
				</div>

				{demo && (
					<span className="pointer-events-none mr-2 rounded-pill bg-warning-chip px-2 py-1 font-sans text-[calc(9px*var(--ws-fs))] font-bold uppercase tracking-[0.1em] text-warning">
						Demo
					</span>
				)}
				<button
					type="button"
					onClick={() => setMuted((m) => !m)}
					aria-label={t("vertical.unmute")}
					className="pointer-events-auto relative flex h-10 w-10 items-center justify-center rounded-pill text-white [filter:drop-shadow(0_1px_3px_rgb(0_0_0/0.45))] hover:bg-white/[0.08] transition-colors cursor-pointer"
				>
					<AnimatePresence mode="popLayout" initial={false}>
						<motion.span
							key={muted ? "muted" : "on"}
							{...swap}
							className="flex"
						>
							{muted ? (
								<SpeakerSimpleX size={20} />
							) : (
								<SpeakerSimpleHigh size={20} />
							)}
						</motion.span>
					</AnimatePresence>
				</button>
			</div>

			{/* Up and down, in the middle of the right edge (desktop): the
			    wheel works, but a pointer wants something to press. */}
			{slides.length > 1 && (
				<div className="fixed right-6 top-1/2 z-modal hidden -translate-y-1/2 flex-col gap-3 lg:flex">
					{[
						{ dir: -1, Icon: CaretUp, label: "Previous", off: active === 0 },
						{ dir: 1, Icon: CaretDown, label: "Next", off: active >= slides.length - 1 },
					].map(({ dir, Icon, label, off }) => (
						<motion.button
							key={label}
							type="button"
							{...press}
							disabled={off}
							aria-label={label}
							onClick={() => {
								const el = containerRef.current;
								if (el) el.scrollBy({ top: dir * el.clientHeight, behavior: "smooth" });
							}}
							className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-pill bg-white/[0.08] text-white transition-colors hover:bg-white/[0.16] disabled:cursor-default disabled:opacity-30 disabled:hover:bg-white/[0.08]"
						>
							<Icon size={18} weight="bold" />
						</motion.button>
					))}
				</div>
			)}

			{loading && (
				<div className="h-[calc(100dvh-56px-var(--ws-safe-bottom))] md:h-dvh flex items-center justify-center lg:px-6">
					<div className="h-full w-full lg:h-[min(calc(100dvh-56px),960px)] lg:w-auto lg:aspect-[9/16] lg:rounded-2xl skeleton" />
				</div>
			)}

			{!loading && slides.length === 0 && (
				<motion.div
					{...reveal()}
					className="h-[calc(100dvh-56px-var(--ws-safe-bottom))] md:h-dvh flex flex-col items-center justify-center gap-3 px-8"
				>
					<span className="flex h-16 w-16 items-center justify-center rounded-pill bg-white/[0.07] text-white/60">
						<Broadcast size={26} weight="light" />
					</span>
					<p className="text-center text-white font-display text-[calc(17px*var(--ws-fs))] font-semibold">
						{tab === "live" ? t("liveNow.emptyTitle") : t("vertical.empty")}
					</p>
					<p className="max-w-[300px] text-center text-white/50 font-sans text-[calc(13px*var(--ws-fs))] leading-relaxed">
						{t("liveNow.emptyCaption")}
					</p>
					<Link
						href="/"
						className="mt-2 flex h-10 items-center rounded-pill bg-white px-5 font-sans text-[calc(13px*var(--ws-fs))] font-semibold text-black hover:bg-white/90 transition-colors"
					>
						{t("watch.browse")}
					</Link>
				</motion.div>
			)}

			{slides.map((slide, idx) => {
				// Two ahead, not one. At ±1 the next clip only STARTED loading
				// when you landed on it, so every flick paid the whole fetch
				// and the surface looked stalled. Two is the balance: the
				// flick is covered, without mounting a feed of players.
				// One either side. This used to be two, which mounted FIVE
				// videos; with preload=auto on each that is five full-file
				// downloads from one host against a ~6-connection cap, and
				// the one you are actually watching lost the race. Warming
				// ahead is the detached pool's job, not the DOM's.
				const near = Math.abs(idx - active) <= 1;
				const isActive = idx === active;
				const isSelf =
					me?._id === slide.authorId || me?.userId === slide.authorId;
				// Server truth first, session atom as the optimistic override.
				// The atom alone seeds empty, so after a reload every author
				// looked unfollowed and the button was offered to people the
				// viewer had aligned with long ago.
				const followed = (slide.authorId ?? slide.username)
					? slide.authorIsFollowing ||
						followedIds.includes((slide.authorId ?? slide.username) as string)
					: true;
				// A broadcast is only followable once its handle resolves to a
				// real profile. `undefined` means the answer has not arrived —
				// treated as "no", because offering the button and taking it
				// away a beat later is worse than showing it a beat late.
				const alignable =
					!slide.streamId || Boolean(slide.authorId)
						? true
						: Boolean(slide.username && peekHandle(slide.username));
				return (
					<section
						key={slide.key}
						data-index={idx}
						className="relative h-[calc(100dvh-56px-var(--ws-safe-bottom))] md:h-dvh snap-start overflow-hidden flex items-end lg:items-center justify-center lg:gap-5 lg:px-6"
					>
						{!slide.streamId && slide.videoUrl && (
							<AmbientGlow video={videoGetter(slide.key)} active={isActive} />
						)}
						{/* The stage: full-bleed on phones, a floating 9:16 plate on
						    desktop — the same object grammar as the Story Studio. */}
						<div className="relative h-full w-full lg:h-[min(calc(100dvh-56px),960px)] lg:w-auto lg:aspect-[9/16] lg:shrink-0 lg:overflow-hidden lg:rounded-[22px] lg:bg-[#0a0a0a]">
							{/* media */}
							{near && slide.streamId ? (
								<LiveSlidePlayer
									streamId={slide.streamId}
									active={isActive}
									muted={muted}
									onRoom={isActive ? setLiveRoom : undefined}
									onViewers={isActive ? setViewers : undefined}
								/>
							) : near && slide.videoUrl ? (
								// eslint-disable-next-line jsx-a11y/media-has-caption
								<video
									ref={(el) => {
										if (el) videoEls.current.set(slide.key, el);
										else videoEls.current.delete(slide.key);
									}}
									src={slide.videoUrl}
									// The media layer is decoration and must not take
									// pointer events. It is `inset-0`, so its box covers
									// the whole slide including the letterbox bars — a tap
									// on the author row or the caption landed on the video
									// instead of the link under the cursor, and nothing
									// happened. There are no video controls to lose.
									className="pointer-events-none absolute inset-0 w-full h-full object-contain"
									autoPlay={isActive}
									muted={muted || !isActive}
									playsInline
									loop
									// Only the slide you are watching pulls bytes
									// eagerly. The neighbours are warmed by
									// useVideoBuffer's detached pool instead, which is
									// bounded and does not compete with playback.
									preload={isActive ? "auto" : "metadata"}
									onWaiting={() => markBuffering(slide.key, true)}
									onStalled={() => markBuffering(slide.key, true)}
									onCanPlay={() => markBuffering(slide.key, false)}
									onPlaying={() => markBuffering(slide.key, false)}
									onLoadStart={() => markBuffering(slide.key, true)}
									onPlay={() => {
										if (slide.postId && !startedRef.current.has(slide.postId)) {
											startedRef.current.add(slide.postId);
											track({
												post: slide.postId,
												author: slide.authorId,
												action: "video_start",
												surface: "vertical",
												position: idx,
											});
										}
									}}
								/>
							) : (
								<div className="absolute inset-0 bg-[#0a0a0a]" />
							)}

							{/* Buffering, on the active slide only. A neighbour
							    quietly filling its buffer is not news. */}
							{isActive && slide.videoUrl && buffering[slide.key] && (
								<span className="pointer-events-none absolute inset-0 flex items-center justify-center">
									<span className="h-8 w-8 animate-spin rounded-pill border-2 border-[#fafaf9]/25 border-t-[#fafaf9]" />
								</span>
							)}

							{/* live status row */}
							{slide.streamId && (
								<div className="absolute top-20 left-4 z-10 flex items-center gap-2">
									<span className="flex items-center gap-1.5 rounded-[4px] bg-danger px-2 h-6 text-[calc(10.5px*var(--ws-fs))] font-bold tracking-wide text-white font-sans">
										<span className="relative flex h-1.5 w-1.5">
											<span className="absolute inline-flex h-full w-full rounded-pill bg-white opacity-70 animate-ping" />
											<span className="relative inline-flex h-1.5 w-1.5 rounded-pill bg-white" />
										</span>
										{t("live.badge")}
									</span>
									{isActive && (
										<span className="flex items-center gap-1.5 rounded-[4px] bg-black/50 backdrop-blur-md px-2 h-6 text-[calc(11px*var(--ws-fs))] font-semibold text-white/85 font-sans tabular-nums">
											<Eye size={12} />
											<Roll value={formatCompact(viewers)} />
										</span>
									)}
									{slide.category && (
										<span className="rounded-[4px] bg-black/50 backdrop-blur-md px-2 h-6 flex items-center text-[calc(11px*var(--ws-fs))] font-medium text-white/75 font-sans">
											{slide.category}
										</span>
									)}
								</div>
							)}

							{/* The broadcaster's running campaign rides their live
							    stream, YouTube-style — only on live slides, only
							    while this slide is the active one. */}
							{slide.streamId && (
								<LiveAdBanner
									creatorProfileId={slide.authorId}
									active={isActive}
								/>
							)}

							{/* bottom info */}
							{/* Who, where and what (Space v2): the community it came
							    from, the person by name with their tick and when, then
							    the caption. A person, not a handle. */}
							<div className="absolute bottom-0 inset-x-0 pt-28 pb-5 px-4 bg-gradient-to-t from-black/80 via-black/30 to-transparent pointer-events-none lg:pb-6">
								<div className="pointer-events-auto max-w-[560px] pr-20 lg:pr-4">
									{slide.community && (
										<Link
											href={`/communities/${slide.community.slug}`}
											className="mb-2.5 inline-flex h-7 max-w-full items-center gap-1.5 rounded-pill bg-black/35 px-2.5 font-sans text-[calc(12px*var(--ws-fs))] font-semibold text-white backdrop-blur-md transition-colors hover:bg-black/50"
										>
											<UsersThree size={13} weight="bold" className="shrink-0" />
											<span className="truncate">{slide.community.name}</span>
										</Link>
									)}
									<div className="mb-1.5 flex min-w-0 items-center gap-1.5 [text-shadow:0_1px_2px_rgb(0_0_0/0.5)]">
										<Link
											href={`/profile/${slide.username}`}
											className="truncate font-sans text-[calc(15.5px*var(--ws-fs))] font-bold text-white hover:underline"
										>
											{slide.name || slide.username}
										</Link>
										{slide.verified && (
											<SealCheck size={15} weight="fill" className="shrink-0 text-brand" aria-label="Verified" />
										)}
										{slide.createdAt && (
											<span className="shrink-0 font-sans text-[calc(13px*var(--ws-fs))] text-white/75">
												· {formatTimeAgo(slide.createdAt)}
											</span>
										)}
									</div>
									{slide.streamId && slide.liveTitle ? (
										<p className="text-[calc(16px*var(--ws-fs))] font-semibold text-white font-sans leading-snug line-clamp-2 [text-shadow:0_1px_2px_rgb(0_0_0/0.5)]">
											{slide.liveTitle}
										</p>
									) : (
										slide.content && <Caption text={slide.content} />
									)}
									{!slide.streamId && slide.videoUrl && (
										<SoundLine username={slide.username} active={isActive} />
									)}
								</div>
							</div>
							{!slide.streamId && slide.videoUrl && (
								<ProgressLine video={videoGetter(slide.key)} active={isActive} />
							)}
						</div>

						{/* action rail — overlaid on phones, beside the stage on desktop */}
						{/* lg:relative z-10, never static: the ambient glow is a positioned
						    layer, and a static rail painted UNDER its wash and read
						    as disabled (owner 2026-10-16). */}
						<div className="absolute right-3 bottom-8 z-10 flex flex-col items-center gap-4 text-white lg:relative lg:self-end lg:pb-10">
							{/* The creator's face heads the rail with a + to follow,
							    TikTok's grammar; the + leaves once you follow. */}
							<div className="relative mb-2.5">
								<Link
									href={`/profile/${slide.username}`}
									aria-label={`@${slide.username}`}
									className="relative block h-12 w-12 overflow-hidden rounded-pill bg-white/10 ring-2 ring-white"
								>
									<SafeAvatar src={slide.avatar} className="object-cover" alt={slide.username} />
								</Link>
								<AnimatePresence initial={false}>
									{!isSelf && !followed && alignable && (
										<motion.button
											key="follow"
											type="button"
											{...pop}
											onClick={() => follow(slide)}
											aria-label={t("rail.follow")}
											className="absolute -bottom-2.5 left-1/2 flex h-5 w-5 -translate-x-1/2 cursor-pointer items-center justify-center rounded-pill bg-brand text-brand-on"
										>
											<Plus size={12} weight="bold" />
										</motion.button>
									)}
								</AnimatePresence>
							</div>
							{/* The heart is NOT gated on `postId`. `toggleLike` has
							    always known how to like a stream — it calls Xstream's
							    own like endpoint so the count is shared with Xstream —
							    but the button lived inside the post-only group, so a
							    live broadcast rendered a rail with no like at all. */}
							<button
								type="button"
								onClick={() => toggleLike(slide)}
								aria-label={t("post.like")}
								className="flex flex-col items-center gap-1 cursor-pointer"
							>
								<motion.span
									animate={{ scale: slide.isLiked ? [1, 1.25, 1] : 1 }}
									transition={{ duration: 0.25, ease: [0.2, 0, 0, 1] }}
									className={clsx(railBtn, slide.isLiked && "text-danger")}
								>
									<Heart size={28} weight={slide.isLiked ? "fill" : "regular"} />
								</motion.span>
								<Roll
									value={fmt(slide.likes)}
									className="text-[calc(12.5px*var(--ws-fs))] font-bold font-sans tabular-nums text-white [text-shadow:0_1px_2px_rgb(0_0_0/0.5)]"
								/>
							</button>

							{slide.postId && (
								<>
									<button
										type="button"
										onClick={() => openComments(slide)}
										aria-label={t("vertical.comments")}
										className="flex flex-col items-center gap-1 cursor-pointer"
									>
										<span className={railBtn}>
											<ChatCircle size={28} />
										</span>
										<Roll
											value={fmt(slide.replies)}
											className="text-[calc(12.5px*var(--ws-fs))] font-bold font-sans tabular-nums text-white [text-shadow:0_1px_2px_rgb(0_0_0/0.5)]"
										/>
									</button>

									<button
										type="button"
										onClick={() => toggleBookmark(slide)}
										aria-label={t("post.bookmark")}
										className="flex flex-col items-center gap-1 cursor-pointer"
									>
										<span
											className={clsx(
												railBtn,
												"relative",
												slide.isBookmarked && "text-gold",
											)}
										>
											{/* The glyph pops, not the pill: the pill carries
											    the blur and must not be scaled. */}
											<AnimatePresence mode="popLayout" initial={false}>
												<motion.span
													key={slide.isBookmarked ? "on" : "off"}
													{...pop}
													className="flex"
												>
													<BookmarkSimple
														size={28}
														weight={slide.isBookmarked ? "fill" : "regular"}
													/>
												</motion.span>
											</AnimatePresence>
										</span>
									</button>
								</>
							)}

							{slide.streamId && (
								<button
									type="button"
									onClick={() => setChatFor(slide)}
									aria-label={t("chat.placeholder")}
									className="flex flex-col items-center gap-1 cursor-pointer"
								>
									<span className={railBtn}>
										<ChatsCircle size={28} />
									</span>
								</button>
							)}

							<button
								type="button"
								onClick={() => share(slide)}
								aria-label={t("post.share")}
								className="flex flex-col items-center gap-1 cursor-pointer"
							>
								<span className={railBtn}>
									<PaperPlaneTilt size={28} />
								</span>
							</button>
							{!slide.streamId && slide.videoUrl && <SoundDisc avatar={slide.avatar} active={isActive} />}
						</div>
					</section>
				);
			})}

			{/* ── live chat: the same anchored popover the post comments use ── */}
			<AnimatePresence>
				{chatFor?.streamId && (
					<>
						{/* Invisible on desktop on purpose: a popover is not a modal,
						    and dimming a live broadcast to read its chat is exactly
						    backwards. Dimmed on mobile, where the sheet owns the screen. */}
						<motion.button
							type="button"
							aria-label={t("common.close")}
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
							onClick={() => setChatFor(null)}
							className="fixed inset-0 z-modal cursor-default bg-black/45 sm:bg-transparent"
						/>
						<motion.aside
							initial={{ opacity: 0, y: 16, scale: 0.98 }}
							animate={{ opacity: 1, y: 0, scale: 1 }}
							exit={{ opacity: 0, y: 16, scale: 0.98 }}
							transition={{ duration: 0.26, ease: [0.2, 0, 0, 1] }}
							style={{ transformOrigin: "bottom right" }}
							className={clsx(
								"fixed z-modal flex flex-col overflow-hidden glass-panel backdrop-blur-2xl backdrop-saturate-150",
								// mobile: bottom sheet
								"inset-x-0 bottom-0 max-h-[74vh] rounded-t-2xl",
								// desktop: floating popover, not a full-height drawer
								"sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-[380px] sm:max-h-[min(600px,72vh)] sm:rounded-2xl",
							)}
						>
							<span
								aria-hidden
								className="mx-auto mt-2 h-1 w-9 shrink-0 rounded-pill bg-white/25 sm:hidden"
							/>

							<div className="flex h-12 shrink-0 items-center gap-2 px-4">
								<h2 className="flex-1 truncate font-sans text-[calc(14px*var(--ws-fs))] font-semibold glass-ink">
									{chatFor.liveTitle || chatFor.username}
								</h2>
								<button
									type="button"
									onClick={() => setChatFor(null)}
									aria-label={t("common.close")}
									/* A tint, not another blur — nesting backdrop-filter
									   inside a blurred panel blurs the panel's own fill. */
									className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-pill bg-white/10 glass-ink transition-colors hover:bg-white/[0.18]"
								>
									<X size={14} weight="bold" />
								</button>
							</div>

							<LiveChatPanel
								streamId={chatFor.streamId}
								room={liveRoom}
								glass
								me={
									me?.username
										? {
												username: me.username,
												avatar: me.avatar ?? "",
											}
										: null
								}
								className="min-h-0 flex-1"
							/>
						</motion.aside>
					</>
				)}
			</AnimatePresence>

			{/* ── comments: an anchored popover on desktop, a sheet on mobile ── */}
			<AnimatePresence>
				{commentsFor && (
					<>
						{/* Click-catcher. Dimmed on mobile where the sheet owns the
						    screen; invisible on desktop, because a popover is not a
						    modal and dimming the video you are commenting on is
						    exactly backwards. */}
						<motion.button
							type="button"
							aria-label={t("common.close")}
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
							onClick={() => setCommentsFor(null)}
							className="fixed inset-0 z-modal cursor-default bg-black/45 sm:bg-transparent"
						/>
						<motion.aside
							initial={{ opacity: 0, y: 16, scale: 0.98 }}
							animate={{ opacity: 1, y: 0, scale: 1 }}
							exit={{ opacity: 0, y: 16, scale: 0.98 }}
							transition={{ duration: 0.26, ease: [0.2, 0, 0, 1] }}
							/* Grows from the bottom-right, where the comment button is,
							   so the panel reads as coming out of the control. */
							style={{ transformOrigin: "bottom right" }}
							className={clsx(
								"fixed z-modal flex flex-col overflow-hidden glass-panel backdrop-blur-2xl backdrop-saturate-150",
								// mobile: bottom sheet
								"inset-x-0 bottom-0 max-h-[74vh] rounded-t-2xl",
								// desktop: floating popover, not a full-height drawer
								"sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-[380px] sm:max-h-[min(600px,72vh)] sm:rounded-2xl",
							)}
						>
							{/* Grab handle, mobile only. */}
							<span
								aria-hidden
								className="mx-auto mt-2 h-1 w-9 shrink-0 rounded-pill bg-white/25 sm:hidden"
							/>

							<div className="flex h-12 shrink-0 items-center gap-2 px-4">
								<h2 className="flex-1 font-sans text-[calc(14px*var(--ws-fs))] font-semibold glass-ink">
									{t("vertical.comments")}
									<Roll
										value={fmt(commentsCount)}
										className="ml-1.5 align-bottom font-normal tabular-nums glass-ink-faint"
									/>
								</h2>
								<button
									type="button"
									onClick={() => setCommentsFor(null)}
									aria-label={t("common.close")}
									/* A tint, not another blur — nesting backdrop-filter
									   inside a blurred panel blurs the panel's own fill. */
									className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-pill bg-white/10 glass-ink transition-colors hover:bg-white/[0.18]"
								>
									<X size={14} weight="bold" />
								</button>
							</div>

							<div className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto px-4 pb-2">
								{commentsLoading ? (
									[1, 2, 3].map((i) => (
										<div key={i} className="flex gap-2.5">
											<div className="h-8 w-8 shrink-0 animate-pulse rounded-pill bg-white/10" />
											<div className="flex-1 space-y-2 py-0.5">
												<div className="h-3 w-24 animate-pulse rounded bg-white/10" />
												<div className="h-3 w-3/4 animate-pulse rounded bg-white/10" />
											</div>
										</div>
									))
								) : comments.length === 0 ? (
									<div className="m-auto flex flex-col items-center gap-1.5 py-8 text-center">
										<span className="flex h-11 w-11 items-center justify-center rounded-pill bg-white/[0.08]">
											<ChatCircle size={19} className="glass-ink-faint" />
										</span>
										<p className="font-sans text-[calc(13px*var(--ws-fs))] glass-ink-dim">
											{t("vertical.noComments")}
										</p>
									</div>
								) : (
									/* Cascades when the rows replace the skeleton, once per
									   open. Only the first screenful takes part, so a long
									   thread is not late. */
									<motion.div
										variants={staggerParentFast}
										initial="hidden"
										animate="show"
										className="flex flex-col gap-3.5"
									>
										{comments.map((c, i) => (
											<motion.div
												key={c.id}
												variants={i < 8 ? staggerItem : undefined}
												className="flex gap-2.5"
											>
												<Link
													href={`/profile/${c.username}`}
													className="relative h-8 w-8 shrink-0 overflow-hidden rounded-pill bg-white/10"
												>
													<SafeAvatar src={c.avatar} className="object-cover" />
												</Link>
												{/* The comment sits in its own tinted bubble so a
												    wall of replies has rhythm instead of running
												    together as one block of text. */}
												<div className="min-w-0 flex-1 rounded-xl rounded-tl-[4px] bg-white/[0.07] px-3 py-2">
													<span className="flex items-baseline gap-2">
														<Link
															href={`/profile/${c.username}`}
															className="truncate font-sans text-[calc(12.5px*var(--ws-fs))] font-semibold glass-ink hover:underline"
														>
															@{c.username}
														</Link>
														{c.timestamp && (
															<span className="shrink-0 font-sans text-[calc(11px*var(--ws-fs))] glass-ink-faint">
																{c.timestamp}
															</span>
														)}
													</span>
													<p className="break-words font-sans text-[calc(13.5px*var(--ws-fs))] leading-snug glass-ink-dim">
														{c.content}
													</p>
												</div>
											</motion.div>
										))}
									</motion.div>
								)}
							</div>

							{/* Composer: one field with the send control inside it, so the
							    row reads as a single object rather than a box and a
							    button that happen to be adjacent. */}
							<div className="shrink-0 p-3 pb-safe sm:pb-3">
								<div className="relative flex items-center">
									<input
										value={draft}
										onChange={(e) => setDraft(e.target.value)}
										onKeyDown={(e) => {
											if (e.key === "Enter") void sendComment();
										}}
										placeholder={t("vertical.addComment")}
										maxLength={280}
										className="h-11 w-full rounded-pill bg-white/[0.09] pl-4 pr-12 font-sans text-[calc(13.5px*var(--ws-fs))] glass-ink outline-none transition-colors placeholder:text-white/40 focus:bg-white/[0.14]"
									/>
									<motion.button
										type="button"
										{...press}
										onClick={() => void sendComment()}
										disabled={!draft.trim() || sending}
										aria-label={t("chat.send")}
										className="absolute right-1.5 flex h-8 w-8 cursor-pointer items-center justify-center rounded-pill glass-cta transition-opacity disabled:cursor-not-allowed disabled:opacity-35"
									>
										<PaperPlaneTilt size={14} weight="fill" />
									</motion.button>
								</div>
							</div>
						</motion.aside>
					</>
				)}
			</AnimatePresence>
		</div>
	);
}

export default function VerticalFeedPage() {
	return (
		<Suspense fallback={null}>
			<VerticalSurface />
		</Suspense>
	);
}
