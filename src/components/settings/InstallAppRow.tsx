"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MonitorDown, Share, SquarePlus } from "lucide-react";
import { collapse } from "@/lib/motion-presets";
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
			{/* An Inspector row whose whole width is the button. */}
			<button
				type="button"
				onClick={() => {
					if (canPrompt) void promptInstall();
					else setShowIOSSteps((v) => !v);
				}}
				className="grid min-h-[52px] w-full cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 py-1.5 text-left lg:grid-cols-[minmax(0,220px)_minmax(0,1fr)_auto] lg:gap-x-6"
			>
				<span className="font-sans text-[calc(13.5px*var(--ws-fs))] font-medium text-primary">
					Install the app
				</span>
				<span className="col-start-1 row-start-2 font-sans text-[calc(12.5px*var(--ws-fs))] leading-snug text-muted lg:col-start-2 lg:row-start-1">
					WorldSpace on your home screen, with its own icon and badge
				</span>
				<span className="col-start-2 row-span-2 row-start-1 flex h-10 items-center gap-2 rounded-[7px] border border-hairline px-3.5 font-sans text-[calc(13px*var(--ws-fs))] font-medium text-primary lg:col-start-3 lg:row-span-1">
					<MonitorDown className="h-4 w-4 text-muted" />
					Install
				</span>
			</button>

			{/* animate-rise is switched off once the app intro has played, so
			    this panel used to snap both ways. The wrapper carries the height;
			    the margins live inside it so they fold away too. */}
			<AnimatePresence initial={false}>
			{showIOSSteps && (
				<motion.div key="ios-steps" {...collapse} className="overflow-hidden">
				<div className="mb-3 flex flex-col gap-2 border-l-2 border-hairline py-1 pl-4">
					<span className="flex items-center gap-2 font-sans text-[calc(13.5px*var(--ws-fs))] text-primary">
						<Share className="h-4 w-4 shrink-0 text-muted" />
						1. Tap the Share button in Safari
					</span>
					<span className="flex items-center gap-2 font-sans text-[calc(13.5px*var(--ws-fs))] text-primary">
						<SquarePlus className="h-4 w-4 shrink-0 text-muted" />
						2. Choose "Add to Home Screen"
					</span>
				</div>
				</motion.div>
			)}
			</AnimatePresence>
		</div>
	);
}
