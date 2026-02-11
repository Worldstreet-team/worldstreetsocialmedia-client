"use client";

import { useEffect } from "react";
import { useSetAtom } from "jotai";
import { userAtom, type User } from "@/store/user.atom";

export const UserHydrator = ({ user }: { user: User | null }) => {
	const setUser = useSetAtom(userAtom);

	useEffect(() => {
		console.log("USER: ", user);
		if (user) {
			console.log("Hydrating user atom:", user);
			setUser(user);
		}
	}, [user, setUser]);

	return null;
};
