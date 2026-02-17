import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { syncUser } from "./lib/auth.actions";

const isProtectedRoute = createRouteMatcher(["/(.*)"]);
const isOnboardingRoute = createRouteMatcher(["/onboarding(.*)"]);

export default clerkMiddleware(async (auth, req) => {
	const { userId, getToken, isAuthenticated } = await auth();

	if (isProtectedRoute(req)) {
		await auth.protect();
	}
	console.log("USERIDDDD: ", userId);

	const hasProfile = req.cookies.get("has_profile")?.value === "true";
	console.log("HAS PROFILE: ", hasProfile);

	if (isOnboardingRoute(req) && !hasProfile) return;

	// 1. If user is logged in and trying to access a protected area
	if (userId && isProtectedRoute(req)) {
		// Check your custom cookie

		const token = await getToken();
		console.log("TOKEN: ", token);
		const userExistsInDb = await syncUser(token);

		console.log("EXISTS IN DB: ", userExistsInDb);

		// if (userExistsInDb == null) {
		// 	console.log("FAILED HERE");
		// 	return;
		// }

		if (userExistsInDb?.status === "not_found") {
			// Redirect to onboarding if they don't exist in your DB
			return NextResponse.redirect(new URL("/onboarding", req.url));
		}

		// 3. If they exist but cookie was missing, set the cookie and continue
		const response = NextResponse.next();
		response.cookies.set("has_profile", "true", {
			path: "/",
			httpOnly: false,
		});
		if (userExistsInDb?.profile) {
			console.log("GETTING SAVED EXISTS IN DB: ", userExistsInDb.profile);
			const requestHeaders = new Headers(req.headers);
			requestHeaders.set("x-user-data", JSON.stringify(userExistsInDb.profile));

			return NextResponse.next({
				request: {
					headers: requestHeaders,
				},
			});
		}
		return response;
	}

	// 4. Prevent users who ALREADY have a profile from going back to onboarding
	if (userId && isOnboardingRoute(req)) {
		const hasProfile = req.cookies.get("has_profile")?.value === "true";
		if (hasProfile) {
			return NextResponse.redirect(new URL("/", req.url));
		}
	}
});

export const config = {
	matcher: [
		// Skip Next.js internals and all static files, unless found in search params
		"/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
		// Always run for API routes
		"/(api|trpc)(.*)",
	],
};
