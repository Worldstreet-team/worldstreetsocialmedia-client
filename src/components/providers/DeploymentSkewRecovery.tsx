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
		const maybeReload = (message: unknown) => {
			if (!SIGNATURE.test(String(message ?? ""))) return;
			try {
				const last = Number(sessionStorage.getItem(STAMP) ?? 0);
				if (Date.now() - last < 30_000) return;
				sessionStorage.setItem(STAMP, String(Date.now()));
			} catch {
				/* storage blocked — still better to reload once than stay dead */
			}
			window.location.reload();
		};
		const onRejection = (e: PromiseRejectionEvent) =>
			maybeReload(e.reason?.message ?? e.reason);
		const onError = (e: ErrorEvent) => maybeReload(e.message);
		window.addEventListener("unhandledrejection", onRejection);
		window.addEventListener("error", onError);
		return () => {
			window.removeEventListener("unhandledrejection", onRejection);
			window.removeEventListener("error", onError);
		};
	}, []);
	return null;
}
