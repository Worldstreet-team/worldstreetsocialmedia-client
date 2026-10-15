"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Plus } from "@phosphor-icons/react";
import { getWalletBalanceAction, type WalletBalances } from "@/lib/wallet.actions";
import { useT } from "@/i18n/client";
import { reveal } from "@/lib/motion-presets";

/** Always two decimals: a balance that renders "$8" reads as an estimate. */
const money = (minor: number) =>
	new Intl.NumberFormat(undefined, {
		style: "currency",
		currency: "USD",
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	}).format(minor / 100);

/**
 * The wallet on the right rail, as one plain line (Concept A, 2026-10-15:
 * no cards for the everyday bits): the label, the balance, and Top up. It
 * renders nothing when the wallet is unreachable, because a wrong balance
 * is worse than none. USD only (owner ruling 2026-08-28): a naira line
 * under it read as a second wallet.
 */
export function SidebarWallet() {
	const t = useT();
	const [balances, setBalances] = useState<WalletBalances | null>(null);
	const [ready, setReady] = useState(false);

	useEffect(() => {
		let cancelled = false;
		void getWalletBalanceAction().then((res) => {
			if (cancelled) return;
			if (res.available && res.balances) setBalances(res.balances);
			setReady(true);
		});
		return () => {
			cancelled = true;
		};
	}, []);

	if (!ready || !balances) return null;

	return (
		<motion.div {...reveal()} className="flex items-end justify-between gap-3 px-3">
			<a
				href="https://worldstreetgold.com/welcome"
				target="_blank"
				rel="noopener noreferrer"
				className="flex min-w-0 flex-col gap-0.5 no-underline!"
			>
				<span className="font-sans text-[calc(13px*var(--ws-fs))] font-semibold text-primary">
					{t("wallet.title")}
				</span>
				<span className="font-display text-[calc(24px*var(--ws-fs))] font-medium leading-tight tracking-[-0.01em] tabular-nums text-primary">
					{money(balances.USD.availableMinor)}
				</span>
			</a>
			<a
				href="https://worldstreetgold.com/welcome"
				target="_blank"
				rel="noopener noreferrer"
				className="mb-0.5 inline-flex no-underline! h-[34px] shrink-0 items-center gap-1.5 rounded-pill bg-primary/10 px-3.5 font-sans text-[calc(12.5px*var(--ws-fs))] font-semibold text-primary transition-colors hover:bg-primary/15"
			>
				<Plus size={14} weight="bold" />
				{t("wallet.topUp")}
			</a>
		</motion.div>
	);
}
