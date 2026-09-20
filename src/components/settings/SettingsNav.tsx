"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useAtomValue } from "jotai";
import { CaretRight, MagnifyingGlass } from "@phosphor-icons/react";
import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { collapse, thumbSpring } from "@/lib/motion-presets";
import {
	GROUPS,
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
 *
 * Inspector layout (owner 2026-09-20): a tool's rail, not a menu of tiles.
 * Search sits on top on every width, the sections are plain words under two
 * quiet labels, rows are 40px and carry no icons. On a phone the same rows
 * grow a one-line hint and a caret and are ruled with hairlines.
 */

/** The label that opens above a section, by the section it precedes. */
const RAIL_LABELS: Partial<Record<SectionId, string>> = {
	account: "You",
	notifications: "App",
};
export function SettingsNav({
	activeId,
	activeGroup,
	onGroup,
}: {
	activeId: SectionId;
	/** The group currently in view, lit in the sub-list. */
	activeGroup?: string;
	/** Tap a group: the page scrolls the detail to it. */
	onGroup?: (id: string) => void;
}) {
	const t = useT();
	const user = useAtomValue(userAtom);
	const [query, setQuery] = useState("");
	const results = useMemo(() => searchSettings(query), [query]);
	const searching = query.trim().length > 0;

	const row =
		"relative flex items-center gap-3 border-b border-hairline px-1 min-h-[56px] transition-colors lg:min-h-[40px] lg:rounded-[7px] lg:border-b-0 lg:px-2.5";

	return (
		<div className="flex flex-col p-3">
			<div className="flex items-baseline justify-between gap-3 px-1 pb-3 pt-1 lg:px-2.5">
				<h1 className="font-display text-[calc(22px*var(--ws-fs))] font-semibold tracking-tight text-primary lg:text-[calc(16px*var(--ws-fs))] lg:font-medium">
					{t("settings.title")}
				</h1>
				<div className="truncate font-sans text-[calc(12.5px*var(--ws-fs))] text-muted">
					@{user?.username}
				</div>
			</div>

			{/* Search, on every width: a tool is found by typing. */}
			<label className="relative mb-3 block px-1 lg:px-0">
				<MagnifyingGlass
					size={16}
					weight="bold"
					className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-subtle lg:left-3"
				/>
				<input
					value={query}
					onChange={(e) => setQuery(e.target.value)}
					type="search"
					inputMode="search"
					placeholder={t("settings.search.placeholder")}
					aria-label={t("settings.search.placeholder")}
					className="h-11 w-full rounded-[7px] border border-hairline bg-transparent pl-11 pr-3 font-sans text-[calc(14px*var(--ws-fs))] text-primary placeholder:text-subtle focus:border-primary/40 focus:outline-none lg:h-10 lg:pl-9 lg:text-[calc(13px*var(--ws-fs))]"
				/>
			</label>

			{/* Search results. Empty query shows the full list. */}
			{searching ? (
				<div>
					{results.length === 0 ? (
						<p className="px-3 py-6 text-center font-sans text-[calc(13px*var(--ws-fs))] text-muted">
							{t("settings.search.empty")}
						</p>
					) : (
						<ul className="flex flex-col lg:gap-0.5">
							{results.map((r) => {
								const sec = SECTIONS.find((s) => s.id === r.section);
								return (
									<li key={r.label}>
										<Link
											href={`/settings/${r.section}`}
											className={clsx(row, "text-primary hover:bg-primary/5")}
										>
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
				className={clsx("flex flex-col lg:gap-0.5", searching && "hidden")}
			>
				{SECTIONS.map(({ id, labelKey, hint }) => {
					const active = id === activeId;
					const subs = GROUPS[id];
					return (
						<div key={id} className="flex flex-col">
						{RAIL_LABELS[id] && (
							<span
								className={clsx(
									"px-1 pb-1 font-sans text-[calc(12.5px*var(--ws-fs))] font-semibold text-muted lg:px-2.5",
									id === "account" ? "pt-1" : "pt-5",
								)}
							>
								{RAIL_LABELS[id]}
							</span>
						)}
						<Link
							href={`/settings/${id}`}
							aria-current={active ? "page" : undefined}
							className={clsx(
								row,
								active
									? "text-primary"
									: "text-muted hover:bg-primary/5 hover:text-primary",
							)}
						>
							{/* The selected wash is one element that slides between
							    sections. The page never unmounts across sections and
							    this nav is a page singleton, so a fixed id is safe. */}
							{active && (
								<motion.span
									aria-hidden
									layoutId="settings-nav-active"
									transition={thumbSpring}
									className="absolute inset-0 hidden rounded-[7px] bg-primary/10 lg:block"
								/>
							)}
							<span className="relative flex min-w-0 flex-col">
								<span
									className={clsx(
										"truncate font-sans text-[calc(15px*var(--ws-fs))] text-primary lg:text-[calc(13.5px*var(--ws-fs))] lg:text-inherit",
										active ? "font-semibold" : "font-medium",
									)}
								>
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
								className="relative ml-auto shrink-0 text-subtle lg:hidden"
							/>
						</Link>
						{/* The sub-nav (desktop): the open section's groups, tap to
						    scroll, the one in view lit. Hidden on a phone, where the
						    chip strip in the detail header does this job. */}
						{/* Opens and closes so the rows below glide instead of jumping.
						    initial={false}: a deep link arrives already open. */}
						<AnimatePresence initial={false}>
						{active && subs.length > 1 && (
							<motion.div
								key="subs"
								{...collapse}
								className="hidden overflow-hidden lg:block"
							>
							<ul className="my-1 ml-[14px] flex flex-col border-l border-hairline pl-3">
								{subs.map((g) => {
									const on = g.id === activeGroup;
									return (
										<li key={g.id} className="relative">
											{/* A marker riding the hairline as the scroll-spy
											    moves, the desktop twin of the phone's chip
											    wash. The id carries the section: a closing list
											    is still mounted while the next one opens, and a
											    shared id would fly the marker between them. */}
											{on && (
												<motion.span
													aria-hidden
													layoutId={`settings-subnav-marker-${id}`}
													transition={thumbSpring}
													className="absolute -left-[13px] bottom-1.5 top-1.5 w-[2px] rounded-pill bg-primary"
												/>
											)}
											<button
												type="button"
												aria-current={on ? "true" : undefined}
												onClick={() => onGroup?.(g.id)}
												className={clsx(
													"flex h-8 w-full cursor-pointer items-center rounded-[7px] px-2 text-left font-sans text-[calc(13px*var(--ws-fs))] transition-colors",
													on
														? "font-semibold text-primary"
														: "text-muted hover:bg-primary/5 hover:text-primary",
												)}
											>
												{g.label}
											</button>
										</li>
									);
								})}
							</ul>
							</motion.div>
						)}
						</AnimatePresence>
						</div>
					);
				})}
			</nav>
		</div>
	);
}
