/**
 * System-event copy + per-sender colour for group threads (register 105/117).
 *
 * The gateway persists structured system rows ({kind, params}); the client
 * owns the wording, so copy changes never need a migration. Sender colours
 * are a deterministic hash into a fixed, AA-legible, brand-family palette —
 * no blue, no pink, stable per person across sessions and both themes.
 */

export interface SystemEvent {
	kind: string;
	params?: Record<string, unknown>;
}

function actorName(
	params: Record<string, unknown> | undefined,
	senderName?: string,
): string {
	return (params?.actorName as string) || senderName || "Someone";
}

/** One line describing a system event. Returns "" for unknown kinds.
 *  Viewer-relative: when the viewer IS the actor or the subject the copy
 *  says "You", the way Signal/Telegram/WhatsApp all render it. */
export function systemEventCopy(
	event: SystemEvent,
	senderName?: string,
	viewerId?: string,
): string {
	const p = event.params ?? {};
	const viewerIsActor =
		Boolean(viewerId) && String(p.actor ?? "") === String(viewerId);
	const viewerIsSubject =
		Boolean(viewerId) && String(p.subject ?? "") === String(viewerId);
	const actor = viewerIsActor ? "You" : actorName(p, senderName);
	const subject = viewerIsSubject
		? "you"
		: (p.subjectName as string) || "someone";
	switch (event.kind) {
		case "group.created":
			return `${actor} created "${(p.name as string) ?? "the group"}"`;
		case "group.renamed":
			return p.from
				? `${actor} renamed the group from "${p.from as string}" to "${(p.name as string) ?? ""}"`
				: `${actor} renamed the group to "${(p.name as string) ?? ""}"`;
		case "group.avatar":
			return p.removed
				? `${actor} removed the group photo`
				: `${actor} changed the group photo`;
		case "group.joined":
			if (p.viaLink) return `${subject} joined by invite link`;
			if (p.approved) return `${actor} let ${subject} in`;
			return p.viaInvite ? `${subject} joined` : `${actor} added ${subject}`;
		case "group.description":
			return p.removed
				? `${actor} removed the description`
				: `${actor} changed the description`;
		case "group.history":
			if (typeof p.share === "number")
				return p.share > 0
					? `${actor} set new members to see the last ${p.share} messages`
					: `${actor} hid past messages from new members`;
			return p.visible
				? `${actor} let new members see past messages`
				: `${actor} hid past messages from new members`;
		case "group.slowmode":
			return Number(p.seconds) > 0
				? `${actor} turned on slow mode: one message every ${slowWords(p.seconds)}`
				: `${actor} turned off slow mode`;
		case "group.disappearing":
			return Number(p.seconds) > 0
				? `${actor} set messages to disappear after ${spanWords(p.seconds)}`
				: `${actor} turned off disappearing messages`;
		case "group.pinned":
			return `${actor} pinned a message`;
		case "group.unpinned":
			return `${actor} unpinned a message`;
		case "group.restricted":
			return viewerIsSubject
				? `${actor} paused your messages for a while`
				: `${actor} paused ${subject}'s messages for a while`;
		case "group.unrestricted":
			return viewerIsSubject
				? `${actor} let you send messages again`
				: `${actor} let ${subject} send messages again`;
		case "group.restored":
			return `${actor} restored the group`;
		case "group.settings":
			return `${actor} changed who can ${settingWords(p.changed)}`;
		case "group.left":
			if (p.accountDeleted) return `${subject}'s account was deleted`;
			return viewerIsSubject ? "You left the group" : `${subject} left`;
		case "group.removed":
			if (p.banned)
				return viewerIsSubject
					? `${actor} removed and banned you`
					: `${actor} removed and banned ${subject}`;
			return viewerIsSubject
				? `${actor} removed you`
				: `${actor} removed ${subject}`;
		case "group.approval":
			return p.on
				? `${actor} turned on approval for new members`
				: `${actor} turned off approval for new members`;
		case "group.promoted":
			return viewerIsSubject
				? "You're an admin now"
				: `${subject} is now an admin`;
		case "group.demoted":
			return `${subject} is no longer an admin`;
		case "group.owner":
			return viewerIsSubject
				? "You own the group now"
				: `${subject} owns the group now`;
		case "group.locked":
			return `${actor} locked the group, only admins can send`;
		case "group.unlocked":
			return `${actor} unlocked the group`;
		default:
			return "";
	}
}

function slowWords(seconds: unknown): string {
	const s = Number(seconds) || 0;
	if (s >= 3600) return `${Math.round(s / 3600)} hour${s >= 7200 ? "s" : ""}`;
	if (s >= 60) return `${Math.round(s / 60)} minute${s >= 120 ? "s" : ""}`;
	return `${s} seconds`;
}
function spanWords(seconds: unknown): string {
	const s = Number(seconds) || 0;
	if (s >= 7776000) return "90 days";
	if (s >= 604800) return "7 days";
	if (s >= 86400) return "24 hours";
	return `${s} seconds`;
}

const SETTING_WORDS: Record<string, string> = {
	send: "send messages",
	media: "send media",
	addMembers: "add people",
	editInfo: "edit the group",
	pin: "pin messages",
	calls: "start calls",
	mentionAll: "mention everyone",
	money: "send money",
};
function settingWords(changed: unknown): string {
	const keys = Array.isArray(changed) ? changed.map(String) : [];
	const words = keys.map((k) => SETTING_WORDS[k] ?? k);
	if (words.length === 0) return "do what";
	if (words.length === 1) return words[0];
	return `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;
}

// Six brand-family hues, all AA on both the stone and paper grounds. No blue,
// no pink (the palette forbids them). Rendered via inline color.
const SENDER_HUES = [
	"#EAB308", // gold
	"#F59E0B", // amber
	"#10B981", // emerald
	"#14B8A6", // teal
	"#A3A375", // olive
	"#D97706", // ochre
];

export function senderColor(profileId: string): string {
	let h = 0;
	for (let i = 0; i < profileId.length; i++) {
		h = (h * 31 + profileId.charCodeAt(i)) >>> 0;
	}
	return SENDER_HUES[h % SENDER_HUES.length];
}
