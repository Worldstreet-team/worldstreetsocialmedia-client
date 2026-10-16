"use client";

import { useLayoutEffect, useRef } from "react";
import { type MorphClasses, MorphDriver } from "@/lib/morph/driver";
import { cn } from "@/lib/utils";
import { createProductScenes, PRODUCT_VIEWBOX } from "./product-scenes";
import s from "./products.module.css";

const classes: MorphClasses = {
	path: s.path,
	beat: s.beat,
	paint: (name) => s[name] ?? "",
	idle: () => "",
};

/**
 * The Products dial's hub glyph (scenes: ./product-scenes.ts). One driver
 * for the life of the dial: change `scene` and it morphs, from the rail's
 * four squares into the product in focus and from product to product.
 * Decorative: the name under it carries the meaning.
 */
export function ProductGlyph({ scene, size, className }: { scene: string; size?: number; className?: string }) {
	const svg = useRef<SVGSVGElement>(null);
	const driver = useRef<MorphDriver | null>(null);
	const latest = useRef(scene);
	useLayoutEffect(() => {
		latest.current = scene;
	});

	useLayoutEffect(() => {
		const el = svg.current;
		if (!el) return;
		const d = new MorphDriver(el, createProductScenes(), { initial: latest.current, classes });
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
			viewBox={PRODUCT_VIEWBOX}
			aria-hidden="true"
			focusable="false"
			overflow="visible"
			width={size}
			height={size}
			className={cn(s.art, "block overflow-visible", className)}
		/>
	);
}
