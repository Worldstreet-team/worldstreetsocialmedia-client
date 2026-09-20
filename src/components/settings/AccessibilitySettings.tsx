"use client";

import { AnimatePresence, motion } from "framer-motion";
import { usePreferences } from "@/components/providers/PreferencesProvider";
import { swap } from "@/lib/motion-presets";
import type { Preferences } from "@/lib/preferences";
import { rowButton } from "./inspector";
import { Choice, Toggle } from "./SettingRows";

/**
 * The accessibility controls, on the preferences layer.
 *
 * Every one of these paints the moment it is touched, saves to the account
 * in the background and reaches this person's other devices within a
 * second. Text size leads because it is the reason the whole layer exists.
 */
export function AccessibilitySettings() {
	const { prefs, setPrefs, resetPrefs, synced } = usePreferences();
	const a = prefs.a11y;

	return (
		<div className="flex flex-col">
			<Choice
				label="Text size"
				hint="Everything in the app, from this screen to a chat bubble. Match my device follows the size you already set on your phone."
				value={a.textScale}
				options={[
					["auto", "Match my device"],
					[90, "90%"],
					[100, "100%"],
					[110, "110%"],
					[125, "125%"],
					[150, "150%"],
					[175, "175%"],
				]}
				onPick={(v) => setPrefs({ a11y: { textScale: v as Preferences["a11y"]["textScale"] } })}
			/>
			<Preview />
			<Choice
				label="Message text size"
				hint="Chat is read one-handed at arm's length, so it can run larger than the rest of the app."
				value={a.chatTextScale}
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
			<Choice
				label="Colour vision"
				hint="Retints money, status and presence off the hue axis that is hard to separate, and turns on symbols alongside colour."
				value={a.colorVision}
				options={[
					["off", "Off"],
					["deuteran", "Red and green (deuteran)"],
					["protan", "Red and green (protan)"],
					["tritan", "Blue and yellow"],
					["achroma", "No colour"],
				]}
				onPick={(v) =>
					setPrefs({ a11y: { colorVision: v as Preferences["a11y"]["colorVision"] } })
				}
			/>
			<Choice
				label="Contrast"
				hint="High lifts the faintest text a step and firms up dividers and the focus ring."
				value={a.contrast}
				options={[
					["auto", "Match my device"],
					["off", "Standard"],
					["on", "High"],
				]}
				onPick={(v) => setPrefs({ a11y: { contrast: v as Preferences["a11y"]["contrast"] } })}
			/>
			<Choice
				label="Motion"
				hint="Reduce stops things sliding, rising and fading in."
				value={a.reduceMotion}
				options={[
					["auto", "Match my device"],
					["off", "Full motion"],
					["on", "Reduce"],
				]}
				onPick={(v) =>
					setPrefs({ a11y: { reduceMotion: v as Preferences["a11y"]["reduceMotion"] } })
				}
			/>
			<Toggle
				label="Show symbols, not just colour"
				hint="Arrows on money, a ring on presence dots. Always on while a colour vision mode is."
				checked={a.nonColorCues || a.colorVision !== "off"}
				disabled={a.colorVision !== "off"}
				onChange={(v) => setPrefs({ a11y: { nonColorCues: v } })}
			/>
			<Toggle
				label="Bold text"
				hint="Heavier type at the same size. Easier to read outdoors."
				checked={a.boldText}
				onChange={(v) => setPrefs({ a11y: { boldText: v } })}
			/>
			<Toggle
				label="Underline links"
				hint="So a link is not set apart from the words around it by colour alone."
				checked={a.underlineLinks || a.colorVision !== "off"}
				disabled={a.colorVision !== "off"}
				onChange={(v) => setPrefs({ a11y: { underlineLinks: v } })}
			/>
			<Toggle
				label="Reduce transparency"
				hint="Solid panels instead of frosted ones. Sharper text, and lighter on an older phone."
				checked={a.reduceTransparency}
				onChange={(v) => setPrefs({ a11y: { reduceTransparency: v } })}
			/>

			<div className="flex min-h-[52px] items-center justify-between gap-3 py-1.5">
				{/* The save landing is the one event on this screen worth a beat.
				    initial={false}: a page that opens already saved just says so. */}
				<AnimatePresence mode="wait" initial={false}>
					<motion.span
						key={synced ? "saved" : "saving"}
						{...swap}
						className="font-sans text-[calc(12.5px*var(--ws-fs))] text-subtle"
					>
						{synced
							? "Saved to your account and applied on every device."
							: "Saving to your account…"}
					</motion.span>
				</AnimatePresence>
				<button
					type="button"
					onClick={() => void resetPrefs()}
					className={rowButton}
				>
					Reset
				</button>
			</div>
		</div>
	);
}

/** Real app text at the chosen size, so the choice is judged not guessed. */
function Preview() {
	return (
		<div className="border-b border-hairline py-3">
			{/* A quote, not a card: a rule down the side and the real type. */}
			<div className="border-l-2 border-hairline pl-4">
				<p className="font-sans text-[calc(15px*var(--ws-fs))] font-semibold text-primary">
					John Doe
				</p>
				<p className="mt-0.5 font-sans text-[calc(14px*var(--ws-fs))] leading-relaxed text-primary">
					Good morning. This is what a message and a post will look like at
					the size you have picked.
				</p>
				<p className="mt-1 font-sans text-[calc(12px*var(--ws-fs))] text-muted">
					2:46 PM · Seen
				</p>
			</div>
		</div>
	);
}
