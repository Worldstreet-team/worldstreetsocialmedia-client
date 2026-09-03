"use client";

import {
	RiFacebookCircleFill,
	RiLinkM,
	RiTelegram2Fill,
	RiTwitterXFill,
	RiWhatsappFill,
} from "@remixicon/react";

/**
 * Sharing a post off-platform (owner 2026-09-03: "not just copy").
 *
 * `sharePost` prefers the OS share sheet — on phones that is every app the
 * person has, which beats any menu we could draw. Where the API is missing
 * (desktop Chrome/Firefox), the caller opens `ShareMenu`: the big four via
 * their share intents, plus copy. A dismissed native sheet (AbortError) is
 * a choice, not an error — no toast, no fallback.
 */
export async function sharePost({
	url,
	text,
}: {
	url: string;
	text?: string;
}): Promise<"shared" | "unsupported"> {
	if (typeof navigator !== "undefined" && "share" in navigator) {
		try {
			await navigator.share({ url, text: text || undefined });
			return "shared";
		} catch (err) {
			if ((err as DOMException)?.name === "AbortError") return "shared";
			// NotAllowedError etc — fall through to the menu.
			return "unsupported";
		}
	}
	return "unsupported";
}

const TARGETS = [
	{
		key: "x",
		label: "X",
		Icon: RiTwitterXFill,
		href: (url: string, text: string) =>
			`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
	},
	{
		key: "whatsapp",
		label: "WhatsApp",
		Icon: RiWhatsappFill,
		href: (url: string, text: string) =>
			`https://wa.me/?text=${encodeURIComponent(text ? `${text} ${url}` : url)}`,
	},
	{
		key: "telegram",
		label: "Telegram",
		Icon: RiTelegram2Fill,
		href: (url: string, text: string) =>
			`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
	},
	{
		key: "facebook",
		label: "Facebook",
		Icon: RiFacebookCircleFill,
		href: (url: string) =>
			`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
	},
];

export function ShareMenu({
	url,
	text,
	onCopy,
	onClose,
}: {
	url: string;
	text?: string;
	onCopy: () => void;
	onClose: () => void;
}) {
	const shareText = (text ?? "").trim().slice(0, 120);
	return (
		<>
			{/* Click-away catcher, no dim: a popover is not a modal. */}
			<button
				type="button"
				aria-hidden
				tabIndex={-1}
				onClick={(e) => {
					e.stopPropagation();
					onClose();
				}}
				className="fixed inset-0 z-dropdown cursor-default"
			/>
			<div
				role="menu"
				aria-label="Share this post"
				className="absolute bottom-11 right-0 z-dropdown w-44 overflow-hidden rounded-xl card-depth py-1 animate-rise"
				onClick={(e) => e.stopPropagation()}
			>
				{TARGETS.map((tgt) => (
					<a
						key={tgt.key}
						role="menuitem"
						href={tgt.href(url, shareText)}
						target="_blank"
						rel="noopener noreferrer"
						onClick={onClose}
						className="flex w-full cursor-pointer items-center gap-2.5 px-3.5 py-2.5 font-sans text-sm font-medium text-primary transition-colors hover:bg-raised"
					>
						<tgt.Icon size={17} className="shrink-0 text-muted" />
						{tgt.label}
					</a>
				))}
				<button
					type="button"
					role="menuitem"
					onClick={() => {
						onCopy();
						onClose();
					}}
					className="flex w-full cursor-pointer items-center gap-2.5 border-t border-hairline px-3.5 py-2.5 text-left font-sans text-sm font-medium text-primary transition-colors hover:bg-raised"
				>
					<RiLinkM size={17} className="shrink-0 text-muted" />
					Copy link
				</button>
			</div>
		</>
	);
}
