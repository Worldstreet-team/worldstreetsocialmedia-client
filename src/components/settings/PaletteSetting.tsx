"use client";

import clsx from "clsx";
import { motion } from "framer-motion";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { usePreferences } from "@/components/providers/PreferencesProvider";
import { PALETTES } from "@/data/palettes";
import { thumbSpring } from "@/lib/motion-presets";
import { withThemeTransition } from "@/lib/theme-transition";
import { SettingRow } from "./inspector";

/**
 * Settings > Appearance > Colour: the app's brand colour (owner
 * 2026-09-20). A radiogroup of swatches; each swatch is the real fill with
 * a tick in the real ink, so what you tap is what the Post button becomes.
 *
 * Separate from Mode (light / dark) above it and from a chat's own theme,
 * which lives in the thread. Saved to the account like every preference,
 * so it follows the person to their other devices. The switch goes through
 * withThemeTransition() for the same one-beat cross-fade as the mode
 * switch (instant under reduced motion).
 */
export function PaletteSetting() {
	const { prefs, setPrefs } = usePreferences();
	const { resolvedTheme } = useTheme();
	// next-themes resolves on the client; draw the dark swatches until it has.
	const [mounted, setMounted] = useState(false);
	useEffect(() => setMounted(true), []);
	const mode = mounted && resolvedTheme === "light" ? "light" : "dark";
	const current = prefs.appearance.palette;
	const active = PALETTES.find((p) => p.id === current) ?? PALETTES[0];

	return (
		<SettingRow label="Colour" hint={`${active.label}. ${active.blurb}`}>
			{/* The dot is 16px; the button around it is the 40px target. They
			    overlap by a hair (-mx-1) so seven fit a phone row. */}
			<div role="radiogroup" aria-label="App colour" className="-mr-3 flex">
				{PALETTES.map((p) => {
					const on = p.id === current;
					const sw = p[mode];
					return (
						<motion.button
							key={p.id}
							type="button"
							role="radio"
							aria-checked={on}
							aria-label={`${p.label}. ${p.blurb}`}
							title={p.label}
							whileTap={{ scale: 0.92 }}
							onClick={() => {
								if (on) return;
								withThemeTransition(() =>
									setPrefs({ appearance: { palette: p.id } }),
								);
							}}
							className="relative -mx-1 flex size-10 cursor-pointer items-center justify-center rounded-pill"
						>
							{on && (
								<motion.span
									layoutId="palette-ring"
									transition={thumbSpring}
									className="absolute inset-[7px] rounded-pill border-[1.5px] border-primary"
								/>
							)}
							<span
								className={clsx(
									"block size-4 rounded-pill",
									// Mono's dot is the ink itself: a hairline keeps it
									// from dissolving into a same-coloured page.
									p.id === "mono" && "border border-hairline",
								)}
								style={{ background: sw.fill }}
							/>
						</motion.button>
					);
				})}
			</div>
		</SettingRow>
	);
}
