import { IconProps } from "@/app/types";

export default function MoreCircleIcon({ color, size }: IconProps) {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width={size?.width || "24"}
			height={size?.height || "24"}
			viewBox="0 0 24 24"
			fill="none"
			stroke={color || "currentColor"}
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<circle cx="12" cy="12" r="10" />
			<path d="M8 12h8" />
			<path d="M12 8v8" />
		</svg>
	);
}
