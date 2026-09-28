"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Loader2, Search } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { SafeAvatar } from "@/components/ui/SafeAvatar";
import { UserBadges } from "@/components/ui/UserBadges";
import { useGatewayRead } from "@/hooks/useGateway";
import { pop, staggerParentFast } from "@/lib/motion-presets";
import { CascadeRow } from "./ConversationList";

export interface PickedPerson {
	_id: string;
	username?: string;
	firstName?: string;
	lastName?: string;
	avatar?: string;
	isVerified?: boolean;
	verification?: unknown;
	badges?: unknown;
}

export const personName = (u: PickedPerson) =>
	`${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || u.username || "Someone";

/**
 * Pick people for a group (audit G20, G168). The people you follow are
 * the suggestions; typing two characters searches everyone on the server,
 * so person 101 and a stranger who lets anyone add them can both be found.
 * Whether each pick is added or invited is the gateway's call, by their
 * own "who can add me" setting; the picker never guesses.
 */
export function PeoplePicker({
	myClerkId,
	exclude,
	selected,
	onToggle,
	placeholder = "Search people",
	autoFocus = false,
}: {
	myClerkId: string;
	/** Already in the room: never listed. */
	exclude?: Set<string>;
	selected: Record<string, PickedPerson>;
	onToggle: (u: PickedPerson) => void;
	placeholder?: string;
	autoFocus?: boolean;
}) {
	const read = useGatewayRead();
	const [query, setQuery] = useState("");
	const [follows, setFollows] = useState<PickedPerson[]>([]);
	const [followsLoading, setFollowsLoading] = useState(true);
	const [found, setFound] = useState<PickedPerson[]>([]);
	const [searching, setSearching] = useState(false);

	useEffect(() => {
		if (!myClerkId) {
			setFollowsLoading(false);
			return;
		}
		let cancelled = false;
		void (async () => {
			setFollowsLoading(true);
			try {
				const res = await read(`/api/users/${myClerkId}/following?limit=100`, (b) => b);
				const rows = (res.data as any)?.data ?? [];
				if (!cancelled) setFollows(Array.isArray(rows) ? rows : []);
			} finally {
				if (!cancelled) setFollowsLoading(false);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [myClerkId, read]);

	// The server search, debounced, from two characters.
	useEffect(() => {
		const term = query.trim();
		if (term.length < 2) {
			setFound([]);
			setSearching(false);
			return;
		}
		setSearching(true);
		const id = window.setTimeout(async () => {
			const res = await read(`/api/users/search?q=${encodeURIComponent(term)}`, (b) => b.data);
			if (res.success && Array.isArray(res.data)) setFound(res.data as PickedPerson[]);
			setSearching(false);
		}, 300);
		return () => window.clearTimeout(id);
	}, [query, read]);

	const rows = useMemo(() => {
		const q = query.trim().toLowerCase();
		const out: PickedPerson[] = [];
		const seen = new Set<string>();
		const push = (u: PickedPerson) => {
			if (!u?._id || seen.has(u._id) || exclude?.has(u._id)) return;
			seen.add(u._id);
			out.push(u);
		};
		for (const u of follows) {
			if (
				!q ||
				u.username?.toLowerCase().includes(q) ||
				`${u.firstName ?? ""} ${u.lastName ?? ""}`.toLowerCase().includes(q)
			)
				push(u);
		}
		for (const u of found) push(u);
		return out;
	}, [follows, found, query, exclude]);

	// One cascade per mount; a search remounts rows and must cut.
	const cascadePlayed = useRef(false);
	useEffect(() => {
		if (followsLoading || rows.length === 0) return;
		const id = window.setTimeout(() => {
			cascadePlayed.current = true;
		}, 400);
		return () => window.clearTimeout(id);
	}, [followsLoading, rows.length]);

	const term = query.trim();

	return (
		<div className="flex min-h-0 flex-1 flex-col">
			<div className="relative shrink-0 px-4 pb-2">
				<Search className="absolute left-7 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
				<input
					value={query}
					onChange={(e) => setQuery(e.target.value)}
					placeholder={placeholder}
					autoFocus={autoFocus}
					className="w-full rounded-pill bg-primary/5 py-2.5 pl-10 pr-10 text-base text-primary outline-none transition-colors placeholder:text-subtle focus:bg-primary/10 sm:text-sm"
				/>
				{searching && (
					<Loader2 className="absolute right-7 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-subtle" />
				)}
			</div>

			<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
				{followsLoading && !term ? (
					<div className="flex flex-col items-center justify-center py-12 text-muted">
						<Loader2 className="mb-3 h-6 w-6 animate-spin" />
						<span className="text-sm">Loading people</span>
					</div>
				) : rows.length === 0 ? (
					<p className="px-6 py-12 text-center font-sans text-[calc(13px*var(--ws-fs))] text-muted">
						{term.length >= 2
							? searching
								? "Looking"
								: `No one matches "${term}"`
							: term
								? "Keep typing to search everyone"
								: "People you follow show up here. Type a name or a handle to find anyone."}
					</p>
				) : (
					<motion.div
						variants={staggerParentFast}
						initial={cascadePlayed.current ? false : "hidden"}
						animate="show"
					>
						{rows.map((u, i) => {
							const on = !!selected[u._id];
							return (
								<CascadeRow key={u._id} index={i}>
									<button
										type="button"
										onClick={() => onToggle(u)}
										className="flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-primary/5"
									>
										<span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-pill bg-raised">
											<SafeAvatar src={u.avatar} eager />
										</span>
										<span className="min-w-0 flex-1">
											<span className="flex items-center gap-1">
												<span className="truncate font-sans text-[calc(15px*var(--ws-fs))] font-semibold text-primary">
													{personName(u)}
												</span>
												<UserBadges
													isVerified={u.isVerified}
													verification={u.verification as any}
													badges={u.badges as any}
													size={15}
												/>
											</span>
											{u.username && (
												<span className="block truncate font-sans text-[calc(13px*var(--ws-fs))] text-muted">
													@{u.username}
												</span>
											)}
										</span>
										{/* The ring is always there; the filled disc lands
										    over it (own action, so it may pop). */}
										<span className="relative h-6 w-6 shrink-0 rounded-pill border border-hairline">
											<AnimatePresence initial={false}>
												{on && (
													<motion.span
														key="on"
														{...pop}
														className="absolute -inset-px flex items-center justify-center rounded-pill bg-brand text-brand-on"
													>
														<Check className="h-4 w-4" />
													</motion.span>
												)}
											</AnimatePresence>
										</span>
									</button>
								</CascadeRow>
							);
						})}
					</motion.div>
				)}
			</div>
		</div>
	);
}

/** What the gateway said happened to each pick (audit G41, G169). */
export type AddOutcome =
	| "added"
	| "invited"
	| "already"
	| "pending"
	| "blocked"
	| "banned"
	| "full"
	| "unknown";

export const OUTCOME_WORDS: Record<AddOutcome, { title: string; note?: string }> = {
	added: { title: "Added" },
	invited: {
		title: "Invited",
		note: "They choose who can add them, so they got an invite instead. It lasts three days.",
	},
	pending: {
		title: "Already on the way in",
		note: "They have an invite or a request waiting.",
	},
	already: { title: "Already in the group" },
	blocked: { title: "Can't be added", note: "One of you has blocked the other." },
	banned: { title: "Kept out", note: "An admin banned them from this group." },
	full: { title: "No room", note: "The group is full." },
	unknown: { title: "Not found" },
};

/** Group the results by outcome, in the order a person wants to read them. */
export function groupOutcomes(
	results: { id: string; status: AddOutcome }[],
	nameOf: (id: string) => string,
): { status: AddOutcome; names: string[] }[] {
	const order: AddOutcome[] = ["added", "invited", "pending", "already", "blocked", "banned", "full", "unknown"];
	const by = new Map<AddOutcome, string[]>();
	for (const r of results) {
		const list = by.get(r.status) ?? [];
		list.push(nameOf(r.id));
		by.set(r.status, list);
	}
	return order.filter((s) => by.has(s)).map((s) => ({ status: s, names: by.get(s) ?? [] }));
}
