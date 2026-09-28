"use client";

import { useEffect, useState } from "react";
import { Phone, Video } from "@/components/ui/icons";
import { AnimatePresence, motion } from "framer-motion";
import { collapse } from "@/lib/motion-presets";

/**
 * A call is on in this group (audit G121, G174): who started it, how long
 * it has been going, and Join. It shows while the group carries a live
 * call and folds when call:ended lands.
 */
export function CallJoinBar({
	call,
	starterName,
	onJoin,
}: {
	call: { startedBy: string; startedAt: string; video: boolean } | null | undefined;
	starterName?: string;
	onJoin: (video: boolean) => void;
}) {
	const [now, setNow] = useState(Date.now());
	useEffect(() => {
		if (!call) return;
		const id = window.setInterval(() => setNow(Date.now()), 15_000);
		return () => window.clearInterval(id);
	}, [call]);
	const mins = call ? Math.max(0, Math.round((now - new Date(call.startedAt).getTime()) / 60_000)) : 0;
	return (
		<AnimatePresence initial={false}>
			{call && (
				<motion.div key="call" {...collapse} className="overflow-hidden">
					<div className="chat-chrome mx-2 mt-1 flex items-center gap-3 rounded-xl px-3 py-2">
						<span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-pill bg-success/15 text-success">
							{call.video ? <Video className="h-4 w-4" /> : <Phone className="h-4 w-4" />}
						</span>
						<span className="min-w-0 flex-1">
							<span className="block truncate font-sans text-[calc(13.5px*var(--ws-fs))] font-semibold text-primary">
								{call.video ? "Video call" : "Voice call"} in progress
							</span>
							<span className="block truncate font-sans text-[calc(12px*var(--ws-fs))] tabular-nums text-muted">
								{starterName ? `Started by ${starterName}` : "Started"}
								{mins > 0 ? ` · ${mins} min` : " · just now"}
							</span>
						</span>
						<button
							type="button"
							onClick={() => onJoin(call.video)}
							className="h-9 shrink-0 cursor-pointer rounded-pill bg-success px-4 font-sans text-[calc(13px*var(--ws-fs))] font-semibold text-page transition-opacity hover:opacity-90"
						>
							Join
						</button>
					</div>
				</motion.div>
			)}
		</AnimatePresence>
	);
}
