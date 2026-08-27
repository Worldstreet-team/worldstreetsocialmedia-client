"use client";

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
} from "@phosphor-icons/react";
import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { useAtom, useAtomValue } from "jotai";
import type { Room } from "livekit-client";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { LiveChatPanel } from "@/components/live/LiveChatPanel";
import { LiveSlidePlayer } from "@/components/live/LiveSlidePlayer";
import { useToast } from "@/components/ui/Toast/ToastContext";
import { DEFAULT_AVATAR, XSTREAM_API_URL } from "@/const";
import { useLiveEvents } from "@/hooks/useLiveNow";
import { useVideoBuffer } from "@/hooks/useVideoBuffer";
import { useT } from "@/i18n/client";
import { demoStreetSlides } from "@/lib/demoSeed";
import { getVideoFeedAction } from "@/lib/feed.actions";
import { getStreamAction, listLiveStreamsAction } from "@/lib/live.actions";
import {
	bookmarkPostAction,
	getPostCommentsAction,
	likePostAction,
	replyToPostAction,
	unbookmarkPostAction,
	unlikePostAction,
} from "@/lib/post.actions";
import { track } from "@/lib/telemetry";
import { followUserAction } from "@/lib/user.actions";
import { followingIdsAtom } from "@/store/ui.atom";
import { userAtom } from "@/store/user.atom";

type Tab = "street" | "live";

interface Slide {
	key: string;
	postId?: string;
	authorId?: string;
	username: string;
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
	const [liveRoom, setLiveRoom] = useState<Room | null>(null);
	const [chatFor, setChatFor] = useState<Slide | null>(null);
	const [commentsFor, setCommentsFor] = useState<Slide | null>(null);
	const [comments, setComments] = useState<CommentRow[]>([]);
	const [commentsLoading, setCommentsLoading] = useState(false);
	const [draft, setDraft] = useState("");
	const [sending, setSending] = useState(false);
	const containerRef = useRef<HTMLDivElement>(null);
	const fetchingRef = useRef(false);
	const startedRef = useRef<Set<string>>(new Set());
	const deepLinkRef = useRef<string | null>(search.get("s") ?? search.get("v"));

	const mapPost = (p: any): Slide => ({
		key: `post-${p._id}`,
		postId: p._id,
		authorId: p.author?._id,
		username: p.author?.username ?? "",
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
				likes: 0,
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
							likes: 0,
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
		window.history.replaceState(null, "", next);
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

	const patchSlide = (key: string, patch: Partial<Slide>) =>
		setSlides((prev) =>
			prev.map((s) => (s.key === key ? { ...s, ...patch } : s)),
		);

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
		if (!slide.authorId) return;
		setFollowedIds((prev) => [...prev, slide.authorId!]);
		const res = await followUserAction(slide.authorId);
		if (!res.success) {
			setFollowedIds((prev) => prev.filter((id) => id !== slide.authorId));
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
		"flex h-12 w-12 items-center justify-center rounded-pill bg-white/[0.09] backdrop-blur-md backdrop-saturate-150 transition-colors cursor-pointer hover:bg-white/[0.18]";

	return (
		<div
			ref={containerRef}
			className="fixed inset-0 z-dropdown bg-black overflow-y-auto snap-y snap-mandatory [scrollbar-width:none]"
		>
			{/* ── top chrome ── */}
			<div className="fixed top-0 inset-x-0 z-modal flex items-center px-4 h-16 pt-safe box-content bg-gradient-to-b from-black/70 to-transparent pointer-events-none">
				<Link
					href="/"
					aria-label="Close"
					className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-pill bg-white/[0.09] backdrop-blur-md text-white hover:bg-white/[0.18] transition-colors"
				>
					<X size={17} />
				</Link>

				<div className="flex-1 flex justify-center pointer-events-auto">
					<div className="flex items-center gap-1 rounded-pill bg-white/[0.09] backdrop-blur-md p-1">
						{[
							{ key: "street" as Tab, label: t("vertical.tabStreet") },
							{ key: "live" as Tab, label: t("vertical.tabLive") },
						].map(({ key, label }) => (
							<button
								key={key}
								type="button"
								onClick={() => setTab(key)}
								className={clsx(
									"relative h-8 px-4 rounded-pill font-sans text-[13px] font-semibold transition-colors cursor-pointer",
									tab === key ? "text-black" : "text-white/70 hover:text-white",
								)}
							>
								{tab === key && (
									<motion.span
										layoutId="street-tab"
										transition={{
											duration: 0.2,
											ease: [0.2, 0, 0, 1],
										}}
										className="absolute inset-0 rounded-pill bg-white"
									/>
								)}
								<span className="relative flex items-center gap-1.5">
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
							</button>
						))}
					</div>
				</div>

				{demo && (
					<span className="pointer-events-none mr-2 rounded-pill bg-warning-chip px-2 py-1 font-sans text-[9px] font-bold uppercase tracking-[0.1em] text-warning">
						Demo
					</span>
				)}
				<button
					type="button"
					onClick={() => setMuted((m) => !m)}
					aria-label={t("vertical.unmute")}
					className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-pill bg-white/[0.09] backdrop-blur-md text-white hover:bg-white/[0.18] transition-colors cursor-pointer"
				>
					{muted ? (
						<SpeakerSimpleX size={17} />
					) : (
						<SpeakerSimpleHigh size={17} />
					)}
				</button>
			</div>

			{loading && (
				<div className="h-dvh flex items-center justify-center lg:px-6">
					<div className="h-full w-full lg:h-[min(calc(100dvh-56px),960px)] lg:w-auto lg:aspect-[9/16] lg:rounded-2xl skeleton" />
				</div>
			)}

			{!loading && slides.length === 0 && (
				<div className="h-dvh flex flex-col items-center justify-center gap-3 px-8">
					<span className="flex h-16 w-16 items-center justify-center rounded-pill bg-white/[0.07] text-white/60">
						<Broadcast size={26} weight="light" />
					</span>
					<p className="text-center text-white font-display text-[17px] font-semibold">
						{tab === "live" ? t("liveNow.emptyTitle") : t("vertical.empty")}
					</p>
					<p className="max-w-[300px] text-center text-white/50 font-sans text-[13px] leading-relaxed">
						{t("liveNow.emptyCaption")}
					</p>
					<Link
						href="/"
						className="mt-2 flex h-10 items-center rounded-pill bg-white px-5 font-sans text-[13px] font-semibold text-black hover:bg-white/90 transition-colors"
					>
						{t("watch.browse")}
					</Link>
				</div>
			)}

			{slides.map((slide, idx) => {
				const near = Math.abs(idx - active) <= 1;
				const isActive = idx === active;
				const isSelf =
					me?._id === slide.authorId || me?.userId === slide.authorId;
				const followed = slide.authorId
					? followedIds.includes(slide.authorId)
					: true;
				return (
					<section
						key={slide.key}
						data-index={idx}
						className="relative h-dvh snap-start overflow-hidden flex items-end lg:items-center justify-center lg:gap-5 lg:px-6"
					>
						{/* The stage: full-bleed on phones, a floating 9:16 plate on
						    desktop — the same object grammar as the Story Studio. */}
						<div className="relative h-full w-full lg:h-[min(calc(100dvh-56px),960px)] lg:w-auto lg:aspect-[9/16] lg:shrink-0 lg:overflow-hidden lg:rounded-2xl lg:glass-stage bg-[#0a0a0a]">
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
									// The neighbours are one flick away; letting them sit
									// at metadata-only defeats the buffer above.
									preload="auto"
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

							{/* live status row */}
							{slide.streamId && (
								<div className="absolute top-20 left-4 z-10 flex items-center gap-2">
									<span className="flex items-center gap-1.5 rounded-[4px] bg-danger px-2 h-6 text-[10.5px] font-bold tracking-wide text-white font-sans">
										<span className="relative flex h-1.5 w-1.5">
											<span className="absolute inline-flex h-full w-full rounded-pill bg-white opacity-70 animate-ping" />
											<span className="relative inline-flex h-1.5 w-1.5 rounded-pill bg-white" />
										</span>
										{t("live.badge")}
									</span>
									{isActive && (
										<span className="flex items-center gap-1.5 rounded-[4px] bg-black/50 backdrop-blur-md px-2 h-6 text-[11px] font-semibold text-white/85 font-sans tabular-nums">
											<Eye size={12} />
											{viewers}
										</span>
									)}
									{slide.category && (
										<span className="rounded-[4px] bg-black/50 backdrop-blur-md px-2 h-6 flex items-center text-[11px] font-medium text-white/75 font-sans">
											{slide.category}
										</span>
									)}
								</div>
							)}

							{/* bottom info */}
							<div className="absolute bottom-0 inset-x-0 pt-24 pb-6 px-4 bg-gradient-to-t from-black/85 via-black/35 to-transparent pointer-events-none">
								<div className="pointer-events-auto max-w-[560px] pr-20">
									<div className="flex items-center gap-2.5 mb-2">
										<Link
											href={`/profile/${slide.username}`}
											className="relative w-9 h-9 rounded-pill overflow-hidden shrink-0 bg-white/10"
										>
											<Image
												src={slide.avatar}
												alt={slide.username}
												fill
												className="object-cover"
											/>
										</Link>
										<Link
											href={`/profile/${slide.username}`}
											className="text-[15px] font-semibold text-white font-sans truncate hover:underline"
										>
											@{slide.username}
										</Link>
										{!isSelf && !followed && (
											<button
												type="button"
												onClick={() => follow(slide)}
												className="h-7 px-3 rounded-pill bg-white text-black font-sans text-[12px] font-bold hover:bg-white/85 transition-colors cursor-pointer shrink-0"
											>
												{t("rail.follow")}
											</button>
										)}
									</div>
									{slide.streamId && slide.liveTitle ? (
										<p className="text-[16px] font-semibold text-white font-sans leading-snug line-clamp-2">
											{slide.liveTitle}
										</p>
									) : (
										<p className="text-[13.5px] text-white/85 font-sans leading-snug line-clamp-2">
											{slide.content}
										</p>
									)}
								</div>
							</div>
						</div>

						{/* action rail — overlaid on phones, beside the stage on desktop */}
						<div className="absolute right-3 bottom-8 z-10 flex flex-col items-center gap-3.5 text-white lg:static lg:z-auto lg:self-end lg:pb-10">
							{slide.postId && (
								<>
									<button
										type="button"
										onClick={() => toggleLike(slide)}
										aria-label={t("post.like")}
										className="flex flex-col items-center gap-1 cursor-pointer"
									>
										<motion.span
											animate={{
												scale: slide.isLiked ? [1, 1.25, 1] : 1,
											}}
											transition={{
												duration: 0.25,
												ease: [0.2, 0, 0, 1],
											}}
											className={clsx(railBtn, slide.isLiked && "text-danger")}
										>
											<Heart
												size={22}
												weight={slide.isLiked ? "fill" : "regular"}
											/>
										</motion.span>
										<span className="text-[11.5px] font-semibold font-sans tabular-nums text-white/85">
											{fmt(slide.likes)}
										</span>
									</button>

									<button
										type="button"
										onClick={() => openComments(slide)}
										aria-label={t("vertical.comments")}
										className="flex flex-col items-center gap-1 cursor-pointer"
									>
										<span className={railBtn}>
											<ChatCircle size={22} />
										</span>
										<span className="text-[11.5px] font-semibold font-sans tabular-nums text-white/85">
											{fmt(slide.replies)}
										</span>
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
												slide.isBookmarked && "text-gold",
											)}
										>
											<BookmarkSimple
												size={22}
												weight={slide.isBookmarked ? "fill" : "regular"}
											/>
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
										<ChatsCircle size={22} />
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
									<PaperPlaneTilt size={22} />
								</span>
							</button>
						</div>
					</section>
				);
			})}

			{/* ── live chat drawer (shared cross-platform panel) ── */}
			<AnimatePresence>
				{chatFor?.streamId && (
					<>
						<motion.button
							type="button"
							aria-label="Close"
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
							onClick={() => setChatFor(null)}
							className="fixed inset-0 z-modal bg-black/40 cursor-default"
						/>
						<motion.aside
							initial={{ x: "100%" }}
							animate={{ x: 0 }}
							exit={{ x: "100%" }}
							transition={{ duration: 0.32, ease: [0.2, 0, 0, 1] }}
							className="fixed right-0 top-0 bottom-0 z-modal w-[400px] max-w-[94vw] glass-panel backdrop-blur-2xl backdrop-saturate-150 !rounded-none flex flex-col"
						>
							<div className="flex items-center gap-2 px-4 h-14 border-b border-white/8 shrink-0">
								<h2 className="font-sans text-[15px] font-semibold glass-ink flex-1 truncate">
									{chatFor.liveTitle || chatFor.username}
								</h2>
								<button
									type="button"
									onClick={() => setChatFor(null)}
									aria-label="Close"
									className="flex h-9 w-9 items-center justify-center rounded-pill glass-chip cursor-pointer"
								>
									<X size={15} />
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
								className="flex-1 min-h-0"
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
								<h2 className="flex-1 font-sans text-[14px] font-semibold glass-ink">
									{t("vertical.comments")}
									<span className="ml-1.5 font-normal tabular-nums glass-ink-faint">
										{fmt(commentsFor.replies)}
									</span>
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
										<p className="font-sans text-[13px] glass-ink-dim">
											{t("vertical.noComments")}
										</p>
									</div>
								) : (
									comments.map((c) => (
										<div key={c.id} className="flex gap-2.5">
											<Link
												href={`/profile/${c.username}`}
												className="relative h-8 w-8 shrink-0 overflow-hidden rounded-pill bg-white/10"
											>
												<Image src={c.avatar} alt="" fill className="object-cover" />
											</Link>
											{/* The comment sits in its own tinted bubble so a
											    wall of replies has rhythm instead of running
											    together as one block of text. */}
											<div className="min-w-0 flex-1 rounded-xl rounded-tl-[4px] bg-white/[0.07] px-3 py-2">
												<span className="flex items-baseline gap-2">
													<Link
														href={`/profile/${c.username}`}
														className="truncate font-sans text-[12.5px] font-semibold glass-ink hover:underline"
													>
														@{c.username}
													</Link>
													{c.timestamp && (
														<span className="shrink-0 font-sans text-[11px] glass-ink-faint">
															{c.timestamp}
														</span>
													)}
												</span>
												<p className="break-words font-sans text-[13.5px] leading-snug glass-ink-dim">
													{c.content}
												</p>
											</div>
										</div>
									))
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
										className="h-11 w-full rounded-pill bg-white/[0.09] pl-4 pr-12 font-sans text-[13.5px] glass-ink outline-none transition-colors placeholder:text-white/40 focus:bg-white/[0.14]"
									/>
									<button
										type="button"
										onClick={() => void sendComment()}
										disabled={!draft.trim() || sending}
										aria-label={t("chat.send")}
										className="absolute right-1.5 flex h-8 w-8 cursor-pointer items-center justify-center rounded-pill glass-cta transition-opacity disabled:cursor-not-allowed disabled:opacity-35"
									>
										<PaperPlaneTilt size={14} weight="fill" />
									</button>
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
