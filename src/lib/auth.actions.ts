import { BACKEND_URL } from "@/const";

/**
 * How long the middleware will wait for the profile sync.
 *
 * This call sits in front of EVERY request, so an unbounded wait is an
 * unbounded wait on every page. The gateway is a free instance that sleeps
 * when idle and takes 20-30s to wake, and with no timeout here the first
 * request after a nap hung until the platform killed it. 8s is generous for a
 * warm gateway and short enough that a cold one degrades instead of freezing.
 */
const SYNC_TIMEOUT_MS = 8_000;

/**
 * Three outcomes, and the difference between them matters:
 *  - a profile        → this account exists, here it is
 *  - `"not_found"`    → the gateway is sure there is no profile → onboarding
 *  - `null`           → we do not know (timeout, 500, network). NOT the same
 *                       as "no account", and the caller must not treat it as
 *                       one: doing so is what signed people out of their own
 *                       account whenever the gateway hiccuped.
 */
export async function syncUser(token: string | null) {
	if (!token) return null;
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), SYNC_TIMEOUT_MS);
	try {
		const res = await fetch(`${BACKEND_URL}/api/users/sync`, {
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${token}`,
			},
			signal: controller.signal,
		});

		if (!res.ok) {
			// 404 is an answer; everything else is a failure to get one.
			if (res.status === 404) return { status: "not_found" };
			console.error(`Sync user failed: ${res.status} ${res.statusText}`);
			return null;
		}

		return await res.json();
	} catch (error) {
		console.error(
			"Sync user error:",
			(error as Error)?.name === "AbortError"
				? `timed out after ${SYNC_TIMEOUT_MS}ms`
				: error,
		);
		return null;
	} finally {
		clearTimeout(timer);
	}
}
