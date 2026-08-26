"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface Particle {
	x: number;
	y: number;
	/** Target position — where the particle settles when assembled. */
	tx: number;
	ty: number;
	r: number;
	/** Kept split from alpha so the entrance can fade a particle in. */
	rgb: string;
	a: number;
	/** 0 = scattered, 1 = settled. Only the entrance uses this. */
	t: number;
}

/**
 * Aceternity's placeholders-and-vanish-input, adapted: the vanish belongs to
 * the PLACEHOLDER itself. Each prompt ASSEMBLES from particles sweeping
 * left-to-right, holds for a beat, then dissolves right-to-left into the next
 * one — no typing required. Hidden entirely once the field has content. Under
 * prefers-reduced-motion both passes are skipped and prompts simply swap.
 */
export function VanishingPlaceholder({
	texts,
	className = "",
	holdMs = 2600,
	font = "500 18px 'Public Sans', sans-serif",
	color = "#78716C",
}: {
	texts: string[];
	className?: string;
	holdMs?: number;
	font?: string;
	color?: string;
}) {
	const [index, setIndex] = useState(0);
	const [visible, setVisible] = useState(true);
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const particlesRef = useRef<Particle[]>([]);
	const rafRef = useRef<number | null>(null);
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	/**
	 * Paint `text` and sample it into particles. `paint: false` leaves the
	 * canvas blank afterwards — that's how the entrance gets its particle set
	 * without the finished text flashing on screen for a frame first.
	 */
	const draw = useCallback(
		(text: string, paint = true) => {
			const canvas = canvasRef.current;
			const ctx = canvas?.getContext("2d");
			if (!canvas || !ctx) return;
			const dpr = 2;
			canvas.width = canvas.offsetWidth * dpr;
			canvas.height = canvas.offsetHeight * dpr;
			ctx.clearRect(0, 0, canvas.width, canvas.height);
			ctx.font = font.replace(/(\d+)px/, (_, n) => `${Number(n) * dpr}px`);
			ctx.fillStyle = color;
			ctx.textBaseline = "middle";
			ctx.fillText(text, 0, canvas.height / 2);

			const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
			const data = image.data;
			const particles: Particle[] = [];
			// Sample every 2nd pixel — enough density, quarter the work.
			for (let y = 0; y < canvas.height; y += 2) {
				for (let x = 0; x < canvas.width; x += 2) {
					const i = (y * canvas.width + x) * 4;
					if (data[i + 3] > 128) {
						particles.push({
							x,
							y,
							tx: x,
							ty: y,
							r: 1.2,
							rgb: `${data[i]},${data[i + 1]},${data[i + 2]}`,
							a: data[i + 3] / 255,
							t: 0,
						});
					}
				}
			}
			particlesRef.current = particles;
			if (!paint) ctx.clearRect(0, 0, canvas.width, canvas.height);
		},
		[font, color],
	);

	/**
	 * The entrance — the mirror of `dissolve`. A sweep runs left-to-right and
	 * each particle it passes eases from a scattered offset onto its target
	 * pixel, fading up as it lands. This pass was simply missing: prompts
	 * dissolved out beautifully and then the next one appeared instantly.
	 */
	const assemble = useCallback((onDone: () => void) => {
		const canvas = canvasRef.current;
		const ctx = canvas?.getContext("2d");
		const parts = particlesRef.current;
		if (!canvas || !ctx || parts.length === 0) {
			onDone();
			return;
		}
		const spread = 26;
		for (const p of parts) {
			p.t = 0;
			p.x = p.tx + (Math.random() - 0.5) * spread;
			p.y = p.ty + (Math.random() - 0.5) * spread;
		}
		const maxX = parts.reduce((m, p) => Math.max(m, p.tx), 0);
		const stride = canvas.width / 45;

		const step = (pos: number) => {
			rafRef.current = requestAnimationFrame(() => {
				ctx.clearRect(0, 0, canvas.width, canvas.height);
				let pending = 0;
				for (const p of parts) {
					if (p.tx <= pos && p.t < 1) p.t = Math.min(1, p.t + 0.16);
					if (p.t < 1) pending++;
					if (p.t <= 0) continue;
					// ease-out so particles decelerate onto the glyph
					const e = 1 - (1 - p.t) * (1 - p.t);
					const x = p.x + (p.tx - p.x) * e;
					const y = p.y + (p.ty - p.y) * e;
					ctx.fillStyle = `rgba(${p.rgb},${p.a * e})`;
					ctx.fillRect(x, y, p.r * (0.4 + 0.6 * e), p.r * (0.4 + 0.6 * e));
				}
				if (pending > 0 || pos < maxX) step(pos + stride);
				else onDone();
			});
		};
		step(0);
	}, []);

	const dissolve = useCallback(
		(onDone: () => void) => {
			const canvas = canvasRef.current;
			const ctx = canvas?.getContext("2d");
			if (!canvas || !ctx || particlesRef.current.length === 0) {
				onDone();
				return;
			}
			const maxX = particlesRef.current.reduce(
				(m, p) => Math.max(m, p.x),
				0,
			);
			const step = (pos: number) => {
				rafRef.current = requestAnimationFrame(() => {
					const kept: Particle[] = [];
					for (const p of particlesRef.current) {
						if (p.x < pos) {
							kept.push(p);
							continue;
						}
						p.x += Math.random() > 0.5 ? 1.4 : -1.4;
						p.y += Math.random() > 0.5 ? 1.4 : -1.4;
						p.r -= 0.055 * Math.random();
						if (p.r > 0) kept.push(p);
					}
					particlesRef.current = kept;
					ctx.clearRect(0, 0, canvas.width, canvas.height);
					for (const p of kept) {
						ctx.fillStyle = `rgba(${p.rgb},${p.a})`;
						ctx.fillRect(p.x, p.y, p.r, p.r);
					}
					if (kept.length > 0) step(pos - canvas.width / 45);
					else onDone();
				});
			};
			step(maxX);
		},
		[],
	);

	useEffect(() => {
		if (!visible) return;
		const reduced = window.matchMedia(
			"(prefers-reduced-motion: reduce)",
		).matches;

		if (reduced) {
			draw(texts[index]);
			timerRef.current = setTimeout(
				() => setIndex((i) => (i + 1) % texts.length),
				holdMs,
			);
		} else {
			// assemble in → hold → dissolve out → next prompt
			draw(texts[index], false);
			assemble(() => {
				// Land on the real glyphs: the particle grid is sampled every
				// 2px, so leaving it as-is would read slightly thinner.
				draw(texts[index]);
				timerRef.current = setTimeout(() => {
					dissolve(() => setIndex((i) => (i + 1) % texts.length));
				}, holdMs);
			});
		}

		return () => {
			if (timerRef.current) clearTimeout(timerRef.current);
			if (rafRef.current) cancelAnimationFrame(rafRef.current);
		};
	}, [index, visible, texts, holdMs, draw, dissolve, assemble]);

	// Pause the cycle while the tab is hidden — no invisible canvas work.
	useEffect(() => {
		const onVis = () => setVisible(document.visibilityState === "visible");
		document.addEventListener("visibilitychange", onVis);
		return () => document.removeEventListener("visibilitychange", onVis);
	}, []);

	return (
		<canvas
			ref={canvasRef}
			aria-hidden="true"
			className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}
		/>
	);
}
