"use client";

import { useEffect, useRef } from "react";
import type { CallState } from "@/lib/call-manager";

/**
 * Call tones, synthesized with Web Audio.
 *
 * Generated rather than shipped as audio files: a ringtone is two sine waves
 * and an envelope, and this keeps the bundle free of media assets that would
 * need licensing, preloading and a CDN round trip at the exact moment the app
 * is busy negotiating a call.
 *
 * Two patterns, deliberately different so the two states are distinguishable
 * without looking at the screen:
 *  - **incoming** — a warbling two-tone ring, the one that means "answer me"
 *  - **outgoing** — a single low ringback pulse, the one you hear in the earpiece
 */

const RING = { a: 660, b: 520, on: 1.0, gap: 2.0, gain: 0.16 };
const RINGBACK = { a: 420, b: 0, on: 1.1, gap: 2.9, gain: 0.09 };

export function useCallTones(state: CallState) {
	const ctxRef = useRef<AudioContext | null>(null);
	const stopRef = useRef<(() => void) | null>(null);

	const mode =
		state.status === "ringing"
			? state.isIncoming
				? "incoming"
				: "outgoing"
			: null;

	useEffect(() => {
		if (!mode) {
			stopRef.current?.();
			stopRef.current = null;
			return;
		}

		const Ctor =
			typeof window !== "undefined"
				? (window.AudioContext ??
					(window as any).webkitAudioContext)
				: null;
		if (!Ctor) return;

		if (!ctxRef.current) ctxRef.current = new Ctor();
		const ctx = ctxRef.current;
		// Autoplay policy suspends contexts created without a gesture; an
		// incoming call has no gesture, so ask nicely and carry on if refused.
		void ctx.resume().catch(() => {});

		const cfg = mode === "incoming" ? RING : RINGBACK;
		let cancelled = false;
		let timer: ReturnType<typeof setTimeout> | null = null;

		const pulse = () => {
			if (cancelled || ctx.state === "closed") return;
			const now = ctx.currentTime;
			const gain = ctx.createGain();
			gain.connect(ctx.destination);

			// Soft edges — a square-edged gate on a sine reads as a click.
			gain.gain.setValueAtTime(0, now);
			gain.gain.linearRampToValueAtTime(cfg.gain, now + 0.04);
			gain.gain.setValueAtTime(cfg.gain, now + cfg.on - 0.06);
			gain.gain.linearRampToValueAtTime(0, now + cfg.on);

			const tones = [cfg.a, cfg.b].filter(Boolean) as number[];
			for (const freq of tones) {
				const osc = ctx.createOscillator();
				osc.type = "sine";
				osc.frequency.setValueAtTime(freq, now);
				osc.connect(gain);
				osc.start(now);
				osc.stop(now + cfg.on + 0.02);
			}

			timer = setTimeout(pulse, (cfg.on + cfg.gap) * 1000);
		};

		pulse();

		stopRef.current = () => {
			cancelled = true;
			if (timer) clearTimeout(timer);
		};
		return () => stopRef.current?.();
	}, [mode]);

	// Release the hardware audio context when calling is over for good.
	useEffect(() => {
		if (state.status !== "idle") return;
		const ctx = ctxRef.current;
		if (!ctx) return;
		ctxRef.current = null;
		void ctx.close().catch(() => {});
	}, [state.status]);
}
