"use client";

import clsx from "clsx";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { type MorphClasses, MorphDriver } from "@/lib/morph/driver";
import { motionReduced } from "@/lib/motion";
import s from "./vivid-morph.module.css";
import { HELLO_VIEWBOX, createHelloScenes, type HelloScene } from "./vivid-hello-scenes";

const classes: MorphClasses = {
	path: s.path,
	beat: s.beat,
	paint: (name) => s[name] ?? "",
	idle: (kind) => s[`i${kind.charAt(0).toUpperCase()}${kind.slice(1)}`] ?? "",
};

/**
 * One morph driver, kept mounted; change `scene` and the dots travel.
 * (Keying or remounting per scene would replay the entrance instead.)
 */
export function VividMorph({
	scene,
	className,
	viewBox,
}: {
	scene: HelloScene;
	className?: string;
	/** Crop to a region (the thinking indicator only shows the middle). */
	viewBox?: string;
}) {
	const svg = useRef<SVGSVGElement>(null);
	const driver = useRef<MorphDriver | null>(null);
	const latest = useRef(scene);
	useLayoutEffect(() => {
		latest.current = scene;
	});

	useLayoutEffect(() => {
		const el = svg.current;
		if (!el) return;
		const d = new MorphDriver(el, createHelloScenes(), { initial: latest.current, classes });
		driver.current = d;
		return () => {
			d.destroy();
			driver.current = null;
		};
	}, []);

	useLayoutEffect(() => {
		driver.current?.go(scene);
	}, [scene]);

	return (
		<svg
			ref={svg}
			viewBox={viewBox ?? HELLO_VIEWBOX}
			aria-hidden="true"
			focusable="false"
			overflow="visible"
			data-scene={scene}
			className={clsx(s.art, "block overflow-visible", className)}
		/>
	);
}

/**
 * One lap of the empty window, then back to the dots: [scene, ms from the
 * start of its morph to the next]. A morph takes about 0.95s, so each scene
 * gets at least a second of its own beat: one typing wave, one breath, a
 * lap and a half of the chase.
 */
const LAP: [HelloScene, number][] = [
	["dots", 2200],
	["mark", 2400],
	["spin", 2600],
	["hello", 3400],
];

/**
 * The empty Vivid window's greeting, on a loop: the three dots split into
 * Vivid's mark, gather on the ring she thinks with, write a hello, then fold
 * back into the three dots. Under reduced motion it rests on the hello.
 */
export function VividIntro({ className }: { className?: string }) {
	const [step, setStep] = useState(() => (motionReduced() ? 3 : 0));
	useEffect(() => {
		if (motionReduced()) return;
		const t = window.setTimeout(() => setStep((i) => (i + 1) % LAP.length), LAP[step][1]);
		return () => clearTimeout(t);
	}, [step]);
	return <VividMorph scene={LAP[step][0]} className={className} />;
}

/** The middle of the drawing: the dots and the ring, cropped to fill a small box. */
const THINKING_VIEWBOX = "84 52 72 56";

/** While Vivid works on an answer: the dots, then the chasing ring. */
export function VividThinking({ className }: { className?: string }) {
	const [scene, setScene] = useState<HelloScene>("dots");
	useEffect(() => {
		const t = window.setTimeout(() => setScene("spin"), motionReduced() ? 0 : 700);
		return () => clearTimeout(t);
	}, []);
	return <VividMorph scene={scene} className={className} viewBox={THINKING_VIEWBOX} />;
}
