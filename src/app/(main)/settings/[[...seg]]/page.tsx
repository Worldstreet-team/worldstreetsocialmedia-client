"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { AccessibilitySettings } from "@/components/settings/AccessibilitySettings";
import { ContentSettings, DataSettings } from "@/components/settings/DataSettings";
import { MessagingSettings } from "@/components/settings/MessagingSettings";
import { NotificationBehaviour, PrivacySettings } from "@/components/settings/PrivacySettings";
import { InstallAppRow } from "@/components/settings/InstallAppRow";
import { InterestPicker } from "@/components/onboarding/InterestPicker";
import { BlockedAccounts } from "@/components/settings/BlockedAccounts";
import { AccountLifecycle } from "@/components/settings/AccountLifecycle";
import { UsernameSetting } from "@/components/settings/UsernameSetting";
import { LayoutGrid } from "lucide-react";
import { SafeAvatar } from "@/components/ui/SafeAvatar";
import { UserBadges } from "@/components/ui/UserBadges";
import { NotificationPrefs } from "@/components/settings/NotificationPrefs";
import { PaletteSetting } from "@/components/settings/PaletteSetting";
import { SettingsNav } from "@/components/settings/SettingsNav";
import { SettingsOverview } from "@/components/settings/SettingsOverview";
import {
	SelectRow,
	SettingGroup,
	SettingRow,
	ValueRow,
} from "@/components/settings/inspector";
import {
	GROUPS,
	SECTIONS,
	type SectionId,
	isSectionId,
} from "@/components/settings/sections";
import { motionReduced } from "@/lib/motion";
import { press, reveal, swap, thumbSpring } from "@/lib/motion-presets";
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
	const groups = GROUPS[activeId];

	// Sub-nav (owner 2026-09-15): the groups of the open section, tap to
	// scroll. The group in view is lit by an observer against the main
	// scroll box, so the nav answers "where am I" as well as "take me there".
	const [activeGroup, setActiveGroup] = useState<string>(groups[0]?.id ?? "");
	const detailRef = useRef<HTMLDivElement>(null);
	useEffect(() => {
		setActiveGroup(GROUPS[activeId][0]?.id ?? "");
	}, [activeId]);
	useEffect(() => {
		const root = document.getElementById("ws-main-scroll");
		const targets = Array.from(
			detailRef.current?.querySelectorAll<HTMLElement>("[data-group]") ?? [],
		);
		if (targets.length < 2) return;
		const io = new IntersectionObserver(
			(entries) => {
				// Topmost visible group wins; falling back to the last one that
				// crossed above the line keeps the nav lit while scrolling up.
				const visible = entries
					.filter((e) => e.isIntersecting)
					.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
				const top = visible[0]?.target.getAttribute("data-group");
				if (top) setActiveGroup(top);
			},
			{ root, rootMargin: "-96px 0px -55% 0px", threshold: 0 },
		);
		for (const el of targets) io.observe(el);
		return () => io.disconnect();
	}, [activeId]);
	// Scroll the column by hand rather than through scrollIntoView: the
	// header is a floating sticky pill, and a block that lands at the
	// container's top edge lands UNDER it. Measuring the pill also keeps
	// this right when the phone's chip strip is there and when text size
	// makes both taller.
	const scrollToGroup = useCallback((id: string) => {
		const el = document.getElementById(`group-${id}`);
		if (!el) return;
		setActiveGroup(id);
		const behavior = motionReduced() ? ("auto" as const) : ("smooth" as const);
		const root = document.getElementById("ws-main-scroll");
		const header = document.querySelector<HTMLElement>("[data-settings-header]");
		const offset = (header?.offsetHeight ?? 0) + 10;
		if (!root) {
			el.scrollIntoView({ behavior, block: "start" });
			return;
		}
		const top =
			el.getBoundingClientRect().top -
			root.getBoundingClientRect().top +
			root.scrollTop -
			offset;
		root.scrollTo({ top: Math.max(0, top), behavior });
	}, []);

	// Master search hands over with a hash (#group-<id>): go to that block
	// and ring it for a moment, so the eye lands where the result pointed.
	useEffect(() => {
		const land = () => {
			const m = window.location.hash.match(/^#group-([\w-]+)$/);
			if (!m) return;
			const el = document.getElementById(`group-${m[1]}`);
			if (!el) return;
			scrollToGroup(m[1]);
			el.classList.add("ring-2", "ring-brand/60");
			window.setTimeout(() => el.classList.remove("ring-2", "ring-brand/60"), 1600);
			// Spent: a later section change must not replay it.
			history.replaceState(null, "", window.location.pathname);
		};
		// Two frames, then a beat: the router does its own scroll to the
		// fragment on arrival, and landing before that one only to be
		// overruled by it put the block back under the header.
		let id = 0;
		const raf = requestAnimationFrame(() =>
			requestAnimationFrame(() => {
				id = window.setTimeout(land, 120);
			}),
		);
		window.addEventListener("hashchange", land);
		return () => {
			cancelAnimationFrame(raf);
			window.clearTimeout(id);
			window.removeEventListener("hashchange", land);
		};
	}, [activeId, scrollToGroup]);

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
	// next-themes resolves on the client. The mode thumb waits for mount, so
	// the server markup matches and a light reader does not watch it slide
	// across from Dark on load.
	const [mounted, setMounted] = useState(false);
	useEffect(() => setMounted(true), []);

	// "{n} of {max} selected", split around the number so only the digits roll.
	const [countBefore, countAfter = ""] = t("settings.topics.count")
		.replace("{max}", String(MAX_INTERESTS))
		.split("{n}");

	return (
		<div className="flex min-h-full w-full items-start">
			{/* Section list (desktop) / hub (mobile). Hidden on mobile once a
			    section is open so the detail owns the screen. */}
			<div
				className={clsx(
					// Full height on a desktop (owner 2026-09-20): the rail and its
					// border run to the bottom of the window however short the
					// open section is, and it scrolls on its own when the map,
					// with every group folded out, is taller than the window.
					"pb-nav lg:sticky lg:top-0 lg:block lg:h-dvh lg:w-[288px] lg:shrink-0 lg:overflow-y-auto lg:border-r lg:border-hairline lg:pb-0 lg:[scrollbar-width:none] lg:[&::-webkit-scrollbar]:hidden",
					valid ? "hidden" : "block w-full",
				)}
			>
				{/* `valid`, not `activeId`: at /settings nothing is a section, the
				    Overview is what is open. */}
				<SettingsNav activeId={valid} activeGroup={activeGroup} onGroup={scrollToGroup} />
			</div>

			{/* The open section. Hidden on mobile at the hub. */}
			<div
				className={clsx(
					"min-w-0 flex-1 pb-nav lg:block lg:pb-16",
					valid ? "block" : "hidden lg:block",
				)}
			>
				{/* The Messages thread's grammar: the title rides in a frosted pill
				    floating over the blocks, with the section's own icon. The
				    pill blurs what scrolls under it; the blocks are its siblings,
				    never its children, so no blur sits inside another. */}
				<header
					data-settings-header
					className="sticky top-0 z-sticky px-2 pt-2 md:px-3 md:pt-3"
				>
					<div className="flex h-14 items-center gap-2.5 rounded-pill px-2 glass-frost backdrop-blur-xl">
						<Link
							href="/settings"
							aria-label="Back to settings"
							className="flex h-10 w-10 shrink-0 items-center justify-center rounded-pill text-muted transition-colors hover:bg-primary/5 hover:text-primary lg:hidden"
						>
							<ArrowLeft className="h-5 w-5" strokeWidth={2.5} />
						</Link>
						{valid ? (
							<activeDef.icon
								className="ml-2 hidden h-[19px] w-[19px] shrink-0 text-primary lg:block"
								strokeWidth={2.25}
							/>
						) : (
							<LayoutGrid
								className="ml-2 hidden h-[19px] w-[19px] shrink-0 text-primary lg:block"
								strokeWidth={2.25}
							/>
						)}
						<h2 className="min-w-0 flex-1 truncate font-display text-[calc(17px*var(--ws-fs))] font-semibold tracking-tight text-primary">
							{valid ? t(activeDef.labelKey) : "Overview"}
						</h2>
						<span className="mr-3 hidden shrink-0 items-center gap-1.5 font-sans text-[calc(12.5px*var(--ws-fs))] text-muted sm:flex">
							<span className="h-1.5 w-1.5 rounded-pill bg-success" />
							Synced to your account
						</span>
					</div>
					{/* The sub-nav on a phone: the section's groups as chips, tap to
					    scroll. The desktop list carries the same groups under the
					    open section, so this strip is mobile only. */}
					{/* No chip strip on a phone any more (mobile direction A): a
					    section is a back arrow, a title and its blocks. The
					    sidebar carries the groups on a desktop. */}
				</header>

				<div ref={detailRef} className="flex w-full max-w-[980px] flex-col gap-2 p-2 md:gap-3 md:p-3">
					{/* The landing (owner 2026-09-20): who you are, then the few
					    things most people came to change. It used to open on
					    Account, so the first screen was a username field and a
					    Delete account button. */}
					{!valid && <SettingsOverview />}

					{valid && activeId === "account" && (
						<>
							{/* Identity card: gives the page a subject rather than
							    opening on a bare label/value list. */}
							<motion.div
								{...reveal(0)}
								className="flex items-center gap-3.5 rounded-2xl p-4 glass-frost backdrop-blur-xl lg:px-5"
							>
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
							</motion.div>

							<Section
								id="account"
								order={1}
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
								id="danger"
								order={2}
								icon={ShieldAlert}
								title={t("settings.danger.title")}
								caption={t("settings.danger.caption")}
								tone="danger"
							>
								<AccountLifecycle />
							</Section>
						</>
					)}

					{valid && activeId === "premium" && (
						<Section
							id="plan"
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
							<SettingRow label="Plan" hint="Billing, renewal and your verified tick.">
								<motion.button
									type="button"
									{...press}
									onClick={() => setPremiumOpen(true)}
									className="h-10 cursor-pointer rounded-pill bg-brand px-5 font-sans text-[calc(13px*var(--ws-fs))] font-semibold text-brand-on transition-opacity hover:opacity-90"
								>
									{subState?.subscription
										? t("premium.manageTitle")
										: t("premium.cta")}
								</motion.button>
							</SettingRow>
						</Section>
					)}

					{valid && activeId === "topics" && (
						<Section
							id="interests"
							icon={SlidersHorizontal}
							title={t("settings.topics.title")}
							caption={t("settings.topics.caption")}
						>
							<div className="py-4">
								<InterestPicker selected={interests} onToggle={toggleInterest} />
							</div>
							<div className="flex min-h-[52px] items-center justify-between gap-3 border-y border-hairline py-1.5">
								<span className="font-sans text-[calc(13px*var(--ws-fs))] tabular-nums text-muted">
									{countBefore}
									<span className="relative inline-flex overflow-hidden align-bottom">
										<AnimatePresence mode="popLayout" initial={false}>
											<motion.span
												key={interests.length}
												{...swap}
												className="inline-block"
											>
												{interests.length}
											</motion.span>
										</AnimatePresence>
									</span>
									{countAfter}
								</span>
								<motion.button
									type="button"
									{...press}
									onClick={saveTopics}
									disabled={!dirty || savingTopics}
									className="h-10 cursor-pointer rounded-pill bg-brand px-5 font-sans text-[calc(13px*var(--ws-fs))] font-semibold text-brand-on transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
								>
									<AnimatePresence mode="wait" initial={false}>
										<motion.span
											key={savingTopics ? "saving" : "save"}
											{...swap}
											className="inline-block"
										>
											{savingTopics
												? t("settings.topics.saving")
												: t("common.save")}
										</motion.span>
									</AnimatePresence>
								</motion.button>
							</div>
						</Section>
					)}

					{valid && activeId === "notifications" && (
						<>
							<Section
								id="alerts"
								icon={Bell}
								title={t("settings.notify.title")}
								caption={t("settings.notify.caption")}
							>
								<NotificationPrefs />
							</Section>

							<Section
								id="behaviour"
								order={1}
								icon={BellRing}
								title="Notification behaviour"
								caption="How notifications reach you inside the app."
							>
								<NotificationBehaviour />
							</Section>
						</>
					)}

					{valid && activeId === "safety" && (
						<>
							<Section
								id="privacy"
								icon={Lock}
								title="Privacy"
								caption="Who sees what about you. Each of these is enforced on the server, not just hidden in the app."
							>
								<PrivacySettings />
							</Section>

							<Section
								id="blocked"
								order={1}
								icon={ShieldCheck}
								title={t("settings.blocked.title")}
								caption={t("settings.blocked.caption")}
							>
								<BlockedAccounts />
							</Section>
						</>
					)}

					{valid && activeId === "data" && (
						<>
							<Section
								id="usage"
								icon={Gauge}
								title="Data usage"
								caption="What the app downloads on its own. Most of these follow one switch, so a phone already saving data gets the lighter app."
							>
								<DataSettings />
							</Section>
							<Section
								id="timeline"
								order={1}
								icon={Rss}
								title="Timeline"
								caption="What shows up when you open Home, and how much of it loads at once."
							>
								<ContentSettings />
							</Section>
							<Section
								id="messaging"
								order={2}
								icon={MessageSquare}
								title="Messaging"
								caption="How chat behaves for you. None of it changes what the other person sees."
							>
								<MessagingSettings />
							</Section>
						</>
					)}

					{valid && activeId === "display" && (
						<>
							<Section
								id="accessibility"
								icon={Eye}
								title="Accessibility"
								caption="Size, colour and motion. Saved to your account, so it follows you to every device you sign in on."
							>
								<AccessibilitySettings />
							</Section>

							<Section
								id="appearance"
								order={1}
								icon={Palette}
								title={t("settings.display.title")}
								caption={t("settings.display.caption")}
							>
								<InstallAppRow />
								<SelectRow
									label={t("settings.display.theme")}
									hint="Dark or light. Stays on this device."
									// next-themes resolves on the client; until then the
									// row says Dark, which is what the server rendered.
									value={mounted && isLight ? "light" : "dark"}
									options={[
										["dark", t("settings.display.dark")],
										["light", t("settings.display.light")],
									]}
									onPick={(v) => withThemeTransition(() => setTheme(v))}
								/>

								<PaletteSetting />

								<SelectRow
									label={t("settings.display.language")}
									value={locale}
									options={LOCALES.map((code) => [code, LANGUAGE_NAMES[code]] as const)}
									onPick={(code) => pickLocale(code)}
								/>
							</Section>
						</>
					)}
				</div>
			</div>
		</div>
	);
}

/**
 * A settings group: a frosted block with an icon header, the same
 * architecture as the Messages inbox blocks (owner 2026-09-20). The block
 * itself lives in settings/inspector.tsx; this adds the first-open rise.
 */
function Section({
	id,
	order = 0,
	icon,
	title,
	caption,
	children,
	tone,
}: {
	/** Matches a GROUPS entry for this section; the sub-nav scrolls here. */
	id: string;
	/** Position on the page. The groups rise in sequence when a section
	 *  opens; they mount once per open, so it never replays on a re-render. */
	order?: number;
	icon?: React.ComponentType<{ className?: string; strokeWidth?: number }>;
	title: string;
	caption: string;
	children: React.ReactNode;
	tone?: "danger";
}) {
	return (
		<motion.div {...reveal(order)}>
			<SettingGroup id={id} icon={icon} title={title} caption={caption} tone={tone}>
				{children}
			</SettingGroup>
		</motion.div>
	);
}

const Row = ValueRow;
