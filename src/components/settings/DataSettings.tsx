"use client";

import { usePreferences } from "@/components/providers/PreferencesProvider";
import { saverOn } from "@/lib/preferences";
import type { Preferences } from "@/lib/preferences";
import { Choice, Toggle } from "./SettingRows";

/**
 * Data usage. Most of these default to "Match data saver" so one switch
 * governs the lot, and so a phone that already asked the web to save data
 * gets the lighter app without anyone opening this screen.
 */
export function DataSettings() {
	const { prefs, setPrefs } = usePreferences();
	const d = prefs.data;
	const on = saverOn(prefs);

	return (
		<div className="flex flex-col">
			<Choice
				label="Data saver"
				hint={
					d.saver === "auto"
						? `Follows your phone's own data saver. Right now it is ${on ? "on" : "off"}.`
						: "Cuts what the app downloads on its own."
				}
				value={d.saver}
				options={[
					["auto", "Automatic"],
					["on", "On"],
					["off", "Off"],
				]}
				onPick={(v) => setPrefs({ data: { saver: v as Preferences["data"]["saver"] } })}
			/>
			<Choice
				label="Autoplay videos"
				hint="Videos in the timeline start on their own, with no sound. Turn it off and they wait for a tap."
				value={d.autoplay}
				options={[
					["always", "Always"],
					["saver", "Off on data saver"],
					["never", "Never"],
				]}
				onPick={(v) => setPrefs({ data: { autoplay: v as Preferences["data"]["autoplay"] } })}
			/>
			<Choice
				label="Photo upload quality"
				hint="How much photos are shrunk before they leave your phone. Smaller files send faster on a weak connection."
				value={d.uploadQuality}
				options={[
					["auto", "Match data saver"],
					["high", "Standard"],
					["low", "Smaller files"],
				]}
				onPick={(v) =>
					setPrefs({ data: { uploadQuality: v as Preferences["data"]["uploadQuality"] } })
				}
			/>
			<Choice
				label="Load posts before you reach them"
				hint="The timeline fetches the next posts while you read. Fewer means less data and a little more waiting."
				value={d.preloadPosts}
				options={[
					["auto", "Match data saver"],
					["full", "Full"],
					["light", "Fewer"],
				]}
				onPick={(v) =>
					setPrefs({ data: { preloadPosts: v as Preferences["data"]["preloadPosts"] } })
				}
			/>
		</div>
	);
}

/** The feed and what shows up in it. */
export function ContentSettings() {
	const { prefs, setPrefs } = usePreferences();
	const c = prefs.content;
	return (
		<div className="flex flex-col">
			<Toggle
				label="Stories bar"
				hint="The row of story circles above the timeline and in Messages. Off gives that space back to posts."
				checked={c.showStories}
				onChange={(v) => setPrefs({ content: { showStories: v } })}
			/>
			<Toggle
				label="Show long posts in full"
				hint="Long posts open at their full length instead of stopping at a See more link."
				checked={c.expandLongPosts}
				onChange={(v) => setPrefs({ content: { expandLongPosts: v } })}
			/>
			<Toggle
				label="Reposts in my timeline"
				hint="Off hides plain reshares. Quotes, where the person added their own words, still show."
				checked={c.showReposts}
				onChange={(v) => setPrefs({ content: { showReposts: v } })}
			/>
			<Toggle
				label="Keep loading as I scroll"
				hint="Off stops the endless scroll: the timeline waits at the end of a page for you to tap Show more."
				checked={c.autoLoadMore}
				onChange={(v) => setPrefs({ content: { autoLoadMore: v } })}
			/>
		</div>
	);
}
