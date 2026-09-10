"use client";

import clsx from "clsx";
import { Switch } from "@/components/ui/Switch";

/**
 * The two row shapes every settings group is built from: a pill Choice and
 * a Switch row. Shared so a new group is a list of rows, not a new design.
 */

export function Choice({
	label,
	hint,
	value,
	options,
	onPick,
}: {
	label: string;
	hint?: string;
	value: string | number;
	options: [string | number, string][];
	onPick: (v: string | number) => void;
}) {
	return (
		<div className="border-t border-hairline px-4 py-3 first:border-t-0">
			<span className="font-sans text-[calc(14px*var(--ws-fs))] font-medium text-primary">
				{label}
			</span>
			{hint && (
				<p className="mt-0.5 max-w-[62ch] font-sans text-[calc(12.5px*var(--ws-fs))] leading-snug text-muted">
					{hint}
				</p>
			)}
			<div className="mt-2.5 flex flex-wrap gap-1.5">
				{options.map(([v, l]) => {
					const active = v === value;
					return (
						<button
							key={String(v)}
							type="button"
							aria-pressed={active}
							onClick={() => onPick(v)}
							className={clsx(
								"flex h-9 cursor-pointer items-center rounded-pill px-3.5 font-sans text-[calc(13px*var(--ws-fs))] font-semibold transition-colors",
								active
									? "bg-primary text-page"
									: "bg-raised text-muted hover:text-primary",
							)}
						>
							{l}
						</button>
					);
				})}
			</div>
		</div>
	);
}

export function Toggle({
	label,
	hint,
	checked,
	disabled,
	onChange,
}: {
	label: string;
	hint?: string;
	checked: boolean;
	disabled?: boolean;
	onChange: (v: boolean) => void;
}) {
	return (
		<div
			className={clsx(
				"flex items-center justify-between gap-4 border-t border-hairline px-4 py-2.5 first:border-t-0",
				disabled && "opacity-60",
			)}
		>
			<span className="min-w-0">
				<span className="block font-sans text-[calc(14px*var(--ws-fs))] font-medium text-primary">
					{label}
				</span>
				{hint && (
					<span className="mt-0.5 block max-w-[62ch] font-sans text-[calc(12.5px*var(--ws-fs))] leading-snug text-muted">
						{hint}
					</span>
				)}
			</span>
			<Switch
				checked={checked}
				disabled={disabled}
				onChange={onChange}
				label={label}
				className="-mr-2"
			/>
		</div>
	);
}
