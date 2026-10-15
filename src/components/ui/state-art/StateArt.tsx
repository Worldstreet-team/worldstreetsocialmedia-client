"use client";

import { useLayoutEffect, useRef } from "react";
import { type MorphClasses, MorphDriver } from "@/lib/morph/driver";
import { cn } from "@/lib/utils";
import s from "./state-art.module.css";
import { createStateScenes, STATE_VIEWBOX, type StateScene } from "./state-scenes";

export { STATE_SCENES, type StateScene } from "./state-scenes";

const classes: MorphClasses = {
	path: s.path,
	beat: s.beat,
	paint: (name) => s[name] ?? "",
	idle: (kind) => s[`i${kind.charAt(0).toUpperCase()}${kind.slice(1)}`] ?? "",
};

/**
 * The state glyph (scenes and the reasoning: ./state-scenes.ts). Keep ONE
 * mounted for the life of the surface and change `scene`, so a retry that
 * fails again morphs magnifier to cloud instead of replaying the entrance.
 * Decorative: the title and caption beside it carry the meaning.
 */
export function StateArt({
	scene,
	className,
}: {
	scene: StateScene;
	className?: string;
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
		const d = new MorphDriver(el, createStateScenes(), {
			initial: latest.current,
			classes,
		});
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
			viewBox={STATE_VIEWBOX}
			aria-hidden="true"
			focusable="false"
			overflow="visible"
			data-scene={scene}
			className={cn(s.art, "block overflow-visible", className)}
		/>
	);
}
