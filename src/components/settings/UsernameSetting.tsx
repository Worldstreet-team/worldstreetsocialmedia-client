"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAtom } from "jotai";
import { AnimatePresence, motion } from "framer-motion";
import { Check, LoaderCircle, X } from "lucide-react";
import { pop, swap } from "@/lib/motion-presets";
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
		// The Inspector row, with a field where a dropdown would sit: name,
		// the handle and its verdict, Save at the right edge.
		<div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 gap-y-2 border-b border-hairline py-2.5 lg:grid-cols-[minmax(0,220px)_minmax(0,1fr)_auto] lg:gap-x-6">
			<span className="flex h-10 items-center font-sans text-[calc(13.5px*var(--ws-fs))] font-medium text-primary">
				Username
			</span>
			<button
				type="button"
				onClick={save}
				disabled={!canSave}
				className="col-start-2 row-start-1 h-10 shrink-0 cursor-pointer rounded-[7px] bg-primary px-4 font-sans text-[calc(13px*var(--ws-fs))] font-semibold text-page transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 lg:col-start-3"
			>
				{/* inline-block: a transform does nothing on an inline box. */}
				<AnimatePresence mode="wait" initial={false}>
					<motion.span
						key={saving ? "saving" : "save"}
						{...swap}
						className="inline-block"
					>
						{saving ? "Saving…" : "Save"}
					</motion.span>
				</AnimatePresence>
			</button>
			<div className="col-span-2 min-w-0 lg:col-span-1 lg:col-start-2 lg:row-start-1">
			<div className="flex h-10 items-center gap-2 rounded-[7px] border border-hairline px-3 focus-within:border-primary/40">
				<span className="font-sans text-[calc(14px*var(--ws-fs))] text-subtle">@</span>
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
					className="min-w-0 flex-1 bg-transparent font-sans text-[calc(14px*var(--ws-fs))] text-primary outline-none placeholder:text-subtle"
				/>
				{state === "checking" && (
					<LoaderCircle className="h-4 w-4 shrink-0 animate-spin text-subtle" />
				)}
				{/* The verdict lands; it does not leave. Entrance only, no
				    presence: the next keystroke cuts straight back to the
				    spinner, because typing never waits on an exit. */}
				{state === "ok" && (
					<motion.span
						initial={pop.initial}
						animate={pop.animate}
						className="flex shrink-0"
					>
						<Check className="h-4 w-4 text-success" />
					</motion.span>
				)}
				{(state === "taken" || state === "invalid") && (
					<motion.span
						// The format rule answers a keystroke, so it cuts in.
						initial={state === "taken" ? pop.initial : false}
						animate={pop.animate}
						className="flex shrink-0"
					>
						<X className="h-4 w-4 text-danger" />
					</motion.span>
				)}
			</div>

			{/* Keyed by the state, not the text: the line rises once when a
			    checked verdict lands and holds still while the handle is typed.
			    Lines a keystroke produces (Checking, the format rule) cut in,
			    and the old line is cut rather than faded out, same reason. */}
			{hint.text && (
				<motion.p
					key={unchanged ? "unchanged" : state}
					initial={
						!unchanged && (state === "ok" || state === "taken")
							? swap.initial
							: false
					}
					animate={swap.animate}
					className={`mt-1.5 font-sans text-[calc(12px*var(--ws-fs))] ${
						hint.tone === "danger"
							? "text-danger"
							: hint.tone === "success"
								? "text-success"
								: "text-muted"
					}`}
				>
					{hint.text}
				</motion.p>
			)}
			<p className="mt-1 font-sans text-[calc(12px*var(--ws-fs))] text-subtle">
				You can change this again 30 days after a change. Your old handle
				becomes free for someone else to take.
			</p>
			</div>
		</div>
	);
}
