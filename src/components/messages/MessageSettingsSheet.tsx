"use client";

import { AnimatePresence } from "framer-motion";
import Link from "next/link";
import { usePreferences } from "@/components/providers/PreferencesProvider";
import { SelectRow, ToggleRow } from "@/components/settings/inspector";
import {
	OverlayHeader,
	OverlayPanel,
	OverlayScrim,
	useOverlayDismiss,
} from "@/components/ui/Overlay";
import type { Preferences } from "@/lib/preferences";

/**
 * Message settings, inside Messages (owner 2026-09-22: "let the settings
 * for the messages section be in the messages page too").
 *
 * Not a second settings page: the SAME preferences, through the same rows,
 * gathered by what someone in a chat is thinking about. In Settings these
 * live in three different sections (Data and feed, Safety, Display); here
 * they are one sheet in three short groups, in the order people reach for
 * them: how chats behave, voice notes, then who can reach you and what
 * they see. Anything that is not about messages stays out.
 *
 * Plain groups on the sheet's own surface, not the frosted SettingGroup:
 * the sheet is already the one blurred layer of this stack.
 */
export function MessageSettingsSheet({
	open,
	onClose,
}: {
	open: boolean;
	onClose: () => void;
}) {
	const { prefs, setPrefs } = usePreferences();
	const m = prefs.messaging;
	const p = prefs.privacy;
	useOverlayDismiss(open, onClose);

	return (
		<AnimatePresence>
			{open && (
				<>
					<OverlayScrim key="msg-settings-scrim" onClose={onClose} label="Close" />
					<OverlayPanel
						key="msg-settings-panel"
						variant="sheet"
						ground="none"
						className="bg-surface sm:w-[min(560px,94vw)] sm:max-h-[84vh]"
						label="Message settings"
						dragClose={onClose}
					>
						<OverlayHeader title="Message settings" onClose={onClose} />
						<div className="flex flex-col gap-6 overflow-y-auto px-5 pb-[calc(20px+var(--ws-safe-bottom))]">
							<Group title="Chats">
								<SelectRow
									label="What the Enter key does"
									hint="When it starts a new line, Ctrl or Cmd plus Enter sends."
									value={m.enterToSend}
									options={[
										["send", "Send the message"],
										["newline", "Start a new line"],
									]}
									onPick={(v) =>
										setPrefs({
											messaging: {
												enterToSend: v as Preferences["messaging"]["enterToSend"],
											},
										})
									}
								/>
								<SelectRow
									label="Message text size"
									hint="Chat is read at arm's length, so it can run larger than the rest of the app."
									value={prefs.a11y.chatTextScale}
									options={[
										["match", "Match app size"],
										[100, "100%"],
										[115, "115%"],
										[130, "130%"],
										[150, "150%"],
										[175, "175%"],
									]}
									onPick={(v) =>
										setPrefs({
											a11y: {
												chatTextScale: v as Preferences["a11y"]["chatTextScale"],
											},
										})
									}
								/>
								<ToggleRow
									label="Open a chat where you left off"
									hint="At your first unread message. Off opens at the newest."
									checked={m.openAtFirstUnread}
									onChange={(v) => setPrefs({ messaging: { openAtFirstUnread: v } })}
								/>
								<ToggleRow
									label="Stories above your chats"
									checked={m.inboxStories}
									onChange={(v) => setPrefs({ messaging: { inboxStories: v } })}
								/>
							</Group>

							<Group title="Voice notes">
								<SelectRow
									label="Playback speed"
									value={m.voiceSpeed}
									options={[
										[1, "1x"],
										[1.5, "1.5x"],
										[2, "2x"],
									]}
									onPick={(v) =>
										setPrefs({
											messaging: {
												voiceSpeed: v as Preferences["messaging"]["voiceSpeed"],
											},
										})
									}
								/>
								<ToggleRow
									label="Play them back to back"
									hint="The next voice note starts when one ends."
									checked={m.voiceAutoplayNext}
									onChange={(v) => setPrefs({ messaging: { voiceAutoplayNext: v } })}
								/>
							</Group>

							<Group title="Who reaches you, and what they see">
								<SelectRow
									label="Who can start a chat with you"
									hint="A stranger's first message waits in Requests. Allies only turns it away."
									value={p.dmFrom}
									options={[
										["everyone", "Anyone"],
										["allies", "Allies only"],
									]}
									onPick={(v) =>
										setPrefs({
											privacy: { dmFrom: v as Preferences["privacy"]["dmFrom"] },
										})
									}
								/>
								<ToggleRow
									label="Send read receipts"
									hint="Off both ways: you stop seeing theirs too."
									checked={p.readReceipts}
									onChange={(v) => setPrefs({ privacy: { readReceipts: v } })}
								/>
								<ToggleRow
									label="Show when I'm typing"
									hint="Off both ways."
									checked={p.typingIndicators}
									onChange={(v) => setPrefs({ privacy: { typingIndicators: v } })}
								/>
								<ToggleRow
									label="Show when I'm online"
									hint="Your green dot and last seen. Off hides other people's from you too."
									checked={p.showActivity}
									onChange={(v) => setPrefs({ privacy: { showActivity: v } })}
								/>
							</Group>

							<p className="font-sans text-[calc(13px*var(--ws-fs))] text-muted">
								A chat's colours and wallpaper are set from the palette button
								inside that chat.{" "}
								<Link
									href="/settings"
									onClick={onClose}
									className="font-semibold text-primary underline underline-offset-2"
								>
									All settings
								</Link>
							</p>
						</div>
					</OverlayPanel>
				</>
			)}
		</AnimatePresence>
	);
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
	return (
		<section>
			<h3 className="pb-2 font-display text-[calc(15px*var(--ws-fs))] font-semibold tracking-tight text-primary">
				{title}
			</h3>
			<div className="flex flex-col [&>*:last-child]:border-b-0">{children}</div>
		</section>
	);
}
