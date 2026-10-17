"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAtomValue } from "jotai";
import { MagnifyingGlass, X } from "@phosphor-icons/react";
import { LayoutGrid } from "@/components/ui/icons";
import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { collapse, staggerItem, staggerParentFast, thumbSpring } from "@/lib/motion-presets";
import {
	CATEGORIES,
	GROUPS,
	MESSAGES_MOVED_KEY,
	SECTIONS,
	type SectionId,
	searchSettings,
} from "@/components/settings/sections";
import { SafeAvatar } from "@/components/ui/SafeAvatar";
import { useTourSeen } from "@/lib/use-tour-seen";
import { userAtom } from "@/store/user.atom";
import { useT } from "@/i18n/client";
import { SettingsHub } from "./SettingsHub";

/**
 * The settings sidebar (owner 2026-10-07, replacing the two frosted blocks
 * of 2026-09-20).
 *
 * Flat on the page: the title and the master search, then the map. The map
 * is Overview and the sections under five labels (Activity, Privacy,
 * Content, App, Account), each a bare glyph and a name, the open one on a
 * sliding pressed wash. Only the OPEN section folds out its groups: with
 * every section open by default the rail ran to some twenty-two rows and
 * needed per-account carets to get short again. `prefs.advanced
 * .collapsedSettings` is no longer read.
 *
 * The search covers every row of every section (sections.tsx SEARCH_INDEX).
 * A result opens the section, scrolls to the block and lights it; Enter
 * takes the first result, arrows walk the list, Escape clears.
 */
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
	const inputRef = useRef<HTMLInputElement>(null);
	const results = useMemo(() => searchSettings(query), [query]);
	const searching = query.trim().length > 0;
	useEffect(() => setCursor(0), [query]);
	// Messages is new since the regroup; the badge goes with the notice.
	const moved = useTourSeen(MESSAGES_MOVED_KEY);

	const subRow =
		"flex h-8 w-full cursor-pointer items-center rounded-[8px] px-2.5 text-left font-sans text-[calc(13.5px*var(--ws-fs))] transition-colors";

	const hrefOf = (r: { section: SectionId; group: string }) =>
		`/settings/${r.section}#group-${r.group}`;
	const name =
		[user?.firstName, user?.lastName].filter(Boolean).join(" ") || user?.username;

	const row = (on: boolean) =>
		clsx(
			"relative flex min-h-[40px] items-center gap-3 rounded-xl px-3 transition-colors",
			!on && "hover:bg-primary/5",
		);

	return (
		<div className="flex min-h-full flex-col gap-4 px-3 pb-4 pt-5 lg:px-4 lg:pt-7">
			{/* Masthead: title and master search. On a phone it also says
			    whose settings these are; a desktop has the Overview for that. */}
			<div className="flex flex-col gap-4">
				<div className="flex items-center gap-3 px-2">
					<div className="min-w-0 flex-1">
						<h1 className="font-display text-[calc(26px*var(--ws-fs))] font-semibold tracking-tight text-primary">
							{t("settings.title")}
						</h1>
						<p className="truncate font-sans text-[calc(13px*var(--ws-fs))] text-muted lg:hidden">
							{name} · @{user?.username}
						</p>
					</div>
					<span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-pill bg-sunken lg:hidden">
						<SafeAvatar src={user?.avatar} />
					</span>
				</div>
				<label className="relative block">
					<MagnifyingGlass
						size={16}
						weight="bold"
						className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-subtle"
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
						className="h-10 w-full rounded-pill bg-primary/5 pl-10 pr-10 font-sans text-[calc(14px*var(--ws-fs))] text-primary transition-colors placeholder:text-subtle focus:bg-primary/10 focus:outline-none"
					/>
					{searching && (
						<button
							type="button"
							aria-label="Clear search"
							onClick={() => {
								setQuery("");
								inputRef.current?.focus();
							}}
							className="absolute right-0 top-1/2 flex h-10 w-10 -translate-y-1/2 cursor-pointer items-center justify-center rounded-pill text-muted transition-colors hover:text-primary"
						>
							<X size={14} weight="bold" />
						</button>
					)}
				</label>
			</div>
			{/* On a phone `/settings` IS this column (owner 2026-09-20, mobile
			    directions A + B): tiles for the common changes, then the
			    sections as a list that says what each is set to. The map
			    below is a desktop idiom and stays on the desktop. */}
			{!searching && (
				<div className="lg:hidden">
					<SettingsHub />
				</div>
			)}
			{/* The map, or the results while a search is running. A phone
			    shows this only for search results. */}
			<div className={clsx(!searching && "hidden lg:block")}>
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
													"flex min-h-[42px] items-center gap-2.5 rounded-[10px] px-2.5 transition-colors",
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
						className="flex flex-col gap-px"
					>
						<motion.div variants={staggerItem}>
							<Link
								href="/settings"
								aria-current={!activeId ? "page" : undefined}
								className={row(!activeId)}
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
										activeId ? "text-muted" : "text-brand",
									)}
									strokeWidth={activeId ? 2 : 2.5}
								/>
								<span
									className={clsx(
										"relative truncate font-sans text-[calc(14.5px*var(--ws-fs))] text-primary",
										activeId ? "font-medium" : "font-semibold",
									)}
								>
									Overview
								</span>
							</Link>
						</motion.div>
						{CATEGORIES.map((cat) => (
							<motion.div key={cat.label} variants={staggerItem} className="flex flex-col gap-px">
								<span className="px-3 pb-1.5 pt-5 font-sans text-[calc(11.5px*var(--ws-fs))] font-semibold uppercase tracking-[0.1em] text-subtle">
									{cat.label}
								</span>
								{cat.ids.map((id) => {
									const def = SECTIONS.find((s) => s.id === id);
									if (!def) return null;
									const { labelKey, icon: Icon } = def;
									const active = id === activeId;
									const subs = GROUPS[id];
									const isNew = id === "messages" && moved.ready && !moved.seen;
									return (
										<div key={id} className="flex flex-col">
											<Link
												href={`/settings/${id}`}
												aria-current={active ? "page" : undefined}
												className={row(active)}
											>
												{/* One pressed wash that slides between sections.
												    The page never unmounts across sections and this
												    nav is a page singleton, so a fixed id is safe. */}
												{active && (
													<motion.span
														aria-hidden
														layoutId="settings-nav-active"
														transition={thumbSpring}
														className="absolute inset-0 rounded-xl bg-primary/10"
													/>
												)}
												<Icon
													className={clsx(
														"relative h-[18px] w-[18px] shrink-0 transition-colors",
														active ? "text-brand" : "text-muted",
													)}
													strokeWidth={active ? 2.5 : 2}
												/>
												<span
													className={clsx(
														"relative min-w-0 flex-1 truncate py-1 font-sans text-[calc(14.5px*var(--ws-fs))] text-primary",
														active ? "font-semibold" : "font-medium",
													)}
												>
													{t(labelKey)}
												</span>
												{isNew && (
													<span className="relative shrink-0 rounded-pill bg-brand/10 px-2 py-0.5 font-sans text-[calc(11px*var(--ws-fs))] font-semibold text-brand">
														New
													</span>
												)}
											</Link>
											{/* The open section's groups, tap to scroll; the one
											    in view is lit. initial={false}: a first paint
											    arrives already open. */}
											<AnimatePresence initial={false}>
												{active && subs.length > 1 && (
													<motion.div key="subs" {...collapse} className="overflow-hidden">
														<ul className="mb-1.5 ml-[21px] mt-0.5 flex flex-col border-l border-hairline pl-3">
															{subs.map((g) => {
																const on = g.id === activeGroup;
																return (
																	<li key={g.id} className="relative">
																		{on && (
																			<motion.span
																				aria-hidden
																				layoutId={`settings-subnav-marker-${id}`}
																				transition={thumbSpring}
																				className="absolute -left-[13px] bottom-1 top-1 w-[2px] rounded-pill bg-brand"
																			/>
																		)}
																		<button
																			type="button"
																			aria-current={on ? "true" : undefined}
																			onClick={() => onGroup?.(g.id)}
																			className={clsx(
																				subRow,
																				on
																					? "font-semibold text-primary"
																					: "text-subtle hover:bg-primary/5 hover:text-primary",
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
							</motion.div>
						))}
					</motion.nav>
				)}
			</div>
		</div>
	);
}
