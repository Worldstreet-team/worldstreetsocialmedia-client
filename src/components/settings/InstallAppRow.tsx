"use client";

import { useState } from "react";
import { MonitorDown, Share, SquarePlus } from "lucide-react";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";

/**
 * "Install the app" — the one place the PWA offers itself.
 *
 * Three states: already installed (render nothing), a real deferred prompt in
 * hand (Chrome family: fire it), or iOS (no prompt API exists, so the row
 * expands into the two Share-sheet steps instead of pretending).
 */
export function InstallAppRow() {
	const { canPrompt, isIOS, isStandalone, promptInstall } = useInstallPrompt();
	const [showIOSSteps, setShowIOSSteps] = useState(false);

	if (isStandalone || (!canPrompt && !isIOS)) return null;

	return (
		<div className="flex flex-col border-b border-hairline">
			<button
				type="button"
				onClick={() => {
					if (canPrompt) void promptInstall();
					else setShowIOSSteps((v) => !v);
				}}
				className="flex w-full cursor-pointer items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-raised"
			>
				<span className="flex items-center gap-3">
					<MonitorDown className="h-[18px] w-[18px] text-gold" />
					<span className="flex flex-col">
						<span className="font-sans text-[14.5px] font-medium text-primary">
							Install the app
						</span>
						<span className="font-sans text-[12.5px] text-muted">
							WorldSpace on your home screen, with its own icon and badge
						</span>
					</span>
				</span>
			</button>

			{showIOSSteps && (
				<div className="animate-rise mx-4 mb-3 flex flex-col gap-2 rounded-[10px] bg-raised px-4 py-3">
					<span className="flex items-center gap-2 font-sans text-[13.5px] text-primary">
						<Share className="h-4 w-4 shrink-0 text-muted" />
						1. Tap the Share button in Safari
					</span>
					<span className="flex items-center gap-2 font-sans text-[13.5px] text-primary">
						<SquarePlus className="h-4 w-4 shrink-0 text-muted" />
						2. Choose "Add to Home Screen"
					</span>
				</div>
			)}
		</div>
	);
}
