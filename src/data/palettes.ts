/**
 * App palettes (owner 2026-09-20: "users can choose the worldspace whole
 * theme ... separate from the conversation theme").
 *
 * A palette is the brand colour of the whole app: the primary button, the
 * active nav item, tabs, links, the top loader. It is orthogonal to light
 * and dark (`data-ws-theme`, owned by next-themes) and to a chat's own
 * theme (`--chat-*`, scoped to the thread). The stamp is
 * `<html data-ws-palette="id">`; the default carries NO attribute, so it
 * always follows the vendored token file.
 *
 * The values here draw the swatches in Settings. The values the app
 * actually paints with live in `src/styles/ws-palettes.css`; change both
 * together.
 *
 * Every fill is a LIGHT fill with dark ink in both modes, the same
 * architecture as the house cyan (white on a mid-tone brand fill fails AA;
 * #3B82F6 with white is 3.7:1). Checked: ink on fill 7.2:1 or better,
 * brand-as-text 11:1 or better on black and 5.8:1 or better on paper.
 *
 * Left out on purpose: rose and red (a like is `text-danger`), emerald and
 * teal (credit and success are green, and teal sits on top of the default).
 * Money, status, the focus ring and the verified tick never follow a
 * palette.
 */

export type PaletteId =
	| "tide"
	| "cobalt"
	| "iris"
	| "orchid"
	| "sunset"
	| "heritage"
	| "mono";

export const DEFAULT_PALETTE: PaletteId = "tide";

export const PALETTES: {
	id: PaletteId;
	label: string;
	blurb: string;
	/** Swatch per mode: the fill, and the ink that sits on it. */
	dark: { fill: string; on: string };
	light: { fill: string; on: string };
}[] = [
	{
		id: "tide",
		label: "Tide",
		blurb: "The house cyan.",
		dark: { fill: "#22B8D6", on: "#0C0A09" },
		light: { fill: "#22B8D6", on: "#0C0A09" },
	},
	{
		id: "cobalt",
		label: "Cobalt",
		blurb: "A clear daylight blue.",
		dark: { fill: "#60A5FA", on: "#0C0A09" },
		light: { fill: "#60A5FA", on: "#0C0A09" },
	},
	{
		id: "iris",
		label: "Iris",
		blurb: "Soft violet.",
		dark: { fill: "#A78BFA", on: "#0C0A09" },
		light: { fill: "#A78BFA", on: "#0C0A09" },
	},
	{
		id: "orchid",
		label: "Orchid",
		blurb: "Bright orchid pink.",
		dark: { fill: "#E879F9", on: "#0C0A09" },
		light: { fill: "#E879F9", on: "#0C0A09" },
	},
	{
		id: "sunset",
		label: "Sunset",
		blurb: "Warm orange.",
		dark: { fill: "#FB923C", on: "#0C0A09" },
		light: { fill: "#FB923C", on: "#0C0A09" },
	},
	{
		id: "heritage",
		label: "Heritage",
		blurb: "The original WorldStreet gold.",
		dark: { fill: "#EAB308", on: "#0C0A09" },
		light: { fill: "#EAB308", on: "#0C0A09" },
	},
	{
		id: "mono",
		label: "Mono",
		blurb: "No colour at all. Ink is the brand.",
		dark: { fill: "#FAFAFA", on: "#0C0A09" },
		light: { fill: "#18181B", on: "#FFFFFF" },
	},
];

export const PALETTE_IDS = PALETTES.map((p) => p.id) as readonly PaletteId[];
