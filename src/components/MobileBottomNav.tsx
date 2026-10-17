"use client";

import Link from "next/link";
import { usePressPrefetch } from "@/hooks/usePressPrefetch";
import { Fragment, useEffect, useState } from "react";
import { useAppPathname } from "@/i18n/useAppPathname";
// Nav uses Phosphor with weight="fill" on the active tab, matching the rail.
import type { Icon as PhosphorIcon } from "@phosphor-icons/react";
import {
	ChatCircleDots,
	House,
	Binoculars,
	MonitorPlay,
	UserCircle,
} from "@phosphor-icons/react";
import clsx from "clsx";
import { motion, useReducedMotionConfig } from "framer-motion";
import { BadgedIcon } from "@/components/ui/Badge";
import { useAtomValue } from "jotai";
import { unreadMessagesCountAtom } from "@/store/messageCache";
import { userAtom } from "@/store/user.atom";
import { useT } from "@/i18n/client";
import { usePostLayerOpen } from "@/components/feed/PostLayer";
// Aliased: `press` in this file is already the prefetch-on-pointer-down hook.
import { press as pressTap } from "@/lib/motion-presets";

const MotionLink = motion.create(Link);

/* Press feedback only, and only on the glyph. The whole cell is the target,
   so the cell carries the gesture and the glyph answers it. No entrance and
   no pop on becoming active: this bar is tapped all day, and a bar that
   performs on every tap gets tiring by lunch. Nothing here scales the
   blurred bar itself. */
const GLYPH_TAP = { tap: pressTap.whileTap } as const;

const navIcon = (Icon: PhosphorIcon) => {
	const NavIcon = ({ isActive }: { isActive?: boolean }) => (
		<Icon
			// Line glyphs in the rail's own style, filled when active (owner
			// 2026-10-16: the big duotone set "looks disgusting"; keep the
			// Explore glyph's style). Five even cells, no labels: clean.
			size={26}
			weight={isActive ? "fill" : "regular"}
			aria-hidden="true"
		/>
	);
	NavIcon.displayName = `NavIcon(${Icon.displayName ?? "icon"})`;
	return NavIcon;
};

const HomeIcon = navIcon(House);
// Binoculars matches the rail's Explore glyph (owner rulings 2026-08-28 +
// 2026-09-03: the tab is the explore ROUTE, wearing the explore glyph).
const SearchIcon = navIcon(Binoculars);
const MessageIcon = navIcon(ChatCircleDots);
// The W left the middle (owner 2026-10-16): The Space takes it, in the
// rail's own glyph. The ecosystem is in the drawer's Products.
const SpaceIcon = navIcon(MonitorPlay);


/**
 * The profile tab carries the glyph, not the account's photo (owner ruling
 * 2026-08-28). It previously rendered the avatar; the bar reads as one set of
 * controls, and a photo in a row of line icons breaks that.
 *
 * It also means this tab no longer depends on the user atom, which hydrates on
 * the client — the whole reason this component had to defer its first paint.
 */
const ProfileIcon = ({ isActive }: { isActive?: boolean }) => (
	<UserCircle size={26} weight={isActive ? "fill" : "regular"} aria-hidden />
);
ProfileIcon.displayName = "ProfileIcon";

export const MobileBottomNav = () => {
	const t = useT();
	const pathname = useAppPathname();
	const press = usePressPrefetch();
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
	// Reading a post, the bar slides down out of the way and comes back up
	// when you leave it (owner 2026-10-16): the layer over the feed, or the
	// post's own page.
	const postOpen = usePostLayerOpen();
	const reduced = useReducedMotionConfig();
	const tucked = postOpen || pathname.startsWith("/post/");

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
			href: "/live",
			icon: SpaceIcon,
			label: t("nav.videos"),
			active: pathname === "/live" || pathname.startsWith("/live/"),
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

	// The Space keeps the bar, TikTok-style (owner 2026-10-16), on solid
	// black under the video. Exact-match /live (plus real subroutes): a bare
	// startsWith("/live") would also catch /live-now.
	const onSpace = pathname === "/live" || pathname.startsWith("/live/");

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
			<motion.div
				initial={false}
				animate={{ y: tucked ? "110%" : 0 }}
				transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 40 }}
				aria-hidden={tucked || undefined}
				inert={tucked || undefined}
				// On The Space the bar wears the dark tokens in either theme, so
				// its glyphs read on the black under the video.
				data-ws-theme={onSpace ? "platform" : undefined}
				className={clsx(
					"fixed inset-x-0 bottom-0 md:hidden",
					onSpace
						? "z-modal bg-black"
						: "z-sticky bg-page/70 backdrop-blur-[40px] backdrop-saturate-[1.8]",
				)}
			>
				{/* Docked means the bar now sits UNDER the home indicator, so it
				    owns the safe-area inset again (a floating bar cleared it via
				    its own `bottom` offset instead). */}
				<div style={{ paddingBottom: "var(--ws-safe-bottom)" }}>
				<div className="flex justify-between items-center h-[56px] px-2">
					{navItems.map((item) => (
						<Fragment key={item.href}>
						<MotionLink
							href={item.href}
							{...press(item.href)}
							whileTap="tap"
							aria-label={item.label}
							className={clsx(
								// Icon-only (owner ruling 2026-09-02): no labels, the
								// glyphs a size up. The name lives on as the aria-label
								// and the badge label. `.glass-nav` follows the theme,
								// so the ink is the normal token pair.
								"flex h-full w-full min-w-0 items-center justify-center transition-colors",
								item.active ? "text-primary" : "text-muted",
							)}
						>
							<motion.span
								variants={GLYPH_TAP}
								transition={pressTap.transition}
								className="flex"
							>
								<BadgedIcon count={item.badge} label={item.label} size={26}>
									<item.icon isActive={item.active} />
								</BadgedIcon>
							</motion.span>
						</MotionLink>
						</Fragment>
					))}
					</div>
				</div>
			</motion.div>

		</>
	);
};
