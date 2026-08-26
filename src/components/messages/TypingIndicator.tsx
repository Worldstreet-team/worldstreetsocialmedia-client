"use client";

import { motion } from "framer-motion";

/**
 * The three-dot "still writing" bubble.
 *
 * Shaped and coloured like an inbound message so it reads as a message being
 * born rather than as a loading spinner — it sits where their next bubble
 * will land.
 */
export function TypingIndicator({ name }: { name?: string }) {
	return (
		<div className="mb-4 flex flex-col items-start">
			<div className="flex items-center gap-1.5 rounded-xl bg-raised px-3.5 py-3">
				{[0, 1, 2].map((i) => (
					<motion.span
						key={i}
						className="h-1.5 w-1.5 rounded-pill bg-muted"
						animate={{ opacity: [0.35, 1, 0.35], y: [0, -2, 0] }}
						transition={{
							duration: 1.1,
							repeat: Infinity,
							ease: "easeInOut",
							// Staggered so it reads as a travelling wave, not a blink.
							delay: i * 0.16,
						}}
					/>
				))}
			</div>
			{name && (
				<span className="mt-1 block text-xs text-subtle">
					{name} is typing…
				</span>
			)}
		</div>
	);
}
