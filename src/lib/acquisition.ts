/**
 * How this person arrived — read once, at signup.
 *
 * Attribution cannot be reconstructed after the fact: two 1,700-signup days
 * have already passed with no way to know what caused them. UTM parameters
 * are stashed on first landing (they are gone from the URL by the time
 * onboarding submits) and the referrer is read from the document.
 *
 * Absent values are meaningful, not missing: no source means organic.
 */

const KEY = "ws_acq";

export interface Acquisition {
	source?: string;
	medium?: string;
	campaign?: string;
	referrer?: string;
}

/** Call once on first load. Stores only if something was actually carried,
 *  and never overwrites an earlier capture — first touch wins. */
export function captureAcquisition(): void {
	if (typeof window === "undefined") return;
	try {
		if (sessionStorage.getItem(KEY)) return;
		const p = new URLSearchParams(window.location.search);
		const ref = document.referrer || "";
		const sameSite = ref.includes(window.location.host);
		const acq: Acquisition = {
			source: p.get("utm_source") ?? undefined,
			medium: p.get("utm_medium") ?? undefined,
			campaign: p.get("utm_campaign") ?? undefined,
			// An internal referrer says nothing about acquisition.
			referrer: ref && !sameSite ? ref.slice(0, 300) : undefined,
		};
		if (acq.source || acq.medium || acq.campaign || acq.referrer) {
			sessionStorage.setItem(KEY, JSON.stringify(acq));
		}
	} catch {
		// Private mode or blocked storage: organic is a fine default.
	}
}

/** What to send with the onboarding payload. */
export function readAcquisition(): Acquisition | undefined {
	if (typeof window === "undefined") return undefined;
	try {
		const raw = sessionStorage.getItem(KEY);
		return raw ? (JSON.parse(raw) as Acquisition) : undefined;
	} catch {
		return undefined;
	}
}
