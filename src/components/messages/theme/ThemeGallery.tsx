"use client";

import clsx from "clsx";
import { AnimatePresence } from "framer-motion";
import { useState } from "react";
import { Tabs } from "@/components/ui/Tabs";
import {
	OverlayHeader,
	OverlayPanel,
	OverlayScrim,
	useOverlayDismiss,
} from "@/components/ui/Overlay";
import {
	type ChatTheme,
	THEME_CARDS,
	type ThemeMode,
	type ThemeScope,
	sameTheme,
} from "./chatTheme";
import { ThemePreview } from "./ThemePreview";

/**
 * The main entry (owner 2026-09-10: cards first, Advanced behind): a
 * gallery of finished wallpaper + bubble pairings, one tap each, applied
 * to this chat or to all chats. "Advanced" opens the studio for people
 * who want to change one thing or bring their own photo.
 */
export function ThemeGallery({
	mode,
	current,
	isGroup,
	saving,
	onClose,
	onApply,
	onAdvanced,
	onReset,
}: {
	mode: ThemeMode;
	current: ChatTheme;
	isGroup: boolean;
	saving: boolean;
	onClose: () => void;
	onApply: (theme: ChatTheme, scope: ThemeScope) => void;
	onAdvanced: (scope: ThemeScope) => void;
	onReset: (scope: ThemeScope) => void;
}) {
	const [scope, setScope] = useState<ThemeScope>("chat");
	useOverlayDismiss(true, onClose);

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
					<div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
						{THEME_CARDS.map((card) => {
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
										on ? "bg-brand/12" : "hover:bg-raised",
									)}
								>
									<ThemePreview
										theme={t}
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
							className="h-10 cursor-pointer rounded-pill border border-hairline px-4 font-sans text-[calc(13px*var(--ws-fs))] font-semibold text-primary transition-colors hover:bg-raised"
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
