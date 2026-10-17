"use client";

import { usePreferences } from "@/components/providers/PreferencesProvider";
import type { Preferences } from "@/lib/preferences";
import { Choice, Toggle } from "./SettingRows";

/**
 * Messages, one section (owner 2026-10-07). These were filed under three
 * drawers: Safety held who can message you, read receipts and typing; Data
 * & feed held the Enter key, voice notes and inbox stories; Notifications
 * held message pop-ups; Display held message text size. Same preferences,
 * gathered by what someone thinking about chat is looking for. The
 * in-Messages sheet (`MessageSettingsSheet`) carries the same rows, so a
 * new messaging preference still gets a row in BOTH places.
 */

/** Who can reach you. */
export function MessagesReach() {
	const { prefs, setPrefs } = usePreferences();
	const p = prefs.privacy;
	return (
		<div className="flex flex-col">
			<Choice
				label="Who can start a chat with you"
				hint="A stranger's first message waits on your Requests shelf. Allies only turns it away at the door."
				value={p.dmFrom}
				options={[
					["everyone", "Anyone"],
					["allies", "Allies only"],
				]}
				onPick={(v) =>
					setPrefs({ privacy: { dmFrom: v as Preferences["privacy"]["dmFrom"] } })
				}
			/>
			<Choice
				label="Who can add you to groups"
				hint="Anyone outside this sends you an invite instead, which waits on your Requests shelf for three days."
				value={p.groupAdd}
				options={[
					["everyone", "Anyone"],
					["following", "People you follow"],
					["allies", "Allies only"],
					["nobody", "Nobody, always ask"],
				]}
				onPick={(v) =>
					setPrefs({ privacy: { groupAdd: v as Preferences["privacy"]["groupAdd"] } })
				}
			/>
		</div>
	);
}

/** What the other person sees from you. Both are reciprocal. */
export function MessagesSeen() {
	const { prefs, setPrefs } = usePreferences();
	const p = prefs.privacy;
	return (
		<div className="flex flex-col">
			<Toggle
				label="Send read receipts"
				hint="The Seen mark under a message you have opened. Your own unread count still clears."
				tag="both"
				checked={p.readReceipts}
				onChange={(v) => setPrefs({ privacy: { readReceipts: v } })}
			/>
			<Toggle
				label="Show when I'm typing"
				hint="Whether people see “typing…” and “recording…” from you."
				tag="both"
				checked={p.typingIndicators}
				onChange={(v) => setPrefs({ privacy: { typingIndicators: v } })}
			/>
		</div>
	);
}

/** How a chat behaves for you. None of it changes what the other person sees. */
export function MessagesChat() {
	const { prefs, setPrefs } = usePreferences();
	const m = prefs.messaging;
	return (
		<div className="flex flex-col">
			<Choice
				label="What the Enter key does"
				hint="When it starts a new line, Ctrl or Cmd plus Enter sends."
				value={m.enterToSend}
				options={[
					["send", "Sends"],
					["newline", "New line"],
				]}
				onPick={(v) =>
					setPrefs({ messaging: { enterToSend: v as Preferences["messaging"]["enterToSend"] } })
				}
			/>
			<Toggle
				label="Open a chat where you left off"
				hint="On, a chat with unread messages opens at the first one you have not read. Off, it opens at the newest."
				checked={m.openAtFirstUnread}
				onChange={(v) => setPrefs({ messaging: { openAtFirstUnread: v } })}
			/>
			<Toggle
				label="Pop-ups for new messages"
				hint="A short banner when a message arrives while you are elsewhere in the app. The unread count still counts it either way."
				checked={prefs.notifications.messageAlerts}
				onChange={(v) => setPrefs({ notifications: { messageAlerts: v } })}
			/>
			<Choice
				label="Message text size"
				hint="Chat is read one-handed at arm's length, so it can run larger than the rest of the app."
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
					setPrefs({ a11y: { chatTextScale: v as Preferences["a11y"]["chatTextScale"] } })
				}
			/>
			<Toggle
				label="Stories above your chats"
				hint="The row of stories at the top of your chat list. It does not scroll away, so turn it off if you never use it."
				checked={m.inboxStories}
				onChange={(v) => setPrefs({ messaging: { inboxStories: v } })}
			/>
		</div>
	);
}

/** Voice notes. */
export function MessagesVoice() {
	const { prefs, setPrefs } = usePreferences();
	const m = prefs.messaging;
	return (
		<div className="flex flex-col">
			<Choice
				label="Voice note speed"
				hint="How fast a voice note plays when you press play. The speed button on a playing note still changes it for that one."
				value={m.voiceSpeed}
				options={[
					[1, "1×"],
					[1.5, "1.5×"],
					[2, "2×"],
				]}
				onPick={(v) =>
					setPrefs({ messaging: { voiceSpeed: v as Preferences["messaging"]["voiceSpeed"] } })
				}
			/>
			<Toggle
				label="Play voice notes back to back"
				hint="When a voice note finishes, the next one in the chat starts on its own."
				checked={m.voiceAutoplayNext}
				onChange={(v) => setPrefs({ messaging: { voiceAutoplayNext: v } })}
			/>
		</div>
	);
}
