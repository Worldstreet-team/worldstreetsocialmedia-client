"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Loader2 } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import {
	OverlayHeader,
	OverlayPanel,
	OverlayScrim,
	useOverlayDismiss,
} from "@/components/ui/Overlay";
import { SafeAvatar } from "@/components/ui/SafeAvatar";
import { compressImage } from "@/lib/image-compress";
import { collapse, pop, swap } from "@/lib/motion-presets";
import { postJsonDirect, sendFormDirect } from "@/lib/upload-direct";
import {
	type AddOutcome,
	groupOutcomes,
	OUTCOME_WORDS,
	PeoplePicker,
	type PickedPerson,
	personName,
} from "./PeoplePicker";

/**
 * Create a group (register 109; audit G168, G169, G175). Name, an
 * optional photo and description, and people found anywhere, not only the
 * first hundred you follow. Consent is the gateway's: each pick is added
 * or invited by their own "who can add me" setting, and the answer says
 * exactly what happened to whom before the room opens.
 */
export function GroupCreateModal({
	isOpen,
	onClose,
	currentUserId,
	onCreated,
}: {
	isOpen: boolean;
	onClose: () => void;
	/** Clerk userId, for the relations endpoint. */
	currentUserId: string;
	onCreated: (conversationId: string) => void;
}) {
	const [selected, setSelected] = useState<Record<string, PickedPerson>>({});
	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const [describing, setDescribing] = useState(false);
	const [photo, setPhoto] = useState<{ key: string; preview: string } | null>(null);
	const [photoBusy, setPhotoBusy] = useState(false);
	const [creating, setCreating] = useState(false);
	const [done, setDone] = useState<{
		id: string;
		outcome: { status: AddOutcome; names: string[] }[];
	} | null>(null);
	/** The gateway refused to create because nobody could be added: why,
	 *  per person, above the button, until the picks change. */
	const [refusal, setRefusal] = useState<{ status: AddOutcome; names: string[] }[]>([]);
	const photoInputRef = useRef<HTMLInputElement | null>(null);
	// One key per open: a retried create finds the group it already made.
	const clientKeyRef = useRef<string>("");

	useEffect(() => {
		if (!isOpen) {
			setSelected({});
			setName("");
			setDescription("");
			setDescribing(false);
			setPhoto(null);
			setDone(null);
			clientKeyRef.current = "";
			return;
		}
		clientKeyRef.current = crypto.randomUUID();
	}, [isOpen]);

	useOverlayDismiss(isOpen, onClose);

	const selectedList = Object.values(selected);
	const canCreate = name.trim().length > 0 && selectedList.length >= 1;

	const toggle = (u: PickedPerson) => {
		setRefusal([]);
		setSelected((prev) => {
			const next = { ...prev };
			if (next[u._id]) delete next[u._id];
			else next[u._id] = u;
			return next;
		});
	};

	/** The photo goes up first, direct (files never ride a server action);
	 *  the create carries the returned key. */
	const pickPhoto = async (file: File) => {
		setPhotoBusy(true);
		try {
			const small = await compressImage(file, {
				maxEdge: 512,
				quality: 0.85,
				skipUnderBytes: 40 * 1024,
			});
			const fd = new FormData();
			fd.append("file", small);
			const up = await sendFormDirect("/api/messages/upload", fd);
			if (!up.success) {
				toast.error(up.message || "Couldn't upload the photo");
				return;
			}
			setPhoto({
				key: up.data?.key ?? up.data?.url,
				preview: URL.createObjectURL(small),
			});
		} finally {
			setPhotoBusy(false);
		}
	};

	const create = async () => {
		if (!canCreate || creating) return;
		setCreating(true);
		try {
			const res = await postJsonDirect("/api/messages/groups", {
				name: name.trim(),
				description: description.trim() || undefined,
				avatar: photo?.key,
				memberIds: selectedList.map((u) => u._id),
				clientKey: clientKeyRef.current,
			});
			if (!res.success || !res.data?._id) {
				const refused = (res.data?.results ?? []) as { id: string; status: AddOutcome }[];
				if (refused.length)
					setRefusal(groupOutcomes(refused, (id) => (selected[id] ? personName(selected[id]) : "Someone")));
				else toast.error(res.message || "Couldn't create the group");
				return;
			}
			const results = (res.data.results ?? []) as { id: string; status: AddOutcome }[];
			const everyoneIn = results.length > 0 && results.every((r) => r.status === "added");
			if (everyoneIn || results.length === 0) {
				onCreated(res.data._id);
				onClose();
				return;
			}
			// Someone was invited, or left out: say so before opening the
			// room, so nobody wonders where a friend went.
			setDone({
				id: res.data._id,
				outcome: groupOutcomes(results, (id) => (selected[id] ? personName(selected[id]) : "Someone")),
			});
		} finally {
			setCreating(false);
		}
	};

	return (
		<AnimatePresence>
			{isOpen && (
				<>
					<OverlayScrim onClose={onClose} />
					<OverlayPanel dragClose={onClose} variant="sheet" label="New group">
						<OverlayHeader title={done ? "Group created" : "New group"} onClose={onClose} />

						<AnimatePresence mode="wait" initial={false}>
							{done ? (
								<motion.div key="done" {...swap} className="flex min-h-0 flex-1 flex-col">
									<div className="min-h-0 flex-1 overflow-y-auto px-4 py-2">
										{done.outcome.map((g) => (
											<div key={g.status} className="py-2">
												<p className="font-sans text-[calc(13px*var(--ws-fs))] font-semibold text-primary">
													{OUTCOME_WORDS[g.status].title}
													<span className="ml-1.5 font-normal tabular-nums text-subtle">{g.names.length}</span>
												</p>
												<p className="font-sans text-[calc(14px*var(--ws-fs))] text-primary">
													{g.names.join(", ")}
												</p>
												{OUTCOME_WORDS[g.status].note && (
													<p className="mt-0.5 font-sans text-[calc(12.5px*var(--ws-fs))] text-muted">
														{OUTCOME_WORDS[g.status].note}
													</p>
												)}
											</div>
										))}
									</div>
									<div className="shrink-0 border-t border-hairline p-3">
										<button
											type="button"
											onClick={() => {
												onCreated(done.id);
												onClose();
											}}
											className="flex h-11 w-full cursor-pointer items-center justify-center rounded-pill bg-brand font-sans text-[calc(14px*var(--ws-fs))] font-semibold text-brand-on transition-colors hover:bg-brand-active"
										>
											Open group
										</button>
									</div>
								</motion.div>
							) : (
								<motion.div key="compose" {...swap} className="flex min-h-0 flex-1 flex-col">
									<div className="shrink-0 space-y-3 px-4 pb-2 pt-1">
										<div className="flex items-center gap-3">
											<button
												type="button"
												onClick={() => photoInputRef.current?.click()}
												disabled={photoBusy}
												aria-label="Group photo"
												className="relative flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-pill bg-raised text-muted transition-colors hover:bg-primary/10 disabled:opacity-60"
											>
												{photo ? (
													<SafeAvatar src={photo.preview} eager />
												) : photoBusy ? (
													<Loader2 className="h-4 w-4 animate-spin" />
												) : (
													<Camera className="h-5 w-5" />
												)}
											</button>
											<input
												ref={photoInputRef}
												type="file"
												accept="image/*"
												className="hidden"
												onChange={(e) => {
													const f = e.target.files?.[0];
													if (f) void pickPhoto(f);
													if (photoInputRef.current) photoInputRef.current.value = "";
												}}
											/>
											<input
												value={name}
												onChange={(e) => setName(e.target.value)}
												placeholder="Group name"
												maxLength={80}
												autoFocus
												className="min-w-0 flex-1 rounded-pill bg-primary/5 px-4 py-2.5 text-base text-primary outline-none transition-colors placeholder:text-subtle focus:bg-primary/10 sm:text-sm"
											/>
										</div>

										<AnimatePresence initial={false}>
											{describing ? (
												<motion.div key="desc" {...collapse} className="!mb-0 overflow-hidden">
													<textarea
														value={description}
														onChange={(e) => setDescription(e.target.value)}
														placeholder="What is this group about?"
														maxLength={500}
														rows={2}
														autoFocus
														className="w-full resize-none rounded-[10px] bg-primary/5 px-4 py-2.5 text-base text-primary outline-none transition-colors placeholder:text-subtle focus:bg-primary/10 sm:text-sm"
													/>
												</motion.div>
											) : (
												<motion.button
													key="desc-btn"
													{...collapse}
													type="button"
													onClick={() => setDescribing(true)}
													className="!mb-0 block cursor-pointer font-sans text-[calc(13px*var(--ws-fs))] text-muted transition-colors hover:text-primary"
												>
													Add a description
												</motion.button>
											)}
										</AnimatePresence>

										{/* The shelf opens for the first pick and folds for the
										    last; each pick after that lands as a chip. */}
										<AnimatePresence initial={false}>
											{selectedList.length > 0 && (
												<motion.div key="picked" {...collapse} className="!mb-0 overflow-hidden">
													<div className="flex flex-wrap gap-1.5 pb-1">
														<AnimatePresence initial={false}>
															{selectedList.map((u) => (
																<motion.button
																	key={u._id}
																	{...pop}
																	type="button"
																	onClick={() => toggle(u)}
																	className="flex cursor-pointer items-center gap-1.5 rounded-pill bg-primary/5 py-1 pl-1 pr-2.5 font-sans text-[calc(12.5px*var(--ws-fs))] text-primary transition-colors hover:bg-primary/10"
																>
																	<span className="relative h-6 w-6 overflow-hidden rounded-pill bg-raised">
																		<SafeAvatar src={u.avatar} eager />
																	</span>
																	{u.firstName || u.username}
																	<span className="text-subtle">×</span>
																</motion.button>
															))}
														</AnimatePresence>
													</div>
												</motion.div>
											)}
										</AnimatePresence>
									</div>

									<PeoplePicker
										myClerkId={currentUserId}
										selected={selected}
										onToggle={toggle}
										placeholder="Search anyone"
									/>

									<div className="shrink-0 border-t border-hairline p-3">
										{refusal.length > 0 && (
											<div className="mb-2 space-y-1">
												{refusal.map((g) => (
													<p key={g.status} className="font-sans text-[calc(12.5px*var(--ws-fs))] text-muted">
														<span className="font-semibold text-primary">{OUTCOME_WORDS[g.status].title}:</span>{" "}
														{g.names.join(", ")}
														{OUTCOME_WORDS[g.status].note ? `. ${OUTCOME_WORDS[g.status].note}` : ""}
													</p>
												))}
											</div>
										)}
										<button
											type="button"
											onClick={create}
											disabled={!canCreate || creating}
											className="flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-pill bg-brand font-sans text-[calc(14px*var(--ws-fs))] font-semibold text-brand-on transition-colors hover:bg-brand-active disabled:opacity-50"
										>
											{creating && <Loader2 className="h-4 w-4 animate-spin" />}
											{selectedList.length > 0 ? (
												<span className="relative">
													{"Create group · "}
													<AnimatePresence mode="popLayout" initial={false}>
														<motion.span
															key={selectedList.length}
															{...swap}
															className="inline-block tabular-nums"
														>
															{selectedList.length}
														</motion.span>
													</AnimatePresence>
												</span>
											) : (
												"Create group"
											)}
										</button>
										<p className="mt-2 text-center font-sans text-[calc(12px*var(--ws-fs))] text-subtle">
											People who limit who can add them get an invite instead.
										</p>
									</div>
								</motion.div>
							)}
						</AnimatePresence>
					</OverlayPanel>
				</>
			)}
		</AnimatePresence>
	);
}
