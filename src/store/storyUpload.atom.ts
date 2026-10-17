import { atom } from "jotai";

/**
 * A story in flight (owner pick 2026-10-11, "Ring on Your story"): Share
 * closes the studio at once and the upload carries on behind you. The rail's
 * own circle shows it, filling as it goes, so there is no island and no
 * toast to chase. Null when nothing is posting.
 */
export type StoryUpload = {
	/** Each Share gets a fresh id; a job only writes while its id is current. */
	id: number;
	status: "working" | "done" | "failed";
	/** 1-based slide being sent, of `total`. */
	slide: number;
	total: number;
	/** 0..1 across the whole job (render + every slide's bytes). */
	pct: number;
	/** Object URL of the first exported picture, owned by the job. */
	thumb: string | null;
	message?: string;
	cancel?: () => void;
	retry?: () => void;
};

export const storyUploadAtom = atom<StoryUpload | null>(null);
