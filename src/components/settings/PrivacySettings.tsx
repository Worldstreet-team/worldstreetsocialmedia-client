"use client";

import { usePreferences } from "@/components/providers/PreferencesProvider";
import type { Preferences } from "@/lib/preferences";
import { Choice, Toggle } from "./SettingRows";

/**
 * Visibility: what other people can see about you outside a chat. The chat
 * side of privacy (who can message you, read receipts, typing) lives in
 * Messages since the regroup (owner 2026-10-07).
 *
 * Every one is enforced on the gateway as well as here - a privacy setting
 * the server does not enforce is worse than none, because it reads as a
 * promise the app is not keeping.
 */
export function VisibilitySettings() {
	const { prefs, setPrefs } = usePreferences();
	const p = prefs.privacy;
	return (
		<div className="flex flex-col">
			<Toggle
				label="Show when I'm online"
				hint="Your green dot and the last-seen line in a chat. Turning it off hides other people's from you too."
				tag="both"
				checked={p.showActivity}
				onChange={(v) => setPrefs({ privacy: { showActivity: v } })}
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

/** Notification behaviour that lives on the preferences layer. Message
 *  pop-ups moved to Messages, where people look for them. */
export function NotificationBehaviour() {
	const { prefs, setPrefs } = usePreferences();
	const n = prefs.notifications;
	return (
		<div className="flex flex-col">
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
