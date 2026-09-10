"use client";

import { usePreferences } from "@/components/providers/PreferencesProvider";
import type { Preferences } from "@/lib/preferences";
import { Choice, Toggle } from "./SettingRows";

/**
 * Privacy. Three of these are deliberately reciprocal: the app will not
 * sell you other people's presence while hiding your own, and saying so in
 * the hint is the honest thing rather than letting someone discover it.
 *
 * Every one is enforced on the gateway as well as here - a privacy setting
 * the server does not enforce is worse than none, because it reads as a
 * promise the app is not keeping.
 */
export function PrivacySettings() {
	const { prefs, setPrefs } = usePreferences();
	const p = prefs.privacy;
	return (
		<div className="flex flex-col">
			<Toggle
				label="Show when I'm online"
				hint="Your green dot and the last-seen line in a chat. Turning it off hides other people's from you too."
				checked={p.showActivity}
				onChange={(v) => setPrefs({ privacy: { showActivity: v } })}
			/>
			<Toggle
				label="Show when I'm typing"
				hint="Whether people see “typing…” and “recording…” from you. Off both ways: you stop seeing theirs."
				checked={p.typingIndicators}
				onChange={(v) => setPrefs({ privacy: { typingIndicators: v } })}
			/>
			<Toggle
				label="Send read receipts"
				hint="The Seen mark under a message you have opened. Off both ways. Your own unread count still clears."
				checked={p.readReceipts}
				onChange={(v) => setPrefs({ privacy: { readReceipts: v } })}
			/>
			<Choice
				label="Who can start a chat with you"
				hint="Anyone can open a chat today, and a stranger's first message waits on your Requests shelf. Allies only turns it away at the door."
				value={p.dmFrom}
				options={[
					["everyone", "Anyone"],
					["allies", "Allies only"],
				]}
				onPick={(v) =>
					setPrefs({ privacy: { dmFrom: v as Preferences["privacy"]["dmFrom"] } })
				}
			/>
			<Toggle
				label="Show my likes on my profile"
				hint="Anyone can open the Likes tab on your profile today. Off leaves it there for you alone."
				checked={p.showLikes}
				onChange={(v) => setPrefs({ privacy: { showLikes: v } })}
			/>
		</div>
	);
}

/** Notification behaviour that lives on the preferences layer. */
export function NotificationBehaviour() {
	const { prefs, setPrefs } = usePreferences();
	const n = prefs.notifications;
	return (
		<div className="flex flex-col">
			<Toggle
				label="Pop-ups for new messages"
				hint="A short banner when a message arrives while you are elsewhere in the app. The unread count still counts it either way."
				checked={n.messageAlerts}
				onChange={(v) => setPrefs({ notifications: { messageAlerts: v } })}
			/>
			<Choice
				label="Open notifications on"
				hint="The tab the notifications screen starts on. You can still switch once you are there."
				value={n.defaultTab}
				options={[
					["all", "All"],
					["mentions", "Mentions"],
					["follows", "Allies"],
					["verified", "Verified"],
				]}
				onPick={(v) =>
					setPrefs({
						notifications: { defaultTab: v as Preferences["notifications"]["defaultTab"] },
					})
				}
			/>
		</div>
	);
}
