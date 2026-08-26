"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Download, Send, Volume2, VolumeX, X } from "lucide-react";
import { DEFAULT_AVATAR } from "@/const";
import { replyToStoryAction, viewStoryAction } from "@/lib/stories.actions";
import { StoryPaywall } from "@/components/feed/StoryPaywall";
import { useToast } from "@/components/ui/Toast/ToastContext";
import { useAtomValue } from "jotai";
import { userAtom } from "@/store/user.atom";
import { useT } from "@/i18n/client";

export interface RailStory {
	id: string;
	media: { url: string; type: "image" | "video" };
	caption?: string;
	origin: "upload" | "live";
	streamRef?: string;
	createdAt: string;
	seen: boolean;
	/** The uploader allowed downloads on this story. */
	allowSave?: boolean;
	/** This viewer has already paid the unlock (or owns the story). */
	unlocked?: boolean;
}

export interface RailEntry {
	author: {
		_id: string;
		username: string;
		avatar?: string;
		firstName?: string;
		lastName?: string;
	};
	stories: RailStory[];
	hasUnseen: boolean;
	isLive: boolean;
	isSelf: boolean;
}

const STORY_MS = 5_000;

/**
 * Full-screen story playback for one author. Left third = previous, the rest
 * = next; the progress segments up top mirror position. Each story is marked
 * viewed the moment it shows.
 *
 * Replies are DMs: the bar at the bottom sends into the normal conversation
 * with the author, carrying the story as a thumbnail. Auto-advance pauses
 * while the bar has focus, because nobody can type against a five-second
 * timer.
 */
export function StoryViewer({
	entry,
	onClose,
}: {
	entry: RailEntry;
	onClose: () => void;
}) {
	const t = useT();
	const { toast } = useToast();
	const viewer = useAtomValue(userAtom);
	const [index, setIndex] = useState(() =>
		Math.max(
			0,
			entry.stories.findIndex((s) => !s.seen),
		),
	);
	const story = entry.stories[index];
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	// Sound-first playback: voice stories are waveform videos, so a hard-muted
	// player would make them silent. Try unmuted (the viewer opens from a
	// click, which usually satisfies autoplay policy) and fall back to muted
	// with the toggle available.
	const videoRef = useRef<HTMLVideoElement | null>(null);
	const [muted, setMuted] = useState(false);

	const [reply, setReply] = useState("");
	const [replyBusy, setReplyBusy] = useState(false);
	const [typing, setTyping] = useState(false);
	// Unlock state is per story id, so paying for one slide does not unlock
	// its neighbours.
	const [unlockedIds, setUnlockedIds] = useState<Set<string>>(
		() => new Set(entry.stories.filter((s) => s.unlocked).map((s) => s.id)),
	);
	const [paywall, setPaywall] = useState<null | { fromScreenshot: boolean }>(
		null,
	);

	const frozen = typing || paywall !== null;

	const advance = useCallback(
		(dir: 1 | -1) => {
			setIndex((i) => {
				const next = i + dir;
				if (next < 0) return 0;
				if (next >= entry.stories.length) {
					onClose();
					return i;
				}
				return next;
			});
		},
		[entry.stories.length, onClose],
	);

	useEffect(() => {
		if (!story) return;
		void viewStoryAction(story.id);
		if (story.media.type === "image") {
			// The timer only runs while nothing needs the frame held still.
			if (!frozen) {
				timerRef.current = setTimeout(() => advance(1), STORY_MS);
			}
			return () => {
				if (timerRef.current) clearTimeout(timerRef.current);
			};
		}
		const video = videoRef.current;
		if (video) {
			if (frozen) {
				video.pause();
				return;
			}
			video.muted = muted;
			video.play().catch(() => {
				// Autoplay with sound was blocked — restart muted.
				video.muted = true;
				setMuted(true);
				video.play().catch(() => {});
			});
		}
		// biome-ignore lint/correctness/useExhaustiveDependencies: `muted` toggles on the element directly; re-running would restart playback.
	}, [story, advance, frozen]);

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				if (paywall) setPaywall(null);
				else onClose();
				return;
			}
			if (typing) return;
			if (e.key === "ArrowRight") advance(1);
			if (e.key === "ArrowLeft") advance(-1);
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [advance, onClose, typing, paywall]);

	// Screenshot deterrence, honestly scoped: PrintScreen is detectable on
	// Windows and surfaces the paywall; macOS and phone screenshots never
	// reach the page, so the real protection is that saving goes through the
	// unlock. Right-click save and drag are blocked below for the same reason.
	useEffect(() => {
		const onKeyUp = (e: KeyboardEvent) => {
			if (e.key === "PrintScreen" && story && !unlockedIds.has(story.id)) {
				setPaywall({ fromScreenshot: true });
			}
		};
		window.addEventListener("keyup", onKeyUp);
		return () => window.removeEventListener("keyup", onKeyUp);
	}, [story, unlockedIds]);

	const sendReply = async () => {
		const text = reply.trim();
		if (!text || replyBusy || !story) return;
		setReplyBusy(true);
		const res = await replyToStoryAction(story.id, text);
		setReplyBusy(false);
		if (res.success) {
			setReply("");
			toast(t("story.replySent"), { type: "success" });
		} else {
			toast(res.message ?? t("story.replySent"), { type: "error" });
		}
	};

	const download = async (url: string) => {
		try {
			const blob = await fetch(url).then((r) => r.blob());
			const a = document.createElement("a");
			a.href = URL.createObjectURL(blob);
			a.download = `worldstreet-story-${story?.id ?? "media"}`;
			a.click();
			URL.revokeObjectURL(a.href);
			toast(t("story.unlock.done"), { type: "success" });
		} catch {
			// Cross-origin without CORS: open in a tab as the fallback.
			window.open(url, "_blank", "noopener");
		}
	};

	if (!story) return null;
	const name =
		entry.author.firstName || entry.author.lastName
			? `${entry.author.firstName ?? ""} ${entry.author.lastName ?? ""}`.trim()
			: entry.author.username;
	const canSave = Boolean(story.allowSave) || entry.isSelf;
	const isUnlocked = entry.isSelf || unlockedIds.has(story.id);

	return (
		<AnimatePresence>
			<motion.div
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				exit={{ opacity: 0 }}
				transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
				className="fixed inset-0 z-modal flex items-center justify-center overflow-hidden"
				onClick={onClose}
			>
				{/* The story itself, out of focus, as the ground. It is the
				    same asset the frame is already showing, so it costs one
				    extra paint and no extra fetch. Video falls back to a flat
				    field rather than decoding a second stream. */}
				<div aria-hidden className="absolute inset-0">
					{story.media.type === "image" ? (
						// eslint-disable-next-line @next/next/no-img-element
						<img
							src={story.media.url}
							alt=""
							className="h-full w-full scale-125 object-cover blur-2xl"
							draggable={false}
						/>
					) : null}
					{/* Flat veil, not a gradient — enough to hold white text on
					    any photo without the ground turning glossy. */}
					<div className="absolute inset-0 bg-[#0c0a09]/70" />
				</div>

				<div
					className="relative h-full w-full select-none overflow-hidden bg-black sm:h-[86vh] sm:w-[420px] sm:rounded-2xl"
					onClick={(e) => e.stopPropagation()}
					onContextMenu={(e) => e.preventDefault()}
				>
					{/* progress segments */}
					<div className="absolute top-0 inset-x-0 z-20 flex gap-1 p-2.5">
						{entry.stories.map((s, i) => (
							<div
								key={s.id}
								className="h-[3px] flex-1 overflow-hidden rounded-pill bg-white/30"
							>
								<div
									className="h-full bg-white"
									style={{
										width: i < index ? "100%" : i > index ? "0%" : undefined,
										animation:
											i === index && story.media.type === "image" && !frozen
												? `ws-story-fill ${STORY_MS}ms linear forwards`
												: undefined,
									}}
								/>
							</div>
						))}
					</div>

					{/* Header sits on a flat band: white-on-photo needs a floor,
					    and a band holds it without the top-light gradient the
					    old chrome used. */}
					<div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-24 bg-[#0c0a09]/45" />

					{/* header */}
					<div className="absolute top-5 inset-x-0 z-20 flex items-center gap-2.5 px-3">
						<div className="relative w-9 h-9 rounded-pill overflow-hidden shrink-0">
							<Image
								src={entry.author.avatar || DEFAULT_AVATAR}
								alt={entry.author.username}
								fill
								className="object-cover"
							/>
						</div>
						<span className="flex min-w-0 flex-col leading-tight">
							<span className="truncate font-sans text-[14px] font-semibold text-white">
								{name}
							</span>
							<span className="font-sans text-[11.5px] text-white/65">
								@{entry.author.username}
							</span>
						</span>
						<span className="ml-auto flex items-center">
							{story.media.type === "video" && (
								<button
									type="button"
									onClick={() => {
										const next = !muted;
										setMuted(next);
										if (videoRef.current) videoRef.current.muted = next;
									}}
									aria-label={muted ? "Unmute" : "Mute"}
									className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-pill text-white/80 transition-colors hover:bg-white/15 hover:text-white"
								>
									{muted ? (
										<VolumeX className="w-5 h-5" />
									) : (
										<Volume2 className="w-5 h-5" />
									)}
								</button>
							)}
							{canSave && (
								<button
									type="button"
									onClick={() =>
										isUnlocked
											? void download(story.media.url)
											: setPaywall({ fromScreenshot: false })
									}
									aria-label={t("story.download")}
									className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-pill text-white/80 transition-colors hover:bg-white/15 hover:text-white"
								>
									<Download className="w-5 h-5" />
								</button>
							)}
							<button
								type="button"
								onClick={onClose}
								aria-label="Close"
								className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-pill text-white/80 transition-colors hover:bg-white/15 hover:text-white"
							>
								<X className="w-5 h-5" />
							</button>
						</span>
					</div>

					{/* media */}
					{story.media.type === "video" ? (
						<video
							key={story.id}
							ref={videoRef}
							src={story.media.url}
							className="absolute inset-0 h-full w-full object-cover"
							autoPlay
							playsInline
							muted={muted}
							onEnded={() => advance(1)}
							onContextMenu={(e) => e.preventDefault()}
							controlsList="nodownload"
						/>
					) : (
						// eslint-disable-next-line @next/next/no-img-element
						<img
							key={story.id}
							src={story.media.url}
							alt={story.caption ?? ""}
							className="absolute inset-0 h-full w-full object-cover"
							draggable={false}
							onContextMenu={(e) => e.preventDefault()}
						/>
					)}

					{/* Forensic watermark: the viewer's own handle tiled faintly over
					    the frame. Screenshots on the web cannot be blanked, so the
					    deterrent is traceability — any capture that leaks carries
					    the account it was taken from. Skipped on your own stories. */}
					{!entry.isSelf && viewer?.username && (
						<div
							aria-hidden
							className="pointer-events-none absolute inset-0 z-[15] overflow-hidden opacity-[0.07]"
							style={{ transform: "rotate(-24deg) scale(1.5)" }}
						>
							<div className="flex h-full flex-col justify-around">
								{[0, 1, 2, 3, 4, 5].map((row) => (
									<div
										key={row}
										className="flex gap-10 whitespace-nowrap font-sans text-[13px] font-semibold text-primary"
										style={{ marginLeft: row % 2 ? "-60px" : "0" }}
									>
										{[0, 1, 2, 3].map((col) => (
											<span key={col}>@{viewer.username}</span>
										))}
									</div>
								))}
							</div>
						</div>
					)}

					{story.caption && (
						<div className="absolute bottom-[74px] inset-x-0 z-20 px-4">
							<p className="text-center text-sm text-primary font-sans bg-page/70 rounded-lg px-3 py-2">
								{story.caption}
							</p>
						</div>
					)}

					{/* tap zones sit under the reply bar and header */}
					<button
						type="button"
						aria-label="Previous story"
						className="absolute inset-y-0 left-0 w-1/3 z-10 cursor-pointer"
						onClick={() => advance(-1)}
					/>
					<button
						type="button"
						aria-label="Next story"
						className="absolute inset-y-0 right-0 w-2/3 z-10 cursor-pointer"
						onClick={() => advance(1)}
					/>

					{/* reply bar: a DM in place. Not shown on your own stories. */}
					{!entry.isSelf && (
						<div className="absolute bottom-0 inset-x-0 z-20 flex items-center gap-2 bg-gradient-to-t from-page via-page/80 to-transparent px-3 pb-3 pt-6">
							<input
								value={reply}
								onChange={(e) => setReply(e.target.value)}
								onFocus={() => setTyping(true)}
								onBlur={() => setTyping(false)}
								onKeyDown={(e) => {
									if (e.key === "Enter") void sendReply();
									e.stopPropagation();
								}}
								placeholder={t("story.replyPlaceholder").replace("{name}", name)}
								className="h-11 min-w-0 flex-1 rounded-pill border border-hairline bg-page/60 px-4 font-sans text-base text-primary outline-none transition-colors placeholder:text-subtle focus:border-primary/40 sm:text-[14px]"
							/>
							<button
								type="button"
								onClick={() => void sendReply()}
								disabled={!reply.trim() || replyBusy}
								aria-label={t("story.replySent")}
								className={
									reply.trim() && !replyBusy
										? "flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-pill bg-primary text-page transition-colors hover:bg-muted"
										: "flex h-11 w-11 shrink-0 items-center justify-center rounded-pill bg-raised text-subtle"
								}
							>
								{replyBusy ? (
									<span className="h-4 w-4 animate-spin rounded-pill border-2 border-current/30 border-t-current" />
								) : (
									<Send className="h-[18px] w-[18px]" />
								)}
							</button>
						</div>
					)}

					<AnimatePresence>
						{paywall && (
							<StoryPaywall
								storyId={story.id}
								fromScreenshot={paywall.fromScreenshot}
								onUnlocked={(url) => {
									setUnlockedIds((prev) => new Set(prev).add(story.id));
									setPaywall(null);
									void download(url);
								}}
								onClose={() => setPaywall(null)}
							/>
						)}
					</AnimatePresence>
				</div>
				<style>{`@keyframes ws-story-fill { from { width: 0% } to { width: 100% } }`}</style>
			</motion.div>
		</AnimatePresence>
	);
}
