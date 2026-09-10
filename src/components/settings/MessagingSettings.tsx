"use client";

import { usePreferences } from "@/components/providers/PreferencesProvider";
import type { Preferences } from "@/lib/preferences";
import { Choice, Toggle } from "./SettingRows";

/** How chat behaves. Everything here is your view of your own chats. */
export function MessagingSettings() {
	const { prefs, setPrefs } = usePreferences();
	const m = prefs.messaging;
	return (
		<div className="flex flex-col">
			<Choice
				label="What the Enter key does"
				hint="Send your message, or start a new line instead. When it starts a new line, Ctrl or Cmd plus Enter sends."
				value={m.enterToSend}
				options={[
					["send", "Send the message"],
					["newline", "Start a new line"],
				]}
				onPick={(v) =>
					setPrefs({ messaging: { enterToSend: v as Preferences["messaging"]["enterToSend"] } })
				}
			/>
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
			<Toggle
				label="Open a chat where you left off"
				hint="On, a chat with unread messages opens at the first one you have not read. Off, it opens at the newest."
				checked={m.openAtFirstUnread}
				onChange={(v) => setPrefs({ messaging: { openAtFirstUnread: v } })}
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
