"use client";

import clsx from "clsx";
import { UserBadges, type ProfileBadge } from "@/components/ui/UserBadges";
import type { VerifiedTier } from "@/assets/icons/VerifiedIcon";

/** Whatever shape a surface happens to hold a person in. Every field is
 *  optional because callers get people from a dozen different endpoints. */
export interface PersonLike {
	firstName?: string | null;
	lastName?: string | null;
	username?: string | null;
	name?: string | null;
	isVerified?: boolean;
	verification?: { tier?: VerifiedTier } | null;
	badges?: ProfileBadge[];
}

/**
 * The one rule for what a person is CALLED: their real name, falling back to
 * the handle only when there is no name to use.
 *
 * `name` is honoured first for the surfaces that only ever receive a resolved
 * string (the mention cache hands back one).
 */
export function displayName(person: PersonLike | null | undefined): string {
	if (!person) return "";
	const full = `${person.firstName ?? ""} ${person.lastName ?? ""}`.trim();
	return full || person.name?.trim() || person.username || "";
}

/**
 * A person's name with everything that belongs after it.
 *
 * There is no library for this — and there does not need to be, because both
 * halves already existed here and were being re-assembled by hand at every
 * call site. This is the seam: `displayName` decides what to call someone,
 * `UserBadges` decides what follows, and a surface just says whose name it is.
 *
 * Two things it fixes wherever it lands. Rails showed `@handle` because that
 * was the only field the caller bothered to read, so people were addressed by
 * their login rather than their name. And badges were commonly wrapped in a
 * `{isVerified && …}` guard, which hid Wolf and developer marks from anyone
 * who had not also bought a tick — UserBadges already returns null when there
 * is nothing to show, so the guard only ever removed real marks.
 */
export function PersonName({
	person,
	size = 13,
	className,
	nameClassName,
}: {
	person: PersonLike | null | undefined;
	size?: number;
	className?: string;
	/** Truncation and weight belong to the caller — a rail card and a
	 *  notification line want different things around the same name. */
	nameClassName?: string;
}) {
	const name = displayName(person);
	if (!name) return null;
	return (
		<span className={clsx("inline-flex min-w-0 items-center gap-0.5", className)}>
			<span className={clsx("truncate", nameClassName)}>{name}</span>
			<UserBadges
				isVerified={person?.isVerified}
				verification={person?.verification}
				badges={person?.badges}
				size={size}
			/>
		</span>
	);
}
