"use server";

import { BACKEND_URL } from "@/const";
import { auth } from "@clerk/nextjs/server";
import axios from "axios";

export interface WalletBalances {
	USD: { availableMinor: number; lockedMinor: number };
	NGN: { availableMinor: number; lockedMinor: number };
}

export async function getWalletBalanceAction() {
	const { getToken } = await auth();
	const token = await getToken();
	if (!token) return { success: false as const, available: false };
	try {
		const res = await axios.get(`${BACKEND_URL}/api/wallet/balance`, {
			headers: { Authorization: `Bearer ${token}` },
		});
		return {
			success: true as const,
			available: Boolean(res.data?.available),
			balances: (res.data?.balances ?? null) as WalletBalances | null,
		};
	} catch {
		// The rail must render whether or not the wallet answers.
		return { success: false as const, available: false, balances: null };
	}
}
