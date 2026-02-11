import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { REFRESH_TOKEN } from "./const";
import { getAccessToken, getRefreshToken } from "./lib/auth.actions";

export async function proxy(request: NextRequest) {
	const { pathname, href } = request.nextUrl;

	// Create a dynamic login URL that remembers where the user wanted to go
	const loginUrl = new URL("https://www.worldstreetgold.com/login");
	loginUrl.searchParams.set("redirect", encodeURIComponent(href));

	// 1. Get tokens from cookies
	const accessToken = await getAccessToken();
	const refreshToken = await getRefreshToken();

	// 2. If no access token, check if we can refresh immediately, otherwise login
	if (!accessToken && !refreshToken) {
		return NextResponse.redirect(loginUrl);
	}

	try {
		// 3. Verify the token with Central Auth
		const verifyRes = await fetch(
			"https://api.worldstreetgold.com/api/auth/verify",
			{
				headers: { Authorization: `Bearer ${accessToken}` },
			},
		);

		// 4. Handle Expired Token
		if (verifyRes.status === 401 && refreshToken) {
			const refreshRes = await fetch(
				"https://api.worldstreetgold.com/api/auth/refresh-token",
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ refreshToken }),
				},
			);

			const refreshData = await refreshRes.json();

			if (refreshData.success) {
				const response = NextResponse.next();
				// Ensure cookies are set for the ENTIRE domain
				const cookieOptions = {
					httpOnly: true,
					secure: true,
					domain: ".worldstreetgold.com",
					path: "/",
				};

				response.cookies.set(
					"accessToken",
					refreshData.data.tokens.accessToken,
					cookieOptions,
				);
				response.cookies.set(
					"refreshToken",
					refreshData.data.tokens.refreshToken,
					cookieOptions,
				);
				return response;
			}
		}

		console.log("VRRRR: ", verifyRes);

		// 5. Handle Valid Token
		if (verifyRes.ok) {
			const data = await verifyRes.json();
			if (data.success) {
				const response = NextResponse.next();
				// Pass user data to the app via headers
				console.log("USER DATA: ", data.data);
				response.headers.set("x-user-data", JSON.stringify(data.data.user));
				return response;
			}
		}

		return NextResponse.redirect(loginUrl);
	} catch (error) {
		return NextResponse.redirect(loginUrl);
	}
}

export const config = {
	matcher: [
		"/((?!api|_next/static|_next/image|favicon.ico|login|onboarding).*)",
	],
};
