"use client";

import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { ImagePlus } from "lucide-react";
import { useAuth } from "@clerk/nextjs";
import { staggerItem, staggerParent } from "@/lib/motion-presets";
import { useState } from "react";
import { Tabs } from "@/components/ui/Tabs";
import { useToast } from "@/components/ui/Toast/ToastContext";
import {
	OverlayHeader,
	OverlayPanel,
	OverlayScrim,
	useOverlayDismiss,
} from "@/components/ui/Overlay";
import {
	CARD_GROUPS,
	type ChatTheme,
	THEME_CARDS,
	type ThemeMode,
	type ThemeScope,
	sameTheme,
} from "./chatTheme";
import { ThemePreview } from "./ThemePreview";
import { sampleImage, themeFromSample } from "./imageTheme";
import { uploadWallpaperImage } from "./themeApi";

/**
 * The main entry (owner 2026-09-10: cards first, Advanced behind): a
 * gallery of finished wallpaper + bubble pairings, one tap each, applied
 * to this chat or to all chats. "Advanced" opens the studio for people
 * who want to change one thing or bring their own photo.
 *
 * "Your picture" (owner 2026-09-25) sits first on the Photographs shelf:
 * pick any picture and a whole theme is read out of it (imageTheme.ts),
 * then the studio opens on that draft so the person sees it on the stage
 * before saving.
 */
export function ThemeGallery({
	mode,
	current,
	isGroup,
	saving,
	conversationId,
	onClose,
	onApply,
	onAdvanced,
	onReset,
	onDerived,
}: {
	mode: ThemeMode;
	current: ChatTheme;
	isGroup: boolean;
	saving: boolean;
	conversationId: string;
	onClose: () => void;
	onApply: (theme: ChatTheme, scope: ThemeScope) => void;
	onAdvanced: (scope: ThemeScope) => void;
	onReset: (scope: ThemeScope) => void;
	/** A theme read out of the person's own picture, ready for the studio. */
	onDerived: (theme: ChatTheme, scope: ThemeScope) => void;
}) {
	const [scope, setScope] = useState<ThemeScope>("chat");
	const [deriving, setDeriving] = useState(false);
	const { getToken } = useAuth();
	const { toast } = useToast();
	useOverlayDismiss(true, onClose);

	const pickPicture = () => {
		const input = document.createElement("input");
		input.type = "file";
		input.accept = "image/*";
		input.onchange = async () => {
			const file = input.files?.[0];
			if (!file) return;
			setDeriving(true);
			try {
				// Sampled from the file (the served copy would taint a canvas),
				// uploaded once, and the theme built from both.
				const [sample, up] = await Promise.all([
					sampleImage(file),
					uploadWallpaperImage(getToken, file, conversationId),
				]);
				onDerived(
					themeFromSample(sample, { type: "image", imageKey: up.key, imageUrl: up.url }),
					scope,
				);
			} catch {
				toast("Couldn't read that picture", { type: "error" });
			} finally {
				setDeriving(false);
			}
		};
		input.click();
	};

	return (
		<AnimatePresence>
			<OverlayScrim key="theme-scrim" onClose={onClose} label="Close" />
			<OverlayPanel
				key="theme-panel"
				// Sheet, not anchored: six cards need the width, and the
				// right-corner popover ran off the edge of the pane.
				variant="sheet"
				ground="none"
				className="bg-surface sm:w-[min(720px,94vw)] sm:max-h-[82vh]"
				label="Chat theme"
				dragClose={onClose}
			>
				<OverlayHeader title="Chat theme" onClose={onClose} />
				<div className="flex flex-col gap-4 overflow-y-auto px-4 pb-[calc(16px+var(--ws-safe-bottom))]">
					<ScopeSwitch scope={scope} onChange={setScope} isGroup={isGroup} />
					{/* Three shelves (22 cards is too many for one unlabelled grid):
					    colour, the drawn set, then photographs. They cascade in as
					    shelves, not as 22 tiles: a whole cascade fits in 300ms. */}
					<motion.div
						variants={staggerParent}
						initial="hidden"
						animate="show"
						className="flex flex-col gap-4"
					>
						{CARD_GROUPS.map((g) => (
							<motion.section key={g.id} variants={staggerItem}>
								<p className="mb-2 px-1 font-sans text-[calc(13px*var(--ws-fs))] font-semibold text-primary">
									{g.label}
								</p>
								<div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
									{g.id === "photo" && (
										<button
											type="button"
											disabled={saving || deriving}
											onClick={pickPicture}
											title="Pick a picture; its colours become the theme"
											className="group flex cursor-pointer flex-col gap-1.5 rounded-xl p-1 text-left transition-colors hover:bg-primary/5 disabled:cursor-default"
										>
											<span className="flex aspect-[9/13] w-full flex-col items-center justify-center gap-1.5 rounded-[10px] border border-dashed border-hairline px-2 text-center text-muted transition-colors group-hover:text-primary">
												<ImagePlus className="h-5 w-5" />
												<span className="font-sans text-[calc(11px*var(--ws-fs))] leading-tight">
													{deriving ? "Reading the picture…" : "Colours read from the picture"}
												</span>
											</span>
											<span className="px-1 font-sans text-[calc(12.5px*var(--ws-fs))] font-medium text-primary">
												Your picture
											</span>
										</button>
									)}
									{THEME_CARDS.filter((card) => card.group === g.id).map((card) => {
									const t = card[mode];
									const on = sameTheme(t, current);
									return (
										<button
											key={card.id}
											type="button"
											disabled={saving}
											title={card.blurb}
											onClick={() => onApply(t, scope)}
											className={clsx(
												"group flex cursor-pointer flex-col gap-1.5 rounded-xl p-1 text-left transition-colors",
												on ? "bg-brand/12" : "hover:bg-primary/5",
											)}
										>
											<ThemePreview
												theme={t}
												mode={mode}
												frame="card"
												compact
												className={clsx(on && "outline outline-2 outline-brand")}
											/>
											<span
												className={clsx(
													"px-1 font-sans text-[calc(12.5px*var(--ws-fs))] font-medium",
													on ? "text-brand" : "text-primary",
												)}
											>
												{card.label}
											</span>
										</button>
									);
								})}
								</div>
							</motion.section>
						))}
					</motion.div>
					<div className="flex items-center justify-between gap-3 pt-1">
						<button
							type="button"
							onClick={() => onReset(scope)}
							disabled={saving}
							className="cursor-pointer font-sans text-[calc(13px*var(--ws-fs))] text-muted transition-colors hover:text-primary"
						>
							Reset to default
						</button>
						<button
							type="button"
							onClick={() => onAdvanced(scope)}
							className="h-10 cursor-pointer rounded-pill border border-hairline px-4 font-sans text-[calc(13px*var(--ws-fs))] font-semibold text-primary transition-colors hover:bg-primary/5"
						>
							Advanced
						</button>
					</div>
				</div>
			</OverlayPanel>
		</AnimatePresence>
	);
}

/** This chat / All chats, on the house Tabs. A group has no "this chat" ambiguity, same control. */
export function ScopeSwitch({
	scope,
	onChange,
	isGroup,
}: {
	scope: ThemeScope;
	onChange: (s: ThemeScope) => void;
	isGroup: boolean;
}) {
	return (
		<Tabs<ThemeScope>
			ariaLabel="Apply to"
			value={scope}
			onChange={onChange}
			className="px-0 py-0"
			items={[
				{ key: "chat", label: isGroup ? "This group" : "This chat" },
				{ key: "all", label: "All chats" },
			]}
		/>
	);
}
