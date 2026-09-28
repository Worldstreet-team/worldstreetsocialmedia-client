"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus, X } from "@/components/ui/icons";
import { AnimatePresence } from "framer-motion";
import { SelectRow, ToggleRow } from "@/components/settings/inspector";
import {
	OverlayHeader,
	OverlayPanel,
	OverlayScrim,
	useOverlayDismiss,
} from "@/components/ui/Overlay";

export interface PollDraft {
	question: string;
	options: string[];
	multi?: boolean;
	anonymous?: boolean;
	endsAt?: string;
}

const END_SPANS: Record<string, number> = {
	"1h": 3600_000,
	"24h": 24 * 3600_000,
	"7d": 7 * 24 * 3600_000,
};

/**
 * Write a poll (audit G89): a question, two to twelve options, single or
 * multiple choice, voters shown or hidden, an optional end.
 */
export function PollComposer({
	open,
	onClose,
	onSubmit,
}: {
	open: boolean;
	onClose: () => void;
	onSubmit: (draft: PollDraft) => Promise<boolean>;
}) {
	const [question, setQuestion] = useState("");
	const [options, setOptions] = useState<string[]>(["", ""]);
	const [multi, setMulti] = useState(false);
	const [anonymous, setAnonymous] = useState(false);
	const [ends, setEnds] = useState<"none" | "1h" | "24h" | "7d">("none");
	const [busy, setBusy] = useState(false);
	useOverlayDismiss(open, onClose);

	useEffect(() => {
		if (!open) {
			setQuestion("");
			setOptions(["", ""]);
			setMulti(false);
			setAnonymous(false);
			setEnds("none");
		}
	}, [open]);

	const clean = options.map((o) => o.trim()).filter(Boolean);
	const ok = question.trim().length > 0 && clean.length >= 2 && new Set(clean).size === clean.length;

	const submit = async () => {
		if (!ok || busy) return;
		setBusy(true);
		try {
			const done = await onSubmit({
				question: question.trim(),
				options: clean,
				multi: multi || undefined,
				anonymous: anonymous || undefined,
				endsAt: ends === "none" ? undefined : new Date(Date.now() + END_SPANS[ends]).toISOString(),
			});
			if (done) onClose();
		} finally {
			setBusy(false);
		}
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
						className="bg-surface sm:w-[min(520px,94vw)] sm:max-h-[86vh]"
						label="New poll"
					>
						<OverlayHeader title="New poll" onClose={onClose} />
						<div className="min-h-0 flex-1 overflow-y-auto px-5 pb-2">
							<input
								value={question}
								onChange={(e) => setQuestion(e.target.value)}
								maxLength={300}
								autoFocus
								placeholder="Ask something"
								className="mb-3 w-full rounded-[10px] bg-primary/5 px-4 py-3 font-sans text-[calc(15px*var(--ws-fs))] font-medium text-primary outline-none placeholder:text-subtle focus:bg-primary/10"
							/>
							<div className="flex flex-col gap-1.5">
								{options.map((o, i) => (
									<div key={i} className="flex items-center gap-1.5">
										<input
											value={o}
											onChange={(e) =>
												setOptions((prev) => prev.map((x, j) => (j === i ? e.target.value : x)))
											}
											maxLength={100}
											placeholder={`Option ${i + 1}`}
											className="min-w-0 flex-1 rounded-pill bg-primary/5 px-4 py-2.5 font-sans text-[calc(14px*var(--ws-fs))] text-primary outline-none placeholder:text-subtle focus:bg-primary/10"
										/>
										{options.length > 2 && (
											<button
												type="button"
												onClick={() => setOptions((prev) => prev.filter((_, j) => j !== i))}
												aria-label="Remove option"
												className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-pill text-muted hover:bg-primary/5 hover:text-primary"
											>
												<X className="h-4 w-4" />
											</button>
										)}
									</div>
								))}
							</div>
							{options.length < 12 && (
								<button
									type="button"
									onClick={() => setOptions((prev) => [...prev, ""])}
									className="mt-2 flex h-10 cursor-pointer items-center gap-1.5 rounded-pill px-3 font-sans text-[calc(13px*var(--ws-fs))] font-medium text-muted hover:bg-primary/5 hover:text-primary"
								>
									<Plus className="h-4 w-4" />
									Add an option
								</button>
							)}
							<div className="mt-3 flex flex-col [&>*:last-child]:border-b-0">
								<ToggleRow label="Pick more than one" checked={multi} onChange={setMulti} />
								<ToggleRow
									label="Anonymous"
									hint="Counts show; who voted does not."
									checked={anonymous}
									onChange={setAnonymous}
								/>
								<SelectRow
									label="Ends"
									value={ends}
									options={[
										["none", "Never"],
										["1h", "In an hour"],
										["24h", "In a day"],
										["7d", "In a week"],
									] as const}
									onPick={setEnds}
								/>
							</div>
						</div>
						<div className="shrink-0 border-t border-hairline p-3">
							<button
								type="button"
								onClick={() => void submit()}
								disabled={!ok || busy}
								className="flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-pill bg-brand font-sans text-[calc(14px*var(--ws-fs))] font-semibold text-brand-on disabled:opacity-50"
							>
								{busy && <Loader2 className="h-4 w-4 animate-spin" />}
								Send poll
							</button>
						</div>
					</OverlayPanel>
				</>
			)}
		</AnimatePresence>
	);
}
