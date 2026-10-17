"use client";

import { Check, CircleNotch, CloudCheck, CloudSlash } from "@phosphor-icons/react";
import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { usePreferences } from "@/components/providers/PreferencesProvider";
import { swap } from "@/lib/motion-presets";

/**
 * The save receipt in the settings header (owner 2026-10-07, replacing the
 * permanent green "Synced to your account" pill, which said synced before
 * anything had happened and never showed a save in flight or a failed one).
 *
 * Quiet at rest. A change reads Saving…, then Saved in green for two
 * seconds, then settles back. A failed save turns amber with Retry, and
 * the change is kept and sent again. Settings that never leave this device
 * say so on their own row (`tag="device"`), so this never over-promises.
 *
 * It reports the preferences layer. Notification types and topics save
 * through the profile and report their own failures with a toast.
 */
export function SaveStatus({ className }: { className?: string }) {
	const { saveState, retrySave } = usePreferences();
	const look = {
		idle: { Glyph: CloudCheck, label: "All changes saved", tone: "text-subtle" },
		saving: { Glyph: CircleNotch, label: "Saving…", tone: "bg-primary/5 text-muted" },
		saved: { Glyph: Check, label: "Saved", tone: "bg-success/10 text-success" },
		error: { Glyph: CloudSlash, label: "Couldn't save", tone: "bg-warning/10 text-warning" },
	}[saveState];
	const { Glyph } = look;

	return (
		<span role="status" aria-live="polite" className={clsx("inline-flex shrink-0", className)}>
			<AnimatePresence mode="wait" initial={false}>
				<motion.span
					key={saveState}
					{...swap}
					className={clsx(
						"flex h-[30px] items-center gap-1.5 rounded-pill px-3 font-sans text-[calc(12.5px*var(--ws-fs))] font-medium",
						look.tone,
					)}
				>
					<Glyph
						size={15}
						weight={saveState === "saved" ? "bold" : "regular"}
						aria-hidden
						className={clsx(saveState === "saving" && "motion-safe:animate-spin")}
					/>
					{look.label}
					{saveState === "error" && (
						<>
							<span aria-hidden className="h-[3px] w-[3px] rounded-pill bg-current opacity-50" />
							<button
								type="button"
								onClick={retrySave}
								className="cursor-pointer font-semibold underline underline-offset-2"
							>
								Retry
							</button>
						</>
					)}
				</motion.span>
			</AnimatePresence>
		</span>
	);
}
