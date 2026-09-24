"use client";

import { useEffect, useMemo, useState } from "react";
import { Pin, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useGatewayRead } from "@/hooks/useGateway";
import { collapse, swap } from "@/lib/motion-presets";

interface PinnedRow {
	message: {
		_id: string;
		content?: string;
		type?: string;
		sender?: { firstName?: string; username?: string } | string;
		poll?: { question?: string };
	};
	by?: string;
	at?: string;
	until?: string;
}

/** What a pinned row says in one line. */
function pinPreview(m: PinnedRow["message"]): string {
	if (m.type === "poll") return `Poll: ${m.poll?.question ?? ""}`;
	if (m.type === "image") return m.content ? m.content : "Photo";
	if (m.type === "video") return m.content ? m.content : "Video";
	if (m.type === "audio") return "Voice note";
	if (m.type === "contact") return "A contact";
	if (m.type === "group_invite") return "A group invite";
	return m.content ?? "";
}

/**
 * Pinned messages under the thread header (audit G88). Three at most;
 * tapping cycles through them and jumps to the one shown. Unpin sits at
 * the end when the reader may.
 */
export function PinsBar({
	conversationId,
	pinIds,
	canUnpin,
	onJump,
	onUnpin,
}: {
	conversationId: string;
	pinIds: string[];
	canUnpin: boolean;
	onJump: (messageId: string) => void;
	onUnpin: (messageId: string) => Promise<void> | void;
}) {
	const read = useGatewayRead();
	const [rows, setRows] = useState<PinnedRow[]>([]);
	const [index, setIndex] = useState(0);
	const key = pinIds.join(",");

	useEffect(() => {
		if (!pinIds.length) {
			setRows([]);
			return;
		}
		let cancelled = false;
		void (async () => {
			const res = await read(`/api/messages/conversations/${conversationId}/pins`, (b) => b);
			if (cancelled) return;
			setRows(res.success && Array.isArray(res.data) ? (res.data as PinnedRow[]) : []);
			setIndex(0);
		})();
		return () => {
			cancelled = true;
		};
		// pinIds changes identity every render; its joined key is the fact.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [conversationId, key, read]);

	const current = rows[index % Math.max(1, rows.length)];
	const sender = useMemo(() => {
		const s = current?.message.sender;
		return typeof s === "object" && s ? s.firstName || s.username || "" : "";
	}, [current]);

	return (
		<AnimatePresence initial={false}>
			{current && (
				<motion.div key="pins" {...collapse} className="overflow-hidden">
					<div className="chat-chrome mx-2 mt-1 flex items-center gap-2 rounded-xl px-2 py-1.5">
						<button
							type="button"
							onClick={() => {
								onJump(current.message._id);
								if (rows.length > 1) setIndex((i) => (i + 1) % rows.length);
							}}
							className="flex min-h-[36px] min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-[10px] px-1 text-left transition-colors hover:bg-primary/5"
						>
							<Pin className="h-4 w-4 shrink-0 text-gold" />
							<span className="min-w-0 flex-1">
								<span className="block font-sans text-[calc(11.5px*var(--ws-fs))] font-semibold text-muted">
									Pinned{rows.length > 1 ? ` ${index + 1} of ${rows.length}` : ""}
									{sender ? ` · ${sender}` : ""}
								</span>
								<AnimatePresence mode="wait" initial={false}>
									<motion.span
										key={current.message._id}
										{...swap}
										className="block truncate font-sans text-[calc(13px*var(--ws-fs))] text-primary"
									>
										{pinPreview(current.message)}
									</motion.span>
								</AnimatePresence>
							</span>
						</button>
						{canUnpin && (
							<button
								type="button"
								onClick={() => void onUnpin(current.message._id)}
								aria-label="Unpin"
								className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-pill text-muted transition-colors hover:bg-primary/5 hover:text-primary"
							>
								<X className="h-4 w-4" />
							</button>
						)}
					</div>
				</motion.div>
			)}
		</AnimatePresence>
	);
}
