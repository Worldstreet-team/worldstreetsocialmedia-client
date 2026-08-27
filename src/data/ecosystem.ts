/**
 * The WorldStreet ecosystem — every sibling product this app links out to.
 *
 * One list, two surfaces: the desktop rail's "Products" group and the mobile
 * bottom nav's brand sheet. It lives here rather than in either component so
 * the two can never drift into showing different platforms, which is exactly
 * what happened while the rail owned the only copy.
 *
 * Labels are the ratified DS names — "Xstream", never "XTreme".
 */
export interface EcosystemApp {
	title: string;
	href: string;
	/** One line on what it is. The mobile sheet has room for it; the rail does not. */
	description: string;
}

export const ECOSYSTEM: EcosystemApp[] = [
	{
		title: "Forex Markets",
		href: "https://dashboard.worldstreetgold.com/trade",
		description: "Trade currency pairs",
	},
	{
		title: "Cryptocurrencies",
		href: "https://dashboard.worldstreetgold.com/trade",
		description: "Buy, sell and hold crypto",
	},
	{
		title: "Vivid AI",
		href: "https://worldstreetgold.com/vivid",
		description: "The assistant across the ecosystem",
	},
	{
		title: "Academy",
		href: "https://academy.worldstreetgold.com",
		description: "Courses and market education",
	},
	{
		title: "e-Commerce",
		href: "https://shop.worldstreetgold.com",
		description: "The WorldStreet marketplace",
	},
	{
		title: "Xstream",
		href: "https://xtreme.worldstreetgold.com",
		description: "Live streaming",
	},
	{
		title: "Prediction",
		href: "https://prediction.worldstreetgold.com",
		description: "Markets on what happens next",
	},
	{
		title: "Arcade",
		href: "https://arcade.worldstreetgold.com",
		description: "Play and compete",
	},
	{
		title: "Vision",
		href: "https://vision.worldstreetgold.com",
		description: "Watch and discover",
	},
];
