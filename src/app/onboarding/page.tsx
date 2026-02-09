import { cookies, headers } from "next/headers";
import Onboarding from "./Onboarding";

export default async function OnboardingPage() {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get("accessToken")?.value;
    const refreshToken = cookieStore.get("refreshToken")?.value;

    const headerList = await headers();
    const userDataRaw = headerList.get('x-user-data');
    const userData = userDataRaw ? JSON.parse(userDataRaw) : null;

    return (
        <Onboarding accessToken={accessToken} refreshToken={refreshToken} userData={userData} />
    )
}
