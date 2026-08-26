"use client";

/* Flat section header — eyebrow + optional live dot + optional trailing
   chip. No boxes: the rail reads as one column of content, not a stack of
   cards. Shared by every right-rail section so the eyebrows stay identical. */
export function SectionHead({
	label,
	live,
	icon,
	trailing,
}: {
	label: string;
	live?: boolean;
	/** A small Phosphor glyph before the label, same ink as the eyebrow. */
	icon?: React.ReactNode;
	trailing?: React.ReactNode;
}) {
	return (
		<div className="flex items-center gap-2 px-3 pb-1.5">
			{icon && (
				<span className="flex shrink-0 items-center text-subtle">{icon}</span>
			)}
			{live && (
				<span className="relative flex h-2 w-2">
					<span className="absolute inline-flex h-full w-full rounded-pill bg-danger opacity-60 animate-ping" />
					<span className="relative inline-flex h-2 w-2 rounded-pill bg-danger" />
				</span>
			)}
			<h3 className="font-sans font-semibold text-[11px] uppercase tracking-[0.14em] text-subtle flex-1">
				{label}
			</h3>
			{trailing}
		</div>
	);
}
