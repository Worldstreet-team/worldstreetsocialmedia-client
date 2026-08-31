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
		window.addEventListener("beforeunload", markNav);
		window.addEventListener("pagehide", markNav);

		const maybeReload = (message: unknown) => {
			if (!SIGNATURE.test(String(message ?? ""))) return;
			if (navigating) return;
			try {
				const last = Number(sessionStorage.getItem(STAMP) ?? 0);
				if (Date.now() - last < 30_000) return;
				sessionStorage.setItem(STAMP, String(Date.now()));
			} catch {
				/* storage blocked — still better to reload once than stay dead */
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
			window.removeEventListener("beforeunload", markNav);
			window.removeEventListener("pagehide", markNav);
		};
	}, []);
	return null;
}
