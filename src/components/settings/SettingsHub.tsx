"use client";

import { useClerk } from "@clerk/nextjs";
import { CaretRight } from "@phosphor-icons/react";
import { motion } from "framer-motion";
import { useAtomValue } from "jotai";
import Link from "next/link";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { usePreferences } from "@/components/providers/PreferencesProvider";
import { SECTIONS, type SectionId } from "@/components/settings/sections";
import { LOCALE_COOKIE } from "@/i18n/config";
import { useT } from "@/i18n/client";
import { normalizeCategoryIds } from "@/lib/categories";
import { press, staggerItem, staggerParentFast } from "@/lib/motion-presets";
import type { Preferences } from "@/lib/preferences";
import { withThemeTransition } from "@/lib/theme-transition";
import { handleSignOut } from "@/lib/utils";
import { userAtom } from "@/store/user.atom";
import { PickerSheet } from "./inspector";

/**
 * Settings on a phone (owner 2026-09-20, picked mobile directions A + B
 * after the first flow "doesn't actually sit well with me at all").
 *
 * What was wrong: the hub was the desktop sidebar squeezed into a phone. A
 * tree of sections with indented sub-rows, under a five-row quick block of
 * two-line explanations, ran 1.7 screens and told you nothing about what
 * anything was set to.
 *
 * What it is now, top to bottom:
 * - B: four tiles for the settings people change most. A tile shows its
 *   value and opens its picker as a bottom sheet, so the common change is
 *   two taps and never leaves this screen.
 * - A: the sections as a plain grouped list, each row saying what it is
 *   currently set to, so half of all visits are answered without a tap.
 * - Sign out, last.
 *
 * Fits one screen. The desktop keeps its sidebar; this renders under `lg`.
 */

const LANGUAGE: Record<string, string> = {
	en: "English",
	es: "Español",
	fr: "Français",
	pt: "Português",
	de: "Deutsch",
};

const NOTIFY_KEYS = ["like", "reply", "repost", "mention", "follow", "live"] as const;

const GROUPS: { label: string; ids: SectionId[] }[] = [
	{ label: "App", ids: ["notifications", "safety", "display", "data", "topics"] },
	{ label: "Account", ids: ["account", "premium"] },
];

type TileKey = "theme" | "text" | "saver" | "dm";

export function SettingsHub() {
	const t = useT();
	const { prefs, setPrefs } = usePreferences();
	const { resolvedTheme, setTheme } = useTheme();
	const { signOut } = useClerk();
	const user = useAtomValue(userAtom);
	const [mounted, setMounted] = useState(false);
	const [locale, setLocale] = useState("en");
	const [sheet, setSheet] = useState<TileKey | null>(null);
	const [leaving, setLeaving] = useState(false);
	useEffect(() => {
		setMounted(true);
		const m = document.cookie.match(new RegExp(`${LOCALE_COOKIE}=([a-z]{2})`));
		if (m) setLocale(m[1]);
	}, []);

	const mode = mounted && resolvedTheme === "light" ? "light" : "dark";
	const textScale = prefs.a11y.textScale;
	const textLabel = textScale === "auto" ? "Device" : `${textScale}%`;
	const saverLabel = { auto: "Automatic", on: "On", off: "Off" }[prefs.data.saver];
	const dmLabel = prefs.privacy.dmFrom === "everyone" ? "Everyone" : "People you follow";

	// What each section is set to, in a few words. A row that answers the
	// question is a visit that ends here.
	const notify = (user as { notificationPrefs?: Record<string, boolean> })
		?.notificationPrefs;
	const notifyOn = NOTIFY_KEYS.filter((k) => notify?.[k] !== false).length;
	const topics = user?.interests ? normalizeCategoryIds(user.interests).length : 0;
	const summary: Record<SectionId, string> = {
		notifications:
			notifyOn === NOTIFY_KEYS.length
				? "All on"
				: `${notifyOn} of ${NOTIFY_KEYS.length} on`,
		safety: prefs.privacy.dmFrom === "everyone" ? "Anyone can message" : "Follows can message",
		display: `${mode === "light" ? "Light" : "Dark"} · ${textLabel} · ${LANGUAGE[locale] ?? locale}`,
		data: `Data saver ${saverLabel.toLowerCase()}`,
		topics: topics ? `${topics} chosen` : "None chosen",
		account: user?.username ? `@${user.username}` : "",
		premium: user?.isVerified ? "Verified" : "Not verified",
	};

	const tiles: { key: TileKey; label: string; value: string }[] = [
		{ key: "theme", label: "Theme", value: mode === "light" ? "Light" : "Dark" },
		{ key: "text", label: "Text size", value: textLabel },
		{ key: "saver", label: "Data saver", value: saverLabel },
		{ key: "dm", label: "Who can message", value: dmLabel },
	];

	return (
		<motion.div
			variants={staggerParentFast}
			initial="hidden"
			animate="show"
			className="flex flex-col gap-2"
		>
			<motion.div variants={staggerItem} className="grid grid-cols-2 gap-2">
				{tiles.map((tile) => (
					<motion.button
						key={tile.key}
						type="button"
						{...press}
						onClick={() => setSheet(tile.key)}
						aria-haspopup="listbox"
						className="flex min-h-[64px] cursor-pointer flex-col justify-center gap-0.5 rounded-2xl px-4 py-3 text-left glass-frost backdrop-blur-xl"
					>
						<span className="font-sans text-[calc(12px*var(--ws-fs))] text-muted">
							{tile.label}
						</span>
						<span className="truncate font-sans text-[calc(15px*var(--ws-fs))] font-semibold text-primary">
							{tile.value}
						</span>
					</motion.button>
				))}
			</motion.div>

			{GROUPS.map((group) => (
				<motion.nav
					key={group.label}
					variants={staggerItem}
					aria-label={group.label}
					className="rounded-2xl px-4 pb-1 pt-3 glass-frost backdrop-blur-xl"
				>
					<span className="block pb-1 font-sans text-[calc(13px*var(--ws-fs))] font-semibold text-primary">
						{group.label}
					</span>
					{group.ids.map((id) => {
						const def = SECTIONS.find((s) => s.id === id);
						if (!def) return null;
						const Icon = def.icon;
						return (
							<Link
								key={id}
								href={`/settings/${id}`}
								className="flex min-h-[52px] items-center gap-3 border-b border-hairline last:border-b-0"
							>
								<Icon className="h-[18px] w-[18px] shrink-0 text-muted" strokeWidth={2} />
								<span className="shrink-0 font-sans text-[calc(15px*var(--ws-fs))] font-medium text-primary">
									{t(def.labelKey)}
								</span>
								<span className="ml-auto min-w-0 truncate text-right font-sans text-[calc(13px*var(--ws-fs))] text-muted">
									{summary[id]}
								</span>
								<CaretRight size={13} weight="bold" className="shrink-0 text-subtle" />
							</Link>
						);
					})}
				</motion.nav>
			))}

			<motion.button
				type="button"
				variants={staggerItem}
				disabled={leaving}
				onClick={() => {
					setLeaving(true);
					void handleSignOut(signOut);
				}}
				className="flex min-h-[52px] cursor-pointer items-center justify-center rounded-2xl font-sans text-[calc(15px*var(--ws-fs))] font-semibold text-muted glass-frost backdrop-blur-xl disabled:opacity-60"
			>
				{leaving ? "Signing out…" : "Sign out"}
			</motion.button>

			<PickerSheet
				open={sheet === "theme"}
				title="Theme"
				value={mode}
				options={[
					["dark", "Dark"],
					["light", "Light"],
				]}
				onPick={(v) => withThemeTransition(() => setTheme(v))}
				onClose={() => setSheet(null)}
			/>
			<PickerSheet
				open={sheet === "text"}
				title="Text size"
				value={textScale}
				options={[
					["auto", "Match my device"],
					[90, "90%"],
					[100, "100%"],
					[110, "110%"],
					[125, "125%"],
					[150, "150%"],
					[175, "175%"],
				]}
				onPick={(v) =>
					setPrefs({ a11y: { textScale: v as Preferences["a11y"]["textScale"] } })
				}
				onClose={() => setSheet(null)}
			/>
			<PickerSheet
				open={sheet === "saver"}
				title="Data saver"
				value={prefs.data.saver}
				options={[
					["auto", "Automatic"],
					["on", "On"],
					["off", "Off"],
				]}
				onPick={(v) => setPrefs({ data: { saver: v as Preferences["data"]["saver"] } })}
				onClose={() => setSheet(null)}
			/>
			<PickerSheet
				open={sheet === "dm"}
				title="Who can start a chat with you"
				value={prefs.privacy.dmFrom}
				options={[
					["everyone", "Everyone"],
					["allies", "People you follow"],
				]}
				onPick={(v) =>
					setPrefs({ privacy: { dmFrom: v as Preferences["privacy"]["dmFrom"] } })
				}
				onClose={() => setSheet(null)}
			/>
		</motion.div>
	);
}
