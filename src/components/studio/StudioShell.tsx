"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import Image from "next/image";
import { useAtomValue } from "jotai";
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

/**
 * Apps is no longer a destination — the ecosystem card lives on the overview.
 * Four sections is few enough that grouping headers would be chrome for its
 * own sake, so the rail is one flat list.
 */
const NAV = [
	{ href: "/studio", key: "studio.nav.overview", Icon: ChartLineUp },
	{ href: "/studio/posts", key: "studio.nav.posts", Icon: Note },
	{ href: "/studio/promotions", key: "studio.nav.promotions", Icon: Megaphone },
	{ href: "/studio/live", key: "studio.nav.live", Icon: Broadcast },
];

/**
 * The Creator Studio, in the glass grammar (owner ruling 2026-08-26 extended
 * the editors' glass exception to the Studio).
 *
 * Fixed-dark in both themes, like the editors: an ambient backdrop — two dim
 * gold radials on stone — gives every blurred panel something to refract, so
 * the glass reads as material instead of grey rectangles. The rail floats as
 * its own dock rather than touching the edges; content is a 12-col bento
 * grid inside a capped well.
 */
export function StudioShell({ children }: { children: React.ReactNode }) {
	const t = useT();
	const pathname = usePathname();
	const user = useAtomValue(userAtom);

	const isActive = (href: string) =>
		href === "/studio" ? pathname === "/studio" : pathname.startsWith(href);

	const current = NAV.find((i) => isActive(i.href)) ?? NAV[0];

	return (
		<div className="relative min-h-dvh bg-[#0c0a09] text-[#fafaf9] isolate">
			{/* Ambient backdrop. Fixed, behind everything, deliberately dim —
			    it exists for the blur to catch, not to be looked at. */}
			<div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
				<div
					className="absolute -top-[20%] -left-[10%] h-[62vh] w-[62vw] rounded-pill opacity-[0.16]"
					style={{
						background:
							"radial-gradient(closest-side, var(--ws-brand-primary, #EAB308) 0%, transparent 70%)",
					}}
				/>
				<div
					className="absolute -bottom-[25%] -right-[12%] h-[70vh] w-[60vw] rounded-pill opacity-[0.09]"
					style={{
						background:
							"radial-gradient(closest-side, #a8a29e 0%, transparent 70%)",
					}}
				/>
				<div
					className="absolute top-[30%] right-[20%] h-[40vh] w-[34vw] rounded-pill opacity-[0.07]"
					style={{
						background:
							"radial-gradient(closest-side, var(--ws-brand-primary, #EAB308) 0%, transparent 70%)",
					}}
				/>
			</div>

			<div className="flex min-h-dvh gap-4 p-3 sm:p-4">
				{/* ── floating rail ─────────────────────────────────────────── */}
				<aside className="hidden md:flex w-[228px] shrink-0 flex-col sticky top-4 h-[calc(100dvh-2rem)] glass-dock backdrop-blur-xl backdrop-saturate-150 border glass-divider rounded-2xl overflow-hidden">
					<div className="px-3 pt-3">
						<Link
							href="/"
							className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 glass-ink-dim hover:glass-ink hover:bg-[#fafaf9]/[0.07] transition-colors"
						>
							<ArrowLeft size={15} />
							<span className="font-sans text-[13px] font-medium flex-1 truncate">
								{t("studio.backShort")}
							</span>
						</Link>
					</div>

					<div className="mx-3 mt-2 mb-1 border-b glass-divider" />

					<div className="px-5 pt-3 pb-4 flex items-center gap-2.5">
						<span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-gold text-[#0c0a09] shrink-0">
							<Faders size={16} weight="bold" />
						</span>
						<span className="min-w-0">
							<span className="block font-display text-[15px] font-semibold tracking-tight leading-tight truncate">
								{t("studio.title")}
							</span>
							<span className="glass-eyebrow font-sans">
								{t("studio.creatorBadge")}
							</span>
						</span>
					</div>

					<nav className="flex-1 overflow-y-auto no-scrollbar px-3 pb-3 flex flex-col gap-1">
						{NAV.map(({ href, key, Icon }) => {
							const active = isActive(href);
							return (
								<Link
									key={href}
									href={href}
									className={clsx(
										"flex items-center gap-3 rounded-xl px-3 h-10 font-sans text-[13.5px] transition-colors",
										active
											? "glass-chip-active font-semibold"
											: "glass-ink-dim hover:glass-ink hover:bg-[#fafaf9]/[0.07] font-medium",
									)}
								>
									<Icon
										size={16}
										weight={active ? "fill" : "regular"}
										className={active ? "text-[#0c0a09]" : "text-gold/80"}
									/>
									<span className="truncate">{t(key)}</span>
								</Link>
							);
						})}
					</nav>

					{/* creator card */}
					<div className="p-3">
						<div className="rounded-xl glass-card p-3">
							<div className="flex items-center gap-2.5">
								{user?.avatar && (
									<span className="relative h-8 w-8 rounded-pill overflow-hidden shrink-0">
										<Image
											src={user.avatar}
											alt=""
											fill
											className="object-cover"
										/>
									</span>
								)}
								<span className="min-w-0 flex-1">
									<span className="block font-sans text-[12.5px] font-semibold glass-ink truncate">
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

				{/* ── main ──────────────────────────────────────────────────── */}
				<div className="flex-1 min-w-0 flex flex-col">
					{/* Mobile top bar: back + title + section chips. Desktop needs
					    no bar — the rail carries identity and the pages carry
					    their own headers. */}
					<header className="md:hidden sticky top-0 z-sticky -mx-3 -mt-3 mb-3 px-3 pt-3 pb-2 glass-veil backdrop-blur-xl">
						<div className="flex items-center gap-2">
							<Link
								href="/"
								aria-label={t("studio.back")}
								className="flex h-9 w-9 items-center justify-center rounded-xl glass-chip backdrop-blur-md"
							>
								<ArrowLeft size={15} weight="bold" />
							</Link>
							<h1 className="font-display text-[16px] font-semibold flex-1 truncate">
								{t(current.key)}
							</h1>
						</div>
						<div className="mt-2.5 flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none]">
							{NAV.map(({ href, key, Icon }) => (
								<Link
									key={href}
									href={href}
									className={clsx(
										"flex h-8 items-center gap-1.5 rounded-pill px-3 font-sans text-[12px] font-semibold transition-colors shrink-0",
										isActive(href)
											? "glass-chip-active"
											: "glass-chip backdrop-blur-md",
									)}
								>
									<Icon
										size={13}
										weight={isActive(href) ? "fill" : "regular"}
									/>
									{t(key)}
								</Link>
							))}
						</div>
					</header>

					<main className="flex-1 animate-rise">
						<div className="mx-auto w-full max-w-[1240px]">{children}</div>
					</main>
				</div>
			</div>
		</div>
	);
}
