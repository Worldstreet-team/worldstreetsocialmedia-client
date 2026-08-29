"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { useAtomValue } from "jotai";
import { useEffect, useState } from "react";
import {
	ArrowLeft,
	Broadcast,
	ChartLineUp,
	Faders,
	Megaphone,
	Note,
} from "@phosphor-icons/react";
import { userAtom } from "@/store/user.atom";
import { useT } from "@/i18n/client";
import { SafeAvatar } from "@/components/ui/SafeAvatar";

const GROUPS = [
	{
		labelKey: "studio.group.analytics",
		items: [
			{ href: "/studio", key: "studio.nav.overview", Icon: ChartLineUp },
			{ href: "/studio/posts", key: "studio.nav.posts", Icon: Note },
		],
	},
	{
		labelKey: "studio.group.growth",
		items: [
			{
				href: "/studio/promotions",
				key: "studio.nav.promotions",
				Icon: Megaphone,
				// Campaigns exist end-to-end but aren't launched yet; the badge
				// is the honest signal rather than a working-looking page.
				badgeKey: "studio.soon",
			},
			{ href: "/studio/live", key: "studio.nav.live", Icon: Broadcast },
		],
	},
];

/**
 * The Creator Studio shell — flat professional dark (owner review
 * 2026-08-26: no gradients, no ambient decoration, no borders).
 *
 * The rail sits directly on the page ink with nothing drawn around it:
 * grouped items under uppercase eyebrows, the active item as the one filled
 * pill on screen (brand fill, dark text), identity card at the bottom.
 * Separation everywhere comes from fill contrast and spacing, never lines.
 */
export function StudioShell({ children }: { children: React.ReactNode }) {
	const t = useT();
	const pathname = usePathname();
	const user = useAtomValue(userAtom);
	// The user atom hydrates client-side, so the identity card renders after
	// mount only — otherwise the server (no avatar) and client (avatar)
	// disagree and React throws the whole shell away on hydration.
	const [mounted, setMounted] = useState(false);
	useEffect(() => setMounted(true), []);

	const isActive = (href: string) =>
		href === "/studio" ? pathname === "/studio" : pathname.startsWith(href);

	const allItems = GROUPS.flatMap((g) => g.items);
	const current = allItems.find((i) => isActive(i.href)) ?? allItems[0];

	return (
		<div className="min-h-dvh bg-[#0F0E0D] text-[#fafaf9]">
			<div className="flex min-h-dvh">
				{/* ── rail ─────────────────────────────────────────────────── */}
				<aside className="sticky top-0 hidden h-dvh w-[240px] shrink-0 flex-col bg-[#141312] px-4 pb-4 pt-5 md:flex">
					<Link
						href="/"
						className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 glass-ink-faint transition-colors hover:glass-ink hover:bg-[#fafaf9]/[0.05]"
					>
						<ArrowLeft size={14} />
						<span className="font-sans text-[12.5px] font-medium">
							{t("studio.backShort")}
						</span>
					</Link>

					<div className="mt-5 flex items-center gap-2.5 px-2.5">
						<span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-[var(--ws-brand-primary)] text-[#0c0a09]">
							<Faders size={16} weight="bold" />
						</span>
						<span className="font-display text-[15px] font-semibold tracking-tight">
							{t("studio.title")}
						</span>
					</div>

					<nav className="no-scrollbar mt-6 flex-1 overflow-y-auto">
						{GROUPS.map((group) => (
							<div key={group.labelKey} className="mb-5">
								<p className="glass-eyebrow select-none px-2.5 pb-2 font-sans">
									{t(group.labelKey)}
								</p>
								<div className="flex flex-col gap-0.5">
									{group.items.map((item) => {
										const { href, key, Icon } = item;
										const badgeKey = (item as { badgeKey?: string })
											.badgeKey;
										const active = isActive(href);
										return (
											<Link
												key={href}
												href={href}
												className={clsx(
													"flex h-10 items-center gap-3 rounded-xl px-3 font-sans text-[13.5px] transition-colors",
													active
														? "bg-[var(--ws-brand-primary)] font-semibold text-[#0c0a09]"
														: "glass-ink-dim font-medium hover:glass-ink hover:bg-[#fafaf9]/[0.05]",
												)}
											>
												<Icon
													size={16}
													weight={active ? "fill" : "regular"}
												/>
												<span className="truncate">{t(key)}</span>
												{badgeKey && (
													<span
														className={clsx(
															"ml-auto shrink-0 rounded-pill px-1.5 py-0.5 font-sans text-[9.5px] font-bold uppercase tracking-[0.06em]",
															active
																? "bg-[#0c0a09]/15 text-[#0c0a09]"
																: "bg-[#fafaf9]/[0.08] glass-ink-faint",
														)}
													>
														{t(badgeKey)}
													</span>
												)}
											</Link>
										);
									})}
								</div>
							</div>
						))}
					</nav>

					{/* identity */}
					{mounted && user && (
					<div className="rounded-xl bg-[#171614] p-3">
						<div className="flex items-center gap-2.5">
							{/* No guard: SafeAvatar owns the missing-picture case, and
							    hiding the circle left the name floating alone. */}
							<span className="relative h-9 w-9 shrink-0 overflow-hidden rounded-pill bg-raised">
								<SafeAvatar src={user.avatar} className="object-cover" eager />
							</span>
							<span className="min-w-0 flex-1">
								<span className="block truncate font-sans text-[13px] font-semibold glass-ink">
									{[user?.firstName, user?.lastName]
										.filter(Boolean)
										.join(" ") ||
										(user?.username ? `@${user.username}` : "")}
								</span>
								<span className="mt-0.5 inline-flex rounded-pill bg-[var(--ws-brand-primary)]/12 px-1.5 py-px font-sans text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--ws-brand-primary)]">
									{t("studio.creatorBadge")}
								</span>
							</span>
						</div>
					</div>
					)}
				</aside>

				{/* ── main ─────────────────────────────────────────────────── */}
				<div className="flex min-w-0 flex-1 flex-col">
					{/* Mobile bar: back + title + section chips. */}
					<header className="sticky top-0 z-sticky bg-[#0F0E0D] px-3 pb-2 pt-3 md:hidden">
						<div className="flex items-center gap-2">
							<Link
								href="/"
								aria-label={t("studio.back")}
								className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#fafaf9]/[0.06] glass-ink"
							>
								<ArrowLeft size={15} weight="bold" />
							</Link>
							<h1 className="flex-1 truncate font-display text-[16px] font-semibold">
								{t(current.key)}
							</h1>
						</div>
						<div className="mt-2.5 flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none]">
							{allItems.map(({ href, key, Icon }) => (
								<Link
									key={href}
									href={href}
									className={clsx(
										"flex h-8 shrink-0 items-center gap-1.5 rounded-pill px-3 font-sans text-[12px] font-semibold transition-colors",
										isActive(href)
											? "bg-[var(--ws-brand-primary)] text-[#0c0a09]"
											: "bg-[#fafaf9]/[0.06] glass-ink-dim",
									)}
								>
									<Icon size={13} weight={isActive(href) ? "fill" : "regular"} />
									{t(key)}
								</Link>
							))}
						</div>
					</header>

					<main className="flex-1 px-3 pb-8 pt-3 md:px-6 md:pt-6">
						<div className="mx-auto w-full max-w-[1200px] animate-rise">
							{children}
						</div>
					</main>
				</div>
			</div>
		</div>
	);
}
