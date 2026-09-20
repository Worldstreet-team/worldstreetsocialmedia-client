"use client";

import clsx from "clsx";
import { Check } from "@phosphor-icons/react";
import { motion } from "framer-motion";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { usePreferences } from "@/components/providers/PreferencesProvider";
import { PALETTES } from "@/data/palettes";
import { staggerParentFast, staggerPop, thumbSpring } from "@/lib/motion-presets";
import { withThemeTransition } from "@/lib/theme-transition";

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
		<div className="border-t border-hairline px-4 py-3">
			<div className="flex items-baseline justify-between gap-3">
				<span className="font-sans text-[calc(15px*var(--ws-fs))] font-medium text-primary">
					Colour
				</span>
				<span className="font-sans text-[calc(13px*var(--ws-fs))] text-muted">
					{active.label}. {active.blurb}
				</span>
			</div>
			<motion.div
				role="radiogroup"
				aria-label="App colour"
				variants={staggerParentFast}
				initial="hidden"
				animate="show"
				className="mt-3 flex flex-wrap gap-2"
			>
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
							variants={staggerPop}
							whileTap={{ scale: 0.92 }}
							onClick={() => {
								if (on) return;
								withThemeTransition(() =>
									setPrefs({ appearance: { palette: p.id } }),
								);
							}}
							className="relative flex size-11 cursor-pointer items-center justify-center rounded-pill"
						>
							{on && (
								<motion.span
									layoutId="palette-ring"
									transition={thumbSpring}
									className="absolute inset-0 rounded-pill border-2 border-primary"
								/>
							)}
							<span
								className={clsx(
									"flex size-8 items-center justify-center rounded-pill",
									// Mono's swatch is the ink itself: a hairline keeps it
									// from dissolving into a same-coloured page.
									p.id === "mono" && "border border-hairline",
								)}
								style={{ background: sw.fill, color: sw.on }}
							>
								{on && <Check size={14} weight="bold" />}
							</span>
						</motion.button>
					);
				})}
			</motion.div>
		</div>
	);
}
