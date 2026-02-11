import type { Config } from "tailwindcss";

const config: Config = {
	content: [
		"./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
		"./src/components/**/*.{js,ts,jsx,tsx,mdx}",
		"./src/app/**/*.{js,ts,jsx,tsx,mdx}",
	],
	theme: {
		extend: {
			colors: {
				background: "var(--background)",
				foreground: "var(--foreground)",
				primary: "#1D9BF0",
				"primary-dark": "#1A8CD8",
				"search-bg": "#EFF3F4",
				"border-gray": "#EFF3F4",
				"hover-gray": "#EFF3F4",
				"text-light": "#536471",
			},
			fontFamily: {
				cuturila: ["var(--font-cuturila)"],
			},
			keyframes: {
				loading: {
					"0%": { transform: "translateX(-100%) scaleX(0.2)" },
					"50%": { transform: "translateX(0%) scaleX(0.5)" },
					"100%": { transform: "translateX(200%) scaleX(0.2)" },
				},
				"fade-in": {
					"0%": { opacity: "0" },
					"100%": { opacity: "1" },
				},
			},
			animation: {
				loading: "loading 1.5s infinite linear",
				"fade-in": "fade-in 0.5s ease-out",
			},
		},
	},
	plugins: [],
};
export default config;
