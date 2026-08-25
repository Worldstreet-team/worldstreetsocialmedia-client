"use client";

import { useEffect, useRef } from "react";
import { observeImpression, type ImpressionMeta } from "@/lib/telemetry";

// Thin wrapper that reports MRC viewability for whatever it wraps.
// Renders a plain div — no layout opinion beyond display: contents-like
// pass-through via className forwarding.
export function ImpressionSensor({
	meta,
	className,
	style,
	children,
}: {
	meta: ImpressionMeta;
	className?: string;
	style?: React.CSSProperties;
	children: React.ReactNode;
}) {
	const ref = useRef<HTMLDivElement>(null);
	// Re-observe only when the post identity changes, not on every render.
	const metaRef = useRef(meta);
	metaRef.current = meta;

	useEffect(() => {
		const el = ref.current;
		if (!el) return;
		return observeImpression(el, metaRef.current);
	}, [meta.post]);

	return (
		<div ref={ref} className={className} style={style}>
			{children}
		</div>
	);
}
