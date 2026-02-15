import { currentUser } from "@clerk/nextjs/server";
import Onboarding from "./Onboarding";

export default async function OnboardingPage() {
	const user = await currentUser();

	return (
		<Onboarding
			initialUser={{
				id: user?.id,
				firstName: user?.firstName,
				lastName: user?.lastName,
				email: user?.emailAddresses[0].emailAddress,
				avatar: user?.imageUrl,
			}}
		/>
	);
}
