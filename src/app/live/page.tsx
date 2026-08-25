"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { Heart, Radio, Volume2, VolumeX, X } from "lucide-react";
import { DEFAULT_AVATAR, XSTREAM_WEB_URL } from "@/const";
import { useT } from "@/i18n/client";
import { getVideoFeedAction } from "@/lib/feed.actions";
import { likePostAction, unlikePostAction } from "@/lib/post.actions";
import { track } from "@/lib/telemetry";

interface VideoItem {
	id: string;
	authorId: string;
	name: string;
	username: string;
	avatar: string;
	content: string;
	videoUrl?: string;
	live?: { streamId: string; status: string; title?: string };
	likes: number;
	isLiked: boolean;
}

/**
 * The vertical surface. CSS scroll-snap does the paging (compositor-driven,
 * survives momentum scrolling); only active±1 keep media mounted, and
 * offscreen videos are torn down rather than muted so exactly one audio
 * source can exist. Uploaded videos and live streams share the surface —
 * live cards link out to the stream.
 */
export default function VerticalFeedPage() {
	const t = useT();
	const [items, setItems] = useState<VideoItem[]>([]);
	const [cursor, setCursor] = useState<string | null>(null);
	const [hasMore, setHasMore] = useState(true);
	const [active, setActive] = useState(0);
	const [muted, setMuted] = useState(true);
	const [loading, setLoading] = useState(true);
	const containerRef = useRef<HTMLDivElement>(null);
	const fetchingRef = useRef(false);
	const startedRef = useRef<Set<string>>(new Set());

	const load = useCallback(async (cur: string | null) => {
		if (fetchingRef.current) return;
		fetchingRef.current = true;
		try {
			const res = await getVideoFeedAction(cur);
			if (res.success && res.data) {
				const mapped: VideoItem[] = res.data.posts.map((p: any) => ({
					id: p._id,
					authorId: p.author?._id,
					name:
						p.author?.firstName && p.author?.lastName
							? `${p.author.firstName} ${p.author.lastName}`
							: (p.author?.username ?? ""),
					username: p.author?.username ?? "",
					avatar: p.author?.avatar || DEFAULT_AVATAR,
					content: p.content ?? "",
					videoUrl: p.videos?.[0],
					live: p.live,
					likes: p.stats?.likes ?? 0,
					isLiked: Boolean(p.isLiked),
				}));
				setItems((prev) => {
					const seen = new Set(prev.map((i) => i.id));
					return [...prev, ...mapped.filter((i) => !seen.has(i.id))];
				});
				setCursor(res.data.nextCursor ?? null);
				setHasMore(Boolean(res.data.hasMore));
			}
		} finally {
			fetchingRef.current = false;
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void load(null);
	}, [load]);

	// Track which card owns the viewport.
	useEffect(() => {
		const root = containerRef.current;
		if (!root) return;
		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (entry.isIntersecting) {
						const idx = Number(
							(entry.target as HTMLElement).dataset.index ?? 0,
						);
						setActive(idx);
					}
				}
			},
			{ root, threshold: 0.6 },
		);
		for (const el of root.querySelectorAll("[data-index]"))
			observer.observe(el);
		return () => observer.disconnect();
	}, [items.length]);

	// Impression per active card + prefetch trigger near the tail.
	useEffect(() => {
		const item = items[active];
		if (!item) return;
		track({
			post: item.id,
			author: item.authorId,
			action: "impression",
			surface: "vertical",
			position: active,
			meta: { mediaType: item.live ? "live" : "video" },
		});
		if (hasMore && active >= items.length - 3) void load(cursor);
	}, [active, items, hasMore, cursor, load]);

	const toggleLike = async (item: VideoItem, idx: number) => {
		setItems((prev) =>
			prev.map((p, i) =>
				i === idx
					? {
							...p,
							isLiked: !p.isLiked,
							likes: p.likes + (p.isLiked ? -1 : 1),
						}
					: p,
			),
		);
		if (item.isLiked) await unlikePostAction(item.id);
		else await likePostAction(item.id);
	};

	return (
		<div
			ref={containerRef}
			className="fixed inset-0 z-sticky bg-page overflow-y-auto snap-y snap-mandatory [scrollbar-width:none]"
		>
			<Link
				href="/"
				aria-label="Close"
				className="fixed top-4 left-4 z-modal flex h-10 w-10 items-center justify-center rounded-pill bg-page/60 text-primary hover:bg-raised transition-colors"
			>
				<X className="w-5 h-5" />
			</Link>
			<button
				type="button"
				onClick={() => setMuted((m) => !m)}
				aria-label={t("vertical.unmute")}
				className="fixed top-4 right-4 z-modal flex h-10 w-10 items-center justify-center rounded-pill bg-page/60 text-primary hover:bg-raised transition-colors cursor-pointer"
			>
				{muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
			</button>

			{!loading && items.length === 0 && (
				<div className="h-dvh flex items-center justify-center px-8">
					<p className="text-center text-muted font-sans">
						{t("vertical.empty")}
					</p>
				</div>
			)}

			{items.map((item, idx) => {
				const near = Math.abs(idx - active) <= 1;
				return (
					<section
						key={item.id}
						data-index={idx}
						className="relative h-dvh snap-start flex items-center justify-center"
					>
						{/* media — mounted only for active±1 */}
						{near && item.live?.status === "live" ? (
							<a
								href={`${XSTREAM_WEB_URL}/stream/${item.live.streamId}`}
								target="_blank"
								rel="noopener noreferrer"
								className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-sunken"
							>
								<span className="flex h-16 w-16 items-center justify-center rounded-pill bg-danger/15 text-danger">
									<Radio className="w-7 h-7" />
								</span>
								<span className="rounded-[4px] bg-danger px-2 py-0.5 text-[11px] font-bold tracking-wide text-white font-sans">
									{t("live.badge")}
								</span>
								<span className="max-w-[80%] text-center text-primary font-sans font-semibold">
									{item.live.title || item.content}
								</span>
								<span className="text-[13px] text-muted font-sans">
									{t("live.watch")}
								</span>
							</a>
						) : near && item.videoUrl ? (
							// eslint-disable-next-line jsx-a11y/media-has-caption
							<video
								src={item.videoUrl}
								className="absolute inset-0 w-full h-full object-contain"
								autoPlay={idx === active}
								muted={muted || idx !== active}
								playsInline
								loop={false}
								onPlay={() => {
									if (!startedRef.current.has(item.id)) {
										startedRef.current.add(item.id);
										track({
											post: item.id,
											author: item.authorId,
											action: "video_start",
											surface: "vertical",
											position: idx,
										});
									}
								}}
								onEnded={() =>
									track({
										post: item.id,
										author: item.authorId,
										action: "video_complete",
										surface: "vertical",
										position: idx,
									})
								}
							/>
						) : (
							<div className="absolute inset-0 bg-sunken" />
						)}

						{/* overlay */}
						<div className="absolute bottom-0 inset-x-0 p-4 pb-8 bg-gradient-to-t from-page/90 to-transparent">
							<div className="flex items-end justify-between gap-4">
								<div className="min-w-0">
									<Link
										href={`/profile/${item.username}`}
										className="flex items-center gap-2 mb-2"
									>
										<span className="relative w-9 h-9 rounded-pill overflow-hidden shrink-0">
											<Image
												src={item.avatar}
												alt={item.username}
												fill
												className="object-cover"
											/>
										</span>
										<span className="text-sm font-semibold text-primary font-sans truncate">
											@{item.username}
										</span>
									</Link>
									<p className="text-sm text-primary/90 font-sans line-clamp-2">
										{item.content}
									</p>
								</div>
								<button
									type="button"
									onClick={() => toggleLike(item, idx)}
									aria-label={t("post.like")}
									className="flex flex-col items-center gap-1 shrink-0 cursor-pointer"
								>
									<span
										className={clsx(
											"flex h-11 w-11 items-center justify-center rounded-pill bg-page/60 transition-colors",
											item.isLiked ? "text-danger" : "text-primary",
										)}
									>
										<Heart
											className="w-5 h-5"
											fill={item.isLiked ? "currentColor" : "none"}
										/>
									</span>
									<span className="text-[11px] text-muted font-sans tabular-nums">
										{item.likes}
									</span>
								</button>
							</div>
						</div>
					</section>
				);
			})}
		</div>
	);
}
