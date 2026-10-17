"use client";

import clsx from "clsx";
import {
	ArrowDownLeft,
	ArrowSquareOut,
	ArrowUpRight,
	ArrowsLeftRight,
	ChatCircle,
	ChatsCircle,
	Check,
	CheckCircle,
	Eye,
	Globe,
	Heart,
	Lock,
	LockOpen,
	Microphone,
	Newspaper,
	PaperPlaneTilt,
	Play,
	Pulse,
	Quotes,
	Repeat,
	ShieldCheck,
	TrendUp,
	Users,
	Wallet,
	Wrench,
	Calculator,
	Ladder,
} from "@phosphor-icons/react";
import { AnimatePresence, motion } from "framer-motion";
import { useSetAtom } from "jotai";
import { useRouter } from "next/navigation";
import { type ReactNode, useContext, useEffect, useRef, useState } from "react";
import VerifiedIcon from "@/assets/icons/VerifiedIcon";
import { renderRichText } from "@/components/ui/RichText";
import { SafeAvatar } from "@/components/ui/SafeAvatar";
import { useVividIntent } from "@/components/vivid/vivid-actions";
import { spaceBackground } from "@/components/voice/SpaceCard";
import { followUserDirect, unfollowUserDirect } from "@/lib/upload-direct";
import { collapse, swap } from "@/lib/motion-presets";
import { formatTimeAgo } from "@/lib/utils";
import { followingIdsAtom } from "@/store/ui.atom";
import { More } from "./learn";
import { LiveFoot } from "./live";
import {
	ActionsContext,
	arr,
	Btn,
	CiteContext,
	Frame,
	fmt,
	money,
	num,
	type Props,
	rec,
	str,
	T,
	Tag,
	Txt,
	useStripEnd,
	well,
} from "./parts";

/* Wave 3 (docs/vivid-widgets.md 8): WorldSpace's own world drawn by ref
   (profile-card, post-embed, trending, live-now, space-card, chat-summary,
   link-summary, sources), the member's own wallet read only
   (wallet-balance, transactions, send-preview) and two calculators
   (trade-plan, position-size). Every action is the member's own tap: open
   goes to a screen, pay opens the real Send sheet, align is their follow. */

type R = Record<string, unknown>;
type Who = { profileId: string; handle: string; name: string; avatar: string; isVerified: boolean };

const who = (v: unknown): Who => {
	const w = rec(v);
	return { profileId: str(w.profileId), handle: str(w.handle), name: str(w.name) || str(w.handle), avatar: str(w.avatar), isVerified: w.isVerified === true };
};

const compact = (n: number) => n.toLocaleString(undefined, { notation: "compact", maximumFractionDigits: 1 });
const isHttp = (u: string) => /^https?:\/\//.test(u);
/** Minor units (cents, kobo) to the currency's own format. */
const minor = (n: number, currency: string) => money(n / 100, currency);
const WALLET_URL = "https://wallet.worldstreetgold.com";

/** Screens inside the app, built from ids in the card, never from a gateway URL (8.1 open). */
function useOpen() {
	const router = useRouter();
	return {
		profile: (handle: string) => handle && router.push(`/profile/${encodeURIComponent(handle)}`),
		post: (id: string) => id && router.push(`/post/${encodeURIComponent(id)}`),
		stream: (id: string) => id && router.push(`/live?tab=live&s=${encodeURIComponent(id)}`),
		space: (id: string) => id && router.push(`/voice/${encodeURIComponent(id)}`),
		chat: (id: string) => id && router.push(`/messages/${encodeURIComponent(id)}`),
		explore: (q: string) => q && router.push(`/explore?q=${encodeURIComponent(q)}`),
	};
}

/** A face: the avatar, or the first letter on the raised wash. */
function Face({ src, name, size }: { src?: string; name: string; size: number }) {
	return (
		<span
			className="relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--vivid-well-press)] font-display font-semibold text-primary"
			style={{ width: size, height: size, fontSize: size * 0.4 }}
		>
			{src && isHttp(src) ? <SafeAvatar src={src} className="object-cover" eager /> : (name.slice(0, 1) || "?").toUpperCase()}
		</span>
	);
}

/** Name, the seal (literal gold), then the handle. */
function Byline({ w, sub, size = "md" }: { w: Who; sub?: ReactNode; size?: "md" | "lg" }) {
	return (
		<span className="flex min-w-0 flex-col">
			<span className="flex min-w-0 items-center gap-1">
				<span className={clsx(size === "lg" ? T.display : T.strong, "truncate")}>{w.name}</span>
				{w.isVerified && <VerifiedIcon size={{ width: size === "lg" ? "18" : "15", height: size === "lg" ? "18" : "15" }} />}
			</span>
			<span className={clsx(T.label, "truncate")}>
				@{w.handle}
				{sub}
			</span>
		</span>
	);
}

/** The house LIVE marker: readable over a thumbnail and on the card. */
function LivePill() {
	return (
		<span className="inline-flex h-6 items-center gap-1.5 rounded-pill bg-page/85 px-2 font-sans text-[11.5px] font-bold text-danger">
			<span className="size-1.5 rounded-full bg-danger" />
			LIVE
		</span>
	);
}

/* ---- people and posts ---- */

export function ProfileCardWidget({ data, title, live }: Props<R>) {
	const open = useOpen();
	const run = useVividIntent();
	const setFollowing = useSetAtom(followingIdsAtom);
	const w = who(data);
	const [following, setFollowingLocal] = useState(data.isFollowing === true);
	const [busy, setBusy] = useState(false);
	const [more, setMore] = useState(false);
	const isYou = data.isYou === true;
	const bio = str(data.bio);
	const banner = str(data.banner);
	const joined = Date.parse(str(data.joinedAt));
	const align = async () => {
		if (busy || !w.profileId) return;
		setBusy(true);
		const next = !following;
		setFollowingLocal(next);
		const res = next ? await followUserDirect(w.profileId) : await unfollowUserDirect(w.profileId);
		if (!res?.success) setFollowingLocal(!next);
		else setFollowing((ids) => (next ? [...new Set([...ids, w.profileId])] : ids.filter((x) => x !== w.profileId)));
		setBusy(false);
	};
	return (
		<Frame title={title || "Profile"} icon={<Users />} live={live} flush>
			{isHttp(banner) && (
				// biome-ignore lint/performance/noImgElement: the member's own banner from the gateway
				<img src={banner} alt="" className="mx-2 mb-1 block h-[88px] w-[calc(100%-16px)] rounded-[13px] object-cover" />
			)}
			<div className="px-4 pt-2 pb-4 sm:px-5 sm:pb-5">
				<button type="button" onClick={() => open.profile(w.handle)} className="flex w-full min-w-0 cursor-pointer items-center gap-3.5 text-left">
					<Face src={w.avatar} name={w.name} size={56} />
					<Byline w={w} size="lg" />
				</button>
				{(data.followsYou === true || data.isCreator === true || data.mutedByYou === true) && (
					<div className="mt-3 flex flex-wrap gap-1.5">
						{data.followsYou === true && <Tag>Follows you</Tag>}
						{data.isCreator === true && <Tag tone="brand">Creator</Tag>}
						{data.mutedByYou === true && <Tag>Muted</Tag>}
					</div>
				)}
				{bio && (
					<div className="mt-3">
						<p className={clsx(T.body, !more && "line-clamp-3")}>{renderRichText(bio)}</p>
						{bio.length > 160 && (
							<More open={more} onClick={() => setMore((m) => !m)}>
								{more ? "Less" : "More"}
							</More>
						)}
					</div>
				)}
				<dl className="mt-4 grid grid-cols-3 gap-2">
					{(
						[
							["Posts", num(data.posts)],
							["Followers", num(data.followers)],
							["Following", num(data.following)],
						] as const
					).map(([k, v]) => (
						<div key={k} className={clsx(well, "flex flex-col gap-0.5 px-3 py-2.5")}>
							<dd className={clsx(T.figure, "text-[calc(19px*var(--ws-fs))]")}>{v === null ? "–" : compact(v)}</dd>
							<dt className={T.label}>{k}</dt>
						</div>
					))}
				</dl>
				{Number.isFinite(joined) && (
					<p className={clsx(T.label, "mt-3")}>Joined {new Date(joined).toLocaleDateString(undefined, { month: "long", year: "numeric" })}</p>
				)}
				<div className="mt-4 flex flex-wrap gap-2">
					{!isYou && (
						<Btn label={following ? "Aligned, tap to unalign" : "Align"} tone={following ? "quiet" : "primary"} onClick={() => void align()} pressed={following} disabled={busy}>
							{following && <Check weight="bold" />}
							{following ? "Aligned" : "Align"}
						</Btn>
					)}
					{!isYou && w.profileId && (
						<Btn label="Message" onClick={() => void run({ type: "chat", profileId: w.profileId, username: w.handle })}>
							<ChatCircle /> Message
						</Btn>
					)}
					<Btn label="View profile" tone={isYou ? "quiet" : "ghost"} onClick={() => open.profile(w.handle)}>
						View profile
					</Btn>
				</div>
			</div>
		</Frame>
	);
}

export function PostEmbedWidget({ data, title, live }: Props<R>) {
	const open = useOpen();
	const author = who(data.author);
	const id = str(data.postId);
	const images = arr(data.images).map(str).filter(isHttp).slice(0, 4);
	const stats = rec(data.stats);
	const poll = rec(data.poll);
	const paid = rec(data.paid);
	const locked = paid.locked === true;
	const opts = arr<R>(poll.options);
	const total = num(poll.total) ?? opts.reduce((s, o) => s + (num(o.votes) ?? 0), 0);
	const lead = Math.max(...opts.map((o) => num(o.votes) ?? 0), 0);
	const at = str(data.createdAt);
	const go = () => open.post(id);
	return (
		<Frame title={title || "Post"} icon={<Quotes />} live={live}>
			{/* The whole card opens the post; links inside the text stop their own clicks. */}
			<div
				role="link"
				tabIndex={0}
				onClick={go}
				onKeyDown={(e) => {
					if (e.key === "Enter") go();
				}}
				className="-m-2 flex cursor-pointer flex-col gap-3 rounded-[13px] p-2 transition-colors hover:bg-[var(--vivid-well)]"
			>
				<div className="flex items-center gap-3">
					<Face src={author.avatar} name={author.name} size={40} />
					<Byline w={author} sub={at ? <span> · {formatTimeAgo(at)}</span> : null} />
					{data.isLive === true && (
						<span className="ml-auto">
							<LivePill />
						</span>
					)}
				</div>
				{data.quotes === true && (
					<span className={clsx(T.label, "flex items-center gap-1.5")}>
						<Quotes className="size-3.5" /> Quote post
					</span>
				)}
				{locked ? (
					<div className={clsx(well, "flex flex-col gap-2 px-4 py-3.5")}>
						<span className={clsx(T.label, "flex items-center gap-1.5")}>
							<Lock weight="fill" className="size-3.5" /> Paid post
						</span>
						{str(paid.title) && <span className={T.strong}>{str(paid.title)}</span>}
						{str(data.text) && <p className={clsx(T.body, "line-clamp-3 text-muted")}>{str(data.text)}</p>}
						<span className="mt-1 flex items-center justify-between gap-3">
							<span className={clsx(T.figure, "text-[calc(20px*var(--ws-fs))]")}>{minor(num(paid.priceUsdMinor) ?? 0, "USD")}</span>
							<span className={clsx(T.label, "flex items-center gap-1.5 font-medium text-primary")}>
								<LockOpen className="size-4" /> Unlock on the post
							</span>
						</span>
					</div>
				) : (
					str(data.text) && <p className={clsx(T.body, "whitespace-pre-wrap break-words")}>{renderRichText(str(data.text))}</p>
				)}
				{!locked && images.length > 0 && (
					<div className={clsx("grid gap-1 overflow-hidden rounded-[13px]", images.length > 1 && "grid-cols-2")}>
						{images.map((src, i) => (
							// biome-ignore lint/performance/noImgElement: post media from the gateway's signed URLs
							<img
								key={src}
								src={src}
								alt=""
								className={clsx(
									"w-full bg-[var(--vivid-well)] object-cover",
									images.length === 1 ? "max-h-[300px]" : "aspect-square",
									images.length === 3 && i === 0 && "row-span-2 aspect-auto h-full",
								)}
							/>
						))}
					</div>
				)}
				{!locked && data.hasVideo === true && images.length === 0 && (
					<div className={clsx(well, "flex aspect-video items-center justify-center")}>
						<span className="flex size-12 items-center justify-center rounded-full bg-page/80 text-primary">
							<Play weight="fill" className="size-5" />
						</span>
					</div>
				)}
				{!locked && opts.length > 0 && (
					<ul className="flex flex-col gap-1.5">
						{opts.map((o, i) => {
							const v = num(o.votes);
							const pct = total > 0 && v !== null ? (v / total) * 100 : 0;
							const top = v !== null && v === lead && lead > 0;
							return (
								// biome-ignore lint/suspicious/noArrayIndexKey: options in order
								<li key={i} className="relative flex h-10 items-center overflow-hidden rounded-[10px] bg-[var(--vivid-well)] px-3">
									<span
										className={clsx("absolute inset-y-0 left-0", top ? "bg-[var(--vivid-brand-wash)]" : "bg-[var(--vivid-well-press)]")}
										style={{ width: `${pct}%` }}
									/>
									<span className={clsx("relative min-w-0 flex-1 truncate", T.body, top && "font-semibold")}>{str(o.text)}</span>
									{v !== null && <span className={clsx("relative", T.label, "tabular-nums")}>{Math.round(pct)}%</span>}
								</li>
							);
						})}
						{total > 0 && <li className={T.label}>{compact(total)} votes</li>}
					</ul>
				)}
				<div className="flex items-center gap-5 text-muted">
					{(
						[
							[ChatCircle, stats.replies, "replies"],
							[Repeat, stats.reposts, "reposts"],
							[Heart, stats.likes, "likes"],
							[Pulse, stats.views, "views"],
						] as const
					).map(([Icon, v, name]) => (
						<span key={name} className="flex items-center gap-1.5 font-sans text-[calc(13px*var(--ws-fs))] tabular-nums" aria-label={`${num(v) ?? 0} ${name}`}>
							<Icon className="size-[17px]" />
							{num(v) ? compact(num(v) as number) : ""}
						</span>
					))}
				</div>
			</div>
		</Frame>
	);
}

export function TrendingWidget({ data, title, live }: Props<R>) {
	const open = useOpen();
	const items = arr<R>(data.items);
	const week = str(data.period) === "week";
	return (
		<Frame title={title || "Trending"} icon={<TrendUp />} action={<span className="pr-2.5"><Tag>{week ? "This week" : "Now"}</Tag></span>} live={live} flush>
			<ol className="flex flex-col px-2 pb-2">
				{items.map((t, i) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: ranked in order
					<li key={i}>
						<button
							type="button"
							onClick={() => open.explore(str(t.label))}
							className="flex min-h-[52px] w-full cursor-pointer items-center gap-3 rounded-[13px] px-2 py-2 text-left transition-colors hover:bg-[var(--vivid-well)] sm:px-3"
						>
							<span className={clsx(T.label, "w-5 shrink-0 text-right font-semibold tabular-nums")}>{i + 1}</span>
							<span className="flex min-w-0 flex-1 flex-col">
								<span className={clsx(T.strong, "truncate")}>{str(t.label)}</span>
								<span className={clsx(T.label, "tabular-nums")}>
									{compact(num(t.posts) ?? 0)} posts
									{num(t.people) ? ` · ${compact(num(t.people) as number)} people` : ""}
								</span>
							</span>
						</button>
					</li>
				))}
			</ol>
			<div className="px-4 pb-4 sm:px-5 sm:pb-5">
				<LiveFoot source={str(data.source) || "WorldSpace"} asOf={str(data.asOf)} stale={false} />
			</div>
		</Frame>
	);
}

export function LiveNowWidget({ data, title, live }: Props<R>) {
	const open = useOpen();
	const streams = arr<R>(data.streams);
	const [strip, end, edge] = useStripEnd<HTMLDivElement>();
	return (
		<Frame title={title || "Live now"} icon={<Pulse />} live={live} flush>
			<div ref={strip} data-end={end} className={clsx(edge, "overflow-x-auto px-4 pb-4 sm:px-5 sm:pb-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden")}>
				<ul className="flex w-max gap-3">
					{streams.map((st, i) => {
						const host = who(st.host);
						const thumb = str(st.thumb);
						const viewers = num(st.viewers);
						return (
							// biome-ignore lint/suspicious/noArrayIndexKey: streams in order
							<li key={i} className="w-[232px]">
								<button type="button" onClick={() => open.stream(str(st.streamId))} className="group flex w-full cursor-pointer flex-col gap-2 text-left">
									<span className="relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-[13px] bg-sunken">
										{isHttp(thumb) ? (
											// biome-ignore lint/performance/noImgElement: a stream thumbnail from Xstream
											<img src={thumb} alt="" className="absolute inset-0 size-full object-cover transition-[filter] group-hover:brightness-110" />
										) : (
											<Face src={host.avatar} name={host.name} size={56} />
										)}
										<span className="absolute top-2 left-2">
											<LivePill />
										</span>
										{viewers !== null && (
											<span className="absolute top-2 right-2 inline-flex h-6 items-center gap-1 rounded-pill bg-page/85 px-2 font-sans text-[11.5px] font-semibold text-primary tabular-nums">
												<Eye className="size-3.5" /> {compact(viewers)}
											</span>
										)}
									</span>
									<span className={clsx(T.strong, "line-clamp-2")}>{str(st.title)}</span>
									<span className="flex items-center gap-2">
										<Face src={host.avatar} name={host.name} size={20} />
										<span className={clsx(T.label, "truncate")}>{host.name}</span>
										{host.isVerified && <VerifiedIcon size={{ width: "13", height: "13" }} />}
									</span>
								</button>
							</li>
						);
					})}
				</ul>
			</div>
		</Frame>
	);
}

/** "in 2h 15m", refreshed each minute. */
function useStartsIn(at: number) {
	const [now, setNow] = useState<number | null>(null);
	useEffect(() => {
		setNow(Date.now());
		const t = setInterval(() => setNow(Date.now()), 60_000);
		return () => clearInterval(t);
	}, []);
	if (now === null || !Number.isFinite(at)) return "";
	const m = Math.round((at - now) / 60_000);
	if (m <= 0) return "starting now";
	if (m < 60) return `in ${m} min`;
	const h = Math.floor(m / 60);
	if (h < 48) return `in ${h}h ${m % 60}m`;
	return `in ${Math.round(h / 24)} days`;
}

export function SpaceCardWidget({ data, title, live }: Props<R>) {
	const open = useOpen();
	const host = who(data.host);
	const isLive = str(data.status) === "live";
	const speakers = arr<R>(data.speakers).slice(0, 6);
	const cover = str(data.cover);
	const starts = Date.parse(str(data.startsAt));
	const inText = useStartsIn(starts);
	const bg = spaceBackground(isHttp(cover) ? { coverImage: cover } : { cover: cover || undefined } as never);
	return (
		<Frame title={title || "Space"} icon={<Microphone />} live={live}>
			<div className="relative h-[112px] overflow-hidden rounded-[13px]" style={{ background: bg }}>
				<span className="absolute top-2.5 left-2.5">
					{isLive ? <LivePill /> : <span className="inline-flex h-6 items-center rounded-pill bg-page/85 px-2 font-sans text-[11.5px] font-semibold text-primary">Scheduled</span>}
				</span>
				<span className="absolute bottom-2.5 left-2.5 flex -space-x-2">
					{[{ handle: host.handle, name: host.name, avatar: host.avatar }, ...speakers.map((sp) => ({ handle: str(sp.handle), name: str(sp.name), avatar: str(sp.avatar) }))]
						.filter((x, i, all) => all.findIndex((y) => y.handle === x.handle) === i)
						.slice(0, 6)
						.map((f) => (
							<span key={f.handle} className="rounded-full ring-2 ring-page">
								<Face src={f.avatar} name={f.name} size={36} />
							</span>
						))}
				</span>
			</div>
			<div className="mt-3 flex flex-col gap-1">
				<span className={clsx(T.display, "text-[calc(19px*var(--ws-fs))]")}>{str(data.title)}</span>
				<span className={clsx(T.label, "flex flex-wrap items-center gap-x-1.5")}>
					<span>Hosted by {host.name}</span>
					{str(data.category) && <span>· {str(data.category)}</span>}
				</span>
				<span className={clsx(T.body, "tabular-nums", isLive ? "text-primary" : "text-muted")}>
					{isLive
						? `${compact(num(data.listeners) ?? 0)} listening`
						: Number.isFinite(starts)
							? `${new Date(starts).toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}${inText ? `, ${inText}` : ""}`
							: "Scheduled"}
				</span>
			</div>
			<div className="mt-4 flex gap-2">
				<Btn label={isLive ? "Join the Space" : "Open the Space"} tone="primary" onClick={() => open.space(str(data.spaceId))}>
					{isLive ? (data.joined === true ? "Back to the Space" : "Join") : "Open"}
				</Btn>
			</div>
		</Frame>
	);
}

/* ---- composed summaries ---- */

export function ChatSummaryWidget({ data, title, live }: Props<R>) {
	const open = useOpen();
	const isGroup = str(data.kind) === "group";
	const since = Date.parse(str(data.since));
	const msgs = num(data.messages) ?? 0;
	const points = arr<R>(data.points);
	const decisions = arr(data.decisions).map(str).filter(Boolean);
	const todos = arr<R>(data.todos);
	const [done, setDone] = useState<Set<number>>(() => new Set());
	const window = `${fmt(msgs)} message${msgs === 1 ? "" : "s"}${
		Number.isFinite(since) ? ` since ${new Date(since).toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" })}` : ""
	}`;
	return (
		<Frame title={title || "Chat summary"} icon={<ChatsCircle />} live={live}>
			<div className="flex items-center gap-3">
				{isGroup && !isHttp(str(data.avatar)) ? (
					<span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[var(--vivid-well-press)] text-muted">
						<Users className="size-5" />
					</span>
				) : (
					<Face src={str(data.avatar)} name={str(data.name)} size={40} />
				)}
				<span className="flex min-w-0 flex-col">
					<span className={clsx(T.strong, "truncate")}>{str(data.name)}</span>
					<span className={clsx(T.label, "tabular-nums")}>{window}</span>
				</span>
			</div>
			<p className={clsx(T.body, "mt-4")}>
				<Txt text={data.summary} />
			</p>
			{points.length > 0 && (
				<ul className="mt-4 flex flex-col">
					{points.map((p, i) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: points in order
						<li key={i} className={clsx(T.body, "border-hairline border-t py-2.5 first:border-t-0 first:pt-0")}>
							{str(p.who) && <span className="font-semibold">{str(p.who)}: </span>}
							<span className={str(p.who) ? "text-muted" : undefined}>
								<Txt text={p.text} />
							</span>
						</li>
					))}
				</ul>
			)}
			{decisions.length > 0 && (
				<>
					<h4 className={clsx(T.head, "mt-5 mb-2")}>Decisions</h4>
					<ul className="flex flex-col gap-2.5">
						{decisions.map((d, i) => (
							// biome-ignore lint/suspicious/noArrayIndexKey: decisions in order
							<li key={i} className={clsx(T.body, "flex gap-2.5")}>
								<CheckCircle weight="fill" className="mt-[3px] size-[18px] shrink-0 text-gold" />
								<span className="min-w-0">
									<Txt text={d} />
								</span>
							</li>
						))}
					</ul>
				</>
			)}
			{todos.length > 0 && (
				<>
					<h4 className={clsx(T.head, "mt-5 mb-1")}>To-dos</h4>
					<ul className="flex flex-col">
						{todos.map((t, i) => (
							// biome-ignore lint/suspicious/noArrayIndexKey: to-dos in order
							<li key={i}>
								<button
									type="button"
									role="checkbox"
									aria-checked={done.has(i)}
									onClick={() =>
										setDone((d) => {
											const n = new Set(d);
											n.has(i) ? n.delete(i) : n.add(i);
											return n;
										})
									}
									className="flex min-h-[44px] w-full cursor-pointer items-center gap-3 text-left"
								>
									<span
										className={clsx(
											"flex size-5 shrink-0 items-center justify-center rounded-[7px] transition-colors",
											done.has(i) ? "bg-brand text-brand-on" : "ring-[1.5px] ring-primary/30 ring-inset",
										)}
									>
										{done.has(i) && <Check weight="bold" className="size-3" />}
									</span>
									<span className={clsx(T.body, "min-w-0", done.has(i) && "text-muted line-through decoration-primary/30")}>
										<Txt text={t.text} />
										{str(t.who) && <span className="text-muted"> · {str(t.who)}</span>}
									</span>
								</button>
							</li>
						))}
					</ul>
				</>
			)}
			<div className="mt-4 flex gap-2">
				<Btn label="Open chat" onClick={() => open.chat(str(data.conversationId))}>
					<ChatCircle /> Open chat
				</Btn>
			</div>
		</Frame>
	);
}

export function LinkSummaryWidget({ data, title, live }: Props<R>) {
	const url = str(data.url);
	const image = str(data.image);
	const points = arr(data.points).map(str).filter(Boolean);
	if (!isHttp(url)) return null;
	return (
		<Frame title={title || "Link"} icon={<Globe />} live={live}>
			<a href={url} target="_blank" rel="noopener noreferrer" className={clsx(well, "flex items-center gap-3 p-2.5 no-underline transition-colors hover:bg-[var(--vivid-well-press)]")}>
				{isHttp(image) ? (
					// biome-ignore lint/performance/noImgElement: the page's own preview image
					<img src={image} alt="" className="size-16 shrink-0 rounded-[10px] bg-[var(--vivid-well-press)] object-cover" />
				) : (
					<span className="flex size-16 shrink-0 items-center justify-center rounded-[10px] bg-[var(--vivid-well-press)] text-muted">
						<Globe className="size-6" />
					</span>
				)}
				<span className="flex min-w-0 flex-col gap-0.5">
					<span className={clsx(T.label, "truncate")}>{str(data.domain)}</span>
					<span className={clsx(T.strong, "line-clamp-2")}>{str(data.title)}</span>
				</span>
			</a>
			<p className={clsx(T.body, "mt-4")}>
				<Txt text={data.summary} />
			</p>
			{points.length > 0 && (
				<ul className="mt-3 flex flex-col gap-2.5">
					{points.map((p, i) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: points in order
						<li key={i} className="flex gap-3">
							<span aria-hidden className="mt-[10px] size-1.5 shrink-0 rounded-full bg-brand" />
							<span className={clsx(T.body, "text-muted")}>
								<Txt text={p} />
							</span>
						</li>
					))}
				</ul>
			)}
			<div className="mt-4 flex gap-2">
				<Btn label="Open link" href={url}>
					Open link <ArrowSquareOut />
				</Btn>
			</div>
		</Frame>
	);
}

/**
 * The turn's web sources as numbered chips. `[n]` in the answer opens its
 * chip through CiteContext (VividAnswer holds which one was asked for).
 */
export function SourcesWidget({ data, title, live }: Props<R>) {
	const cite = useContext(CiteContext);
	const sources = arr<R>(data.sources).filter((x) => isHttp(str(x.url)));
	const [sel, setSel] = useState<number | null>(null);
	const [strip, end, edge] = useStripEnd<HTMLDivElement>();
	const chips = useRef(new Map<number, HTMLButtonElement>());
	// A tap on [n] in the answer opens that chip and brings it into view.
	useEffect(() => {
		if (!cite?.asked) return;
		const n = cite.asked.n;
		if (!sources.some((x) => num(x.n) === n)) return;
		setSel(n);
		chips.current.get(n)?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
		// biome-ignore lint/correctness/useExhaustiveDependencies: reacts to each new ask only
	}, [cite?.asked]);
	const open = sources.find((x) => num(x.n) === sel);
	return (
		<Frame title={title || "Sources"} icon={<Newspaper />} live={live} flush>
			<div ref={strip} data-end={end} className={clsx(edge, "overflow-x-auto px-4 pb-3 sm:px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden")}>
				<ul className="flex w-max gap-2">
					{sources.map((x) => {
						const n = num(x.n) ?? 0;
						const on = sel === n;
						return (
							<li key={n}>
								<button
									ref={(el) => {
										if (el) chips.current.set(n, el);
									}}
									type="button"
									aria-expanded={on}
									onClick={() => setSel((s) => (s === n ? null : n))}
									className={clsx(
										"flex h-[68px] w-[210px] cursor-pointer flex-col justify-center gap-1 rounded-[13px] px-3 text-left transition-colors",
										on ? "bg-[var(--vivid-brand-wash)] ring-[1.5px] ring-brand ring-inset" : "bg-[var(--vivid-well)] hover:bg-[var(--vivid-well-press)]",
									)}
								>
									<span className="flex items-center gap-1.5">
										<span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[var(--vivid-well-press)] font-sans text-[11px] font-bold text-primary tabular-nums">
											{n}
										</span>
										<span className={clsx(T.label, "truncate")}>{str(x.domain)}</span>
										{str(x.from) === "wikipedia" && <Globe className="ml-auto size-3.5 shrink-0 text-muted" />}
									</span>
									<span className="line-clamp-2 font-sans text-[calc(13px*var(--ws-fs))] leading-snug font-medium text-primary">{str(x.title)}</span>
								</button>
							</li>
						);
					})}
				</ul>
			</div>
			<AnimatePresence initial={false}>
				{open && (
					<motion.div key={num(open.n)} {...collapse} className="overflow-hidden">
						<div className="mx-4 mb-4 flex flex-col gap-2 rounded-[13px] bg-[var(--vivid-well)] px-4 py-3.5 sm:mx-5 sm:mb-5">
							<span className={clsx(T.label, "truncate")}>{str(open.url)}</span>
							<span className={T.strong}>{str(open.title)}</span>
							{str(open.snippet) && <p className={clsx(T.body, "text-muted")}>{str(open.snippet)}</p>}
							<div className="mt-1">
								<Btn label={`Open ${str(open.domain)}`} href={str(open.url)}>
									Open <ArrowSquareOut />
								</Btn>
							</div>
						</div>
					</motion.div>
				)}
			</AnimatePresence>
			{!open && <div className="h-1" />}
		</Frame>
	);
}

/* ---- the member's own wallet, read only ---- */

const ACCOUNT: Record<string, string> = { USD: "Dollar Account", NGN: "Naira Account" };

export function WalletBalanceWidget({ data, title, live }: Props<R>) {
	const accounts = arr<R>(data.accounts).sort((a, b) => (str(a.currency) === "USD" ? -1 : str(b.currency) === "USD" ? 1 : 0));
	const [first, ...rest] = accounts;
	if (!first) return null;
	const locked = (a: R) => num(a.lockedMinor) ?? 0;
	return (
		<Frame title={title || "Wallet"} icon={<Wallet />} live={live}>
			<div className="flex flex-col gap-1">
				<span className={T.label}>{ACCOUNT[str(first.currency)] ?? str(first.currency)}</span>
				<span className={T.hero}>{minor(num(first.availableMinor) ?? 0, str(first.currency))}</span>
				{locked(first) > 0 && <span className={clsx(T.label, "tabular-nums")}>{minor(locked(first), str(first.currency))} on hold</span>}
			</div>
			{rest.length > 0 && (
				<ul className="mt-4 flex flex-col">
					{rest.map((a) => (
						<li key={str(a.currency)} className="flex items-baseline justify-between gap-3 border-hairline border-t py-3">
							<span className={T.body}>{ACCOUNT[str(a.currency)] ?? str(a.currency)}</span>
							<span className="flex flex-col items-end">
								<span className={clsx(T.strong, "tabular-nums")}>{minor(num(a.availableMinor) ?? 0, str(a.currency))}</span>
								{locked(a) > 0 && <span className={clsx(T.label, "tabular-nums")}>{minor(locked(a), str(a.currency))} on hold</span>}
							</span>
						</li>
					))}
				</ul>
			)}
			<div className="mt-4 flex flex-wrap gap-2">
				<Btn label="Add money" href={WALLET_URL} tone="primary">
					Add money
				</Btn>
				<Btn label="Convert" href={WALLET_URL}>
					<ArrowsLeftRight /> Convert
				</Btn>
			</div>
			<LiveFoot source={str(data.source) || "WorldStreet wallet"} asOf={str(data.asOf)} stale={false} />
		</Frame>
	);
}

const KIND: Record<string, { label: string; tone: "in" | "out" | "muted" }> = {
	in: { label: "Received", tone: "in" },
	out: { label: "Sent", tone: "out" },
	hold: { label: "On hold", tone: "muted" },
	release: { label: "Released", tone: "muted" },
	settled: { label: "Now spendable", tone: "muted" },
	reversal: { label: "Reversed", tone: "muted" },
	adjustment: { label: "Adjusted", tone: "muted" },
};

function dayLabel(t: number) {
	const d = new Date(t);
	const today = new Date();
	const y = new Date(today);
	y.setDate(today.getDate() - 1);
	if (d.toDateString() === today.toDateString()) return "Today";
	if (d.toDateString() === y.toDateString()) return "Yesterday";
	return d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

export function TransactionsWidget({ data, title, live }: Props<R>) {
	const cur = str(data.currency) || "USD";
	const items = arr<R>(data.items)
		.map((x) => ({ ...x, t: Date.parse(str(x.at)) }) as R & { t: number })
		.sort((a, b) => (b.t || 0) - (a.t || 0));
	const [open, setOpen] = useState<string | null>(null);
	const groups = (() => {
		const g: { day: string; rows: typeof items }[] = [];
		for (const it of items) {
			const day = Number.isFinite(it.t) ? dayLabel(it.t) : "Earlier";
			const last = g[g.length - 1];
			if (last && last.day === day) last.rows.push(it);
			else g.push({ day, rows: [it] });
		}
		return g;
	})();
	return (
		<Frame title={title || "Wallet activity"} icon={<Wallet />} live={live}>
			{groups.map((g) => (
				<section key={g.day} className="mt-4 flex flex-col first:mt-0">
					<h4 className={clsx(T.head, "pb-1")}>{g.day}</h4>
					<ul className="flex flex-col">
						{g.rows.map((x) => {
							const k = KIND[str(x.kind)] ?? KIND.adjustment;
							const amt = num(x.amountMinor) ?? 0;
							const id = str(x.id);
							const isOpen = open === id;
							const after = num(x.balanceAfterMinor);
							return (
								<li key={id} className="border-hairline border-t first:border-t-0">
									<button
										type="button"
										aria-expanded={isOpen}
										onClick={() => setOpen((o) => (o === id ? null : id))}
										className="flex min-h-[56px] w-full cursor-pointer items-center gap-3 py-2 text-left"
									>
										<span
											className={clsx(
												"flex size-9 shrink-0 items-center justify-center rounded-full",
												k.tone === "in" ? "bg-[var(--vivid-credit-wash)] text-credit" : k.tone === "out" ? "bg-[var(--vivid-debit-wash)] text-debit" : "bg-[var(--vivid-well)] text-muted",
											)}
										>
											{k.tone === "in" ? <ArrowDownLeft weight="bold" className="size-4" /> : k.tone === "out" ? <ArrowUpRight weight="bold" className="size-4" /> : k.label === "On hold" ? <Lock className="size-4" /> : <Wrench className="size-4" />}
										</span>
										<span className="flex min-w-0 flex-1 flex-col">
											<span className={clsx(T.body, "truncate")}>{str(x.title) || k.label}</span>
											<span className={clsx(T.label, "tabular-nums")}>
												{Number.isFinite(x.t) ? new Date(x.t).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) : ""}
												{k.tone === "muted" && ` · ${k.label}`}
											</span>
										</span>
										<span
											className={clsx(
												T.strong,
												"shrink-0 tabular-nums",
												k.tone === "in" ? "text-credit" : k.tone === "out" ? "text-debit" : "font-normal text-muted",
											)}
										>
											{k.tone === "in" ? "+" : k.tone === "out" ? "−" : ""}
											{minor(Math.abs(amt), cur)}
										</span>
									</button>
									<AnimatePresence initial={false}>
										{isOpen && (
											<motion.dl key="d" {...collapse} className="overflow-hidden">
												<div className={clsx(well, "mb-3 ml-12 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 px-3.5 py-3")}>
													<dt className={T.label}>Type</dt>
													<dd className={T.body}>{k.label}</dd>
													<dt className={T.label}>When</dt>
													<dd className={clsx(T.body, "tabular-nums")}>
														{Number.isFinite(x.t) ? new Date(x.t).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "–"}
													</dd>
													{after !== null && (
														<>
															<dt className={T.label}>Balance after</dt>
															<dd className={clsx(T.body, "tabular-nums")}>{minor(after, cur)}</dd>
														</>
													)}
													<dt className={T.label}>Reference</dt>
													<dd className="flex min-w-0 items-center gap-1 font-mono text-[calc(12.5px*var(--ws-fs))] text-muted">
														<span className="truncate">{id}</span>
													</dd>
												</div>
											</motion.dl>
										)}
									</AnimatePresence>
								</li>
							);
						})}
					</ul>
				</section>
			))}
			<LiveFoot source={str(data.source) || "WorldStreet wallet"} asOf={str(data.asOf)} stale={false} />
		</Frame>
	);
}

/**
 * A PREVIEW of a payment (8.1 pay). Its one button opens the real Send sheet
 * in the chat, filled in; the member confirms there. Nothing here sends.
 */
export function SendPreviewWidget({ data, title, live }: Props<R>) {
	const actions = useContext(ActionsContext);
	const to = who(data.to);
	const amt = num(data.amountMinor) ?? 0;
	const cur = str(data.currency) || "USD";
	const note = str(data.note);
	return (
		<Frame title={title || "Send money"} icon={<PaperPlaneTilt />} live={live}>
			<div className="flex items-center gap-3">
				<Face src={to.avatar} name={to.name} size={44} />
				<Byline w={to} />
			</div>
			<div className="mt-4 flex flex-col gap-0.5">
				<span className={T.label}>Amount</span>
				<span className={T.hero}>{minor(amt, cur)}</span>
			</div>
			{note && (
				<p className={clsx(well, T.body, "mt-3 px-4 py-3")}>
					<span className="text-muted">Note: </span>
					{note}
				</p>
			)}
			<p className={clsx(T.label, "mt-4 flex items-start gap-2")}>
				<ShieldCheck className="mt-px size-4 shrink-0" />
				Vivid never sends money. Review opens Send, where you confirm.
			</p>
			<div className="mt-4">
				<Btn label="Review in Send" tone="primary" disabled={!actions?.pay || !to.profileId} onClick={() => actions?.pay?.({ profileId: to.profileId, handle: to.handle, amountMinor: amt, note })}>
					Review in Send <ArrowUpRight weight="bold" />
				</Btn>
			</div>
		</Frame>
	);
}

/* ---- calculators ---- */

const price = (n: number) => n.toLocaleString(undefined, { maximumSignificantDigits: 8 });
const signedPct = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${fmt(Math.abs(n), 2)}%`;

export function TradePlanWidget({ data, title, live }: Props<R>) {
	const long = str(data.side) !== "short";
	const entry = num(data.entry) ?? 0;
	const stop = num(data.stop) ?? 0;
	const targets = arr<R>(data.targets)
		.map((t) => ({ price: num(t.price) ?? Number.NaN, rr: num(t.rr), movePct: num(t.movePct) }))
		.filter((t) => Number.isFinite(t.price));
	const risk = num(data.risk) ?? Math.abs(entry - stop);
	const riskPct = num(data.riskPct) ?? (entry ? (risk / entry) * 100 : 0);
	if (!entry || !stop) return null;
	// The ladder, drawn to scale; labels pushed apart where levels crowd.
	const H = 248;
	const levels = [
		...targets.map((t, i) => ({ key: `t${i}`, name: `Target ${i + 1}`, p: t.price, tone: "credit" as const, rr: t.rr, move: t.movePct })),
		{ key: "e", name: "Entry", p: entry, tone: "ink" as const, rr: null, move: null },
		{ key: "s", name: "Stop", p: stop, tone: "debit" as const, rr: null, move: entry ? ((stop - entry) / entry) * 100 : null },
	];
	const hi = Math.max(...levels.map((l) => l.p));
	const lo = Math.min(...levels.map((l) => l.p));
	const pad = (hi - lo) * 0.08 || 1;
	const y = (p: number) => 14 + ((hi + pad - p) / (hi - lo + pad * 2)) * (H - 28);
	const placed = levels.map((l) => ({ ...l, y: y(l.p), ly: y(l.p) })).sort((a, b) => a.y - b.y);
	for (let i = 1; i < placed.length; i++) if (placed[i].ly - placed[i - 1].ly < 34) placed[i].ly = placed[i - 1].ly + 34;
	const overflow = placed.length ? placed[placed.length - 1].ly - (H - 14) : 0;
	const height = H + Math.max(0, overflow);
	const far = targets.length ? (long ? Math.max(...targets.map((t) => t.price)) : Math.min(...targets.map((t) => t.price))) : entry;
	const ink = { credit: "text-credit", ink: "text-primary", debit: "text-debit" };
	const line = { credit: "var(--ws-money-credit)", ink: "var(--ws-text-primary)", debit: "var(--ws-money-debit)" };
	return (
		<Frame
			title={title || str(data.pair) || "Trade plan"}
			icon={<Ladder />}
			action={
				<span className="flex gap-1.5 pr-2.5">
					<span
						className={clsx(
							"inline-flex h-6 items-center rounded-pill px-2.5 font-sans text-[12.5px] font-semibold",
							long ? "bg-[var(--vivid-credit-wash)] text-credit" : "bg-[var(--vivid-debit-wash)] text-debit",
						)}
					>
						{long ? "Long" : "Short"}
					</span>
					{str(data.timeframe) && <Tag>{str(data.timeframe)}</Tag>}
				</span>
			}
			live={live}
		>
			<div className="relative" style={{ height }} role="img" aria-label={`${long ? "Long" : "Short"} ${str(data.pair)}: entry ${price(entry)}, stop ${price(stop)}, targets ${targets.map((t) => price(t.price)).join(", ")}`}>
				{/* Zones: the risk between entry and stop, the reward out to the furthest target. */}
				<span className="absolute right-0 left-[132px] rounded-[7px] bg-[var(--vivid-debit-wash)]" style={{ top: Math.min(y(entry), y(stop)), height: Math.abs(y(entry) - y(stop)) }} />
				<span className="absolute right-0 left-[132px] rounded-[7px] bg-[var(--vivid-credit-wash)]" style={{ top: Math.min(y(entry), y(far)), height: Math.abs(y(entry) - y(far)) }} />
				{placed.map((l) => (
					<div key={l.key}>
						<span
							className="absolute right-0 left-[132px] h-0 border-t-[1.5px]"
							style={{ top: l.y, borderColor: line[l.tone], borderStyle: l.tone === "ink" ? "solid" : "dashed" }}
						/>
						<span className="absolute left-0 flex w-[124px] -translate-y-1/2 flex-col" style={{ top: l.ly }}>
							<span className={clsx("font-sans text-[calc(12.5px*var(--ws-fs))] font-semibold", ink[l.tone])}>
								{l.name}
								{l.rr !== null && <span className="ml-1.5 text-muted tabular-nums">{fmt(l.rr, 2)}R</span>}
							</span>
							<span className={clsx(T.strong, "tabular-nums")}>
								{price(l.p)}
								{l.move !== null && <span className={clsx(T.label, "ml-1.5 font-normal")}>{signedPct(l.move)}</span>}
							</span>
						</span>
					</div>
				))}
			</div>
			<div className={clsx(well, "mt-4 flex items-center justify-between px-4 py-3")}>
				<span className={T.body}>Risk per unit</span>
				<span className={clsx(T.strong, "tabular-nums")}>
					{price(risk)} <span className="font-normal text-muted">({fmt(riskPct, 2)}%)</span>
				</span>
			</div>
			{str(data.invalidation) && (
				<div className="mt-4 flex flex-col gap-1">
					<span className={T.head}>Invalidated if</span>
					<p className={T.body}>
						<Txt text={data.invalidation} />
					</p>
				</div>
			)}
			{str(data.notes) && (
				<p className={clsx(T.body, "mt-3 text-muted")}>
					<Txt text={data.notes} />
				</p>
			)}
			<p className={clsx(T.label, "mt-4 border-hairline border-t pt-3")}>A plan, not advice.</p>
		</Frame>
	);
}

/** The 8.4 formulas, the same ones the gateway runs. */
function sizePosition(v: { balance: number; riskPct: number; entry: number; stop: number; contractSize: number | null }) {
	const { balance, riskPct, entry, stop, contractSize } = v;
	if (!(balance > 0) || !(riskPct > 0) || riskPct > 100 || !(entry > 0) || !(stop > 0) || stop === entry) return null;
	const riskAmount = (balance * riskPct) / 100;
	const perUnitRisk = Math.abs(entry - stop);
	const units = riskAmount / perUnitRisk;
	const positionValue = units * entry;
	return {
		side: stop < entry ? "long" : "short",
		riskAmount,
		perUnitRisk,
		units,
		lots: contractSize && contractSize > 0 ? units / contractSize : null,
		positionValue,
		leverage: positionValue / balance,
	};
}

function NumField({ label: name, value, onChange, suffix }: { label: string; value: string; onChange: (v: string) => void; suffix?: string }) {
	return (
		<label className="flex min-w-0 flex-col gap-1.5">
			<span className={T.label}>{name}</span>
			<span className="flex h-11 items-center rounded-[10px] bg-[var(--vivid-well)] px-3 focus-within:ring-[1.5px] focus-within:ring-brand focus-within:ring-inset">
				<input
					inputMode="decimal"
					value={value}
					onChange={(e) => onChange(e.target.value.replace(/[^\d.]/g, ""))}
					className="w-full min-w-0 bg-transparent text-right font-sans text-[calc(15px*var(--ws-fs))] font-medium text-primary tabular-nums outline-none"
				/>
				{suffix && <span className={clsx(T.label, "ml-1.5 shrink-0")}>{suffix}</span>}
			</span>
		</label>
	);
}

export function PositionSizeWidget({ data, title, live }: Props<R>) {
	const cur = str(data.currency) || "USD";
	const unit = str(data.unit) || "units";
	const cs = num(data.contractSize);
	const [f, setF] = useState(() => ({
		balance: String(num(data.balance) ?? ""),
		riskPct: String(num(data.riskPct) ?? ""),
		entry: String(num(data.entry) ?? ""),
		stop: String(num(data.stop) ?? ""),
	}));
	const r = sizePosition({ balance: Number(f.balance), riskPct: Number(f.riskPct), entry: Number(f.entry), stop: Number(f.stop), contractSize: cs });
	const set = (k: keyof typeof f) => (v: string) => setF((x) => ({ ...x, [k]: v }));
	return (
		<Frame
			title={title || "Position size"}
			icon={<Calculator />}
			action={
				r && (
					<span className="pr-2.5">
						<span
							className={clsx(
								"inline-flex h-6 items-center rounded-pill px-2.5 font-sans text-[12.5px] font-semibold",
								r.side === "long" ? "bg-[var(--vivid-credit-wash)] text-credit" : "bg-[var(--vivid-debit-wash)] text-debit",
							)}
						>
							{r.side === "long" ? "Long" : "Short"}
						</span>
					</span>
				)
			}
			live={live}
		>
			<div className="grid grid-cols-2 gap-3">
				<NumField label="Balance" value={f.balance} onChange={set("balance")} suffix={cur} />
				<NumField label="Risk" value={f.riskPct} onChange={set("riskPct")} suffix="%" />
				<NumField label="Entry" value={f.entry} onChange={set("entry")} />
				<NumField label="Stop" value={f.stop} onChange={set("stop")} />
			</div>
			<AnimatePresence mode="wait" initial={false}>
				{r ? (
					<motion.div key="r" {...swap} className="mt-5 flex flex-col gap-3" aria-live="polite">
						<div className="flex flex-col gap-0.5">
							<span className={T.label}>Position</span>
							<span className="flex flex-wrap items-baseline gap-x-2">
								<span className={T.hero}>{r.units.toLocaleString(undefined, { maximumSignificantDigits: 6 })}</span>
								<span className="font-display text-[calc(18px*var(--ws-fs))] font-semibold text-muted">{unit}</span>
							</span>
							{r.lots !== null && <span className={clsx(T.body, "text-muted tabular-nums")}>{fmt(r.lots, 2)} lots</span>}
						</div>
						<div className="grid grid-cols-2 gap-2">
							<div className={clsx(well, "flex flex-col gap-0.5 px-3.5 py-3")}>
								<span className={T.label}>At risk</span>
								<span className={clsx(T.strong, "tabular-nums")}>{money(r.riskAmount, cur)}</span>
							</div>
							<div className={clsx(well, "flex flex-col gap-0.5 px-3.5 py-3")}>
								<span className={T.label}>Position value</span>
								<span className={clsx(T.strong, "tabular-nums")}>{money(r.positionValue, cur)}</span>
							</div>
						</div>
						<span className={clsx(T.label, "tabular-nums")}>
							Leverage {fmt(r.leverage, 2)}x · {price(r.perUnitRisk)} risk per {unit.replace(/s$/, "")}
						</span>
					</motion.div>
				) : (
					<motion.p key="x" {...swap} className={clsx(T.body, "mt-5 text-muted")}>
						Check the numbers: the stop can't equal the entry, and risk is between 0 and 100%.
					</motion.p>
				)}
			</AnimatePresence>
			<p className={clsx(T.label, "mt-4 border-hairline border-t pt-3")}>
				Assumes the price is quoted in {cur}. Changes stay on this screen. A calculation, not advice.
			</p>
		</Frame>
	);
}
