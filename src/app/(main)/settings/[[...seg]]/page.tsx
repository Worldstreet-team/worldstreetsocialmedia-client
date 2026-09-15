"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAtom, useSetAtom } from "jotai";
import { useTheme } from "next-themes";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
	ArrowLeft,
	BadgeCheck,
	Bell,
	BellRing,
	Eye,
	Gauge,
	Lock,
	MessageSquare,
	Palette,
	Rss,
	ShieldAlert,
	ShieldCheck,
	SlidersHorizontal,
	UserCircle,
} from "lucide-react";
import { Check, Moon, Sun } from "@phosphor-icons/react";
import clsx from "clsx";
import { AccessibilitySettings } from "@/components/settings/AccessibilitySettings";
import { ContentSettings, DataSettings } from "@/components/settings/DataSettings";
import { MessagingSettings } from "@/components/settings/MessagingSettings";
import { NotificationBehaviour, PrivacySettings } from "@/components/settings/PrivacySettings";
import { InstallAppRow } from "@/components/settings/InstallAppRow";
import { InterestPicker } from "@/components/onboarding/InterestPicker";
import { BlockedAccounts } from "@/components/settings/BlockedAccounts";
import { AccountLifecycle } from "@/components/settings/AccountLifecycle";
import { UsernameSetting } from "@/components/settings/UsernameSetting";
import { SafeAvatar } from "@/components/ui/SafeAvatar";
import { UserBadges } from "@/components/ui/UserBadges";
import { NotificationPrefs } from "@/components/settings/NotificationPrefs";
import { SettingsNav } from "@/components/settings/SettingsNav";
import {
	SECTIONS,
	type SectionId,
	isSectionId,
} from "@/components/settings/sections";
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
 * One optional catch-all page (/settings and /settings/<section>) rather
 * than a page per section: the component never unmounts as the reader moves
 * between sections, so a half-picked topic list or an open language menu
 * survives the move, and the URL is still real and deep-linkable.
 *
 * Desktop runs a two-pane: the section list on the left, the open section
 * in the space the discovery rail gave up (MainShell hands Settings the
 * width). Mobile is the X-style hub: search over the section list, and a
 * tap pushes into the section with a back arrow.
 */
export default function SettingsPage() {
	const t = useT();
	const { toast } = useToast();
	const [user, setUser] = useAtom(userAtom);
	const { resolvedTheme, setTheme } = useTheme();

	// The open section rides the URL. An unknown or absent segment resolves
	// to the account default on desktop; on mobile an absent segment is the
	// hub itself (no detail shown).
	const params = useParams<{ seg?: string[] }>();
	const rawSeg = Array.isArray(params?.seg) ? params.seg[0] : undefined;
	const valid = isSectionId(rawSeg) ? rawSeg : undefined;
	const activeId: SectionId = valid ?? "account";
	const activeDef = SECTIONS.find((s) => s.id === activeId)!;

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
		// Ids only, JSON-encoded, the same seam the composer uses.
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

	// Fetched when the section is opened, so the other sections never pay for it.
	useEffect(() => {
		if (activeId !== "premium" || subState) return;
		void getSubscriptionAction().then((res) => {
			if (res.success) setSubState(res.data);
		});
	}, [activeId, subState]);

	const isLight = resolvedTheme === "light";

	return (
		<div className="flex min-h-full w-full items-start">
			{/* Section list (desktop) / hub (mobile). Hidden on mobile once a
			    section is open so the detail owns the screen. */}
			<div
				className={clsx(
					"pb-nav lg:sticky lg:top-0 lg:block lg:w-[264px] lg:shrink-0 lg:border-r lg:border-hairline lg:pb-0",
					valid ? "hidden" : "block w-full",
				)}
			>
				<SettingsNav activeId={activeId} />
			</div>

			{/* The open section. Hidden on mobile at the hub. */}
			<div
				className={clsx(
					"min-w-0 flex-1 pb-nav lg:block lg:pb-16",
					valid ? "block" : "hidden lg:block",
				)}
			>
				<header className="sticky top-0 z-sticky flex items-center gap-2 border-b border-hairline bg-page px-4 py-3">
					<Link
						href="/settings"
						aria-label="Back to settings"
						className="-ml-1 flex h-9 w-9 items-center justify-center rounded-pill text-muted transition-colors hover:bg-primary/5 hover:text-primary lg:hidden"
					>
						<ArrowLeft className="h-5 w-5" strokeWidth={2.5} />
					</Link>
					<h2 className="font-display text-[calc(17px*var(--ws-fs))] font-semibold text-primary">
						{t(activeDef.labelKey)}
					</h2>
				</header>

				<div className="mx-auto flex w-full max-w-[640px] flex-col gap-6 px-4 py-4">
					{activeId === "account" && (
						<>
							{/* Identity card: gives the page a subject rather than
							    opening on a bare label/value list. */}
							<div className="flex items-center gap-3.5 rounded-xl bg-surface p-4">
								<span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-pill bg-sunken">
									<SafeAvatar src={user?.avatar} />
								</span>
								<div className="min-w-0">
									<div className="flex items-center gap-1.5">
										<span className="truncate font-display text-[calc(17px*var(--ws-fs))] font-semibold text-primary">
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
									<span className="block truncate font-sans text-[calc(13px*var(--ws-fs))] text-muted">
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
									value={user?.email ?? "-"}
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

					{activeId === "premium" && (
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
											: "-"
								}
							/>
							<div className="px-4 pb-4 pt-1">
								<button
									type="button"
									onClick={() => setPremiumOpen(true)}
									className="h-9 cursor-pointer rounded-pill bg-brand px-5 font-sans text-[calc(13px*var(--ws-fs))] font-semibold text-brand-on transition-opacity hover:opacity-90"
								>
									{subState?.subscription
										? t("premium.manageTitle")
										: t("premium.cta")}
								</button>
							</div>
						</Section>
					)}

					{activeId === "topics" && (
						<Section
							icon={SlidersHorizontal}
							title={t("settings.topics.title")}
							caption={t("settings.topics.caption")}
						>
							<div className="p-4">
								<InterestPicker selected={interests} onToggle={toggleInterest} />
							</div>
							<div className="flex items-center justify-between gap-3 px-4 py-3">
								<span className="font-sans text-[calc(13px*var(--ws-fs))] tabular-nums text-muted">
									{t("settings.topics.count")
										.replace("{n}", String(interests.length))
										.replace("{max}", String(MAX_INTERESTS))}
								</span>
								<button
									type="button"
									onClick={saveTopics}
									disabled={!dirty || savingTopics}
									className="h-9 cursor-pointer rounded-pill bg-brand px-5 font-sans text-[calc(13px*var(--ws-fs))] font-semibold text-brand-on transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
								>
									{savingTopics ? t("settings.topics.saving") : t("common.save")}
								</button>
							</div>
						</Section>
					)}

					{activeId === "notifications" && (
						<>
							<Section
								icon={Bell}
								title={t("settings.notify.title")}
								caption={t("settings.notify.caption")}
							>
								<NotificationPrefs />
							</Section>

							<Section
								icon={BellRing}
								title="Notification behaviour"
								caption="How notifications reach you inside the app."
							>
								<NotificationBehaviour />
							</Section>
						</>
					)}

					{activeId === "safety" && (
						<>
							<Section
								icon={Lock}
								title="Privacy"
								caption="Who sees what about you. Each of these is enforced on the server, not just hidden in the app."
							>
								<PrivacySettings />
							</Section>

							<Section
								icon={ShieldCheck}
								title={t("settings.blocked.title")}
								caption={t("settings.blocked.caption")}
							>
								<BlockedAccounts />
							</Section>
						</>
					)}

					{activeId === "data" && (
						<>
							<Section
								icon={Gauge}
								title="Data usage"
								caption="What the app downloads on its own. Most of these follow one switch, so a phone already saving data gets the lighter app."
							>
								<DataSettings />
							</Section>
							<Section
								icon={Rss}
								title="Timeline"
								caption="What shows up when you open Home, and how much of it loads at once."
							>
								<ContentSettings />
							</Section>
							<Section
								icon={MessageSquare}
								title="Messaging"
								caption="How chat behaves for you. None of it changes what the other person sees."
							>
								<MessagingSettings />
							</Section>
						</>
					)}

					{activeId === "display" && (
						<>
							<Section
								icon={Eye}
								title="Accessibility"
								caption="Size, colour and motion. Saved to your account, so it follows you to every device you sign in on."
							>
								<AccessibilitySettings />
							</Section>

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
														"flex h-9 cursor-pointer items-center gap-1.5 rounded-pill px-3.5 font-sans text-[calc(13px*var(--ws-fs))] font-semibold transition-colors",
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
														"flex h-9 cursor-pointer items-center gap-1.5 rounded-pill px-3.5 font-sans text-[calc(13px*var(--ws-fs))] font-semibold transition-colors",
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
						</>
					)}
				</div>
			</div>
		</div>
	);
}

/**
 * A settings group: a small label, a contained card, and the explanation as a
 * footnote underneath. Cards get no shadow, the surface ladder does depth.
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
					"flex items-center gap-1.5 px-1 pb-2 font-sans text-[calc(11px*var(--ws-fs))] font-bold uppercase tracking-[0.14em]",
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
				<p className="px-1 pt-2 font-sans text-[calc(12.5px*var(--ws-fs))] leading-relaxed text-muted">
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
			<span className="truncate font-sans text-[calc(13px*var(--ws-fs))] tabular-nums text-muted">
				{value}
			</span>
		</div>
	);
}
