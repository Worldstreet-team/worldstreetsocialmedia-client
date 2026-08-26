import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";

export interface Draft {
  id: string;
  content: string;
  updatedAt: number;
}

/** Saved drafts, newest first. Text only — File handles can't be serialized,
 *  so attachments stay with the live composer. */
export const draftsAtom = atomWithStorage<Draft[]>("ws-social-drafts", []);

export const draftsOpenAtom = atom(false);

/** One-shot channel: the drafts sheet drops a draft's text here, the
 *  composer picks it up on the next render and clears it. */
export const pendingDraftAtom = atom<string | null>(null);
