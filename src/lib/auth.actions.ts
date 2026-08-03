import { BACKEND_URL } from "@/const";

export async function syncUser(token: string | null) {
	if (!token) return null;
	try {
		const res = await fetch(`${BACKEND_URL}/api/users/sync`, {
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${token}`,
			},
		});

		// No request-level logging here: proxy.ts calls syncUser on EVERY
		// matched request, so anything logged in this path runs per-request in
		// production (and the auth'd Response/body can carry user data).
		if (!res.ok) {
			if (res.status === 404) return { status: "not_found" };
			return null;
		}

		const data = await res.json();
		return data; // Expected to be the user object directly or { data: user } depending on API
	} catch (error) {
		console.error("Sync user error:", error);
		return null;
	}
}
