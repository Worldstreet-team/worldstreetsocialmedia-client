"use client";

import { useEffect, useState } from "react";
import { useAtom } from "jotai";
import clsx from "clsx";
import { useToast } from "@/components/ui/Toast/ToastContext";
import { updateMyProfileAction } from "@/lib/user.actions";
import { userAtom } from "@/store/user.atom";
import { useT } from "@/i18n/client";

export type NotificationPrefs = {
	like: boolean;
	repost: boolean;
	reply: boolean;
	follow: boolean;
	mention: boolean;
	live: boolean;
	fromFollowingOnly: boolean;
};

const DEFAULTS: NotificationPrefs = {
	like: true,
	repost: true,
	reply: true,
	follow: true,
	mention: true,
	live: true,
	fromFollowingOnly: false,
};

/** Order shown. Quotes share the repost preference — same act to the reader. */
const TYPES: { key: keyof NotificationPrefs; labelKey: string; captionKey: string }[] = [
	{ key: "like", labelKey: "settings.notify.like", captionKey: "settings.notify.like.desc" },
	{ key: "reply", labelKey: "settings.notify.reply", captionKey: "settings.notify.reply.desc" },
	{ key: "repost", labelKey: "settings.notify.repost", captionKey: "settings.notify.repost.desc" },
	{ key: "mention", labelKey: "settings.notify.mention", captionKey: "settings.notify.mention.desc" },
	{ key: "follow", labelKey: "settings.notify.follow", captionKey: "settings.notify.follow.desc" },
	{ key: "live", labelKey: "settings.notify.live", captionKey: "settings.notify.live.desc" },
];

/**
 * Notification preferences.
 *
 * Six notification types existed and every one was compulsory — the tabs on
 * the notifications page filter an already-fetched array, so they were a view,
 * not a preference. Each toggle here writes through to the gateway
 * immediately: there is no Save button because there is nothing to batch, and
 * a preference that needs confirming is a preference people abandon halfway.
 */
export function NotificationPrefs() {
	const t = useT();
	const { toast } = useToast();
	const [user, setUser] = useAtom(userAtom);
	const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULTS);
	const [busy, setBusy] = useState<string | null>(null);

	useEffect(() => {
		if (user?.notificationPrefs) {
			setPrefs({ ...DEFAULTS, ...user.notificationPrefs });
		}
	}, [user?.notificationPrefs]);

	const toggle = async (key: keyof NotificationPrefs) => {
		const next = { ...prefs, [key]: !prefs[key] };
		// Optimistic: the switch has to move under the finger. Reverted below
		// if the write fails, rather than left showing a lie.
		setPrefs(next);
		setBusy(key);

		const body = new FormData();
		body.append("notificationPrefs", JSON.stringify(next));
		const res = await updateMyProfileAction(body);
		setBusy(null);

		if (!res.success) {
			setPrefs(prefs);
			toast(res.message ?? t("settings.notify.error"), { type: "error" });
			return;
		}
		setUser((prev: any) => ({ ...prev, notificationPrefs: next }));
	};

	return (
		<div className="flex flex-col">
			{TYPES.map(({ key, labelKey, captionKey }) => (
				<Toggle
					key={key}
					label={t(labelKey)}
					caption={t(captionKey)}
					checked={prefs[key]}
					busy={busy === key}
					onChange={() => toggle(key)}
				/>
			))}

			<div className="mt-1 border-t border-hairline pt-1">
				<Toggle
					label={t("settings.notify.followingOnly")}
					caption={t("settings.notify.followingOnly.desc")}
					checked={prefs.fromFollowingOnly}
					busy={busy === "fromFollowingOnly"}
					onChange={() => toggle("fromFollowingOnly")}
				/>
			</div>
		</div>
	);
}

function Toggle({
	label,
	caption,
	checked,
	busy,
	onChange,
}: {
	label: string;
	caption: string;
	checked: boolean;
	busy: boolean;
	onChange: () => void;
}) {
	return (
		<button
			type="button"
			role="switch"
			aria-checked={checked}
			aria-label={label}
			disabled={busy}
			onClick={onChange}
			className="flex cursor-pointer items-center justify-between gap-4 px-4 py-3 text-left transition-colors hover:bg-raised disabled:opacity-60"
		>
			<span className="min-w-0">
				<span className="block font-sans text-sm font-medium text-primary">
					{label}
				</span>
				<span className="mt-0.5 block font-sans text-[13px] leading-relaxed text-muted">
					{caption}
				</span>
			</span>
			{/* Track + knob. No scale on press — the surface ladder does state. */}
			<span
				aria-hidden="true"
				className={clsx(
					"relative h-6 w-10 shrink-0 rounded-pill transition-colors",
					checked ? "bg-brand" : "bg-raised",
				)}
			>
				<span
					className={clsx(
						"absolute top-1 h-4 w-4 rounded-pill transition-[left]",
						checked ? "left-5 bg-brand-on" : "left-1 bg-muted",
					)}
				/>
			</span>
		</button>
	);
}
