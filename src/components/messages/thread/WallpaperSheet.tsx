"use client";

import axios from "axios";
import { AnimatePresence } from "framer-motion";
import { useState } from "react";
import { useAuth } from "@clerk/nextjs";
import {
	OverlayHeader,
	OverlayPanel,
	OverlayScrim,
	useOverlayDismiss,
} from "@/components/ui/Overlay";
import { useToast } from "@/components/ui/Toast/ToastContext";
import {
	DEFAULT_WALLPAPER,
	GRADIENTS,
	SOLIDS,
	type WallpaperSetting,
} from "./wallpaper";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

/** Downscale + re-encode (EXIF dies as a side effect) before upload. */
async function encodeWallpaper(file: File): Promise<Blob> {
	const bitmap = await createImageBitmap(file);
	const scale = Math.min(1, 1440 / Math.max(bitmap.width, bitmap.height));
	const w = Math.round(bitmap.width * scale);
	const h = Math.round(bitmap.height * scale);
	const canvas = document.createElement("canvas");
	canvas.width = w;
	canvas.height = h;
	canvas.getContext("2d")?.drawImage(bitmap, 0, 0, w, h);
	bitmap.close();
	return new Promise((resolve, reject) =>
		canvas.toBlob(
			(b) => (b ? resolve(b) : reject(new Error("encode failed"))),
			"image/jpeg",
			0.82,
		),
	);
}

/**
 * Register items 50-53: the per-thread appearance sheet. Everything here is
 * YOUR view of the thread only; the gateway stores it on your member record.
 */
export function WallpaperSheet({
	conversationId,
	current,
	onClose,
	onApplied,
}: {
	conversationId: string;
	current: WallpaperSetting;
	onClose: () => void;
	onApplied: (w: WallpaperSetting) => void;
}) {
	const { getToken } = useAuth();
	const { toast } = useToast();
	const [draft, setDraft] = useState<WallpaperSetting>(
		current ?? DEFAULT_WALLPAPER,
	);
	const [saving, setSaving] = useState(false);
	useOverlayDismiss(true, onClose);

	const save = async (w: WallpaperSetting) => {
		setSaving(true);
		try {
			const token = await getToken();
			const r = await axios.patch(
				`${API_URL}/api/messages/${conversationId}/wallpaper`,
				{ type: w.type, value: w.value, dim: w.dim ?? 0, blur: w.blur },
				{ headers: { Authorization: `Bearer ${token}` } },
			);
			onApplied({ ...w, ...r.data.wallpaper, valueUrl: w.valueUrl });
			toast("Wallpaper updated", { type: "success" });
			onClose();
		} catch {
			toast("Couldn't save the wallpaper", { type: "error" });
		} finally {
			setSaving(false);
		}
	};

	const pickImage = () => {
		const input = document.createElement("input");
		input.type = "file";
		input.accept = "image/*";
		input.onchange = async () => {
			const file = input.files?.[0];
			if (!file) return;
			setSaving(true);
			try {
				const blob = await encodeWallpaper(file);
				const fd = new FormData();
				fd.append("file", new File([blob], "wallpaper.jpg", { type: "image/jpeg" }));
				fd.append("conversationId", conversationId);
				const token = await getToken();
				const up = await axios.post(`${API_URL}/api/messages/upload`, fd, {
					headers: {
						Authorization: `Bearer ${token}`,
						"Content-Type": "multipart/form-data",
					},
				});
				const next: WallpaperSetting = {
					type: "image",
					value: up.data.key ?? up.data.url,
					valueUrl: up.data.url,
					dim: draft.dim ?? 24,
					blur: draft.blur ?? true,
				};
				setDraft(next);
				onApplied(next); // live preview behind the sheet
			} catch {
				toast("Couldn't upload that image", { type: "error" });
			} finally {
				setSaving(false);
			}
		};
		input.click();
	};

	const preview = (w: WallpaperSetting) => {
		setDraft(w);
		onApplied(w); // the thread behind the sheet IS the preview
	};

	const tile =
		"h-16 cursor-pointer rounded-[10px] transition-opacity hover:opacity-90";

	return (
		<AnimatePresence>
			<OverlayScrim key="wp-scrim" onClose={onClose} label="Close" />
			<OverlayPanel
				key="wp-panel"
				variant="sheet"
				label="Chat wallpaper"
				dragClose={onClose}
			>
				<OverlayHeader title="Chat wallpaper" onClose={onClose} />
				<div className="flex flex-col gap-4 overflow-y-auto px-4 pb-6">
					<div>
						<p className="mb-2 font-sans text-[12px] font-semibold uppercase tracking-wide text-subtle">
							Backgrounds
						</p>
						<div className="grid grid-cols-4 gap-2">
							<button
								type="button"
								aria-label="Default"
								onClick={() => preview({ type: "default", dim: 0 })}
								className={`${tile} border border-hairline bg-page`}
							/>
							{SOLIDS.map((sq) => (
								<button
									key={sq.id}
									type="button"
									aria-label={sq.label}
									onClick={() =>
										preview({ type: "solid", value: sq.color, dim: 0 })
									}
									className={tile}
									style={{ backgroundColor: sq.color }}
								/>
							))}
							{GRADIENTS.map((g) => (
								<button
									key={g.id}
									type="button"
									aria-label={g.label}
									onClick={() =>
										preview({ type: "gradient", value: g.id, dim: 0 })
									}
									className={tile}
									style={{
										backgroundImage: `linear-gradient(160deg, ${g.stops[0]}, ${g.stops[1]})`,
									}}
								/>
							))}
							<button
								type="button"
								onClick={pickImage}
								disabled={saving}
								className={`${tile} flex items-center justify-center border border-dashed border-hairline font-sans text-[12px] font-medium text-muted hover:text-primary`}
							>
								Upload
							</button>
						</div>
					</div>

					<div>
						<p className="mb-2 flex items-center justify-between font-sans text-[12px] font-semibold uppercase tracking-wide text-subtle">
							Dim
							<span className="tabular-nums text-muted">
								{draft.dim ?? 0}%
							</span>
						</p>
						<input
							type="range"
							min={0}
							max={70}
							step={5}
							value={draft.dim ?? 0}
							onChange={(e) =>
								preview({ ...draft, dim: Number(e.target.value) })
							}
							className="w-full accent-[var(--ws-brand-primary)]"
						/>
					</div>

					{draft.type === "image" && (
						<label className="flex cursor-pointer items-center justify-between font-sans text-[13.5px] text-primary">
							Blur the image
							<input
								type="checkbox"
								checked={draft.blur ?? true}
								onChange={(e) =>
									preview({ ...draft, blur: e.target.checked })
								}
								className="h-4 w-4 accent-[var(--ws-brand-primary)]"
							/>
						</label>
					)}

					<button
						type="button"
						disabled={saving}
						onClick={() => void save(draft)}
						className="h-11 cursor-pointer rounded-pill bg-brand font-sans text-[14px] font-semibold text-brand-on transition-colors hover:bg-brand-active disabled:opacity-50"
					>
						{saving ? "Saving…" : "Set wallpaper"}
					</button>
				</div>
			</OverlayPanel>
		</AnimatePresence>
	);
}
