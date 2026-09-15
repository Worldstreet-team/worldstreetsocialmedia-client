"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useAtomValue } from "jotai";
import { CaretRight, MagnifyingGlass } from "@phosphor-icons/react";
import clsx from "clsx";
import {
	SECTIONS,
	type SectionId,
	searchSettings,
} from "@/components/settings/sections";
import { userAtom } from "@/store/user.atom";
import { useT } from "@/i18n/client";

/**
 * Both faces of the settings index in one place.
 *
 * Desktop: a slim section list beside the open section (the reader sees the
 * whole map and where they are at once). Mobile: the X-style hub, a search
 * field over the same list, because a phone can't show list-and-detail side
 * by side, so finding fast has to come from search, not scanning.
 *
 * Selected row uses the live pressed wash (bg-primary/10), resting hover the
 * rest wash (bg-primary/5). Gold stays reserved, so the active row reads by
 * fill and ink weight, not colour.
 */
export function SettingsNav({ activeId }: { activeId: SectionId }) {
	const t = useT();
	const user = useAtomValue(userAtom);
	const [query, setQuery] = useState("");
	const results = useMemo(() => searchSettings(query), [query]);
	const searching = query.trim().length > 0;

	const row =
		"flex items-center gap-3 rounded-[10px] px-3 min-h-[44px] transition-colors";

	return (
		<div className="flex flex-col p-3">
			<div className="px-1 pb-2 pt-1">
				<h1 className="font-display text-[calc(20px*var(--ws-fs))] font-semibold text-primary lg:text-[calc(17px*var(--ws-fs))]">
					{t("settings.title")}
				</h1>
				<div className="font-sans text-[calc(13px*var(--ws-fs))] text-muted">
					@{user?.username}
				</div>
			</div>

			{/* The hub search: mobile only. Desktop reads the list directly. */}
			<label className="relative mb-2 block px-1 lg:hidden">
				<MagnifyingGlass
					size={16}
					weight="bold"
					className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-subtle"
				/>
				<input
					value={query}
					onChange={(e) => setQuery(e.target.value)}
					type="search"
					inputMode="search"
					placeholder={t("settings.search.placeholder")}
					aria-label={t("settings.search.placeholder")}
					className="h-11 w-full rounded-pill bg-primary/5 pl-11 pr-3 font-sans text-[calc(14px*var(--ws-fs))] text-primary placeholder:text-subtle focus:bg-primary/10 focus:outline-none"
				/>
			</label>

			{/* Search results (mobile). Empty query shows the full list. */}
			{searching ? (
				<div className="lg:hidden">
					{results.length === 0 ? (
						<p className="px-3 py-6 text-center font-sans text-[calc(13px*var(--ws-fs))] text-muted">
							{t("settings.search.empty")}
						</p>
					) : (
						<ul className="flex flex-col gap-0.5">
							{results.map((r) => {
								const sec = SECTIONS.find((s) => s.id === r.section);
								const Icon = sec?.icon;
								return (
									<li key={r.label}>
										<Link
											href={`/settings/${r.section}`}
											className={clsx(row, "text-primary hover:bg-primary/5")}
										>
											{Icon && (
												<Icon
													className="h-[18px] w-[18px] shrink-0 text-muted"
													strokeWidth={2}
												/>
											)}
											<span className="flex min-w-0 flex-col">
												<span className="truncate font-sans text-[calc(14px*var(--ws-fs))] font-medium">
													{r.label}
												</span>
												<span className="truncate font-sans text-[calc(12px*var(--ws-fs))] text-muted">
													{sec ? t(sec.labelKey) : ""}
												</span>
											</span>
											<CaretRight
												size={14}
												weight="bold"
												className="ml-auto shrink-0 text-subtle"
											/>
										</Link>
									</li>
								);
							})}
						</ul>
					)}
				</div>
			) : null}

			{/* The section list. Full on desktop; on mobile it hides while a
			    search is running so results own the screen. */}
			<nav
				aria-label={t("settings.title")}
				className={clsx(
					"flex flex-col gap-0.5",
					searching && "hidden lg:flex",
				)}
			>
				{SECTIONS.map(({ id, labelKey, hint, icon: Icon }) => {
					const active = id === activeId;
					return (
						<Link
							key={id}
							href={`/settings/${id}`}
							aria-current={active ? "page" : undefined}
							className={clsx(
								row,
								active
									? "bg-primary/10 text-primary"
									: "text-muted hover:bg-primary/5 hover:text-primary",
							)}
						>
							<Icon
								className={clsx(
									"h-[18px] w-[18px] shrink-0",
									active ? "text-primary" : "text-muted",
								)}
								strokeWidth={active ? 2.5 : 2}
							/>
							<span className="flex min-w-0 flex-col">
								<span className="truncate font-sans text-[calc(14px*var(--ws-fs))] font-medium">
									{t(labelKey)}
								</span>
								{/* The one-line hint is hub texture; the desktop list
								    stays tight, so it is mobile only. */}
								<span className="truncate font-sans text-[calc(12px*var(--ws-fs))] text-muted lg:hidden">
									{hint}
								</span>
							</span>
							<CaretRight
								size={14}
								weight="bold"
								className="ml-auto shrink-0 text-subtle lg:hidden"
							/>
						</Link>
					);
				})}
			</nav>
		</div>
	);
}
