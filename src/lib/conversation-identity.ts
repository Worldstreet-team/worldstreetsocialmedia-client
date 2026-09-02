/**
 * conversationIdentity — the ONE place "who is this thread with" is decided
 * (register 102).
 *
 * Every surface used to read `conversation.otherParticipant` directly, which
 * silently assumes a 1:1 DM. Groups have no single "other": their identity is
 * a name, an avatar and a member count. This resolves both shapes to one, so
 * a header, a list row or a dock renders from `identity.title` /
 * `identity.avatar` without caring which it got — and the DM-only affordances
 * (call, profile link) gate on `identity.kind === "dm"`.
 */

export interface IdentityPeer {
	_id: string;
	firstName?: string;
	lastName?: string;
	username?: string;
	avatar?: string;
	isVerified?: boolean;
	verification?: unknown;
	badges?: unknown;
	lastSeenAt?: string;
}

export interface ConversationLike {
	kind?: "dm" | "group";
	name?: string;
	avatar?: string;
	memberCount?: number;
	otherParticipant?: IdentityPeer;
}

export interface ConversationIdentity {
	kind: "dm" | "group";
	/** Header/list/dock display name. */
	title: string;
	/** Header/list/dock avatar url (may be empty — callers supply a fallback). */
	avatar: string;
	/** The DM peer, present only for DMs — call peer, profile link, presence. */
	peer: IdentityPeer | null;
	/** Groups only. */
	memberCount: number | null;
}

/** A person's display name: full name, else @handle, else "Someone". */
export function displayNameOf(u?: {
	firstName?: string;
	lastName?: string;
	username?: string;
} | null): string {
	if (!u) return "Someone";
	const full = `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim();
	return full || (u.username ? `@${u.username}` : "Someone");
}

export function conversationIdentity(
	conv: ConversationLike | null | undefined,
): ConversationIdentity {
	if (conv?.kind === "group") {
		return {
			kind: "group",
			title: conv.name?.trim() || "Group chat",
			avatar: conv.avatar || "",
			peer: null,
			memberCount: conv.memberCount ?? null,
		};
	}
	const peer = conv?.otherParticipant ?? null;
	return {
		kind: "dm",
		title: displayNameOf(peer),
		avatar: peer?.avatar || "",
		peer,
		memberCount: null,
	};
}
