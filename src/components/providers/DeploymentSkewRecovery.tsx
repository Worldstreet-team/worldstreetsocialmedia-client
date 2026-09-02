"use client";

import { useEffect } from "react";

/**
 * Self-heal after a redeploy.
 *
 * Every push replaces the Next container, and every open tab still holds
 * the previous deployment's server-action ids — the next tap throws
 * "Failed to find Server Action … older or newer deployment" until the
 * person hard-refreshes. One log window held 2,499 of those; to the users
 * it read as the app being broken (nobody could buy a post).
 *
 * A stale tab is unrecoverable except by reload, so reload is the fix:
 * catch the signature globally, refresh once. The sessionStorage stamp
 * stops a reload loop if the error somehow survives the refresh.
 */
const SIGNATURE = /Failed to find Server Action|older or newer deployment/i;
const STAMP = "ws-skew-reloaded-at";

export function DeploymentSkewRecovery() {
	useEffect(() => {
		// Dev is exempt: Turbopack HMR regenerates action ids on every edit,
		// so the skew signature fires constantly and the reload fights the
		// dev loop (it also killed pending navigations while testing).
		if (process.env.NODE_ENV !== "production") return;
		// A reload must NEVER race a navigation. The user taps a link; while
		// the next page is still loading, a stale request from the OLD page
		// rejects with the skew signature — and reload() at that moment
		// cancels the in-flight navigation and re-loads the page they just
		// LEFT. That was the production "I changed page and it dragged me
		// back". Two guards: an unload flag (a hard navigation has begun —
		// the incoming document is fresh, nothing to fix), and a grace delay
		// so a soft navigation's URL commit wins the race before we act.
		let navigating = false;
		const markNav = () => {
			navigating = true;
		};
		// pagehide alone: it fires on every real departure (beforeunload does
		// not exist on iOS), and a beforeunload listener blocks the
		// back/forward cache in Firefox for zero benefit here.
		window.addEventListener("pagehide", markNav);

		// ONE reload per incident, ever — never a rhythm of them.
		//
		// The first version reloaded again every 30s while the signature kept
		// firing, and during a rolling deploy the freshly reloaded page can
		// hit the OLD container and trip the signature again — so production
		// tabs reloaded two, three, four times in a row. Users experience a
		// reload as the app breaking; twice is unforgivable. Now: if THIS
		// load is itself the recovery reload (stamp within 3 min), further
		// auto-reloads are off entirely — a stale action then just fails its
		// one call, which every call site already survives. And a lone error
		// doesn't trigger anything: it takes two strikes inside 60s, so one
		// transient blip during a deploy window costs nothing.
		let coolingDown = false;
		try {
			const last = Number(sessionStorage.getItem(STAMP) ?? 0);
			coolingDown = Date.now() - last < 180_000;
		} catch {
			/* unreadable storage: behave as if cooling down — never loop */
			coolingDown = true;
		}
		let firstStrikeAt = 0;

		const maybeReload = (message: unknown) => {
			if (!SIGNATURE.test(String(message ?? ""))) return;
			if (navigating || coolingDown) return;
			const now = Date.now();
			if (now - firstStrikeAt > 60_000) {
				firstStrikeAt = now;
				return;
			}
			coolingDown = true;
			try {
				sessionStorage.setItem(STAMP, String(now));
			} catch {
				/* storage blocked — the in-memory flag still prevents loops */
			}
			const href = window.location.href;
			setTimeout(() => {
				// Still here, still on the same URL, no unload started — now
				// the reload is safe and lands where the person actually is.
				if (!navigating && window.location.href === href) {
					window.location.reload();
				}
			}, 1_500);
		};
		const onRejection = (e: PromiseRejectionEvent) =>
			maybeReload(e.reason?.message ?? e.reason);
		const onError = (e: ErrorEvent) => maybeReload(e.message);
		window.addEventListener("unhandledrejection", onRejection);
		window.addEventListener("error", onError);
		return () => {
			window.removeEventListener("unhandledrejection", onRejection);
			window.removeEventListener("error", onError);

			window.removeEventListener("pagehide", markNav);
		};
	}, []);
	return null;
}
