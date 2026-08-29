"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAtom } from "jotai";
import { Check, LoaderCircle, X } from "lucide-react";
import { useToast } from "@/components/ui/Toast/ToastContext";
import { changeUsernameAction, checkUsernameAction } from "@/lib/user.actions";
import { USERNAME_RE } from "@/lib/username";
import { userAtom } from "@/store/user.atom";
import { cacheKeys, invalidate, invalidatePrefix } from "@/lib/cache";

type HandleState = "idle" | "checking" | "ok" | "taken" | "invalid";

/**
 * Change your handle.
 *
 * A username was set once at onboarding and then frozen: no route, no field,
 * no way back. That is how accounts ended up permanently sharing a name with
 * someone else in a different case.
 *
 * The live hint here is only a hint. The gateway re-checks format, the
 * cooldown and case-insensitive uniqueness on submit and its message is what
 * gets shown, because a check that passed 400ms ago is not a promise.
 */
export function UsernameSetting() {
	const { toast } = useToast();
	const [user, setUser] = useAtom(userAtom);
	const current = user?.username ?? "";

	const [value, setValue] = useState(current);
	const [state, setState] = useState<HandleState>("idle");
	const [saving, setSaving] = useState(false);
	// Only the LAST check may write state. Without this a slow reply for an
	// earlier keystroke lands after a fast one and labels the wrong handle.
	const seq = useRef(0);

	// Re-seed when the profile arrives, but never while the field is being
	// edited: hydration would otherwise wipe what is half typed.
	useEffect(() => {
		setValue((v) => (v === "" || v === current ? current : v));
	}, [current]);

	const trimmed = value.replace(/^@+/, "").trim();
	const unchanged = trimmed === current;

	useEffect(() => {
		if (unchanged) {
			setState("idle");
			return;
		}
		if (!USERNAME_RE.test(trimmed)) {
			setState("invalid");
			return;
		}
		setState("checking");
		const mine = ++seq.current;
		const timer = setTimeout(async () => {
			const res = await checkUsernameAction(trimmed);
			if (mine !== seq.current) return;
			setState(
				res.reason === "taken"
					? "taken"
					: res.reason === "invalid"
						? "invalid"
						: "ok",
			);
		}, 400);
		return () => clearTimeout(timer);
	}, [trimmed, unchanged]);

	const hint = useMemo(() => {
		if (unchanged) return { text: "This is your handle today", tone: "muted" };
		if (state === "invalid")
			return { text: "3-20 letters, numbers or underscores", tone: "danger" };
		if (state === "checking") return { text: "Checking…", tone: "muted" };
		if (state === "taken") return { text: "That username is taken", tone: "danger" };
		if (state === "ok") return { text: `@${trimmed} is available`, tone: "success" };
		return { text: "", tone: "muted" };
	}, [state, trimmed, unchanged]);

	const canSave = !saving && !unchanged && state === "ok";

	const save = useCallback(async () => {
		if (!canSave) return;
		setSaving(true);
		const res = await changeUsernameAction(trimmed);
		setSaving(false);

		if (!res.success) {
			// Forwarded verbatim: taken, too soon, or the wrong shape are all
			// things the person can act on.
			toast(res.message ?? "Could not change your username", { type: "error" });
			return;
		}

		// Everything keyed by the OLD handle is now pointing at a name this
		// account no longer answers to.
		if (res.previous) invalidate(cacheKeys.profile(res.previous));
		invalidate(cacheKeys.profile(res.username!));
		if (user?.userId) invalidatePrefix(cacheKeys.userPostsAll(user.userId));

		setUser((prev: any) => (prev ? { ...prev, username: res.username } : prev));
		toast(`You are @${res.username} now`, { type: "success" });
	}, [canSave, trimmed, toast, setUser, user?.userId]);

	return (
		<div className="px-4 py-3.5">
			<div className="flex items-center justify-between gap-4">
				<span className="shrink-0 font-sans text-sm font-medium text-primary">
					Username
				</span>
				<button
					type="button"
					onClick={save}
					disabled={!canSave}
					className="h-9 shrink-0 cursor-pointer rounded-pill bg-brand px-4 font-sans text-[13px] font-semibold text-brand-on transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
				>
					{saving ? "Saving…" : "Save"}
				</button>
			</div>

			<div className="mt-2 flex items-center gap-2 rounded-xl bg-sunken px-3.5">
				<span className="font-sans text-[15px] text-subtle">@</span>
				<input
					value={trimmed}
					onChange={(e) => setValue(e.target.value)}
					onKeyDown={(e) => {
						if (e.key === "Enter") save();
					}}
					spellCheck={false}
					autoCapitalize="none"
					autoCorrect="off"
					maxLength={20}
					aria-label="Username"
					className="min-w-0 flex-1 bg-transparent py-3 font-sans text-[15px] text-primary outline-none placeholder:text-subtle"
				/>
				{state === "checking" && (
					<LoaderCircle className="h-4 w-4 shrink-0 animate-spin text-subtle" />
				)}
				{state === "ok" && <Check className="h-4 w-4 shrink-0 text-success" />}
				{(state === "taken" || state === "invalid") && (
					<X className="h-4 w-4 shrink-0 text-danger" />
				)}
			</div>

			{hint.text && (
				<p
					className={`mt-1.5 font-sans text-[12px] ${
						hint.tone === "danger"
							? "text-danger"
							: hint.tone === "success"
								? "text-success"
								: "text-muted"
					}`}
				>
					{hint.text}
				</p>
			)}
			<p className="mt-1 font-sans text-[12px] text-subtle">
				You can change this again 30 days after a change. Your old handle
				becomes free for someone else to take.
			</p>
		</div>
	);
}
