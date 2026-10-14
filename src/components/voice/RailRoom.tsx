"use client";

import { ArrowUp, ArrowsOut, Hand, Heart, Microphone, MicrophoneSlash, X } from "@phosphor-icons/react";
import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";

import { SafeAvatar } from "@/components/ui/SafeAvatar";
import { type SpaceRow, hostName, spaceBackground, spaceListenerCount } from "@/components/voice/SpaceCard";
import type { useSpaceAudio } from "@/hooks/useSpaceAudio";
import type { RoomMember, useSpaceRoom } from "@/hooks/useSpaceRoom";
import { useT } from "@/i18n/client";
import { formatCompact } from "@/lib/utils";
import { press } from "@/lib/motion-presets";

/**
 * A room docked in the third rail (owner 2026-10-12: "space voice can take
 * the third rail on desktop"). Minimising a room on a screen that shows the
 * right rail parks it here instead of in the floating pill, so you keep
 * reading the feed while you listen. Everything is the live room's own
 * state, handed down by VoiceRoomHost: the audio, the guest list, the chat
 * and the reactions keep running exactly as they do on the full stage.
 */
export function RailRoom({
	row,
	audio,
	roomLive,
	onExpand,
	onLeave,
}: {
	row: SpaceRow;
	audio: ReturnType<typeof useSpaceAudio>;
	roomLive: ReturnType<typeof useSpaceRoom>;
	onExpand: () => void;
	onLeave: () => void;
}) {
	const t = useT();
	const [tab, setTab] = useState<"stage" | "chat">("stage");
	const [draft, setDraft] = useState("");
	const { members, messages, realtime, hand, toggleHand, react, sendChat, profileOf } = roomLive;

	const hostId = row.host._id ? String(row.host._id) : "";
	const cohostIds = new Set(row.cohosts ?? []);
	const onStage = (id: string) => {
		const p = audio.room?.getParticipantByIdentity(id);
		return p?.permissions ? Boolean(p.permissions.canPublish) : cohostIds.has(id);
	};
	const others = members.filter((m) => m.id !== hostId && m.username !== row.host.username);
	const stage: (RoomMember | "host")[] = [
		"host" as const,
		...others.filter((m) => onStage(m.id)),
	].slice(0, 4);
	const audience = others.filter((m) => !onStage(m.id));
	const hands = members.filter((m) => m.hand).length;
	const count = realtime ? Math.max(members.length, 1) : Math.max(spaceListenerCount(row), 1);
	const speaking = new Set(audio.speakingIds);

	const send = () => {
		if (sendChat(draft)) setDraft("");
	};

	return (
		<section
			aria-label={row.title}
			className="ws-on-dark relative shrink-0 overflow-hidden rounded-[28px] shadow-pop"
			style={{ background: spaceBackground(row) }}
		>
			{/* The room's own cover, frosted: the rail takes on its colours. */}
			<div className="flex flex-col gap-3.5 bg-[#04060a]/80 p-4 backdrop-blur-2xl backdrop-saturate-150">
				<div className="flex items-center gap-2">
					<span className="flex items-center gap-1.5 rounded-pill bg-danger px-2 py-0.5 font-sans text-[calc(10.5px*var(--ws-fs))] font-bold text-white">
						<span className="h-1.5 w-1.5 animate-pulse rounded-pill bg-white" />
						LIVE
					</span>
					<span className="font-sans text-[calc(12px*var(--ws-fs))] font-semibold tabular-nums text-muted">
						{formatCompact(count)} {t("voice.listeners")}
					</span>
					<span className="flex-1" />
					<motion.button
						{...press}
						type="button"
						onClick={onExpand}
						aria-label={t("voice.expandRoom")}
						className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-pill bg-primary/[0.08] text-primary transition-colors hover:bg-primary/[0.14]"
					>
						<ArrowsOut size={14} weight="bold" />
					</motion.button>
					<motion.button
						{...press}
						type="button"
						onClick={onLeave}
						aria-label={row.isHost ? t("voice.end") : t("voice.leave")}
						className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-pill bg-danger/15 text-danger transition-colors hover:bg-danger/25"
					>
						<X size={13} weight="bold" />
					</motion.button>
				</div>

				<h2 className="line-clamp-2 font-display text-[calc(16px*var(--ws-fs))] font-semibold leading-snug text-primary">
					{row.title}
				</h2>

				<div className="flex gap-1 rounded-pill bg-primary/[0.06] p-1">
					{(["stage", "chat"] as const).map((k) => (
						<button
							key={k}
							type="button"
							onClick={() => setTab(k)}
							aria-pressed={tab === k}
							className={clsx(
								"flex h-8 flex-1 cursor-pointer items-center justify-center rounded-pill font-sans text-[calc(12.5px*var(--ws-fs))] font-semibold transition-colors",
								tab === k ? "bg-surface/80 text-primary" : "text-muted hover:text-primary",
							)}
						>
							{k === "stage" ? t("voice.onStageLabel") : t("voice.chat")}
							{k === "chat" && messages.length > 0 && (
								<span className="ml-1 tabular-nums text-subtle">{messages.length}</span>
							)}
						</button>
					))}
				</div>

				<AnimatePresence mode="wait" initial={false}>
					{tab === "stage" ? (
						<motion.div
							key="stage"
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							className="flex flex-col gap-3"
						>
							<div className="flex justify-around">
								{stage.map((m) => {
									const id = m === "host" ? hostId : m.id;
									const name = m === "host" ? hostName(row.host) : m.username;
									const avatar = m === "host" ? row.host.avatar : m.avatar;
									const talking = speaking.has(id);
									return (
										<div key={id || name} className="flex w-[72px] flex-col items-center gap-1.5">
											<span
												className={clsx(
													"relative block h-14 w-14 rounded-pill p-[3px] transition-shadow",
													talking ? "ring-2 ring-brand shadow-[0_0_0_6px_rgb(34_184_214/0.18)]" : "",
												)}
											>
												<span className="block h-full w-full overflow-hidden rounded-pill bg-raised">
													<SafeAvatar src={avatar} className="object-cover" sizes="56px" />
												</span>
											</span>
											<span className="w-full truncate text-center font-sans text-[calc(12px*var(--ws-fs))] font-semibold text-primary">
												{name.split(" ")[0]}
											</span>
											{m === "host" && (
												<span className="rounded-pill bg-brand/15 px-1.5 font-sans text-[calc(10px*var(--ws-fs))] font-bold text-brand">
													{t("voice.hostBadge")}
												</span>
											)}
										</div>
									);
								})}
							</div>
							{audience.length > 0 && (
								<div className="flex items-center gap-2.5 rounded-[18px] bg-primary/[0.06] px-3 py-2">
									<span className="flex -space-x-2.5">
										{audience.slice(0, 5).map((m) => (
											<span key={m.id} className="block h-7 w-7 overflow-hidden rounded-pill bg-raised ring-2 ring-surface">
												<SafeAvatar src={m.avatar} className="object-cover" sizes="28px" />
											</span>
										))}
									</span>
									<span className="min-w-0 flex-1 truncate font-sans text-[calc(12.5px*var(--ws-fs))] font-semibold text-muted">
										{formatCompact(audience.length)} {t("voice.inTheRoom").toLowerCase()}
									</span>
									{hands > 0 && (
										<span className="flex items-center gap-1 rounded-pill bg-warning/15 px-2 py-0.5 font-sans text-[calc(11.5px*var(--ws-fs))] font-bold text-warning">
											<Hand size={11} weight="fill" />
											{hands}
										</span>
									)}
								</div>
							)}
						</motion.div>
					) : (
						<motion.div
							key="chat"
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							className="flex flex-col gap-2.5"
						>
							<div className="flex max-h-56 flex-col gap-2.5 overflow-y-auto pr-1 [scrollbar-width:none]">
								{messages.length === 0 ? (
									<p className="py-3 text-center font-sans text-[calc(12.5px*var(--ws-fs))] text-subtle">
										{t("voice.chatEmpty")}
									</p>
								) : (
									messages.slice(-8).map((msg) => {
										const who = profileOf(msg.from);
										return (
											<div key={msg.id} className="flex gap-2">
												<span className="block h-6 w-6 shrink-0 overflow-hidden rounded-pill bg-raised">
													<SafeAvatar src={who?.avatar} className="object-cover" sizes="24px" />
												</span>
												<span className="min-w-0">
													<span className="block font-sans text-[calc(11.5px*var(--ws-fs))] font-semibold text-muted">
														{who?.name ?? who?.username ?? "…"}
													</span>
													<span className="block break-words font-sans text-[calc(13px*var(--ws-fs))] text-primary">
														{msg.text}
													</span>
												</span>
											</div>
										);
									})
								)}
							</div>
							<div className="flex items-center gap-2 rounded-pill bg-primary/[0.07] py-1 pl-3.5 pr-1">
								<input
									value={draft}
									onChange={(e) => setDraft(e.target.value)}
									onKeyDown={(e) => {
										if (e.key === "Enter") send();
									}}
									placeholder={t("voice.chatPlaceholder")}
									className="min-w-0 flex-1 bg-transparent font-sans text-[calc(13px*var(--ws-fs))] text-primary outline-none placeholder:text-subtle"
								/>
								<button
									type="button"
									onClick={send}
									aria-label={t("voice.chatSend")}
									className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-pill bg-brand text-brand-on"
								>
									<ArrowUp size={13} weight="bold" />
								</button>
							</div>
						</motion.div>
					)}
				</AnimatePresence>

				<div className="flex items-center gap-2">
					{audio.canSpeak ? (
						<motion.button
							{...press}
							type="button"
							onClick={audio.toggleMute}
							aria-label={t("voice.micToggle")}
							className={clsx(
								"flex h-10 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-pill font-sans text-[calc(13px*var(--ws-fs))] font-bold transition-colors",
								audio.muted ? "bg-primary/[0.08] text-primary" : "bg-brand text-brand-on",
							)}
						>
							{audio.muted ? <MicrophoneSlash size={15} weight="bold" /> : <Microphone size={15} weight="fill" />}
							{audio.muted ? t("voice.mute") : t("voice.youAreLive")}
						</motion.button>
					) : (
						<motion.button
							{...press}
							type="button"
							onClick={toggleHand}
							aria-pressed={hand}
							className={clsx(
								"flex h-10 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-pill font-sans text-[calc(13px*var(--ws-fs))] font-bold transition-colors",
								hand ? "bg-warning/20 text-warning" : "bg-brand text-brand-on",
							)}
						>
							<Hand size={15} weight="fill" />
							{hand ? t("voice.lowerHand") : t("voice.requestSpeak")}
						</motion.button>
					)}
					<motion.button
						{...press}
						type="button"
						onClick={() => react("heart")}
						aria-label="Heart"
						className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-pill bg-primary/[0.08] text-danger transition-colors hover:bg-primary/[0.14]"
					>
						<Heart size={16} weight="fill" />
					</motion.button>
				</div>
			</div>
		</section>
	);
}
