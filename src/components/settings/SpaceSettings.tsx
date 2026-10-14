"use client";

import { usePreferences } from "@/components/providers/PreferencesProvider";
import { ToggleRow } from "@/components/settings/inspector";

/**
 * Space recaps (owner 2026-10-14), the two switches WorldMeet has under
 * Settings > Notifications ("Send a recap to participants"), adapted to
 * rooms. Both on by default, both on the account (`prefs.spaces`), and the
 * gateway reads the same keys with the same defaults when a space ends.
 *
 * Rendered in two places, like every Messages preference: Settings >
 * Notifications > Spaces, and the Space Voice settings sheet. One component
 * so the two can never say different things.
 */
export function SpaceRecapRows() {
	const { prefs, setPrefs } = usePreferences();
	const s = prefs.spaces;
	return (
		<div className="flex flex-col [&>*:last-child]:border-b-0">
			<ToggleRow
				label="Space recaps"
				hint="After a space you listened to ends, get what happened: how long it ran, who spoke and how many listened."
				checked={s.recaps}
				onChange={(v) => setPrefs({ spaces: { recaps: v } })}
			/>
			<ToggleRow
				label="Send recaps to your listeners"
				hint="After spaces you host, everyone who listened gets the recap."
				checked={s.sendRecap}
				onChange={(v) => setPrefs({ spaces: { sendRecap: v } })}
			/>
		</div>
	);
}
