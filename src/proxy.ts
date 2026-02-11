import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { REFRESH_TOKEN } from "./const";
import { getAccessToken } from "./lib/auth.actions";

export async function proxy(request: NextRequest) {
	const accessToken = await getAccessToken();
	const refreshToken =
		request.cookies.get("refreshToken")?.value || REFRESH_TOKEN;
	const loginUrl =
		"https://www.worldstreetgold.com/login?redirect=http://localhost:3000";

	// 1. If no access token, go to login
	if (!accessToken) {
		return NextResponse.redirect(loginUrl);
	}

	try {
		console.log("ACT: ", accessToken);
		// 2. Try to verify the token
		const verifyRes = await fetch(
			`https://api.worldstreetgold.com/api/auth/verify`,
			{
				headers: { Authorization: `Bearer ${accessToken}` },
			},
		);

		if (verifyRes.status === 401 && refreshToken) {
			// 3. Token expired, try to refresh
			const refreshRes = await fetch(
				"https://api.worldstreetgold.com/api/auth/refresh-token",
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ refreshToken }),
				},
			);

			const refreshData = await refreshRes.json();

			if (refreshData.success && refreshData.data?.tokens) {
				const newTokens = refreshData.data.tokens;
				const response = NextResponse.next();

				// 4. SET THE COOKIES (Allowed here!)
				response.cookies.set("accessToken", newTokens.accessToken, {
					httpOnly: true,
					secure: true,
				});
				response.cookies.set("refreshToken", newTokens.refreshToken, {
					httpOnly: true,
					secure: true,
				});

				console.log("DONE HERE");

				return response;
			} else {
				console.log("REFRESH: ", refreshData);
				// return NextResponse.redirect(loginUrl);
			}
		} else {
			console.log("HIT THE ELSE");
			const data = await verifyRes.json();
			const response = NextResponse.next();
			if (data.success) {
				console.log("DATA: ", data);
				response.headers.set("x-user-data", JSON.stringify(data.data.user));
				return response;
			}
			return;
		}
	} catch (error) {
		console.log("ERROR: ", error);
		// return NextResponse.redirect(loginUrl);
	}

	// return NextResponse.next();
}

// Limit middleware to specific paths so it doesn't run on images/assets
export const config = {
	matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
