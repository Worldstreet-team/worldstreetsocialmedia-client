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

/** The order the empty window plays: typing, the mark, thinking, hello. */
const INTRO: { scene: HelloScene; at: number }[] = [
	{ scene: "dots", at: 0 },
	{ scene: "mark", at: 1100 },
	{ scene: "spin", at: 2700 },
	{ scene: "hello", at: 3900 },
];

/**
 * The empty Vivid window's greeting: three dots become Vivid's mark, then
 * the ring Vivid thinks with, then a handwritten hello, where it rests.
 * Under reduced motion it opens on the hello.
 */
export function VividIntro({ className }: { className?: string }) {
	const [scene, setScene] = useState<HelloScene>(() => (motionReduced() ? "hello" : "dots"));
	useEffect(() => {
		if (motionReduced()) return;
		const timers = INTRO.slice(1).map((step) => window.setTimeout(() => setScene(step.scene), step.at));
		return () => timers.forEach(clearTimeout);
	}, []);
	return <VividMorph scene={scene} className={className} />;
}

/** The middle of the drawing: the dots and the ring, cropped to fill a small box. */
const THINKING_VIEWBOX = "84 52 72 56";

/** While Vivid works on an answer: the dots, then the turning ring. */
export function VividThinking({ className }: { className?: string }) {
	const [scene, setScene] = useState<HelloScene>("dots");
	useEffect(() => {
		const t = window.setTimeout(() => setScene("spin"), motionReduced() ? 0 : 700);
		return () => clearTimeout(t);
	}, []);
	return <VividMorph scene={scene} className={className} viewBox={THINKING_VIEWBOX} />;
}
