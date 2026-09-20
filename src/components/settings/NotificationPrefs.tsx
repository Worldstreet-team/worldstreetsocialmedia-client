"use client";

import { useEffect, useState } from "react";
import { useAtom } from "jotai";
import clsx from "clsx";
import { motion } from "framer-motion";
import { snappySpring } from "@/lib/motion-presets";
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

			<div>
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
			// The Inspector row (settings/inspector.tsx), as one switch button:
			// name, what it does, the control at the right edge.
			className="grid min-h-[52px] cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 border-b border-hairline py-1.5 text-left disabled:opacity-60 lg:grid-cols-[minmax(0,220px)_minmax(0,1fr)_auto] lg:gap-x-6"
		>
			<span className="font-sans text-[calc(13.5px*var(--ws-fs))] font-medium text-primary">
				{label}
			</span>
			<span className="col-start-1 row-start-2 font-sans text-[calc(12.5px*var(--ws-fs))] leading-snug text-muted lg:col-start-2 lg:row-start-1">
				{caption}
			</span>
			{/* Track + knob. No scale on press — the surface ladder does state. */}
			<span
				aria-hidden="true"
				className={clsx(
					"relative col-start-2 row-span-2 row-start-1 h-6 w-10 shrink-0 rounded-pill transition-colors lg:col-start-3 lg:row-span-1",
					checked ? "bg-brand" : "bg-chip",
				)}
			>
				{/* Rides x, not left, so the slide never touches layout; the
				    same spring as ui/Switch, which turns round mid-flight when
				    a failed write reverts it. The whole row is the switch
				    button here, so ui/Switch (a button) cannot nest inside.
				    initial={false}: a pref that loads on is on. */}
				<motion.span
					initial={false}
					animate={{ x: checked ? 16 : 0 }}
					transition={snappySpring}
					className={clsx(
						"absolute left-1 top-1 h-4 w-4 rounded-pill transition-colors",
						checked ? "bg-brand-on" : "bg-muted",
					)}
				/>
			</span>
		</button>
	);
}
