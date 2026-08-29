"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";

import { useGatewayRead } from "@/hooks/useGateway";
import { getSubscriptionAction } from "@/lib/subscription.actions";
import { premiumOpenAtom } from "@/store/ui.atom";
import { useSetAtom } from "jotai";
import { Lock } from "lucide-react";
import { UserBadges } from "@/components/ui/UserBadges";
import { SafeAvatar } from "@/components/ui/SafeAvatar";

/**
 * Whether the viewer may summon @vivid, fetched once per app session. The
 * gateway enforces this regardless — Vivid simply never answers a free
 * account — so this cache is UX, not security, and staleness after an
 * upgrade costs one reload at worst.
 */
let canTagVividPromise: Promise<boolean> | null = null;
function fetchCanTagVivid(): Promise<boolean> {
	canTagVividPromise ??= getSubscriptionAction()
		.then((res) =>
			res.success
				? // Older gateway builds don't return canTagVivid yet; premium
					// (subscriber) is the same gate, so fall back to it.
					Boolean(
						res.data.entitlements?.canTagVivid ??
							res.data.entitlements?.subscriber,
					)
				: false,
		)
		.catch(() => false);
	return canTagVividPromise;
}

const VIVID_USERNAME = "vivid";

export interface MentionUser {
	_id: string;
	username: string;
	firstName?: string;
	lastName?: string;
	avatar?: string;
	isVerified?: boolean;
	verification?: { tier?: "bronze" | "silver" | "gold" } | null;
}

/** The `@token` the caret currently sits inside, or null. */
export function activeMentionQuery(value: string, caret: number) {
	const upToCaret = value.slice(0, caret);
	const match = upToCaret.match(/(^|\s)@([A-Za-z0-9_]{0,30})$/);
	if (!match) return null;
	return { query: match[2], start: caret - match[2].length - 1, end: caret };
}

/**
 * Typeahead for @mentions. Opens while the caret sits in an @token, queries
 * the directory on a short debounce, and is keyboard-first: up/down to move,
 * Enter or Tab to insert, Escape to dismiss.
 */
export function MentionAutocomplete({
	query,
	onPick,
	onDismiss,
}: {
	query: string;
	onPick: (user: MentionUser) => void;
	onDismiss: () => void;
}) {
	const read = useGatewayRead();
	const [users, setUsers] = useState<MentionUser[]>([]);
	const [active, setActive] = useState(0);
	const [loading, setLoading] = useState(false);
	const [canTagVivid, setCanTagVivid] = useState(false);
	const setPremiumOpen = useSetAtom(premiumOpenAtom);

	useEffect(() => {
		let cancelled = false;
		fetchCanTagVivid().then((ok) => {
			if (!cancelled) setCanTagVivid(ok);
		});
		return () => {
			cancelled = true;
		};
	}, []);

	// Vivid is premium-gated: locked rows route every pick — mouse or
	// keyboard — to the premium sheet instead of inserting the mention.
	const isLocked = (u: MentionUser) =>
		u.username.toLowerCase() === VIVID_USERNAME && !canTagVivid;

	const pick = (u: MentionUser) => {
		if (isLocked(u)) {
			setPremiumOpen(true);
			onDismiss();
			return;
		}
		onPick(u);
	};
	const activeRef = useRef(0);
	activeRef.current = active;
	const usersRef = useRef<MentionUser[]>([]);
	usersRef.current = users;
	// Ref indirection so the keyboard listener effect below never needs to
	// re-subscribe as `pick` (which closes over the premium flag) changes.
	const pickRef = useRef<(u: MentionUser) => void>(() => {});
	pickRef.current = pick;

	useEffect(() => {
		let cancelled = false;
		setLoading(true);
		const timer = setTimeout(async () => {
			const res = await read(
				`/api/users/search?q=${encodeURIComponent(query)}`,
				(b) => b.data,
			);
			if (cancelled) return;
			const list = Array.isArray(res?.data) ? res.data : [];
			setUsers(list.slice(0, 6));
			setActive(0);
			setLoading(false);
		}, 180);
		return () => {
			cancelled = true;
			clearTimeout(timer);
		};
	}, [query]);

	// Keyboard handling lives here so the composer stays uncluttered.
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			const list = usersRef.current;
			if (e.key === "Escape") {
				onDismiss();
				return;
			}
			if (!list.length) return;
			if (e.key === "ArrowDown") {
				e.preventDefault();
				setActive((i) => (i + 1) % list.length);
			} else if (e.key === "ArrowUp") {
				e.preventDefault();
				setActive((i) => (i - 1 + list.length) % list.length);
			} else if (e.key === "Enter" || e.key === "Tab") {
				e.preventDefault();
				pickRef.current(list[activeRef.current]);
			}
		};
		document.addEventListener("keydown", onKey, true);
		return () => document.removeEventListener("keydown", onKey, true);
	}, [onPick, onDismiss]);

	if (!loading && users.length === 0) return null;

	return (
		// onMouseDown/preventDefault is load-bearing, not decoration: without it
		// pressing a row blurs the textarea, the composer's blur timer nulls the
		// mention range 120ms later, and the click that follows on mouseup has
		// nothing left to insert into — the row looked dead for any click held
		// longer than a flick. Preventing the default keeps focus in the
		// textarea, so no blur ever fires.
		<div
			role="listbox"
			aria-label="People to tag"
			onMouseDown={(e) => e.preventDefault()}
			className="absolute left-0 top-full mt-1 z-dropdown w-[300px] max-w-full overflow-hidden py-1 glass-panel backdrop-blur-2xl backdrop-saturate-150"
		>
			{loading && users.length === 0 ? (
				<p className="px-3 py-2 font-sans text-[12.5px] glass-ink-faint">
					Searching
				</p>
			) : (
				users.map((u, i) => {
					const name =
						[u.firstName, u.lastName].filter(Boolean).join(" ") ||
						u.username;
					return (
						<button
							key={u._id}
							type="button"
							role="option"
							aria-selected={i === active}
							onMouseEnter={() => setActive(i)}
							onClick={() => pick(u)}
							className={clsx(
								"w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors cursor-pointer",
								i === active
									? "bg-white/[0.12]"
									: "hover:bg-white/[0.07]",
							)}
						>
							<span className="relative h-8 w-8 rounded-pill overflow-hidden bg-white/10 shrink-0 ring-1 ring-white/15">
								<SafeAvatar src={u.avatar} className="object-cover" />
							</span>
							<span className="min-w-0 flex-1">
								<span className="flex items-center gap-1 min-w-0">
									<span className="font-sans text-[13px] font-semibold glass-ink truncate">
										{name}
									</span>
									<span className="shrink-0 flex">
										<UserBadges
											isVerified={u.isVerified}
											verification={u.verification}
											badges={(u as any).badges}
											size={12}
										/>
									</span>
								</span>
								<span className="block font-sans text-[11.5px] glass-ink-dim truncate">
									@{u.username}
								</span>
							</span>
							{isLocked(u) && (
								<span className="ml-auto flex shrink-0 items-center gap-1 rounded-pill bg-white/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide glass-ink-dim">
									<Lock className="h-3 w-3" />
									Premium
								</span>
							)}
						</button>
					);
				})
			)}
		</div>
	);
}
