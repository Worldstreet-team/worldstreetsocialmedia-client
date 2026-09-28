"use client";

import clsx from "clsx";
import { motion } from "framer-motion";
import { Image as ImageIcon, LoaderCircle } from "@/components/ui/icons";
import { useTheme } from "next-themes";
import { useEffect, useRef, useState } from "react";
import { sampleImage } from "@/components/messages/theme/imageTheme";
import { usePreferences } from "@/components/providers/PreferencesProvider";
import { useToast } from "@/components/ui/Toast/ToastContext";
import { CUSTOM_PALETTE, PALETTES } from "@/data/palettes";
import { thumbSpring } from "@/lib/motion-presets";
import { paletteFromSeed } from "@/lib/palette-derive";
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
 *
 * The eleventh dot is "From a picture" (owner 2026-09-25): it opens the
 * file picker, reads the picture's accent with the same sampler the chat
 * themes use, and derives the six brand tokens per mode from it
 * (src/lib/palette-derive.ts). While it is chosen the dot wears the
 * derived fill for the current mode; otherwise it is a dashed ring with
 * a picture glyph, since it has no colour of its own to show.
 */
export function PaletteSetting() {
	const { prefs, setPrefs } = usePreferences();
	const { toast } = useToast();
	const { resolvedTheme } = useTheme();
	// next-themes resolves on the client; draw the dark swatches until it has.
	const [mounted, setMounted] = useState(false);
	useEffect(() => setMounted(true), []);
	const mode = mounted && resolvedTheme === "light" ? "light" : "dark";
	const current = prefs.appearance.palette;
	const custom = prefs.appearance.custom;
	const customOn = current === CUSTOM_PALETTE && Boolean(custom);
	const active = PALETTES.find((p) => p.id === current) ?? PALETTES[0];
	const fileRef = useRef<HTMLInputElement>(null);
	const [busy, setBusy] = useState(false);

	async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
		const file = e.target.files?.[0];
		// Clear it so the same picture can be chosen again after a change.
		e.target.value = "";
		if (!file || busy) return;
		setBusy(true);
		try {
			const { accent } = await sampleImage(file);
			const next = paletteFromSeed(accent);
			withThemeTransition(() =>
				setPrefs({ appearance: { palette: CUSTOM_PALETTE, custom: next } }),
			);
		} catch (err) {
			toast(err instanceof Error ? err.message : "The picture could not be read", {
				type: "error",
			});
		} finally {
			setBusy(false);
		}
	}

	return (
		<SettingRow
			label="Colour"
			hint={customOn ? "From your picture." : `${active.label}. ${active.blurb}`}
		>
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
				<motion.button
					type="button"
					role="radio"
					aria-checked={customOn}
					aria-label="From a picture. Pick a photo and the app takes its colour."
					aria-busy={busy}
					title="From a picture"
					whileTap={{ scale: 0.92 }}
					onClick={() => {
						if (busy) return;
						fileRef.current?.click();
					}}
					className="relative -mx-1 flex size-10 cursor-pointer items-center justify-center rounded-pill"
				>
					{customOn && (
						<motion.span
							layoutId="palette-ring"
							transition={thumbSpring}
							className="absolute inset-[7px] rounded-pill border-[1.5px] border-primary"
						/>
					)}
					{customOn && custom && !busy ? (
						<span
							className="block size-4 rounded-pill border border-hairline"
							style={{ background: mode === "light" ? custom.lPrimary : custom.dPrimary }}
						/>
					) : (
						<span className="flex size-4 items-center justify-center rounded-pill border border-dashed border-muted text-muted">
							{busy ? (
								<LoaderCircle className="size-[9px] animate-spin" aria-hidden />
							) : (
								<ImageIcon className="size-[9px]" strokeWidth={2.25} aria-hidden />
							)}
						</span>
					)}
				</motion.button>
				<input
					ref={fileRef}
					type="file"
					accept="image/*"
					className="hidden"
					tabIndex={-1}
					aria-hidden
					onChange={onPick}
				/>
			</div>
		</SettingRow>
	);
}
