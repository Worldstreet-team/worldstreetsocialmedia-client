"use client";

/**
 * The three-dot "still writing" bubble — a pure-CSS stagger loop now: a
 * framer per-dot animation re-scheduled JS frames forever; a CSS keyframe
 * costs the compositor and nothing else (register item 157).
 */
export function TypingIndicator({ name }: { name?: string }) {
	return (
		<div className="flex flex-col items-start">
			<div className="flex items-center gap-1.5 rounded-xl bg-raised/80 px-3.5 py-3">
				{[0, 1, 2].map((i) => (
					<span
						key={i}
						className="ws-typing-dot h-1.5 w-1.5 rounded-pill bg-muted"
						style={{ animationDelay: `${i * 0.16}s` }}
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
