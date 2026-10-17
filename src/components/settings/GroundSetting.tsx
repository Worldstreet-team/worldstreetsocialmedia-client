"use client";

import { motion } from "framer-motion";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { usePreferences } from "@/components/providers/PreferencesProvider";
import { DEFAULT_GROUND, GROUNDS } from "@/data/grounds";
import { thumbSpring } from "@/lib/motion-presets";
import { withThemeTransition } from "@/lib/theme-transition";
import { SettingRow } from "./inspector";

/**
 * Settings > Appearance > Ground (owner 2026-10-09): the surface family of
 * the whole app, beside Colour (the brand) and Mode. Each choice is a tiny
 * picture of the app in that ground: the page, a raised card on it and a
 * line of ink, drawn in the current mode, so what you tap is what you get.
 *
 * Lagoon is the default; Midnight keeps the true-black look for anyone
 * who preferred it. Saved to the account like every preference.
 */
export function GroundSetting() {
	const { prefs, setPrefs } = usePreferences();
	const { resolvedTheme } = useTheme();
	const [mounted, setMounted] = useState(false);
	useEffect(() => setMounted(true), []);
	const mode = mounted && resolvedTheme === "light" ? "light" : "dark";
	const current = prefs.appearance.ground ?? DEFAULT_GROUND;
	const active = GROUNDS.find((g) => g.id === current) ?? GROUNDS[0];

	return (
		<SettingRow label="Ground" hint={`${active.label}. ${active.blurb}`}>
			<div role="radiogroup" aria-label="App ground" className="flex gap-1.5">
				{GROUNDS.map((g) => {
					const on = g.id === current;
					const sw = g[mode];
					return (
						<motion.button
							key={g.id}
							type="button"
							role="radio"
							aria-checked={on}
							aria-label={`${g.label}. ${g.blurb}`}
							title={g.label}
							whileTap={{ scale: 0.94 }}
							onClick={() => {
								if (on) return;
								withThemeTransition(() => setPrefs({ appearance: { ground: g.id } }));
							}}
							className="relative flex size-10 cursor-pointer items-center justify-center rounded-[12px]"
						>
							{on && (
								<motion.span
									layoutId="ground-ring"
									transition={thumbSpring}
									className="absolute inset-0 rounded-[12px] ring-[1.5px] ring-primary"
								/>
							)}
							<span
								className="relative flex size-8 flex-col justify-end gap-[3px] overflow-hidden rounded-[9px] p-[5px] shadow-card"
								style={{ background: sw.page }}
							>
								<span className="block h-[7px] w-full rounded-[3px]" style={{ background: sw.raised }} />
								<span className="block h-[2px] w-3/5 rounded-full" style={{ background: sw.ink }} />
							</span>
						</motion.button>
					);
				})}
			</div>
		</SettingRow>
	);
}
