"use client";

import { useEffect } from "react";
import { useHydrateAtoms } from "jotai/utils";
import { userAtom } from "@/store/user.atom";
import { captureAcquisition } from "@/lib/acquisition";

export default function JotaiHydrator({
	user,
	children,
}: {
	user: any;
	children: React.ReactNode;
}) {
	useHydrateAtoms([[userAtom, user]]);
	// Stash any UTM parameters and the referrer on first landing — they are
	// gone from the URL by the time anyone reaches onboarding, and how
	// somebody arrived cannot be reconstructed later. First touch wins.
	useEffect(() => {
		captureAcquisition();
	}, []);
	return children;
}
