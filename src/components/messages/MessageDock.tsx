"use client";

import clsx from "clsx";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useAtom, useAtomValue } from "jotai";
import { ChatCircleDots, CaretDown } from "@phosphor-icons/react";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { ConversationList } from "@/components/messages/ConversationList";
import type { ConversationRow } from "@/components/messages/ConversationList";
import { useT } from "@/i18n/client";
import { getConversationsAction } from "@/lib/conversation.actions";
import { messageDockOpenAtom, onlineIdsAtom } from "@/store/ui.atom";
import { unreadMessagesCountAtom } from "@/store/messageCache";
import { userAtom } from "@/store/user.atom";

/**
 * Messages, without leaving the page.
 *
 * A tab that lives on the right edge; tapping it slides a panel up, and it
 * settles back down when focus leaves. Same glass grammar as every other
 * overlay, deliberately — this is a panel like any other, it just happens to
 * be summoned from a rail rather than a button.
 *
 * Two things it is NOT:
 *
 * It is not a modal. There is no scrim, and the page behind stays live and
 * scrollable, because the whole point is reading a message without losing
 * your place in the feed. That is also why blur closes it: a surface with no
 * scrim has no other honest dismissal.
 *
 * And it is not a second inbox. It renders the SAME `ConversationList` the
 * messages page does, so a row can never look one way here and another there
 * — the drift between an app's docked chat and its real inbox is exactly the
 * kind of thing nobody notices until a user reports one as broken.
 */
export function MessageDock() {
	const t = useT();
	const router = useRouter();
	const pathname = usePathname();
	const me = useAtomValue(userAtom);
	const online = useAtomValue(onlineIdsAtom);
	const unread = useAtomValue(unreadMessagesCountAtom);
	const [open, setOpen] = useAtom(messageDockOpenAtom);

	const panelRef = useRef<HTMLElement | null>(null);
	const [rows, setRows] = useState<ConversationRow[]>([]);
	const [loading, setLoading] = useState(false);
	const [query, setQuery] = useState("");
	const [loaded, setLoaded] = useState(false);

	const close = useCallback(() => setOpen(false), [setOpen]);

	// Fetched on first open, not on mount: the dock is on every page, and an
	// inbox request on every page load for a panel most people never open is
	// a request nobody asked for.
	useEffect(() => {
		if (!open || loaded) return;
		setLoading(true);
		void getConversationsAction()
			.then((res: any) => setRows(res?.data ?? []))
			.finally(() => {
				setLoading(false);
				setLoaded(true);
			});
	}, [open, loaded]);

	// Esc closes. No scroll lock — the page behind stays usable on purpose.
	//
	// The outside-pointerdown listener is what actually makes "sleeps back on
	// blur" true. `onBlur` alone only fires once something INSIDE has focus,
	// so a dock you opened and never typed in would never close on its own.
	useEffect(() => {
		if (!open) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") close();
		};
		const onDown = (e: PointerEvent) => {
			const el = panelRef.current;
			if (el && !el.contains(e.target as Node)) close();
		};
		window.addEventListener("keydown", onKey);
		// Deferred a frame: the click that OPENS the dock is still propagating
		// when this mounts, and would otherwise close it immediately.
		const id = window.setTimeout(
			() => document.addEventListener("pointerdown", onDown),
			0,
		);
		return () => {
			window.clearTimeout(id);
			window.removeEventListener("keydown", onKey);
			document.removeEventListener("pointerdown", onDown);
		};
	}, [open, close]);

	// Signed out, or already looking at the inbox, the dock is noise.
	if (!me?._id || pathname?.startsWith("/messages")) return null;

	const onlineCount = rows.filter((r) =>
		online.has(r.otherParticipant?._id),
	).length;

	return (
		<>
			{/* The rail. Hidden on phones, where the bottom nav already owns
			    messages and a floating tab would sit on top of it. */}
			<button
				type="button"
				onClick={() => setOpen((v) => !v)}
				aria-expanded={open}
				aria-label={t("nav.messages")}
				className={clsx(
					"fixed right-0 top-1/2 z-sticky hidden -translate-y-1/2 cursor-pointer items-center gap-2",
					"rounded-l-2xl bg-surface py-4 pl-3 pr-2.5 text-muted transition-colors hover:text-primary lg:flex",
					open && "pointer-events-none opacity-0",
				)}
				style={{ writingMode: "vertical-rl" }}
			>
				<ChatCircleDots size={18} weight="fill" className="rotate-90" />
				<span className="font-sans text-[12px] font-semibold tracking-wide">
					{t("nav.messages")}
				</span>
				{unread > 0 && (
					<span className="flex h-4 min-w-4 items-center justify-center rounded-pill bg-brand px-1 font-sans text-[10px] font-bold tabular-nums text-brand-on">
						{unread}
					</span>
				)}
			</button>

			<AnimatePresence>
				{open && (
					<motion.aside
						/* Rises from the bottom-right corner it is anchored to, the
						   same gesture as every anchored popover in the app. */
						initial={{ opacity: 0, y: 16, scale: 0.98 }}
						animate={{ opacity: 1, y: 0, scale: 1 }}
						exit={{ opacity: 0, y: 16, scale: 0.98 }}
						transition={{ duration: 0.26, ease: [0.2, 0, 0, 1] }}
						ref={panelRef}
						tabIndex={-1}
						style={{ transformOrigin: "bottom right" }}
						/* Closing on blur is the dismissal, since there is no scrim.
						   `relatedTarget === null` means focus left the document
						   entirely — switching tabs should not shut your messages. */
						onBlur={(e) => {
							if (
								e.relatedTarget &&
								!e.currentTarget.contains(e.relatedTarget as Node)
							) {
								close();
							}
						}}
						aria-label={t("nav.messages")}
						className={clsx(
							"glass-frost fixed bottom-4 right-4 z-dropdown hidden w-[360px] flex-col overflow-hidden",
							"max-h-[min(620px,78vh)] rounded-2xl backdrop-blur-2xl backdrop-saturate-150 lg:flex",
						)}
					>
						<div className="flex h-12 shrink-0 items-center gap-2 px-4">
							<h2 className="flex-1 truncate font-sans text-[14px] font-semibold text-primary">
								{t("nav.messages")}
								{onlineCount > 0 && (
									<span className="ml-2 inline-flex items-center gap-1 font-normal text-subtle">
										<span className="h-1.5 w-1.5 rounded-pill bg-success" />
										<span className="tabular-nums">{onlineCount}</span>
									</span>
								)}
							</h2>
							<Link
								href="/messages"
								onClick={close}
								className="rounded-pill px-2 py-1 font-sans text-[12px] font-medium text-muted transition-colors hover:text-primary"
							>
								{t("rail.showMore")}
							</Link>
							<button
								type="button"
								onClick={close}
								aria-label={t("common.close")}
								className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-pill bg-chip text-muted transition-colors hover:text-primary"
							>
								<CaretDown size={14} weight="bold" />
							</button>
						</div>

						<div className="shrink-0 px-4 pb-3">
							<input
								value={query}
								onChange={(e) => setQuery(e.target.value)}
								placeholder={t("messages.searchPlaceholder")}
								aria-label={t("messages.searchPlaceholder")}
								className="w-full rounded-pill bg-sunken px-4 py-2 font-sans text-[13px] text-primary outline-none transition-colors placeholder:text-subtle focus:bg-raised"
							/>
						</div>

						<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-2">
							<ConversationList
								conversations={rows}
								loading={loading}
								query={query}
								myProfileId={me._id}
								onOpen={(c) => {
									router.push(`/messages/${c._id}`);
									close();
								}}
							/>
						</div>
					</motion.aside>
				)}
			</AnimatePresence>
		</>
	);
}
