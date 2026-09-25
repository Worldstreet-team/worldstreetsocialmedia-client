"use client";

import { useEffect } from "react";
import { useHydrateAtoms } from "jotai/utils";
import { userAtom } from "@/store/user.atom";
import { captureAcquisition } from "@/lib/acquisition";
import { setCacheScope } from "@/lib/cache";

export default function JotaiHydrator({
	user,
	children,
}: {
	user: any;
	children: React.ReactNode;
}) {
	useHydrateAtoms([[userAtom, user]]);
	// During render, like useHydrateAtoms above: pages mount and read the
	// shared cache in their own effects, which run BEFORE this component's,
	// so an effect here would warm the cache one beat too late for the
	// first page. Idempotent, and it changes nothing that renders.
	if (typeof window !== "undefined") setCacheScope(user?._id ?? user?.id ?? null);
	// Stash any UTM parameters and the referrer on first landing — they are
	// gone from the URL by the time anyone reaches onboarding, and how
	// somebody arrived cannot be reconstructed later. First touch wins.
	useEffect(() => {
		captureAcquisition();
	}, []);
	// The shared read cache warms from this account's saved copy the moment
	// the profile is known, so a reload paints explore, profiles and the
	// notifications page from what the reader last saw and revalidates.
	useEffect(() => {
		setCacheScope(user?._id ?? user?.id ?? null);
	}, [user?._id, user?.id]);
	return children;
}
