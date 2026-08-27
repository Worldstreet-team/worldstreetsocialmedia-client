"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, Vault } from "@phosphor-icons/react";
import { getWalletBalanceAction, type WalletBalances } from "@/lib/wallet.actions";
import { useT } from "@/i18n/client";

/** Always two decimals: a balance that renders "$8" reads as an estimate. */
const money = (minor: number, currency: "USD" | "NGN") =>
	new Intl.NumberFormat(undefined, {
		style: "currency",
		currency,
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	}).format(minor / 100);

/**
 * The wallet strip on the right rail.
 *
 * Same treatment as the promo cards: its own artwork under a baked blur ramp,
 * no border, depth from the image rather than a hairline. It renders nothing
 * when the wallet is unreachable, because a wrong balance is worse than none.
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
		<a
			href="https://worldstreetgold.com/welcome"
			target="_blank"
			rel="noopener noreferrer"
			className="group relative block overflow-hidden rounded-xl transition-opacity hover:opacity-95"
		>
			<img
				src="/images/promo/wallet-dark.webp"
				alt=""
				aria-hidden="true"
				className="wallet-amb wallet-amb-dark"
			/>
			<img
				src="/images/promo/wallet-light.webp"
				alt=""
				aria-hidden="true"
				className="wallet-amb wallet-amb-light"
			/>

			<span className="relative block px-4 py-3.5">
				<span className="flex items-center gap-1.5">
					<Vault size={15} weight="duotone" className="text-gold" />
					<span className="flex-1 font-sans text-[10.5px] font-bold uppercase tracking-[0.14em] text-primary/60">
						{t("wallet.title")}
					</span>
					<ArrowUpRight
						size={12}
						weight="bold"
						className="text-primary/50 transition-colors group-hover:text-primary"
					/>
				</span>

				<span className="mt-2 block font-display text-[24px] font-semibold leading-none tabular-nums text-primary">
					{money(balances.USD.availableMinor, "USD")}
				</span>

				{balances.NGN.availableMinor > 0 && (
					<span className="mt-1.5 block font-sans text-[12px] tabular-nums text-primary/60">
						{money(balances.NGN.availableMinor, "NGN")}
					</span>
				)}
			</span>
		</a>
	);
}
