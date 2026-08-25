import { atomWithStorage } from "jotai/utils";

// X-style auto-translate: when on, post cards translate themselves into the
// reader's locale as they render (server-side cache keeps it cheap).
export const autoTranslateAtom = atomWithStorage<boolean>(
	"ws-auto-translate",
	false,
);
