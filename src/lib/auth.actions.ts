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

		console.log("RES ISH SYNC: ", res);

		if (!res.ok) {
			console.error(`Sync user failed: ${res.status} ${res.statusText}`);
			const text = await res.text();
			console.error("Error body:", text);

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
