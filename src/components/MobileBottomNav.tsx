"use client";

import Link from "next/link";
import { usePressPrefetch } from "@/hooks/usePressPrefetch";
import { Fragment, useEffect, useState } from "react";
import { useAppPathname } from "@/i18n/useAppPathname";
import { EcosystemSheet } from "@/components/layout/EcosystemSheet";
import { BrandMark } from "@/components/layout/BrandRitual";
// Nav uses Phosphor with weight="fill" on the active tab, matching the rail.
import type { Icon as PhosphorIcon } from "@phosphor-icons/react";
import {
	ChatCircleDots,
	House,
	Binoculars,
	UserCircle,
} from "@phosphor-icons/react";
import clsx from "clsx";
import { BadgedIcon } from "@/components/ui/Badge";
import { useAtomValue } from "jotai";
import { unreadMessagesCountAtom } from "@/store/messageCache";
import { userAtom } from "@/store/user.atom";
import { useT } from "@/i18n/client";

const navIcon = (Icon: PhosphorIcon) => {
	const NavIcon = ({ isActive }: { isActive?: boolean }) => (
		<Icon
			// Icon-only bar (owner ruling 2026-09-02): the glyph carries the
			// tab alone. Third sizing round, owner each time: 32 -> 36 -> 50
			// ("increase it by 40%"). These are THE controls on a phone; they
			// get billboard treatment.
			size={50}
			weight={isActive ? "fill" : "duotone"}
			aria-hidden="true"
		/>
	);
	NavIcon.displayName = `NavIcon(${Icon.displayName ?? "icon"})`;
	return NavIcon;
};

/** The brand mark sits mid-row: two tabs, the mark, two tabs. */
const CENTER_SLOT = 2;

const HomeIcon = navIcon(House);
// Binoculars matches the rail's Explore glyph (owner ruling 2026-08-28).
const SearchIcon = navIcon(Binoculars);
const MessageIcon = navIcon(ChatCircleDots);


/**
 * The profile tab carries the glyph, not the account's photo (owner ruling
 * 2026-08-28). It previously rendered the avatar; the bar reads as one set of
 * controls, and a photo in a row of line icons breaks that.
 *
 * It also means this tab no longer depends on the user atom, which hydrates on
 * the client — the whole reason this component had to defer its first paint.
 */
const ProfileIcon = ({ isActive }: { isActive?: boolean }) => (
	<UserCircle size={50} weight={isActive ? "fill" : "duotone"} aria-hidden />
);
ProfileIcon.displayName = "ProfileIcon";

export const MobileBottomNav = () => {
	const t = useT();
	const pathname = useAppPathname();
	const press = usePressPrefetch();
	const [ecosystemOpen, setEcosystemOpen] = useState(false);
	const unreadMessages = useAtomValue(unreadMessagesCountAtom);
	const storedUser = useAtomValue(userAtom);
	/**
	 * The icon no longer needs the user, but the HREF still does, and the atom
	 * hydrates on the client: the server renders "/profile" and the client's
	 * first pass would render "/profile/<handle>". React counts that as a
	 * hydration mismatch and throws the whole tree away, re-rendering the app
	 * on every load — the same trap StudioShell defers around.
	 *
	 * Holding the server's answer for one paint costs nothing visible: both
	 * routes land on your own profile.
	 */
	const [hydrated, setHydrated] = useState(false);
	useEffect(() => setHydrated(true), []);
	const user = hydrated ? storedUser : null;

	const navItems = [
		{
			href: "/",
			icon: HomeIcon,
			label: t("nav.home"),
			active: pathname === "/",
		},
		{
			href: "/explore",
			icon: SearchIcon,
			label: t("nav.explore"),
			active: pathname.startsWith("/explore"),
		},
		{
			href: "/messages",
			icon: MessageIcon,
			label: t("nav.messages"),
			active: pathname.startsWith("/messages"),
			badge: unreadMessages,
		},
		{
			// Right end, where a thumb reaches last — you go to your own profile
			// deliberately, not while skimming.
			href: user?.username ? `/profile/${user.username}` : "/profile",
			icon: ProfileIcon,
			label: t("nav.profile"),
			active: pathname.startsWith("/profile"),
		},
	];

	// Don't show on auth/onboarding flows.
	if (
		pathname.startsWith("/sign-in") ||
		pathname.startsWith("/sign-up") ||
		pathname.startsWith("/onboarding")
	) {
		return null;
	}

	// Hide on message detail screens (when deep in a conversation)
	if (pathname.startsWith("/messages/") && pathname.split("/").length > 2) {
		return null;
	}

	// Hide on post detail screens and the full-screen vertical surface.
	// Exact-match /live (plus real subroutes): a bare startsWith("/live")
	// also swallowed /live-now and left that page with no navigation at all.
	if (
		pathname.startsWith("/post/") ||
		pathname === "/live" ||
		pathname.startsWith("/live/")
	) {
		return null;
	}

	return (
		<>
			{/* The compose FAB that floated here was one of TWO gold FABs
			    stacked in the same corner — CreateFab (root layout) is the one
			    create entry point now.

			    Docked glass bar (owner ruling 2026-08-27): flush to the bottom
			    edge and full-bleed rather than floating, but still glass —
			    this and the media editors remain the sanctioned exceptions to
			    the ecosystem no-backdrop-blur rule. The feed still scrolls
			    under it, so `pb-nav`/`bottom-nav` clearance still applies. */}
			<div className="fixed inset-x-0 bottom-0 z-sticky md:hidden border-t border-hairline glass-nav backdrop-blur-xl backdrop-saturate-150">
				{/* Docked means the bar now sits UNDER the home indicator, so it
				    owns the safe-area inset again (a floating bar cleared it via
				    its own `bottom` offset instead). */}
				<div style={{ paddingBottom: "var(--ws-safe-bottom)" }}>
				<div className="flex justify-between items-center h-[84px] px-1">
					{navItems.map((item, index) => (
						<Fragment key={item.href}>
							{/* The centre slot is the brand, not a destination. It used
							    to be The Space, which is still one tap away in the rail
							    and the FAB — the ecosystem had no mobile entry at all. */}
							{index === CENTER_SLOT && (
								<button
									type="button"
									onClick={() => setEcosystemOpen(true)}
									aria-haspopup="dialog"
									aria-expanded={ecosystemOpen}
									aria-label="WorldStreet"
									className="flex h-full w-full min-w-0 items-center justify-center transition-colors active:bg-primary/10"
								>
									{/* The real animated mark, not the flat PNG: it draws
									    itself on the same 5.2s ritual as the rail's lockup
									    and strokes in the brand token, so it follows the
									    palette. Its own reduced-motion rule in globals.css
									    resolves it to the finished W. */}
									<span
										className={clsx(
											"flex h-[64px] w-[64px] items-center justify-center rounded-[10px] transition-colors",
											ecosystemOpen && "bg-raised",
										)}
									>
										{/* Bigger than the Phosphor glyphs beside it on
										    purpose: the W is a thin two-stroke outline, so at
										    a matched size it reads lighter than the solid
										    duotone icons it sits between. */}
										<BrandMark size={56} />
									</span>
								</button>
							)}
						<Link
							href={item.href}
							{...press(item.href)}
							aria-label={item.label}
							className={clsx(
								// Icon-only (owner ruling 2026-09-02): no labels, the
								// glyphs a size up. The name lives on as the aria-label
								// and the badge label. `.glass-nav` follows the theme,
								// so the ink is the normal token pair.
								"flex items-center justify-center w-full h-full min-w-0 active:bg-primary/10 transition-colors",
								item.active ? "text-gold" : "text-muted",
							)}
						>
							<BadgedIcon count={item.badge} label={item.label}>
								<item.icon isActive={item.active} />
							</BadgedIcon>
						</Link>
						</Fragment>
					))}
					</div>
				</div>
			</div>

			<EcosystemSheet
				open={ecosystemOpen}
				onClose={() => setEcosystemOpen(false)}
			/>
		</>
	);
};
