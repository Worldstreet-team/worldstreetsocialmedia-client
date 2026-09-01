"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAtom, useSetAtom } from "jotai";
import { useTheme } from "next-themes";
import {
	BadgeCheck,
	Bell,
	Palette,
	ShieldAlert,
	ShieldCheck,
	SlidersHorizontal,
	UserCircle,
} from "lucide-react";
import { Check, Moon, Sun } from "@phosphor-icons/react";
import clsx from "clsx";
import { Tabs, type TabItem } from "@/components/ui/Tabs";
import { InstallAppRow } from "@/components/settings/InstallAppRow";
import { InterestPicker } from "@/components/onboarding/InterestPicker";
import { BlockedAccounts } from "@/components/settings/BlockedAccounts";
import { AccountLifecycle } from "@/components/settings/AccountLifecycle";
import { UsernameSetting } from "@/components/settings/UsernameSetting";
import { SafeAvatar } from "@/components/ui/SafeAvatar";
import { UserBadges } from "@/components/ui/UserBadges";
import { NotificationPrefs } from "@/components/settings/NotificationPrefs";
import { useToast } from "@/components/ui/Toast/ToastContext";
import { updateMyProfileAction } from "@/lib/user.actions";
import { withThemeTransition } from "@/lib/theme-transition";
import { userAtom } from "@/store/user.atom";
import { premiumOpenAtom } from "@/store/ui.atom";
import {
	getSubscriptionAction,
	type SubscriptionState,
} from "@/lib/subscription.actions";
import { LOCALE_COOKIE, LOCALES, type Locale } from "@/i18n/config";
import { MAX_INTERESTS, MIN_INTERESTS } from "@/data/categories";
import { normalizeCategoryIds } from "@/lib/categories";
import { useT } from "@/i18n/client";

type Section = "account" | "premium" | "topics" | "notifications" | "safety" | "display";

const LANGUAGE_NAMES: Record<Locale, string> = {
	en: "English",
	es: "Español",
	fr: "Français",
	pt: "Português",
	de: "Deutsch",
};

/**
 * Settings.
 *
 * The app had no settings surface at all — no route, no nav entry, no
 * dictionary strings. The four sections here are the ones that are actually
 * backed by something real. Notification preferences are deliberately absent
 * rather than stubbed: there is no preference store on the gateway yet, and a
 * row of toggles that silently do nothing is worse than no row at all.
 */
export default function SettingsPage() {
	const t = useT();
	const { toast } = useToast();
	const [user, setUser] = useAtom(userAtom);
	const { resolvedTheme, setTheme } = useTheme();
	const [section, setSection] = useState<Section>("account");

	const setPremiumOpen = useSetAtom(premiumOpenAtom);
	const [subState, setSubState] = useState<SubscriptionState | null>(null);
	const [interests, setInterests] = useState<string[]>([]);
	const [savingTopics, setSavingTopics] = useState(false);
	const [locale, setLocale] = useState<Locale>("en");

	// Seed once the hydrated profile lands. Stored values run through the
	// legacy alias map first: older accounts hold the old flat labels
	// ("Technology"), which match no chip, so they counted toward the total
	// while being invisible and impossible to deselect.
	useEffect(() => {
		if (user?.interests) setInterests(normalizeCategoryIds(user.interests));
	}, [user?.interests]);

	useEffect(() => {
		const m = document.cookie.match(new RegExp(`${LOCALE_COOKIE}=([a-z]{2})`));
		if (m && (LOCALES as readonly string[]).includes(m[1])) {
			setLocale(m[1] as Locale);
		}
	}, []);

	const dirty = useMemo(() => {
		const original = normalizeCategoryIds(user?.interests ?? [])
			.sort()
			.join(",");
		return [...interests].sort().join(",") !== original;
	}, [interests, user?.interests]);

	const toggleInterest = useCallback((id: string) => {
		setInterests((prev) =>
			prev.includes(id)
				? prev.filter((x) => x !== id)
				: prev.length >= MAX_INTERESTS
					? prev
					: [...prev, id],
		);
	}, []);

	const saveTopics = async () => {
		if (interests.length < MIN_INTERESTS) {
			toast(t("settings.topics.min"), { type: "error" });
			return;
		}
		setSavingTopics(true);
		const body = new FormData();
		// Ids only, JSON-encoded — the same seam the composer uses.
		body.append("interests", JSON.stringify(interests));
		const res = await updateMyProfileAction(body);
		setSavingTopics(false);

		if (!res.success) {
			toast(res.message ?? t("settings.topics.error"), { type: "error" });
			return;
		}
		setUser((prev: any) => ({ ...prev, interests }));
		toast(t("settings.topics.saved"));
	};

	const pickLocale = (next: Locale) => {
		document.cookie = `${LOCALE_COOKIE}=${next};path=/;max-age=31536000;samesite=lax`;
		// The dictionary is chosen in the root layout, so a router refresh
		// would flip the cookie and leave the UI in the old language.
		window.location.reload();
	};

	// Fetched when the tab is opened, so four other tabs never pay for it.
	useEffect(() => {
		if (section !== "premium" || subState) return;
		void getSubscriptionAction().then((res) => {
			if (res.success) setSubState(res.data);
		});
	}, [section, subState]);

	const isLight = resolvedTheme === "light";

	const tabs: TabItem<Section>[] = [
		{ key: "account", label: t("settings.tab.account") },
		{ key: "premium", label: t("settings.tab.premium") },
		{ key: "topics", label: t("settings.tab.topics") },
		{ key: "notifications", label: t("settings.tab.notifications") },
		{ key: "safety", label: t("settings.tab.safety") },
		{ key: "display", label: t("settings.tab.display") },
	];

	return (
		<div className="flex min-h-dvh flex-col pb-nav md:pb-20">
			<header className="sticky top-0 z-sticky border-b border-hairline bg-page md:top-0">
				<div className="px-4 py-3">
					<h1 className="font-display text-lg font-semibold text-primary">
						{t("settings.title")}
					</h1>
					<div className="font-sans text-[13px] text-muted">
						@{user?.username}
					</div>
				</div>
				<Tabs
					items={tabs}
					value={section}
					onChange={setSection}
					ariaLabel={t("settings.title")}
					className="px-2 pb-2"
				/>
			</header>

			<div className="flex flex-col gap-6 px-4 py-4">
			{section === "account" && (
				<>
					{/* Identity card: gives the page a subject rather than
					    opening on a bare label/value list. */}
					<div className="flex items-center gap-3.5 rounded-xl bg-surface p-4">
						<span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-pill bg-sunken">
							<SafeAvatar src={user?.avatar} />
						</span>
						<div className="min-w-0">
							<div className="flex items-center gap-1.5">
								<span className="truncate font-display text-[17px] font-semibold text-primary">
									{[user?.firstName, user?.lastName]
										.filter(Boolean)
										.join(" ") || user?.username}
								</span>
								<UserBadges
									isVerified={user?.isVerified}
									verification={(user as any)?.verification}
									badges={user?.badges}
									size={16}
								/>
							</div>
							<span className="block truncate font-sans text-[13px] text-muted">
								@{user?.username}
							</span>
						</div>
					</div>

					<Section
						icon={UserCircle}
						title={t("settings.account.title")}
						caption={t("settings.account.managedNote")}
					>
						<UsernameSetting />
						<Row
							label={t("settings.account.email")}
							value={user?.email ?? "—"}
						/>
					</Section>

					<Section
						icon={ShieldAlert}
						title={t("settings.danger.title")}
						caption={t("settings.danger.caption")}
						tone="danger"
					>
						<AccountLifecycle />
					</Section>
				</>
			)}

			{section === "premium" && (
				<Section
					icon={BadgeCheck}
					title={t("premium.eyebrow")}
					caption={t("premium.pitch")}
				>
					<Row
						label={t("premium.active")}
						value={
							subState?.subscription
								? subState.subscription.cancelAtPeriodEnd
									? t("premium.keeps").replace(
											"{date}",
											new Date(
												subState.subscription.currentPeriodEnd,
											).toLocaleDateString(t.locale, {
												month: "long",
												day: "numeric",
											}),
										)
									: t("premium.renews").replace(
											"{date}",
											new Date(
												subState.subscription.currentPeriodEnd,
											).toLocaleDateString(t.locale, {
												month: "long",
												day: "numeric",
											}),
										)
								: user?.isVerified
									? t("premium.verifiedSince")
									: "—"
						}
					/>
					<div className="px-4 pb-4 pt-1">
						<button
							type="button"
							onClick={() => setPremiumOpen(true)}
							className="h-9 cursor-pointer rounded-pill bg-brand px-5 font-sans text-[13px] font-semibold text-brand-on transition-opacity hover:opacity-90"
						>
							{subState?.subscription
								? t("premium.manageTitle")
								: t("premium.cta")}
						</button>
					</div>
				</Section>
			)}

			{section === "topics" && (
				<Section
					icon={SlidersHorizontal}
					title={t("settings.topics.title")}
					caption={t("settings.topics.caption")}
				>
					<div className="p-4">
						<InterestPicker selected={interests} onToggle={toggleInterest} />
					</div>
					<div className="flex items-center justify-between gap-3 px-4 py-3">
						<span className="font-sans text-[13px] tabular-nums text-muted">
							{t("settings.topics.count")
								.replace("{n}", String(interests.length))
								.replace("{max}", String(MAX_INTERESTS))}
						</span>
						<button
							type="button"
							onClick={saveTopics}
							disabled={!dirty || savingTopics}
							className="h-9 cursor-pointer rounded-pill bg-brand px-5 font-sans text-[13px] font-semibold text-brand-on transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
						>
							{savingTopics ? t("settings.topics.saving") : t("common.save")}
						</button>
					</div>
				</Section>
			)}

			{section === "notifications" && (
				<Section
					icon={Bell}
					title={t("settings.notify.title")}
					caption={t("settings.notify.caption")}
				>
					<NotificationPrefs />
				</Section>
			)}

			{section === "safety" && (
				<Section
					icon={ShieldCheck}
					title={t("settings.blocked.title")}
					caption={t("settings.blocked.caption")}
				>
					<BlockedAccounts />
				</Section>
			)}

			{section === "display" && (
				<Section
					icon={Palette}
					title={t("settings.display.title")}
					caption={t("settings.display.caption")}
				>
					<InstallAppRow />
					<div className="flex items-center justify-between gap-3 px-4 py-3">
						<span className="font-sans text-sm font-medium text-primary">
							{t("settings.display.theme")}
						</span>
						<div className="flex gap-1.5">
							{(
								[
									["dark", Moon, t("settings.display.dark")],
									["light", Sun, t("settings.display.light")],
								] as const
							).map(([value, Icon, label]) => {
								const active = value === (isLight ? "light" : "dark");
								return (
									<button
										key={value}
										type="button"
										aria-pressed={active}
										onClick={() =>
											withThemeTransition(() => setTheme(value))
										}
										className={clsx(
											"flex h-9 cursor-pointer items-center gap-1.5 rounded-pill px-3.5 font-sans text-[13px] font-semibold transition-colors",
											active
												? "bg-primary text-page"
												: "bg-raised text-muted hover:text-primary",
										)}
									>
										<Icon size={14} weight="bold" />
										{label}
									</button>
								);
							})}
						</div>
					</div>

					<div className="border-t border-hairline px-4 py-3">
						<span className="font-sans text-sm font-medium text-primary">
							{t("settings.display.language")}
						</span>
						<div className="mt-2.5 flex flex-wrap gap-1.5">
							{LOCALES.map((code) => {
								const active = code === locale;
								return (
									<button
										key={code}
										type="button"
										aria-pressed={active}
										onClick={() => pickLocale(code)}
										className={clsx(
											"flex h-9 cursor-pointer items-center gap-1.5 rounded-pill px-3.5 font-sans text-[13px] font-semibold transition-colors",
											active
												? "bg-primary text-page"
												: "bg-raised text-muted hover:text-primary",
										)}
									>
										{active && <Check size={13} weight="bold" />}
										{LANGUAGE_NAMES[code]}
									</button>
								);
							})}
						</div>
					</div>
				</Section>
			)}
			</div>
		</div>
	);
}

/**
 * A settings group: a small label, a contained card, and the explanation as a
 * footnote underneath.
 *
 * The first pass rendered every section as full-bleed rows separated by
 * hairlines, which read as a data dump rather than a designed surface — no
 * containment, no rhythm, and a wall of 13px muted text at the top of each
 * one. Putting the rows in a card and demoting the caption to a footnote is
 * the grammar people already know from every settings screen worth using.
 *
 * Cards get no shadow — the surface ladder does depth.
 */
function Section({
	icon: Icon,
	title,
	caption,
	children,
	tone,
}: {
	icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
	title: string;
	caption: string;
	children: React.ReactNode;
	tone?: "danger";
}) {
	return (
		<section>
			<h2
				className={clsx(
					"flex items-center gap-1.5 px-1 pb-2 font-sans text-[11px] font-bold uppercase tracking-[0.14em]",
					tone === "danger" ? "text-danger" : "text-subtle",
				)}
			>
				<Icon className="h-3.5 w-3.5" strokeWidth={2.5} />
				{title}
			</h2>

			<div
				className={clsx(
					"overflow-hidden rounded-xl bg-surface",
					"[&>*+*]:border-t [&>*+*]:border-hairline",
					tone === "danger" && "ring-1 ring-danger/15",
				)}
			>
				{children}
			</div>

			{caption && (
				<p className="px-1 pt-2 font-sans text-[12.5px] leading-relaxed text-muted">
					{caption}
				</p>
			)}
		</section>
	);
}

function Row({ label, value }: { label: string; value: string }) {
	return (
		<div className="flex items-center justify-between gap-4 px-4 py-3.5">
			<span className="shrink-0 font-sans text-sm font-medium text-primary">
				{label}
			</span>
			<span className="truncate font-sans text-[13px] tabular-nums text-muted">
				{value}
			</span>
		</div>
	);
}
