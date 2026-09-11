"use client";

import clsx from "clsx";
import { type ChatTheme, themeVars } from "./chatTheme";
import { ThemeBackdrop } from "./ThemeBackdrop";

/**
 * A sample thread painted with a theme — the same variables the real
 * thread reads, so what you see in the editor is what the chat becomes.
 * `frame` sets the proportions: a phone, a desktop pane, or a gallery card.
 */
export function ThemePreview({
	theme,
	frame,
	className,
	compact = false,
}: {
	theme: ChatTheme;
	frame: "phone" | "desktop" | "card";
	className?: string;
	/** Fewer, smaller bubbles for a gallery card. */
	compact?: boolean;
}) {
	const bubble = (mine: boolean, text: string, tail = true) => (
		<span
			className={clsx(
				"block max-w-[78%] font-sans leading-snug",
				compact ? "px-2 py-1 text-[9px]" : "px-3 py-1.5 text-[12px]",
				mine ? "self-end" : "self-start",
			)}
			style={{
				background: mine ? "var(--chat-mine)" : "var(--chat-theirs)",
				color: mine ? "var(--chat-mine-ink)" : "var(--chat-theirs-ink)",
				borderRadius: mine
					? `var(--chat-r) var(--chat-r) ${tail ? "var(--chat-r-in)" : "var(--chat-r)"} var(--chat-r)`
					: `var(--chat-r) var(--chat-r) var(--chat-r) ${tail ? "var(--chat-r-in)" : "var(--chat-r)"}`,
			}}
		>
			{text}
		</span>
	);
	return (
		<div
			style={themeVars(theme)}
			className={clsx(
				"relative flex flex-col overflow-hidden bg-page",
				frame === "phone" && "aspect-[9/17] w-[168px] rounded-[20px] border-2 border-hairline",
				frame === "desktop" && "aspect-[16/10] w-full rounded-xl border border-hairline",
				frame === "card" && "aspect-[9/13] w-full rounded-[10px]",
				className,
			)}
		>
			<ThemeBackdrop wallpaper={theme.wallpaper} resolution={compact ? 320 : 640} />
			<div
				className={clsx(
					"relative flex flex-1 flex-col justify-end gap-1",
					compact ? "p-2" : "p-3",
				)}
			>
				{!compact && bubble(false, "Good morning, Highly Esteemed!")}
				{bubble(false, compact ? "Hey, you around?" : "I don't even know what to say or how to say it.")}
				{!compact && (
					/* A quoted reply and a voice note are in the sample on purpose:
					   they are the two parts of a thread a theme most often broke,
					   and a person should see them survive before saving. */
					<span
						className="-mb-3 mr-2 max-w-[70%] self-end truncate rounded-[14px] px-2.5 pb-4 pt-1 font-sans text-[10.5px] opacity-90"
						style={{
							background: "var(--chat-quote-mine)",
							color: "var(--chat-quote-mine-ink)",
						}}
					>
						I don't even know what to say
					</span>
				)}
				{bubble(true, compact ? "What country is this" : "What country is this")}
				{!compact && (
					<span
						className="flex max-w-[78%] items-center gap-1.5 self-start px-3 py-2"
						style={{
							background: "var(--chat-theirs)",
							color: "var(--chat-theirs-ink)",
							borderRadius: "var(--chat-r) var(--chat-r) var(--chat-r) var(--chat-r-in)",
						}}
					>
						<span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-pill bg-current/15">
							<span className="ml-[1px] border-y-[4px] border-l-[7px] border-y-transparent border-l-current" />
						</span>
						<span className="flex h-6 items-center gap-[2px]" aria-hidden>
							{[6, 12, 18, 10, 22, 14, 8, 20, 12, 16, 6, 18, 10, 14, 8, 20, 12, 6].map((h, i) => (
								<span
									// biome-ignore lint/suspicious/noArrayIndexKey: static sample
									key={i}
									className="w-[2px] rounded-full bg-current"
									style={{ height: h, opacity: i < 7 ? 1 : 0.35 }}
								/>
							))}
						</span>
						<span className="font-sans text-[10px] tabular-nums opacity-80">0:12</span>
					</span>
				)}
			</div>
			{!compact && (
				<div className="relative m-2 mt-0 flex h-8 items-center justify-between rounded-pill border border-hairline bg-page/60 px-3">
					<span className="font-sans text-[11px] text-subtle">Message…</span>
					<span
						className="h-5 w-5 rounded-pill"
						style={{ background: "var(--chat-mine)" }}
					/>
				</div>
			)}
		</div>
	);
}
