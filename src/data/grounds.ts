/**
 * App grounds (owner 2026-10-09: "use the Lagoon ... curate palettes so
 * users can choose from that affects the UI").
 *
 * A ground is the surface family of the whole app: the page, the panels,
 * the raised chips and the ink that sits on them. It is the second half of
 * "how WorldSpace looks", orthogonal to the palette (the brand colour, see
 * palettes.ts), to light and dark, and to a chat's own theme.
 *
 * Lagoon is the default and carries NO attribute: its values are the base
 * blocks in globals.css. Every other ground is `<html data-ws-ground="id">`
 * with one block per mode in src/styles/ws-grounds.css.
 *
 * A ground block may set ONLY the bg-* steps and the primary and muted ink.
 * Subtle ink and the hairline are DERIVED from those in globals.css, so the
 * High contrast block (which overrides subtle and hairline at lower
 * specificity) keeps working under every ground.
 *
 * The values here draw the swatches in Settings; change both together.
 */

export type GroundId = "lagoon" | "midnight" | "graphite" | "dune";

export const DEFAULT_GROUND: GroundId = "lagoon";

type Swatch = { page: string; surface: string; raised: string; ink: string };

export const GROUNDS: {
	id: GroundId;
	label: string;
	blurb: string;
	dark: Swatch;
	light: Swatch;
}[] = [
	{
		id: "lagoon",
		label: "Lagoon",
		blurb: "Soft blue-slate. The house ground.",
		dark: { page: "#0B0F14", surface: "#121821", raised: "#1C2533", ink: "#F3F7FB" },
		light: { page: "#F3F6F9", surface: "#FFFFFF", raised: "#EAF0F5", ink: "#0E1722" },
	},
	{
		id: "midnight",
		label: "Midnight",
		blurb: "True black and pure white. Most contrast.",
		dark: { page: "#000000", surface: "#0D0D0D", raised: "#1A1A1A", ink: "#FFFFFF" },
		light: { page: "#FFFFFF", surface: "#FFFFFF", raised: "#F5F5F4", ink: "#0C0A09" },
	},
	{
		id: "graphite",
		label: "Graphite",
		blurb: "Neutral grey, no tint at all.",
		dark: { page: "#111113", surface: "#18181B", raised: "#232327", ink: "#FAFAFA" },
		light: { page: "#F4F4F5", surface: "#FFFFFF", raised: "#ECECEE", ink: "#18181B" },
	},
	{
		id: "dune",
		label: "Dune",
		blurb: "Warm sand and stone, easy on the eyes.",
		dark: { page: "#12100E", surface: "#1A1714", raised: "#26211C", ink: "#FAF6F0" },
		light: { page: "#F7F3EC", surface: "#FFFDF9", raised: "#EFE8DC", ink: "#1F1A14" },
	},
];

export const GROUND_IDS = GROUNDS.map((g) => g.id);
