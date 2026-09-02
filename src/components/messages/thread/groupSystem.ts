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
			return `${actor} renamed the group to "${(p.name as string) ?? ""}"`;
		case "group.avatar":
			return `${actor} changed the group photo`;
		case "group.joined":
			return `${actor} added ${subject}`;
		case "group.left":
			return viewerIsSubject ? "You left the group" : `${subject} left`;
		case "group.removed":
			return viewerIsSubject
				? `${actor} removed you`
				: `${actor} removed ${subject}`;
		case "group.promoted":
			return viewerIsSubject
				? "You're an admin now"
				: `${subject} is now an admin`;
		case "group.demoted":
			return `${subject} is no longer an admin`;
		case "group.locked":
			return `${actor} locked the group — only admins can send`;
		case "group.unlocked":
			return `${actor} unlocked the group`;
		default:
			return "";
	}
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
