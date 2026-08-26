"use client";

import { ArrowUpRight, CheckCircle, PlugsConnected } from "@phosphor-icons/react";
import { useT } from "@/i18n/client";
import { XSTREAM_WEB_URL } from "@/const";

/** Connected apps: the ecosystem this account actually touches. Xstream and
 *  the identity hub are live integrations (shared Clerk instance, role
 *  mirroring, HMAC relay); the rest are one sign-in away. */
export default function StudioApps() {
	const t = useT();

	const CONNECTED = [
		{
			name: "Xstream",
			description: t("studio.apps.xstream"),
			href: XSTREAM_WEB_URL,
		},
		{
			name: "WorldStreet ID",
			description: t("studio.apps.id"),
			href: "https://dashboard.worldstreetgold.com",
		},
	];
	const AVAILABLE = [
		{ name: "Dashboard", href: "https://dashboard.worldstreetgold.com" },
		{ name: "Academy", href: "https://academy.worldstreetgold.com" },
		{ name: "Shop", href: "https://shop.worldstreetgold.com" },
		{ name: "Wallet", href: "https://wallet.worldstreetgold.com" },
		{ name: "Arcade", href: "https://arcade.worldstreetgold.com" },
	];

	return (
		<div>
			<p className="font-sans text-[13px] text-muted mb-3 max-w-[68ch]">
				{t("studio.apps.caption")}
			</p>

			<h2 className="font-sans text-[11px] font-semibold uppercase tracking-[0.12em] text-subtle mb-2 px-1">
				{t("studio.apps.connected")}
			</h2>
			<div className="flex flex-col gap-2.5 mb-6">
				{CONNECTED.map((app) => (
					<a
						key={app.name}
						href={app.href}
						target="_blank"
						rel="noopener noreferrer"
						className="rounded-xl border border-hairline bg-surface/60 px-4 py-3 flex items-center gap-3 hover:bg-raised/40 transition-colors group"
					>
						<span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-pill bg-success/10 text-success">
							<PlugsConnected size={19} />
						</span>
						<span className="flex-1 min-w-0">
							<span className="flex items-center gap-1.5 font-sans text-[14.5px] font-semibold text-primary">
								{app.name}
								<CheckCircle size={14} weight="fill" className="text-success" />
							</span>
							<span className="block font-sans text-[12.5px] text-subtle truncate">
								{app.description}
							</span>
						</span>
						<ArrowUpRight
							size={15}
							className="text-subtle opacity-0 group-hover:opacity-100 transition-opacity"
						/>
					</a>
				))}
			</div>

			<h2 className="font-sans text-[11px] font-semibold uppercase tracking-[0.12em] text-subtle mb-2 px-1">
				{t("studio.apps.available")}
			</h2>
			<div className="grid sm:grid-cols-2 gap-2.5">
				{AVAILABLE.map((app) => (
					<a
						key={app.name}
						href={app.href}
						target="_blank"
						rel="noopener noreferrer"
						className="rounded-xl border border-hairline bg-surface/60 px-4 py-3 flex items-center gap-3 hover:bg-raised/40 transition-colors group"
					>
						<span className="flex-1 font-sans text-[14px] font-medium text-primary">
							{app.name}
						</span>
						<ArrowUpRight
							size={14}
							className="text-subtle opacity-0 group-hover:opacity-100 transition-opacity"
						/>
					</a>
				))}
			</div>
		</div>
	);
}
