import { IconProps } from "@/app/types";

const Gif2Icon = ({ color, size, isActive }: IconProps) => {
	return (
		<svg
			width={size ? size.width : "25"}
			height={size ? size.height : "25"}
			viewBox="0 0 24 24"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
		>
			<title>GIF</title>
			<path
				d="M8.68006 12.72H10.4201V16.77C10.4201 17.37 11.1601 17.65 11.5601 17.2L15.8201 12.36C16.1901 11.94 15.8901 11.28 15.3301 11.28H13.5901V7.22995C13.5901 6.62995 12.8501 6.34995 12.4501 6.79995L8.19006 11.64C7.82006 12.06 8.12006 12.72 8.68006 12.72Z"
				stroke={color || "#292D32"}
				strokeWidth="1.5"
				strokeMiterlimit="10"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
			<path
				d="M11.97 22C17.4928 22 21.97 17.5228 21.97 12C21.97 6.47715 17.4928 2 11.97 2C6.44712 2 1.96997 6.47715 1.96997 12C1.96997 17.5228 6.44712 22 11.97 22Z"
				stroke={color || "#292D32"}
				strokeWidth="1.5"
				strokeMiterlimit="10"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	);
};

export default Gif2Icon;
