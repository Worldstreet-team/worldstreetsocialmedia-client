"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAtomValue } from "jotai";
import { CaretDown, CaretRight, MagnifyingGlass, X } from "@phosphor-icons/react";
import { LayoutGrid } from "lucide-react";
import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { collapse, staggerItem, staggerParentFast, thumbSpring } from "@/lib/motion-presets";
import {
	GROUPS,
	SECTIONS,
	type SectionId,
	searchSettings,
} from "@/components/settings/sections";
import { SafeAvatar } from "@/components/ui/SafeAvatar";
import { userAtom } from "@/store/user.atom";
import { useT } from "@/i18n/client";
import { SettingsOverview } from "./SettingsOverview";

/**
 * The settings sidebar, built the way the Messages inbox is (owner
 * 2026-09-20: "the make over we gave the messages, do it the same for the
 * settings ... actual proper sidebar, nice use of icons and headers, master
 * search").
 *
 * Two frosted blocks in a padded column. The first is the masthead: the
 * page title in the display face, who you are, and the master search, a
 * well in the rest wash. The second is the map: sections under two labels,
 * each an icon in a wash chip and a name, the open one on a sliding
 * pressed wash, its groups folded out beneath it.
 *
 * The search covers every row of every section (sections.tsx SEARCH_INDEX).
 * A result opens the section, scrolls to the block and lights it; Enter
 * takes the first result, arrows walk the list, Escape clears.
 */

/** The label that opens above a section, by the section it precedes. */
const RAIL_LABELS: Partial<Record<SectionId, string>> = {
	notifications: "App",
	account: "Account",
};

export function SettingsNav({
	activeId,
	activeGroup,
	onGroup,
}: {
	/** Undefined at `/settings`, where the Overview is what is open. */
	activeId?: SectionId;
	/** The group currently in view, lit in the sub-list. */
	activeGroup?: string;
	/** Tap a group: the page scrolls the detail to it. */
	onGroup?: (id: string) => void;
}) {
	const t = useT();
	const router = useRouter();
	const user = useAtomValue(userAtom);
	const [query, setQuery] = useState("");
	const [cursor, setCursor] = useState(0);
	// Sections the person has shut. Empty by default: the sidebar opens
	// showing everything it holds.
	const [collapsed, setCollapsed] = useState<Set<SectionId>>(new Set());
	const inputRef = useRef<HTMLInputElement>(null);
	const results = useMemo(() => searchSettings(query), [query]);
	const searching = query.trim().length > 0;
	useEffect(() => setCursor(0), [query]);

	const subRow =
		"flex h-10 w-full cursor-pointer items-center rounded-[10px] px-2.5 text-left font-sans text-[calc(13px*var(--ws-fs))] transition-colors";
	const subRowOn = "font-semibold text-primary";
	const subRowOff = "text-muted hover:bg-primary/5 hover:text-primary";

	const hrefOf = (r: { section: SectionId; group: string }) =>
		`/settings/${r.section}#group-${r.group}`;
	const name =
		[user?.firstName, user?.lastName].filter(Boolean).join(" ") || user?.username;

	return (
		<div className="flex flex-col gap-2 p-2 md:gap-3 md:p-3">
			{/* Masthead: title, identity, master search. */}
			<div className="rounded-2xl px-4 pb-4 pt-4 glass-frost backdrop-blur-xl">
				<div className="flex items-center gap-3">
					<div className="min-w-0 flex-1">
						<h1 className="font-display text-[calc(20px*var(--ws-fs))] font-semibold tracking-tight text-primary">
							{t("settings.title")}
						</h1>
						<p className="truncate font-sans text-[calc(13px*var(--ws-fs))] text-muted">
							{name} · @{user?.username}
						</p>
					</div>
					<span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-pill bg-sunken">
						<SafeAvatar src={user?.avatar} />
					</span>
				</div>
				<label className="relative mt-3 block">
					<MagnifyingGlass
						size={16}
						weight="bold"
						className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-subtle"
					/>
					<input
						ref={inputRef}
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "ArrowDown") {
								e.preventDefault();
								setCursor((c) => Math.min(c + 1, Math.max(results.length - 1, 0)));
							} else if (e.key === "ArrowUp") {
								e.preventDefault();
								setCursor((c) => Math.max(c - 1, 0));
							} else if (e.key === "Enter" && results[cursor]) {
								e.preventDefault();
								router.push(hrefOf(results[cursor]));
								setQuery("");
							} else if (e.key === "Escape" && query) {
								e.preventDefault();
								setQuery("");
							}
						}}
						type="text"
						inputMode="search"
						role="combobox"
						aria-expanded={searching}
						aria-controls="settings-search-results"
						aria-autocomplete="list"
						placeholder={t("settings.search.placeholder")}
						aria-label={t("settings.search.placeholder")}
						className="h-11 w-full rounded-pill bg-primary/5 pl-11 pr-11 font-sans text-[calc(14px*var(--ws-fs))] text-primary transition-colors placeholder:text-subtle focus:bg-primary/10 focus:outline-none"
					/>
					{searching && (
						<button
							type="button"
							aria-label="Clear search"
							onClick={() => {
								setQuery("");
								inputRef.current?.focus();
							}}
							className="absolute right-0.5 top-1/2 flex h-10 w-10 -translate-y-1/2 cursor-pointer items-center justify-center rounded-pill text-muted transition-colors hover:text-primary"
						>
							<X size={14} weight="bold" />
						</button>
					)}
				</label>
			</div>

			{/* On a phone `/settings` is this column, so the landing's quick
			    settings sit here, above the map. Desktop gets them in the
			    detail pane instead. */}
			{!searching && (
				<div className="flex flex-col gap-2 lg:hidden">
					<SettingsOverview variant="hub" />
				</div>
			)}

			{/* The map, or the results while a search is running. */}
			<div className="rounded-2xl px-2 pb-2 pt-2 glass-frost backdrop-blur-xl">
				{searching ? (
					<div id="settings-search-results" role="listbox" aria-label="Search results">
						{results.length === 0 ? (
							<p className="px-3 py-8 text-center font-sans text-[calc(13px*var(--ws-fs))] text-muted">
								{t("settings.search.empty")}
							</p>
						) : (
							<ul className="flex flex-col gap-0.5">
								{results.map((r, i) => {
									const sec = SECTIONS.find((s) => s.id === r.section);
									const Icon = sec?.icon;
									const group = GROUPS[r.section].find((g) => g.id === r.group);
									return (
										<li key={`${r.section}-${r.label}`}>
											<Link
												href={hrefOf(r)}
												role="option"
												aria-selected={i === cursor}
												onClick={() => setQuery("")}
												onMouseEnter={() => setCursor(i)}
												className={clsx(
													"flex min-h-[48px] items-center gap-3 rounded-xl px-3 transition-colors",
													i === cursor ? "bg-primary/10" : "hover:bg-primary/5",
												)}
											>
												{Icon && (
													<Icon
														className="h-[18px] w-[18px] shrink-0 text-muted"
														strokeWidth={2}
													/>
												)}
												<span className="flex min-w-0 flex-col">
													<span className="truncate font-sans text-[calc(14px*var(--ws-fs))] font-medium text-primary">
														{r.label}
													</span>
													<span className="truncate font-sans text-[calc(12.5px*var(--ws-fs))] text-muted">
														{sec ? t(sec.labelKey) : ""}
														{group ? ` · ${group.label}` : ""}
													</span>
												</span>
											</Link>
										</li>
									);
								})}
							</ul>
						)}
					</div>
				) : (
					// The rows rise once, when the sidebar first mounts. The page
					// never unmounts it across sections, so it never replays.
					<motion.nav
						aria-label={t("settings.title")}
						variants={staggerParentFast}
						initial="hidden"
						animate="show"
						className="flex flex-col gap-0.5"
					>
						{/* The landing is addressable, so it is a row like any
						    other. Desktop only: on a phone `/settings` IS the hub,
						    and the overview is rendered inline above this map. */}
						<motion.div variants={staggerItem} className="hidden lg:flex lg:flex-col">
							<Link
								href="/settings"
								aria-current={!activeId ? "page" : undefined}
								className={clsx(
									"relative flex min-h-[44px] items-center gap-3 rounded-xl px-3 transition-colors",
									activeId && "hover:bg-primary/5",
								)}
							>
								{!activeId && (
									<motion.span
										aria-hidden
										layoutId="settings-nav-active"
										transition={thumbSpring}
										className="absolute inset-0 rounded-xl bg-primary/10"
									/>
								)}
								<LayoutGrid
									className={clsx(
										"relative h-[18px] w-[18px] shrink-0",
										activeId ? "text-muted" : "text-primary",
									)}
									strokeWidth={activeId ? 2 : 2.5}
								/>
								<span
									className={clsx(
										"relative truncate font-sans text-[calc(14px*var(--ws-fs))] text-primary",
										activeId ? "font-medium" : "font-semibold",
									)}
								>
									Overview
								</span>
							</Link>
						</motion.div>
						{SECTIONS.map(({ id, labelKey, icon: Icon }) => {
							const active = id === activeId;
							const subs = GROUPS[id];
							// Every section shows what is inside it (owner 2026-09-20:
							// "showing the sub items by default with a caret to switch
							// back up"), so the map is the whole map, not a drawer that
							// only opens where you already are. Collapsing is per person
							// and per session; the set holds only what they shut.
							const open = subs.length > 1 && !collapsed.has(id);
							return (
								<motion.div key={id} variants={staggerItem} className="flex flex-col">
									{RAIL_LABELS[id] && (
										<span
											className={clsx(
												"px-3 pb-1.5 pt-4 font-sans text-[calc(13px*var(--ws-fs))] font-semibold text-primary",
											)}
										>
											{RAIL_LABELS[id]}
										</span>
									)}
									{/* The row is a link and a disclosure side by side, not a
									    button inside a link: a caret nested in an anchor is
									    invalid, and a tap meant for one would fire the other. */}
									<div
										className={clsx(
											"relative flex min-h-[44px] items-center rounded-xl transition-colors",
											!active && "hover:bg-primary/5",
										)}
									>
										{/* One pressed wash that slides between sections. The
										    page never unmounts across sections and this nav is
										    a page singleton, so a fixed id is safe. */}
										{active && (
											<motion.span
												aria-hidden
												layoutId="settings-nav-active"
												transition={thumbSpring}
												className="absolute inset-0 rounded-xl bg-primary/10"
											/>
										)}
										<Link
											href={`/settings/${id}`}
											aria-current={active ? "page" : undefined}
											className="relative flex min-w-0 flex-1 items-center gap-3 self-stretch rounded-xl pl-3 pr-1"
										>
											{/* Bare glyphs (owner 2026-09-20). The open section is
											    told by the sliding wash behind the row and by
											    weight, not by a filled chip. */}
											<Icon
												className={clsx(
													"h-[18px] w-[18px] shrink-0 transition-colors",
													active ? "text-primary" : "text-muted",
												)}
												strokeWidth={active ? 2.5 : 2}
											/>
											{/* The name alone (owner 2026-09-20: "remove the tagline
											    in the settings"). What is in a section is told by the
											    sub-items under it now, not by a line of prose. */}
											<span
												className={clsx(
													"min-w-0 flex-1 truncate py-2 font-sans text-[calc(14px*var(--ws-fs))] text-primary",
													active ? "font-semibold" : "font-medium",
												)}
											>
												{t(labelKey)}
											</span>
										</Link>
										{subs.length > 1 ? (
											<button
												type="button"
												onClick={() =>
													setCollapsed((prev) => {
														const next = new Set(prev);
														if (next.has(id)) next.delete(id);
														else next.add(id);
														return next;
													})
												}
												aria-expanded={open}
												aria-controls={`settings-subs-${id}`}
												aria-label={`${open ? "Hide" : "Show"} what is in ${t(labelKey)}`}
												className="relative mr-1 flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-pill text-subtle transition-colors hover:text-primary"
											>
												<CaretDown
													size={13}
													weight="bold"
													className={clsx("transition-transform", !open && "-rotate-90")}
												/>
											</button>
										) : (
											<CaretRight
												size={13}
												weight="bold"
												className="relative mr-4 shrink-0 text-subtle lg:hidden"
											/>
										)}
									</div>
									{/* What is inside the section: tap to go there. Inside the
									    open section the one in view is lit and tapping scrolls;
									    anywhere else it opens that section on that group.
									    initial={false}: a first paint arrives already open. */}
									<AnimatePresence initial={false}>
										{open && (
											<motion.div
												key="subs"
												id={`settings-subs-${id}`}
												{...collapse}
												className="overflow-hidden"
											>
												<ul className="my-1 ml-[26px] flex flex-col border-l border-hairline pl-4">
													{subs.map((g) => {
														const on = active && g.id === activeGroup;
														return (
															<li key={g.id} className="relative">
																{/* The id carries the section: a closing list
																    is still mounted while the next opens, and a
																    shared id would fly the marker between them. */}
																{on && (
																	<motion.span
																		aria-hidden
																		layoutId={`settings-subnav-marker-${id}`}
																		transition={thumbSpring}
																		className="absolute -left-[17px] bottom-2 top-2 w-[2px] rounded-pill bg-primary"
																	/>
																)}
																{/* Inside the open section this scrolls, so it is a
																    button; anywhere else it opens that section on
																    that group, which is a link and has to be one:
																    router.push is a no-op here, the row is already
																    inside the same catch-all route. */}
																{active ? (
																	<button
																		type="button"
																		aria-current={on ? "true" : undefined}
																		onClick={() => onGroup?.(g.id)}
																		className={clsx(subRow, on ? subRowOn : subRowOff)}
																	>
																		{g.label}
																	</button>
																) : (
																	<Link
																		href={`/settings/${id}#group-${g.id}`}
																		className={clsx(subRow, subRowOff)}
																	>
																		{g.label}
																	</Link>
																)}
															</li>
														);
													})}
												</ul>
											</motion.div>
										)}
									</AnimatePresence>
								</motion.div>
							);
						})}
					</motion.nav>
				)}
			</div>
		</div>
	);
}
