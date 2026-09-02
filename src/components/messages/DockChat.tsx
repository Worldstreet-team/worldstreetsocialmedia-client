"use client";

import { UserBadges } from "@/components/ui/UserBadges";
import axios from "axios";
import clsx from "clsx";
import { useAtomValue } from "jotai";
import { useAuth } from "@clerk/nextjs";
import {
	ArrowLeft,
	PaperPlaneTilt,
	Phone,
	PhoneCall,
	PhoneX,
	Play,
	VideoCamera,
} from "@phosphor-icons/react";
import { useCallback, useEffect, useRef, useState } from "react";

import { useCall } from "@/providers/CallProvider";
import { useRealtime } from "@/components/providers/RealtimeProvider";
import { SafeAvatar } from "@/components/ui/SafeAvatar";
import { VoiceMessage } from "@/components/messages/VoiceMessage";
import type { ConversationRow } from "@/components/messages/ConversationList";
import type { Message } from "@/store/messageCache";
import { onlineIdsAtom } from "@/store/ui.atom";
import { BACKEND_URL } from "@/const";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? BACKEND_URL;

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
			>
				{part}
			</a>
		) : (
			part
		),
	);
}

/**
 * A whole conversation, inside the dock.
 *
 * The dock's first version treated a row as a link to /messages — which made
 * the dock a bookmark, not a messenger. This is the messenger: tap a thread
 * and it slides in over the list, reply, send a voice line via the phone
 * icons, slide back. The full page still exists for the long sessions; this
 * is for answering without leaving the feed.
 *
 * Deliberately NOT the MessageBox: that component is the full surface (media
 * pipelines, recorder, editors). A dock chat that imported all of it would
 * load the world to answer "ok". Text out, everything in.
 */
export function DockChat({
	conversation,
	myProfileId,
	onBack,
}: {
	conversation: ConversationRow;
	myProfileId: string;
	onBack: () => void;
}) {
	const { getToken } = useAuth();
	const { client } = useRealtime();
	const { startCall } = useCall();
	const online = useAtomValue(onlineIdsAtom);

	const [messages, setMessages] = useState<Message[]>([]);
	const [loading, setLoading] = useState(true);
	const [draft, setDraft] = useState("");
	const endRef = useRef<HTMLDivElement | null>(null);

	const other = conversation.otherParticipant;
	const peerName =
		[other.firstName, other.lastName].filter(Boolean).join(" ") ||
		other.username ||
		"";

	const scrollDown = useCallback(() => {
		endRef.current?.scrollIntoView({ block: "end" });
	}, []);

	// History on open.
	useEffect(() => {
		let dead = false;
		(async () => {
			try {
				const token = await getToken();
				const res = await axios.get(
					`${API_URL}/api/messages/${conversation._id}`,
					{ headers: { Authorization: `Bearer ${token}` } },
				);
				if (dead) return;
				setMessages(Array.isArray(res.data) ? res.data : (res.data?.data ?? []));
			} catch {
				/* the empty state below covers it */
			} finally {
				if (!dead) setLoading(false);
			}
		})();
		return () => {
			dead = true;
		};
	}, [conversation._id, getToken]);

	// eslint-disable-next-line react-hooks/exhaustive-deps
	useEffect(scrollDown, [messages.length]);

	// Live updates: same user channel the app already fans out on.
	useEffect(() => {
		if (!client || !myProfileId) return;
		const channel = client.channels.get(`user:${myProfileId}`);
		const onEvent = (msg: any) => {
			if (msg.name !== "event" || msg.data?.type !== "message:new") return;
			if (msg.data.conversationId !== conversation._id) return;
			const incoming = msg.data.message as Message;
			setMessages((prev) =>
				prev.some((m) => m._id === incoming._id) ? prev : [...prev, incoming],
			);
		};
		channel.subscribe(onEvent);
		return () => channel.unsubscribe(onEvent);
	}, [client, myProfileId, conversation._id]);

	const send = async () => {
		const content = draft.trim();
		if (!content) return;
		setDraft("");
		const tempId = `temp-${Date.now()}`;
		setMessages((prev) => [
			...prev,
			{
				_id: tempId,
				conversationId: conversation._id,
				sender: { _id: myProfileId } as Message["sender"],
				content,
				type: "text",
				createdAt: new Date().toISOString(),
			},
		]);
		try {
			const token = await getToken();
			const res = await axios.post(
				`${API_URL}/api/messages`,
				{ conversationId: conversation._id, content, type: "text" },
				{ headers: { Authorization: `Bearer ${token}` } },
			);
			setMessages((prev) =>
				prev.map((m) => (m._id === tempId ? res.data : m)),
			);
		} catch {
			setMessages((prev) => prev.filter((m) => m._id !== tempId));
			setDraft(content);
		}
	};

	const call = (isVideo: boolean) =>
		startCall({
			conversationId: conversation._id,
			peer: {
				id: other._id,
				name: peerName,
				avatar: other.avatar ?? "",
				username: other.username ?? "",
			},
			isVideo,
		});

	return (
		<div className="flex min-h-0 flex-1 flex-col">
			{/* header */}
			<div className="flex h-12 shrink-0 items-center gap-2 px-2">
				<button
					type="button"
					onClick={onBack}
					aria-label="Back to conversations"
					className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-pill text-muted transition-colors hover:bg-chip hover:text-primary"
				>
					<ArrowLeft size={16} weight="bold" />
				</button>
				<span className="relative shrink-0">
					<span className="relative block h-8 w-8 overflow-hidden rounded-pill bg-raised">
						<SafeAvatar src={other.avatar} />
					</span>
					{online.has(other._id) && (
						<span
							aria-hidden
							className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-pill bg-success ring-2 ring-page"
						/>
					)}
				</span>
				<span className="min-w-0 flex-1">
					<span className="flex items-center gap-1 truncate font-sans text-[13.5px] font-semibold text-primary">
						<span className="min-w-0 truncate">{peerName}</span>
						<UserBadges
							isVerified={(other as any).isVerified}
							verification={(other as any).verification}
							badges={(other as any).badges}
							size={13}
						/>
					</span>
				</span>
				<button
					type="button"
					onClick={() => call(false)}
					aria-label="Start voice call"
					className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-pill text-muted transition-colors hover:bg-chip hover:text-primary"
				>
					<Phone size={16} weight="fill" />
				</button>
				<button
					type="button"
					onClick={() => call(true)}
					aria-label="Start video call"
					className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-pill text-muted transition-colors hover:bg-chip hover:text-primary"
				>
					<VideoCamera size={16} weight="fill" />
				</button>
			</div>

			{/* thread */}
			<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-2">
				{loading ? (
					<div className="flex flex-col gap-2 pt-2">
						{[0, 1, 2].map((i) => (
							<span
								// biome-ignore lint/suspicious/noArrayIndexKey: placeholders
								key={i}
								className={clsx(
									"skeleton h-8 w-2/3 rounded-xl",
									i % 2 ? "self-end" : "self-start",
								)}
							/>
						))}
					</div>
				) : (
					messages.map((m) => {
						const mine =
							m.sender?._id === myProfileId || m._id.startsWith("temp-");
						if (m.type === "call") {
							const missed = /missed|declined|cancelled/i.test(m.content);
							const CallGlyph = missed ? PhoneX : PhoneCall;
							return (
								<div key={m._id} className="my-2 flex justify-center">
									<span className="flex items-center gap-1.5 rounded-pill bg-raised px-2.5 py-1 font-sans text-[11px] text-muted">
										<CallGlyph
											size={12}
											weight="fill"
											className={missed ? "text-danger" : "text-success"}
										/>
										{m.content}
									</span>
								</div>
							);
						}
						return (
							<div
								key={m._id}
								className={clsx(
									"mt-1.5 flex",
									mine ? "justify-end" : "justify-start",
								)}
							>
								<div
									className={clsx(
										"max-w-[85%] min-w-0 overflow-hidden rounded-xl",
										m.type === "image" || m.type === "video"
											? "p-0"
											: "px-3 py-1.5",
										mine
											? m.type === "image" || m.type === "video"
												? ""
												: "bg-brand text-brand-on"
											: m.type === "image" || m.type === "video"
												? ""
												: "bg-raised text-primary",
									)}
								>
									{m.type === "image" && m.mediaUrl && (
										// eslint-disable-next-line @next/next/no-img-element
										<img
											src={m.mediaUrl}
											alt=""
											className="max-h-40 w-auto rounded-xl object-cover"
										/>
									)}
									{m.type === "video" && m.mediaUrl && (
										<span className="relative block">
											{/* eslint-disable-next-line jsx-a11y/media-has-caption */}
											<video
												src={`${m.mediaUrl}#t=0.1`}
												preload="metadata"
												muted
												playsInline
												className="max-h-40 w-auto rounded-xl object-cover"
											/>
											<span className="absolute inset-0 flex items-center justify-center">
												<span className="flex h-9 w-9 items-center justify-center rounded-pill bg-scrim text-primary">
													<Play size={14} weight="fill" />
												</span>
											</span>
										</span>
									)}
									{m.type === "audio" && m.mediaUrl && (
										<span
											className={clsx(
												"block w-52",
												mine ? "text-brand-on" : "text-primary",
											)}
										>
											<VoiceMessage src={m.mediaUrl} isMe={mine} />
										</span>
									)}
									{m.content && (
										<p className="break-words font-sans text-[13px] leading-relaxed whitespace-pre-wrap">
											{linkify(m.content)}
										</p>
									)}
								</div>
							</div>
						);
					})
				)}
				{!loading && messages.length === 0 && (
					<p className="pt-8 text-center font-sans text-[12.5px] text-subtle">
						Say something — it lands here.
					</p>
				)}
				<div ref={endRef} />
			</div>

			{/* composer: text out. The full page owns media and voice notes. */}
			<div className="shrink-0 p-2.5">
				<div className="flex items-end gap-1 rounded-2xl bg-sunken py-1 pl-3 pr-1 transition-colors focus-within:bg-raised">
					<textarea
						value={draft}
						onChange={(e) => setDraft(e.target.value)}
						onKeyDown={(e) =>
							e.key === "Enter" &&
							!e.shiftKey &&
							(e.preventDefault(), send())
						}
						placeholder="Message…"
						rows={1}
						className="max-h-[80px] min-w-0 flex-1 resize-none bg-transparent py-1.5 font-sans text-base text-primary outline-none placeholder:text-subtle sm:text-[13.5px]"
					/>
					<button
						type="button"
						onClick={send}
						disabled={!draft.trim()}
						aria-label="Send message"
						className={clsx(
							"flex h-8 w-8 shrink-0 items-center justify-center rounded-pill transition-colors",
							draft.trim()
								? "cursor-pointer bg-brand text-brand-on"
								: "text-subtle",
						)}
					>
						<PaperPlaneTilt size={14} weight="fill" />
					</button>
				</div>
			</div>
		</div>
	);
}
