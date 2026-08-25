"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface Particle {
	x: number;
	y: number;
	r: number;
	color: string;
}

/**
 * Aceternity's placeholders-and-vanish-input, adapted: the vanish belongs to
 * the PLACEHOLDER itself. Each prompt holds for a beat, dissolves into
 * particles sweeping right-to-left, then the next prompt fades in — no
 * typing required. Hidden entirely once the field has content. Under
 * prefers-reduced-motion the dissolve is skipped and prompts simply swap.
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

	const draw = useCallback(
		(text: string) => {
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
							r: 1.2,
							color: `rgba(${data[i]},${data[i + 1]},${data[i + 2]},${data[i + 3] / 255})`,
						});
					}
				}
			}
			particlesRef.current = particles;
		},
		[font, color],
	);

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
						ctx.fillStyle = p.color;
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
		draw(texts[index]);
		timerRef.current = setTimeout(() => {
			if (reduced) {
				setIndex((i) => (i + 1) % texts.length);
			} else {
				dissolve(() => setIndex((i) => (i + 1) % texts.length));
			}
		}, holdMs);
		return () => {
			if (timerRef.current) clearTimeout(timerRef.current);
			if (rafRef.current) cancelAnimationFrame(rafRef.current);
		};
	}, [index, visible, texts, holdMs, draw, dissolve]);

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
