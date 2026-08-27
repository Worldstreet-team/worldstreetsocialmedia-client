"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useClerk } from "@clerk/nextjs";
import { useAtomValue } from "jotai";
import { Download, PauseCircle, Trash2 } from "lucide-react";
import ConfirmModalPortal from "@/components/ui/ConfirmModalPortal";
import ConfirmModal from "@/components/ui/ConfirmModal";
import {
	OverlayHeader,
	OverlayPanel,
	OverlayScrim,
	useOverlayDismiss,
} from "@/components/ui/Overlay";
import { useToast } from "@/components/ui/Toast/ToastContext";
import { AnimatePresence } from "framer-motion";
import {
	deactivateAccountAction,
	deleteAccountAction,
	exportMyDataAction,
} from "@/lib/account.actions";
import { userAtom } from "@/store/user.atom";
import { handleSignOut } from "@/lib/utils";
import { useT } from "@/i18n/client";

/**
 * Export, deactivate and delete.
 *
 * Deletion asks for the handle typed out rather than an OK button: it is the
 * one action here that cannot be undone, and a confirmation you can dismiss by
 * reflex is not a confirmation.
 *
 * Both confirms carry `role="alertdialog"`, not `dialog` — deactivate through
 * ConfirmModal's `isDestructive`, delete explicitly below. It is what tells a
 * screen reader this interrupted you for a decision.
 */
export function AccountLifecycle() {
	const t = useT();
	const router = useRouter();
	const { toast } = useToast();
	const { signOut } = useClerk();
	const user = useAtomValue(userAtom);

	const [exporting, setExporting] = useState(false);
	const [deactivateOpen, setDeactivateOpen] = useState(false);
	const [deleteOpen, setDeleteOpen] = useState(false);
	const [confirmText, setConfirmText] = useState("");
	const [deleting, setDeleting] = useState(false);

	const download = async () => {
		setExporting(true);
		const res = await exportMyDataAction();
		setExporting(false);

		if (!res.success || !res.json) {
			toast(res.message ?? t("settings.data.error"), { type: "error" });
			return;
		}

		// Assembled in the browser so the export never needs a public URL.
		const blob = new Blob([res.json], { type: "application/json" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `worldstreet-${user?.username ?? "account"}.json`;
		document.body.appendChild(a);
		a.click();
		a.remove();
		URL.revokeObjectURL(url);
		toast(t("settings.data.ready"));
	};

	const deactivate = async () => {
		const res = await deactivateAccountAction();
		if (!res.success) {
			toast(res.message ?? t("settings.data.error"), { type: "error" });
			return;
		}
		toast(t("settings.deactivate.done"));
		await handleSignOut(signOut);
	};

	const remove = async () => {
		setDeleting(true);
		const res = await deleteAccountAction(confirmText.trim());
		setDeleting(false);

		if (!res.success) {
			toast(res.message ?? t("settings.delete.error"), { type: "error" });
			return;
		}
		toast(t("settings.delete.done"));
		await handleSignOut(signOut);
	};

	const confirmMatches =
		confirmText.trim().toLowerCase() === (user?.username ?? "").toLowerCase();

	// Escape and the body scroll lock, which the hand-rolled panel had neither
	// of — you could scroll settings behind a confirm you could not dismiss.
	const closeDelete = useCallback(() => setDeleteOpen(false), []);
	useOverlayDismiss(deleteOpen, closeDelete);

	return (
		<>
			<Action
				icon={Download}
				title={t("settings.data.title")}
				caption={t("settings.data.caption")}
				label={exporting ? t("settings.data.building") : t("settings.data.cta")}
				onClick={download}
				disabled={exporting}
			/>

			<Action
				icon={PauseCircle}
				title={t("settings.deactivate.title")}
				caption={t("settings.deactivate.caption")}
				label={t("settings.deactivate.cta")}
				onClick={() => setDeactivateOpen(true)}
			/>

			<Action
				icon={Trash2}
				title={t("settings.delete.title")}
				caption={t("settings.delete.caption")}
				label={t("settings.delete.cta")}
				onClick={() => {
					setConfirmText("");
					setDeleteOpen(true);
				}}
				destructive
			/>

			<ConfirmModal
				isOpen={deactivateOpen}
				onClose={() => setDeactivateOpen(false)}
				onConfirm={deactivate}
				title={t("settings.deactivate.title")}
				message={t("settings.deactivate.confirm")}
				confirmText={t("settings.deactivate.cta")}
				isDestructive
			/>

			{/* The one confirm in the app that cannot be a ConfirmModal: it asks
			    you to TYPE the handle. Same grammar regardless — the centred
			    plate, `alertdialog` because it interrupts for a decision. */}
			<ConfirmModalPortal>
				<AnimatePresence>
					{deleteOpen && (
						<OverlayScrim
							key="delete-scrim"
							onClose={closeDelete}
							label={t("common.cancel")}
						/>
					)}
					{deleteOpen && (
						<OverlayPanel
							key="delete-panel"
							variant="center"
							role="alertdialog"
							label={t("settings.delete.title")}
							className="max-w-[420px]"
						>
							<OverlayHeader
								title={t("settings.delete.title")}
								onClose={closeDelete}
								closeLabel={t("common.cancel")}
							/>
							<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-[calc(20px+var(--ws-safe-bottom))]">
								<p className="font-sans text-[13.5px] leading-relaxed text-muted">
									{t("settings.delete.confirm")}
								</p>

								<label
									htmlFor="delete-confirm"
									className="mt-4 block font-sans text-[11px] font-bold uppercase tracking-[0.14em] text-subtle"
								>
									{t("settings.delete.typeLabel").replace(
										"{username}",
										user?.username ?? "",
									)}
								</label>
								<input
									id="delete-confirm"
									value={confirmText}
									onChange={(e) => setConfirmText(e.target.value)}
									autoComplete="off"
									className="mt-1.5 w-full rounded-xl bg-sunken px-3.5 py-3 font-sans text-[15px] text-primary outline-none placeholder:text-subtle"
									placeholder={user?.username ?? ""}
								/>

								<div className="mt-5 flex gap-2">
									<button
										type="button"
										onClick={closeDelete}
										className="h-10 flex-1 cursor-pointer rounded-pill bg-chip font-sans text-[13px] font-semibold text-primary transition-colors hover:bg-raised"
									>
										{t("common.cancel")}
									</button>
									<button
										type="button"
										onClick={remove}
										disabled={!confirmMatches || deleting}
										className="h-10 flex-1 cursor-pointer rounded-pill bg-danger font-sans text-[13px] font-semibold text-page transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
									>
										{deleting
											? t("settings.delete.deleting")
											: t("settings.delete.cta")}
									</button>
								</div>
							</div>
						</OverlayPanel>
					)}
				</AnimatePresence>
			</ConfirmModalPortal>
		</>
	);
}

function Action({
	icon: Icon,
	title,
	caption,
	label,
	onClick,
	disabled,
	destructive,
}: {
	icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
	title: string;
	caption: string;
	label: string;
	onClick: () => void;
	disabled?: boolean;
	destructive?: boolean;
}) {
	return (
		<div className="flex items-center justify-between gap-4 px-4 py-3.5">
			<div className="flex min-w-0 items-start gap-3">
				<Icon
					className={`mt-0.5 h-[17px] w-[17px] shrink-0 ${
						destructive ? "text-danger" : "text-muted"
					}`}
					strokeWidth={2}
				/>
				<div className="min-w-0">
					<span
						className={`block font-sans text-sm font-medium ${
							destructive ? "text-danger" : "text-primary"
						}`}
					>
						{title}
					</span>
					<span className="mt-0.5 block font-sans text-[13px] leading-relaxed text-muted">
						{caption}
					</span>
				</div>
			</div>
			<button
				type="button"
				onClick={onClick}
				disabled={disabled}
				className={`h-9 shrink-0 cursor-pointer rounded-pill px-4 font-sans text-[13px] font-semibold transition-opacity hover:opacity-90 disabled:opacity-50 ${
					destructive
						? "bg-danger/12 text-danger"
						: "bg-raised text-primary"
				}`}
			>
				{label}
			</button>
		</div>
	);
}
