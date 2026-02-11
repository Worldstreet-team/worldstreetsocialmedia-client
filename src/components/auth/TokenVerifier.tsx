"use client";

import { useEffect, useState } from "react";
import { useSetAtom } from "jotai";
import { userAtom, User } from "@/store/user.atom";
import { GlobalLoader } from "@/components/ui/GlobalLoader";
import { syncUser } from "@/lib/auth.actions";
import { usePathname, useRouter } from "next/navigation";

interface TokenVerifierProps {
	initialUser?: User | null;
}

const loginUrl =
	"https://www.worldstreetgold.com/login?redirect=https://social.worldstreetgold.com";

export const TokenVerifier = ({ initialUser }: TokenVerifierProps) => {
	const setUser = useSetAtom(userAtom);
	const pathname = usePathname();
	const router = useRouter();
	const [loading, setLoading] = useState(!initialUser);

	useEffect(() => {
		if (pathname.includes("/onboarding")) {
			setLoading(false);
			return;
		}

		if (initialUser && initialUser.username) {
			console.log("TokenVerifier: Hydrating from initialUser", initialUser);
			setUser(initialUser);
			setLoading(false);
			return;
		} else if (initialUser) {
			console.log(
				"TokenVerifier: initialUser incomplete (missing username), forcing sync...",
				initialUser,
			);
		}

		const verify = async () => {
			console.log("TokenVerifier: Syncing user...");
			setLoading(true);
			try {
				const data = await syncUser();

				console.log("DATADDDDD: ", data);

				if (data?.status === "not_found") {
					console.log("TokenVerifier: User not found, redirecting...");
					router.push("/onboarding");
					return;
				}

				if (data) {
					console.log("TokenVerifier: User synced", data);
					setUser(data.profile);
				} else {
					// router.push(loginUrl);
					console.log("TokenVerifier: No user data returned");
				}
			} catch (err) {
				console.error("TokenVerifier Error:", err);
			} finally {
				setLoading(false);
			}
		};

		verify();
	}, [pathname, router, setUser]);

	if (loading && !pathname.includes("/onboarding")) {
		return <GlobalLoader />;
	}

	return null;
};
