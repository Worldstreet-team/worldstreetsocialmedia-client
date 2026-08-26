import { atom } from "jotai";

/**
 * The active native broadcast, if any. Set by the Go Live sheet when the
 * user streams FROM socials (camera or screen); the LiveDock reads it,
 * connects to LiveKit and publishes. Null = not live. The Go Live entry
 * points disable themselves while this is set.
 */
export interface LiveSession {
	streamId: string;
	roomName: string;
	token: string;
	url: string;
	title: string;
	category: string;
	source: "camera" | "screen";
}

export const liveSessionAtom = atom<LiveSession | null>(null);
