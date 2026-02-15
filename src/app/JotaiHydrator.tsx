"use client";

import { useHydrateAtoms } from "jotai/utils";
import { userAtom } from "@/store/user.atom";

export default function JotaiHydrator({
	user,
	children,
}: {
	user: any;
	children: React.ReactNode;
}) {
	useHydrateAtoms([[userAtom, user]]);
	return children;
}
