import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
	icon: LucideIcon;
	title: string;
	caption: string;
	/** Optional single action. The spec allows at most one. */
	action?: { label: string; onClick: () => void };
}

/**
 * 04-components "EmptyState": centered column, gap 12, padding 32/24 —
 * 64px bg/raised circle with a 26px text/muted icon, title SemiBold 16
 * text/primary, caption Regular 13 text/muted capped near 36ch, and at most
 * one small Primary button.
 *
 * "Never more than one action" is enforced by the prop shape.
 */
export function EmptyState({
	icon: Icon,
	title,
	caption,
	action,
}: EmptyStateProps) {
	return (
		<div className="flex flex-col items-center gap-3 px-6 py-8 text-center">
			<div className="flex h-16 w-16 items-center justify-center rounded-pill bg-raised">
				<Icon className="h-[26px] w-[26px] text-muted" strokeWidth={2} />
			</div>

			<h2 className="font-sans text-base font-semibold text-primary">
				{title}
			</h2>

			<p className="max-w-[36ch] font-sans text-[13px] leading-relaxed text-muted">
				{caption}
			</p>

			{action && (
				<button
					type="button"
					onClick={action.onClick}
					className="mt-1 h-9 rounded-pill bg-brand px-[18px] font-sans text-[13px] font-semibold text-brand-on transition-colors hover:bg-brand-active cursor-pointer"
				>
					{action.label}
				</button>
			)}
		</div>
	);
}
