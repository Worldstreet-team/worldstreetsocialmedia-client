import { IconProps } from "@/app/types";

const UserIcon = ({ color, size, isActive }: IconProps) => {
    return (
        <svg
            width={size ? size.width : "30"}
            height={size ? size.height : "30"}
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
        >
            {isActive ? (
                <>
                    <circle cx="12" cy="6" r="4" fill={color || "#000000"}/>
                    <ellipse opacity="1" cx="12" cy="17" rx="7" ry="4" fill={color || "#000000"}/>
                </>
            ) : (
                <>
                    <circle cx="12" cy="6" r="4" stroke={color || "#000000"} strokeWidth="1.2"/>
                    <ellipse opacity="1" cx="12" cy="17" rx="7" ry="4" stroke={color || "#000000"} strokeWidth="1.2"/>
                </>
            )}
        </svg>
    );
};

export default UserIcon;
