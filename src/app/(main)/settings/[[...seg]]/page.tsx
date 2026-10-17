"use client";

import { mainScrollEl } from "@/lib/utils";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAtom, useSetAtom } from "jotai";
import { useTheme } from "next-themes";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ChevronRight, Info } from "@/components/ui/icons";
import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { AccessibilitySettings } from "@/components/settings/AccessibilitySettings";
import { ContentSettings, DataSettings } from "@/components/settings/DataSettings";
import {
	MessagesChat,
	MessagesReach,
	MessagesSeen,
	MessagesVoice,
} from "@/components/settings/MessagingSettings";
import { NotificationBehaviour, VisibilitySettings } from "@/components/settings/PrivacySettings";
import { InstallAppRow } from "@/components/settings/InstallAppRow";
import { InterestPicker } from "@/components/onboarding/InterestPicker";
import { BlockedAccounts } from "@/components/settings/BlockedAccounts";
import { MutedAccounts } from "@/components/settings/MutedAccounts";
import { MutedWords } from "@/components/settings/MutedWords";
import { AccountLifecycle } from "@/components/settings/AccountLifecycle";
import { UsernameSetting } from "@/components/settings/UsernameSetting";
import { SafeAvatar } from "@/components/ui/SafeAvatar";
import { UserBadges } from "@/components/ui/UserBadges";
import { NotificationPrefs } from "@/components/settings/NotificationPrefs";
import { SpaceRecapRows } from "@/components/settings/SpaceSettings";
import { GroundSetting } from "@/components/settings/GroundSetting";
import { PaletteSetting } from "@/components/settings/PaletteSetting";
import { SaveStatus } from "@/components/settings/SaveStatus";
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
	LEGACY_SECTIONS,
	MESSAGES_MOVED_KEY,
	SECTIONS,
	type SectionId,
	isSectionId,
} from "@/components/settings/sections";
import { motionReduced } from "@/lib/motion";
import { press, reveal, swap } from "@/lib/motion-presets";
import { useToast } from "@/components/ui/Toast/ToastContext";
import { updateMyProfileAction } from "@/lib/user.actions";
import { useTourSeen } from "@/lib/use-tour-seen";
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

	// Sections from before the regroup (2026-10-07) land where those
	// settings live now, keeping any #group- hash the link carried.
	const router = useRouter();
	useEffect(() => {
		const to = rawSeg ? LEGACY_SECTIONS[rawSeg] : undefined;
		if (to) router.replace(`/settings/${to}${window.location.hash}`);
	}, [rawSeg, router]);
	const moved = useTourSeen(MESSAGES_MOVED_KEY);

	// Sub-nav (owner 2026-09-15): the groups of the open section, tap to
	// scroll. The group in view is lit by an observer against the main
	// scroll box, so the nav answers "where am I" as well as "take me there".
	const [activeGroup, setActiveGroup] = useState<string>(groups[0]?.id ?? "");
	const detailRef = useRef<HTMLDivElement>(null);
	useEffect(() => {
		setActiveGroup(GROUPS[activeId][0]?.id ?? "");
	}, [activeId]);
	useEffect(() => {
		const root = mainScrollEl();
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
		const root = mainScrollEl();
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
					"pb-nav lg:sticky lg:top-0 lg:block lg:h-dvh lg:w-[300px] lg:shrink-0 lg:overflow-y-auto lg:border-r lg:border-hairline lg:pb-0 lg:[scrollbar-width:none] lg:[&::-webkit-scrollbar]:hidden",
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
				{/* A plain bar on the page colour (owner 2026-10-07): where you
				    are on the left, the save receipt on the right. It stays
				    put while the groups scroll under it. */}
				<header
					data-settings-header
					className="sticky top-0 z-sticky bg-page/85 px-2 backdrop-blur-xl md:px-6 lg:px-12"
				>
					<div className="flex h-14 items-center gap-2">
						<Link
							href="/settings"
							aria-label="Back to settings"
							className="flex h-10 w-10 shrink-0 items-center justify-center rounded-pill text-muted transition-colors hover:bg-primary/5 hover:text-primary lg:hidden"
						>
							<ArrowLeft className="h-5 w-5" strokeWidth={2.5} />
						</Link>
						<nav
							aria-label="Breadcrumb"
							className="flex min-w-0 flex-1 items-center gap-1.5 font-sans text-[calc(14px*var(--ws-fs))]"
						>
							<Link
								href="/settings"
								className="hidden shrink-0 text-subtle transition-colors hover:text-primary lg:inline"
							>
								{t("settings.title")}
							</Link>
							<ChevronRight
								aria-hidden
								className="hidden h-3.5 w-3.5 shrink-0 text-subtle lg:block"
								strokeWidth={2.25}
							/>
							<span aria-current="page" className="truncate font-semibold text-primary">
								{valid ? t(activeDef.labelKey) : "Overview"}
							</span>
						</nav>
						<SaveStatus />
					</div>
				</header>

				<div
					ref={detailRef}
					className="flex w-full max-w-[880px] flex-col gap-8 px-4 pt-2 md:px-6 lg:px-12"
				>
					{valid && (
						<motion.div {...reveal(0)}>
							<h1 className="font-display text-[calc(26px*var(--ws-fs))] font-semibold tracking-tight text-primary lg:text-[calc(30px*var(--ws-fs))]">
								{t(activeDef.labelKey)}
							</h1>
							<p className="mt-2 max-w-[62ch] font-sans text-[calc(15px*var(--ws-fs))] leading-relaxed text-muted">
								{activeDef.caption}
							</p>
						</motion.div>
					)}

					{/* The landing (owner 2026-09-20): who you are, then the few
					    things most people came to change. */}
					{!valid && <SettingsOverview />}

					{valid && activeId === "notifications" && (
						<>
							<Section id="alerts" title={t("settings.notify.title")}>
								<NotificationPrefs />
							</Section>
							<Section id="behaviour" order={1} title="Behaviour">
								<NotificationBehaviour />
							</Section>
							<Section
								id="spaces"
								order={2}
								title="Spaces"
								caption="Recaps land in your notifications, and on your phone if you use the app."
							>
								<SpaceRecapRows />
							</Section>
						</>
					)}

					{valid && activeId === "messages" && (
						<>
							<AnimatePresence initial={false}>
								{moved.ready && !moved.seen && (
									<motion.div
										key="moved"
										{...reveal(0)}
										exit={{ opacity: 0, height: 0, marginBottom: -32 }}
										className="flex items-center gap-3 overflow-hidden rounded-2xl bg-brand/10 px-4 py-3"
									>
										<Info className="h-[17px] w-[17px] shrink-0 text-brand" strokeWidth={2.25} />
										<p className="min-w-0 flex-1 font-sans text-[calc(13.5px*var(--ws-fs))] leading-snug text-primary">
											Chat settings used to be split across Safety, Data &amp; feed
											and Notifications. They&apos;re all here now.
										</p>
										<button
											type="button"
											onClick={moved.markSeen}
											className="shrink-0 cursor-pointer font-sans text-[calc(13.5px*var(--ws-fs))] font-semibold text-brand"
										>
											Got it
										</button>
									</motion.div>
								)}
							</AnimatePresence>
							<Section id="reach" title="Who can reach you">
								<MessagesReach />
							</Section>
							<Section id="seen" order={1} title="What they see from you">
								<MessagesSeen />
							</Section>
							<Section id="chat" order={2} title="In a chat">
								<MessagesChat />
							</Section>
							<Section id="voice" order={3} title="Voice notes">
								<MessagesVoice />
							</Section>
						</>
					)}

					{valid && activeId === "privacy" && (
						<Section id="visibility" title="Visibility">
							<VisibilitySettings />
						</Section>
					)}

					{valid && activeId === "muted" && (
						<>
							<Section
								id="muted-accounts"
								title="Muted accounts"
								caption="Their posts leave your feed and their likes, replies and mentions stop notifying you. They can still see your posts and message you."
							>
								<MutedAccounts />
							</Section>
							<Section
								id="muted-words"
								order={1}
								title="Muted words"
								caption="Posts with these words leave your feed, and replies or mentions with them stay quiet."
							>
								<MutedWords />
							</Section>
						</>
					)}

					{valid && activeId === "blocked" && (
						<Section
							id="blocked"
							title={t("settings.blocked.title")}
							caption={t("settings.blocked.caption")}
						>
							<BlockedAccounts />
						</Section>
					)}

					{valid && activeId === "feed" && (
						<>
							<Section
								id="interests"
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
							<Section id="timeline" order={1} title="Timeline">
								<ContentSettings />
							</Section>
						</>
					)}

					{valid && activeId === "display" && (
						<>
							<Section id="accessibility" title="Accessibility">
								<AccessibilitySettings />
							</Section>

							<Section id="appearance" order={1} title={t("settings.display.title")}>
								<InstallAppRow />
								<SelectRow
									label={t("settings.display.theme")}
									hint="Dark or light."
									tag="device"
									segmented
									// next-themes resolves on the client; until then the
									// row says Dark, which is what the server rendered.
									value={mounted && isLight ? "light" : "dark"}
									options={[
										["dark", t("settings.display.dark")],
										["light", t("settings.display.light")],
									]}
									onPick={(v) => withThemeTransition(() => setTheme(v))}
								/>

								<GroundSetting />

								<PaletteSetting />

								<SelectRow
									label={t("settings.display.language")}
									tag="device"
									value={locale}
									options={LOCALES.map((code) => [code, LANGUAGE_NAMES[code]] as const)}
									onPick={(code) => pickLocale(code)}
								/>
							</Section>
						</>
					)}

					{valid && activeId === "data" && (
						<Section id="usage" title="Data usage">
							<DataSettings />
						</Section>
					)}

					{valid && activeId === "account" && (
						<>
							{/* Identity: gives the page a subject rather than
							    opening on a bare label/value list. */}
							<motion.div {...reveal(0)} className="flex items-center gap-3.5">
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

							<Section id="account" order={1} title={t("settings.account.title")}>
								<UsernameSetting />
								<Row
									label={t("settings.account.email")}
									value={user?.email ?? "-"}
								/>
							</Section>

							<Section
								id="danger"
								order={2}
								title={t("settings.danger.title")}
								caption={t("settings.danger.caption")}
								tone="danger"
							>
								<AccountLifecycle />
							</Section>
						</>
					)}

					{valid && activeId === "premium" && (
						<Section id="plan" title={t("premium.eyebrow")} caption={t("premium.pitch")}>
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
				</div>
			</div>
		</div>
	);
}

/**
 * A settings group: a small uppercase heading over its rows (the kit lives
 * in settings/inspector.tsx). This adds the first-open rise.
 */
function Section({
	id,
	order = 0,
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
	title: string;
	caption?: string;
	children: React.ReactNode;
	tone?: "danger";
}) {
	return (
		<motion.div {...reveal(order)}>
			<SettingGroup id={id} title={title} caption={caption} tone={tone}>
				{children}
			</SettingGroup>
		</motion.div>
	);
}

const Row = ValueRow;
