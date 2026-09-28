import { Archivo_Black, Bebas_Neue, Caveat } from "next/font/google";
import type { CSSProperties } from "react";

/**
 * The Story Studio's poster, condensed and script voices.
 *
 * These three faces exist only for the studio's font picker, yet they used to
 * load in the root layout, so every page paid for them (audit 2026-09-25).
 * They now load with the studio: the `next/font` declarations must sit at
 * module scope, so they live here, and the studio puts `storyFontsClassName`
 * and `storyFontsStyle` on its root element.
 *
 * Why the tokens are redeclared here: `globals.css` declares
 * `--ws-font-poster` and friends on `[data-ws-theme]` (the `<html>`
 * element) as `var(--font-archivo-black), ...`. A custom property resolves
 * where it is DECLARED, not where it is read (the 2026-09-22 font bug), so
 * with the `--font-*` variables no longer on `<html>` those tokens compute
 * to nothing there. Redeclaring them on the same element that carries the
 * variable classes makes them resolve again for everything inside the studio.
 *
 * Two faces the studio also uses stay in the root layout on purpose:
 * Instrument Serif (`font-editorial`) is drawn by the story lane preview in
 * `StoryCreateSheet`, which the feed's stories rail renders outside the
 * studio, and JetBrains Mono (`font-mono`) is app chrome (trend ranks, the
 * countdown, the stream key field).
 */

const archivoBlack = Archivo_Black({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-archivo-black",
});

const bebasNeue = Bebas_Neue({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-bebas-neue",
});

const caveat = Caveat({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-caveat",
});

const POSTER_STACK = '"Archivo Black", Impact, system-ui, sans-serif';
const CONDENSED_STACK = '"Bebas Neue", "Arial Narrow", system-ui, sans-serif';
const SCRIPT_STACK = '"Caveat", "Segoe Script", cursive';

/** The next/font variable classes, for the studio's root element. */
export const storyFontsClassName = `${archivoBlack.variable} ${bebasNeue.variable} ${caveat.variable}`;

/** The creator-voice tokens, redeclared where the variables now live. */
export const storyFontsStyle = {
  "--ws-font-poster": `var(--font-archivo-black), ${POSTER_STACK}`,
  "--ws-font-condensed": `var(--font-bebas-neue), ${CONDENSED_STACK}`,
  "--ws-font-script": `var(--font-caveat), ${SCRIPT_STACK}`,
} as CSSProperties;

/**
 * The hashed families for canvas export. `resolveOverlayFonts()` reads the
 * tokens off `<html>`, where these three no longer resolve, so the studio
 * spreads this over its result.
 */
export const STORY_FONT_FAMILIES = {
  poster: `${archivoBlack.style.fontFamily}, ${POSTER_STACK}`,
  condensed: `${bebasNeue.style.fontFamily}, ${CONDENSED_STACK}`,
  script: `${caveat.style.fontFamily}, ${SCRIPT_STACK}`,
};
