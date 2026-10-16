"use client";

import clsx from "clsx";
import { useEffect, useRef } from "react";

/**
 * Vivid's mark: a sphere of dots turning on its axis, the same construction
 * as WorldStreet's DotsOrb (Worldstreet/components/vivid/dots-orb.tsx).
 * Monochrome on WorldSpace (owner 2026-10-16): the dots take the theme's ink,
 * white on dark and black on light, read from `currentColor` so the theme
 * swap needs no prop. Front dots solid, back dots faint.
 *
 * `speed` is radians per second; `level` (0..1) swells the sphere while Vivid
 * is listening or speaking. Still under reduced motion; paused while hidden.
 */
export function VividOrb({
	size = 28,
	speed = 0.6,
	level = 0,
	className,
}: {
	size?: number;
	speed?: number;
	level?: number;
	className?: string;
}) {
	const ref = useRef<HTMLCanvasElement>(null);
	const levelRef = useRef(level);
	const speedRef = useRef(speed);
	levelRef.current = level;
	speedRef.current = speed;

	useEffect(() => {
		const canvas = ref.current;
		const ctx = canvas?.getContext("2d");
		if (!canvas || !ctx) return;
		const dpr = Math.min(window.devicePixelRatio || 1, 2);
		canvas.width = size * dpr;
		canvas.height = size * dpr;
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

		// Fewer, larger dots at icon size so the sphere still reads.
		const n = size < 48 ? 90 : Math.min(900, Math.round(size * 4.2));
		const golden = Math.PI * (3 - Math.sqrt(5));
		const pts: [number, number, number][] = [];
		for (let i = 0; i < n; i++) {
			const y = 1 - (i / (n - 1)) * 2;
			const r = Math.sqrt(1 - y * y);
			pts.push([Math.cos(golden * i) * r, y, Math.sin(golden * i) * r]);
		}
		const c = size / 2;
		const baseR = size * 0.42;
		const dot = size < 48 ? size / 34 : size / 90;
		const cosT = Math.cos(0.42);
		const sinT = Math.sin(0.42);
		const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

		let raf = 0;
		let last = performance.now();
		let angle = 0.6;
		let swell = 0;

		const draw = (now: number) => {
			const dt = Math.min(0.05, (now - last) / 1000);
			last = now;
			if (!still) angle += speedRef.current * dt;
			swell += (levelRef.current - swell) * Math.min(1, dt * 10);
			const ink = getComputedStyle(canvas).color || "rgb(238,242,246)";
			const R = baseR * (1 + swell * 0.14);
			const cosA = Math.cos(angle);
			const sinA = Math.sin(angle);
			ctx.clearRect(0, 0, size, size);
			ctx.fillStyle = ink;
			for (const [x0, y0, z0] of pts) {
				const x = x0 * cosA + z0 * sinA;
				const z1 = -x0 * sinA + z0 * cosA;
				const y = y0 * cosT - z1 * sinT;
				const depth = (y0 * sinT + z1 * cosT + 1) / 2;
				ctx.globalAlpha =
					depth < 0.5 ? 0.12 + depth * 0.4 : Math.min(1, 0.45 + (depth - 0.5) * 1.2);
				ctx.beginPath();
				ctx.arc(c + x * R, c + y * R, (0.5 + depth * 0.8 + swell * 0.3) * dot, 0, Math.PI * 2);
				ctx.fill();
			}
			ctx.globalAlpha = 1;
			if (!still && !document.hidden) raf = requestAnimationFrame(draw);
		};
		const onVisibility = () => {
			if (document.hidden || still) return;
			cancelAnimationFrame(raf);
			last = performance.now();
			raf = requestAnimationFrame(draw);
		};
		document.addEventListener("visibilitychange", onVisibility);
		raf = requestAnimationFrame(draw);
		return () => {
			cancelAnimationFrame(raf);
			document.removeEventListener("visibilitychange", onVisibility);
		};
	}, [size]);

	return (
		<canvas
			ref={ref}
			aria-hidden
			className={clsx("shrink-0 text-primary", className)}
			style={{ width: size, height: size }}
		/>
	);
}
