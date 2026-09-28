"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
	OverlayHeader,
	OverlayPanel,
	OverlayScrim,
	useOverlayDismiss,
} from "@/components/ui/Overlay";
import { patchJsonDirect } from "@/lib/upload-direct";

/**
 * Edit a message (audit G90): your own text, within fifteen minutes of
 * sending. The gateway marks it edited and tells the room; the caller
 * patches its own copy from the answer.
 */
export function EditMessageSheet({
	open,
	onClose,
	messageId,
	initial,
	onSaved,
}: {
	open: boolean;
	onClose: () => void;
	messageId: string | null;
	initial: string;
	onSaved: (messageId: string, content: string, editedAt: string) => void;
}) {
	const [text, setText] = useState(initial);
	const [busy, setBusy] = useState(false);
	useOverlayDismiss(open, onClose);
	useEffect(() => {
		if (open) setText(initial);
	}, [open, initial]);

	const save = async () => {
		const content = text.trim();
		if (!messageId || !content || content === initial.trim() || busy) return;
		setBusy(true);
		const res = await patchJsonDirect(`/api/messages/message/${messageId}`, { content });
		setBusy(false);
		if (!res.success) {
			toast.error(res.message || "Couldn't edit that");
			return;
		}
		onSaved(messageId, content, res.data?.editedAt ?? new Date().toISOString());
		onClose();
	};

	return (
		<AnimatePresence>
			{open && (
				<>
					<OverlayScrim onClose={onClose} />
					<OverlayPanel
						dragClose={onClose}
						variant="sheet"
						ground="none"
						className="bg-surface sm:w-[min(520px,94vw)]"
						label="Edit message"
					>
						<OverlayHeader title="Edit message" onClose={onClose} />
						<div className="px-4 pb-2">
							<textarea
								value={text}
								onChange={(e) => setText(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void save();
								}}
								maxLength={4000}
								rows={4}
								autoFocus
								className="w-full resize-none rounded-[10px] bg-primary/5 px-4 py-3 font-sans text-[calc(15px*var(--ws-fs))] text-primary outline-none focus:bg-primary/10"
							/>
							<p className="mt-1 font-sans text-[calc(12px*var(--ws-fs))] text-subtle">
								Everyone sees the new text, marked as edited.
							</p>
						</div>
						<div className="shrink-0 border-t border-hairline p-3">
							<button
								type="button"
								onClick={() => void save()}
								disabled={busy || !text.trim() || text.trim() === initial.trim()}
								className="flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-pill bg-brand font-sans text-[calc(14px*var(--ws-fs))] font-semibold text-brand-on disabled:opacity-50"
							>
								{busy && <Loader2 className="h-4 w-4 animate-spin" />}
								Save
							</button>
						</div>
					</OverlayPanel>
				</>
			)}
		</AnimatePresence>
	);
}
