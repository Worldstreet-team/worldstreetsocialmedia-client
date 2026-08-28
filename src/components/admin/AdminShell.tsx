"use client";

import Link from "next/link";
import clsx from "clsx";
import { useAtomValue } from "jotai";
import { ArrowLeft, ShieldCheck } from "@phosphor-icons/react";
import { userAtom } from "@/store/user.atom";
import { useAppPathname } from "@/i18n/useAppPathname";

/**
 * The admin hub.
 *
 * GLASS, done to the house rules. `ambient-field` is the ground — glass only
 * reads as glass when there is something behind it to bend, and a flat page
 * colour behind a blur is just a grey box. The panes are `glass-card` with
 * ONE `backdrop-blur` each, at the pane and nowhere else: chips and rows
 * inside are `glass-tile`, which is a tint, not a second blur. Nesting blurs
 * is the thing that turns glass to mud.
 *
 * This is the theme-following family (`glass-card` / `glass-tile` /
 * `glass-frost`), not the fixed-dark creator family — so ink comes from the
 * normal tokens and the whole surface flips on paper for free. `glass-ink`
 * and `glass-cta` are deliberately absent: they are fixed-white and would
 * vanish in light mode.
 */

const TABS = [
	{ href: "/admin", label: "Overview" },
	{ href: "/admin/revenue", label: "Revenue" },
	{ href: "/admin/health", label: "Health" },
	{ href: "/admin/audit", label: "Audit" },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
	const user = useAtomValue(userAtom);
	const pathname = useAppPathname();

	return (
		<div className="ambient-field min-h-dvh">
			<header className="sticky top-0 z-sticky">
				{/* The one blur in this stack. */}
				<div className="glass-frost backdrop-blur-xl backdrop-saturate-150">
					<div className="mx-auto flex h-14 w-full max-w-[1180px] items-center gap-3 px-4 sm:px-6">
						<Link
							href="/"
							aria-label="Back to WorldSpace"
							className="flex h-9 w-9 items-center justify-center rounded-pill text-muted transition-colors hover:bg-raised hover:text-primary"
						>
							<ArrowLeft size={17} />
						</Link>
						<span className="flex items-center gap-2">
							<ShieldCheck size={17} weight="duotone" className="text-gold" />
							<span className="font-display text-[15px] font-semibold text-primary">
								Admin
							</span>
						</span>
						{user?.username && (
							<span className="ml-auto truncate font-sans text-[12.5px] text-subtle">
								{user.firstName || user.username}
							</span>
						)}
					</div>

					<nav
						aria-label="Admin sections"
						className="mx-auto flex w-full max-w-[1180px] items-center gap-1.5 overflow-x-auto px-4 pb-2.5 sm:px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
					>
						{TABS.map((tab) => {
							const active =
								tab.href === "/admin"
									? pathname === "/admin"
									: pathname.startsWith(tab.href);
							return (
								<Link
									key={tab.href}
									href={tab.href}
									aria-current={active ? "page" : undefined}
									className={clsx(
										"h-8 shrink-0 rounded-pill px-3.5 font-sans text-[13px] transition-colors",
										// Selected is a gold rim on a tint, never a gold
										// fill — large gold fills are reserved for the one
										// primary CTA on a surface.
										active
											? "glass-tile glass-tile-on font-semibold text-primary"
											: "glass-tile font-medium text-muted hover:text-primary",
									)}
								>
									{tab.label}
								</Link>
							);
						})}
					</nav>
				</div>
			</header>

			<main className="mx-auto w-full max-w-[1180px] px-4 py-6 sm:px-6">
				{children}
			</main>
		</div>
	);
}

/** A pane. Carries the blur; nothing inside it may carry another. */
export function Pane({
	children,
	className,
}: {
	children: React.ReactNode;
	className?: string;
}) {
	return (
		<section
			className={clsx(
				"glass-card rounded-xl p-4 backdrop-blur-lg backdrop-saturate-150 sm:p-5",
				className,
			)}
		>
			{children}
		</section>
	);
}

export function PaneHead({
	title,
	caption,
	trailing,
}: {
	title: string;
	caption?: string;
	trailing?: React.ReactNode;
}) {
	return (
		<div className="mb-3 flex items-start gap-3">
			<div className="min-w-0">
				<h2 className="font-display text-[15px] font-semibold text-primary">
					{title}
				</h2>
				{caption && (
					<p className="mt-0.5 font-sans text-[12.5px] text-subtle">{caption}</p>
				)}
			</div>
			{trailing && <div className="ml-auto shrink-0">{trailing}</div>}
		</div>
	);
}
