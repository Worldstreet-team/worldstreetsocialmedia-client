import { headers } from "next/headers";
import Onboarding from "./Onboarding";
import { getAccessToken, getRefreshToken } from "@/lib/auth.actions";

export default async function OnboardingPage() {
	const accessToken = await getAccessToken();
	const refreshToken = await getRefreshToken();

	const headerList = await headers();
	const userDataRaw = headerList.get("x-user-data");
	const userData = userDataRaw ? JSON.parse(userDataRaw) : null;

	return (
		<Onboarding
			accessToken={accessToken}
			refreshToken={refreshToken}
			userData={userData}
		/>
	);
}
