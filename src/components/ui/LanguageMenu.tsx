"use client";

import { Check, Globe } from "@phosphor-icons/react";
import clsx from "clsx";
import { useState } from "react";
import { useT } from "@/i18n/client";
import { LOCALE_COOKIE, LOCALES, type Locale } from "@/i18n/config";

/* Endonyms — a language is always listed in its own language, so someone
   who can't read the current UI can still find theirs. */
const LANGUAGE_NAMES: Record<Locale, string> = {
	en: "English",
	es: "Español",
	fr: "Français",
	pt: "Português",
	de: "Deutsch",
};

/**
 * Locale picker. The app has had five dictionaries and a full URL/cookie/
 * header locale contract since i18n landed, but nothing on screen to change
 * it — this is that control.
 *
 * How the switch lands: `ws_locale` is a non-httpOnly cookie that proxy.ts
 * reads on every request (prefix > cookie > Accept-Language) and turns into
 * the x-ws-locale header the root layout hands to LocaleProvider.
 *
 * It reloads rather than calling router.refresh(): the dictionary is chosen
 * in the ROOT layout, and a refresh re-renders the route without re-seating
 * that provider, so the cookie flips and the UI stays in the old language
 * (verified in the browser). Switching language is a deliberate, rare act —
 * a reload is the honest, correct cost.
 */
export function LanguageMenu({
	expanded,
	onToggle,
	onPicked,
}: {
	expanded: boolean;
	onToggle: () => void;
	onPicked?: () => void;
}) {
	const t = useT();
	const [pending, setPending] = useState(false);
	const [optimistic, setOptimistic] = useState<Locale | null>(null);
	const current = (optimistic ?? t.locale) as Locale;

	const pick = (locale: Locale) => {
		if (locale === current) return;
		setOptimistic(locale);
		setPending(true);
		// One year, root path — the same shape proxy.ts writes back on every
		// response, so the two never disagree.
		document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; samesite=lax`;
		onPicked?.();
		window.location.reload();
	};

	return (
		<div>
			<button
				type="button"
				onClick={onToggle}
				aria-expanded={expanded}
				className="w-full text-left px-3.5 py-2.5 hover:bg-raised text-sm text-primary font-sans font-medium flex items-center gap-2.5 transition-colors cursor-pointer"
			>
				<Globe size={16} />
				<span className="flex-1">{t("nav.language")}</span>
				<span className="text-muted text-[13px]">
					{LANGUAGE_NAMES[current]}
				</span>
			</button>

			{/* Height-animated so the menu grows in place rather than jumping. */}
			<div
				className={clsx(
					"grid transition-[grid-template-rows] duration-200",
					expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
				)}
			>
				<div className="overflow-hidden">
					<div className="flex flex-col pb-1">
						{LOCALES.map((locale) => {
							const active = locale === current;
							return (
								<button
									key={locale}
									type="button"
									onClick={() => pick(locale)}
									disabled={pending}
									aria-current={active}
									className={clsx(
										"w-full text-left pl-11 pr-3.5 py-2 text-sm font-sans flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-60",
										active
											? "text-gold font-semibold"
											: "text-muted hover:bg-raised hover:text-primary",
									)}
								>
									<span className="flex-1">{LANGUAGE_NAMES[locale]}</span>
									{active && <Check size={14} weight="bold" />}
								</button>
							);
						})}
					</div>
				</div>
			</div>
		</div>
	);
}
