"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import Image from "next/image";
import { useAtomValue } from "jotai";
import {
	AppWindow,
	ArrowLeft,
	Broadcast,
	CaretRight,
	ChartLineUp,
	Faders,
	Megaphone,
	Note,
} from "@phosphor-icons/react";
import { userAtom } from "@/store/user.atom";
import { useT } from "@/i18n/client";

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
			},
			{ href: "/studio/live", key: "studio.nav.live", Icon: Broadcast },
		],
	},
	{
		labelKey: "studio.group.tools",
		items: [
			{ href: "/studio/apps", key: "studio.nav.apps", Icon: AppWindow },
		],
	},
];

/**
 * The studio runs as its own app: a fixed left rail for navigation, a slim
 * top bar naming the current section, and a dense content well. Nothing
 * about the socials 3-column layout leaks in — the only way back is the
 * link at the top of the rail.
 */
export function StudioShell({ children }: { children: React.ReactNode }) {
	const t = useT();
	const pathname = usePathname();
	const user = useAtomValue(userAtom);

	const isActive = (href: string) =>
		href === "/studio" ? pathname === "/studio" : pathname.startsWith(href);

	const current =
		GROUPS.flatMap((g) => g.items).find((i) => isActive(i.href)) ??
		GROUPS[0].items[0];

	return (
		<div className="min-h-dvh bg-page text-primary flex">
			{/* ── left rail ───────────────────────────────────────────────── */}
			<aside className="hidden md:flex w-[230px] shrink-0 flex-col sticky top-0 h-dvh border-r border-hairline bg-surface/40">
				<div className="px-3 pt-3.5 pb-2">
					<Link
						href="/"
						className="flex items-center gap-2.5 px-2.5 py-2 rounded-[10px] text-muted hover:text-primary hover:bg-raised transition-colors group"
					>
						<ArrowLeft size={15} />
						<span className="font-sans text-[13px] font-medium flex-1 truncate">
							{t("studio.backShort")}
						</span>
					</Link>
				</div>

				<div className="px-5 pb-3 flex items-center gap-2">
					<span className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-brand text-brand-on shrink-0">
						<Faders size={15} weight="bold" />
					</span>
					<span className="font-display text-[14.5px] font-semibold tracking-tight truncate">
						{t("studio.title")}
					</span>
				</div>

				<nav className="flex-1 overflow-y-auto no-scrollbar px-3 pb-3">
					{GROUPS.map((group) => (
						<div key={group.labelKey} className="mb-1">
							<p className="px-2.5 pt-3 pb-1 font-sans text-[10px] font-semibold uppercase tracking-[0.14em] text-subtle select-none">
								{t(group.labelKey)}
							</p>
							{group.items.map(({ href, key, Icon }) => {
								const active = isActive(href);
								return (
									<Link
										key={href}
										href={href}
										className={clsx(
											"relative flex items-center gap-2.5 px-2.5 h-9 rounded-[10px] font-sans text-[13px] transition-colors",
											active
												? "bg-raised text-primary font-semibold"
												: "text-muted hover:text-primary hover:bg-raised/50 font-medium",
										)}
									>
										{active && (
											<span className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-[3px] rounded-pill bg-brand" />
										)}
										<Icon
											size={15}
											weight={active ? "fill" : "regular"}
											className={active ? "text-gold" : undefined}
										/>
										<span className="truncate">{t(key)}</span>
									</Link>
								);
							})}
						</div>
					))}
				</nav>

 {/* creator card the rail's one filled surface */}
				<div className="p-3">
					<div className="rounded-xl bg-raised/70 border border-hairline p-3">
						<div className="flex items-center gap-2.5">
							{user?.avatar && (
								<span className="relative h-8 w-8 rounded-pill overflow-hidden shrink-0 border border-hairline">
									<Image
										src={user.avatar}
										alt=""
										fill
										className="object-cover"
									/>
								</span>
							)}
							<span className="min-w-0 flex-1">
								<span className="block font-sans text-[12.5px] font-semibold text-primary truncate">
									{user?.username ? `@${user.username}` : t("studio.title")}
								</span>
								<span className="block font-sans text-[11px] text-gold">
									{t("studio.creatorBadge")}
								</span>
							</span>
						</div>
					</div>
				</div>
			</aside>

			{/* ── main ────────────────────────────────────────────────────── */}
			<div className="flex-1 min-w-0 flex flex-col">
				<header className="sticky top-0 z-sticky h-13 min-h-[52px] border-b border-hairline bg-page flex items-center gap-2 px-4">
					<Link
						href="/"
						aria-label={t("studio.back")}
						className="md:hidden flex h-9 w-9 items-center justify-center rounded-[10px] text-muted hover:text-primary hover:bg-raised transition-colors -ml-1"
					>
						<ArrowLeft size={16} />
					</Link>
					<h1 className="font-sans text-[14.5px] font-semibold text-primary">
						{t(current.key)}
					</h1>
					<CaretRight size={12} className="text-subtle hidden sm:block" />
					<span className="hidden sm:block font-sans text-[12.5px] text-subtle truncate">
						{t("studio.title")}
					</span>

					{/* mobile section switcher */}
					<div className="md:hidden ml-auto flex items-center gap-1 overflow-x-auto [scrollbar-width:none]">
						{GROUPS.flatMap((g) => g.items).map(({ href, key, Icon }) => (
							<Link
								key={href}
								href={href}
								aria-label={t(key)}
								className={clsx(
									"flex h-9 w-9 items-center justify-center rounded-[10px] transition-colors shrink-0",
									isActive(href)
										? "bg-raised text-gold"
										: "text-muted hover:text-primary",
								)}
							>
								<Icon size={16} weight={isActive(href) ? "fill" : "regular"} />
							</Link>
						))}
					</div>
				</header>

				<main className="flex-1 p-3 sm:p-4 animate-rise">
					{/* Capped so single cards don't stretch to absurd widths on
					    ultrawide displays; the rail grid sits inside this. */}
					<div className="w-full max-w-[1240px]">{children}</div>
				</main>
			</div>
		</div>
	);
}
