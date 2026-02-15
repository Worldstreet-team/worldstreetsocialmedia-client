// app/onboarding/action.ts (Server Action)
"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function completeOnboarding(formData: FormData) {
	// 1. Save to your DB using Clerk's userId
	// await db.user.create({ ...data });

	// 2. Set the cookie so the middleware lets them in next time
	(await cookies()).set("has_profile", "true");

	// 3. Send them to the app
	redirect("/dashboard");
}
