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
				{bubble(true, compact ? "What country is this" : "What country is this")}
				{!compact && bubble(false, "Thank you, Sir, for texting.", true)}
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
