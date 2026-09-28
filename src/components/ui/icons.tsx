import type { Icon as PhosphorIcon, IconWeight } from "@phosphor-icons/react";
import {
	ArrowLeft as PhArrowLeft,
	ArrowRight as PhArrowRight,
	ArrowUp as PhArrowUp,
	ArrowsClockwise,
	At,
	Bell as PhBell,
	BellRinging,
	BellSlash,
	BookmarkSimple,
	Briefcase as PhBriefcase,
	Broadcast,
	CalendarBlank,
	Camera as PhCamera,
	CaretDown,
	CaretLeft,
	CaretRight,
	ChartBar,
	ChartLineUp,
	ChatCircle,
	ChatCircleText,
	ChatText,
	Check as PhCheck,
	CircleNotch,
	Clock as PhClock,
	ClockCounterClockwise,
	Compass as PhCompass,
	Copy as PhCopy,
	Crown as PhCrown,
	DotsThree,
	DownloadSimple,
	Envelope,
	Export,
	Eye as PhEye,
	FilmSlate,
	Flag as PhFlag,
	Gauge as PhGauge,
	Gear,
	GearSix,
	GraduationCap as PhGraduationCap,
	GridNine,
	Heart as PhHeart,
	House,
	Image as PhImage,
	ImageSquare,
	Info as PhInfo,
	Lightning,
	Link as PhLink,
	LinkSimple,
	Lock as PhLock,
	MagnifyingGlass,
	MapPin as PhMapPin,
	Megaphone as PhMegaphone,
	Microphone,
	Monitor,
	Palette as PhPalette,
	PaperPlaneRight,
	PauseCircle as PhPauseCircle,
	PencilSimple,
	Phone as PhPhone,
	Play as PhPlay,
	Plus as PhPlus,
	PlusSquare,
	Prohibit,
	PushPin,
	Rss as PhRss,
	SealCheck,
	ShareNetwork,
	Shield as PhShield,
	ShieldCheck as PhShieldCheck,
	ShieldWarning,
	ShoppingBag as PhShoppingBag,
	SignOut,
	SlidersHorizontal as PhSlidersHorizontal,
	Sparkle,
	SpeakerHigh,
	SpeakerSlash,
	SquaresFour,
	Trash,
	UserCircle as PhUserCircle,
	UserMinus,
	UserPlus as PhUserPlus,
	Users as PhUsers,
	UsersThree,
	VideoCamera,
	Wallet as PhWallet,
	Warning,
	X as PhX,
} from "@phosphor-icons/react/dist/ssr";
import { type ComponentType, type SVGProps, forwardRef } from "react";

/**
 * The app's line icons, on Phosphor (owner 2026-09-28: "softer icons, the
 * ones used on the Xtreme project"). Xstream draws with Phosphor alone:
 * regular at rest, fill for an active or chosen state, bold at the
 * smallest sizes. Lucide's squarer two-pixel line had crept across 61
 * files here; this module keeps their Lucide names so each file changed
 * only its import path, and draws the Phosphor glyph underneath.
 *
 * Lucide props are translated, not dropped: a `strokeWidth` of 2.4 or
 * more (how the old code said "emphasised" or "active") becomes the bold
 * weight, and a filled Lucide icon (`fill` set to a colour) becomes the
 * fill weight. Pass `weight` to choose directly. The SSR build is used so
 * a server component can render these too.
 *
 * A new icon: import it from Phosphor directly in new code. This layer
 * exists for the names already in use.
 */

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, "ref" | "strokeWidth"> {
	size?: number | string;
	/** Lucide's line width, mapped to a Phosphor weight. */
	strokeWidth?: number;
	absoluteStrokeWidth?: boolean;
	weight?: IconWeight;
}
export type LucideIcon = ComponentType<IconProps>;
export type LucideProps = IconProps;

function lineIcon(Glyph: PhosphorIcon, name: string): LucideIcon {
	const Wrapped = forwardRef<SVGSVGElement, IconProps>(function Wrapped(
		{ strokeWidth, absoluteStrokeWidth: _abs, weight, fill, size, ...rest },
		ref,
	) {
		const width = Number(strokeWidth ?? 2);
		const resolved: IconWeight =
			weight ??
			(fill && fill !== "none" ? "fill" : width >= 2.4 ? "bold" : "regular");
		return (
			<Glyph
				ref={ref}
				size={size ?? 24}
				weight={resolved}
				{...(rest as Record<string, unknown>)}
			/>
		);
	});
	Wrapped.displayName = name;
	return Wrapped as unknown as LucideIcon;
}

export const AlertTriangle = lineIcon(Warning, "AlertTriangle");
export const ArrowLeft = lineIcon(PhArrowLeft, "ArrowLeft");
export const ArrowRight = lineIcon(PhArrowRight, "ArrowRight");
export const ArrowUp = lineIcon(PhArrowUp, "ArrowUp");
export const AtSign = lineIcon(At, "AtSign");
export const BadgeCheck = lineIcon(SealCheck, "BadgeCheck");
export const Ban = lineIcon(Prohibit, "Ban");
export const BarChart3 = lineIcon(ChartBar, "BarChart3");
export const Bell = lineIcon(PhBell, "Bell");
export const BellOff = lineIcon(BellSlash, "BellOff");
export const BellRing = lineIcon(BellRinging, "BellRing");
export const Bookmark = lineIcon(BookmarkSimple, "Bookmark");
export const Briefcase = lineIcon(PhBriefcase, "Briefcase");
export const Calendar = lineIcon(CalendarBlank, "Calendar");
export const Camera = lineIcon(PhCamera, "Camera");
export const CandlestickChart = lineIcon(ChartLineUp, "CandlestickChart");
export const Check = lineIcon(PhCheck, "Check");
export const ChevronDown = lineIcon(CaretDown, "ChevronDown");
export const ChevronLeft = lineIcon(CaretLeft, "ChevronLeft");
export const ChevronRight = lineIcon(CaretRight, "ChevronRight");
export const Clapperboard = lineIcon(FilmSlate, "Clapperboard");
export const Clock = lineIcon(PhClock, "Clock");
export const Compass = lineIcon(PhCompass, "Compass");
export const Copy = lineIcon(PhCopy, "Copy");
export const Crown = lineIcon(PhCrown, "Crown");
export const Download = lineIcon(DownloadSimple, "Download");
export const Eye = lineIcon(PhEye, "Eye");
export const Flag = lineIcon(PhFlag, "Flag");
export const Gauge = lineIcon(PhGauge, "Gauge");
export const GraduationCap = lineIcon(PhGraduationCap, "GraduationCap");
export const Grid3x3 = lineIcon(GridNine, "Grid3x3");
export const Heart = lineIcon(PhHeart, "Heart");
export const History = lineIcon(ClockCounterClockwise, "History");
export const Home = lineIcon(House, "Home");
export const Image = lineIcon(PhImage, "Image");
export const ImagePlus = lineIcon(ImageSquare, "ImagePlus");
export const Info = lineIcon(PhInfo, "Info");
export const LayoutGrid = lineIcon(SquaresFour, "LayoutGrid");
export const Link = lineIcon(PhLink, "Link");
export const Link2 = lineIcon(LinkSimple, "Link2");
export const Loader2 = lineIcon(CircleNotch, "Loader2");
export const LoaderCircle = lineIcon(CircleNotch, "LoaderCircle");
export const Lock = lineIcon(PhLock, "Lock");
export const LogOut = lineIcon(SignOut, "LogOut");
export const Mail = lineIcon(Envelope, "Mail");
export const MapPin = lineIcon(PhMapPin, "MapPin");
export const Megaphone = lineIcon(PhMegaphone, "Megaphone");
export const MessageCircle = lineIcon(ChatCircle, "MessageCircle");
export const MessageSquare = lineIcon(ChatText, "MessageSquare");
export const MessageSquarePlus = lineIcon(ChatCircleText, "MessageSquarePlus");
export const Mic = lineIcon(Microphone, "Mic");
export const MonitorDown = lineIcon(Monitor, "MonitorDown");
export const MoreHorizontal = lineIcon(DotsThree, "MoreHorizontal");
export const Palette = lineIcon(PhPalette, "Palette");
export const PauseCircle = lineIcon(PhPauseCircle, "PauseCircle");
export const Pencil = lineIcon(PencilSimple, "Pencil");
export const Phone = lineIcon(PhPhone, "Phone");
export const Pin = lineIcon(PushPin, "Pin");
export const Play = lineIcon(PhPlay, "Play");
export const Plus = lineIcon(PhPlus, "Plus");
export const Radio = lineIcon(Broadcast, "Radio");
export const RefreshCw = lineIcon(ArrowsClockwise, "RefreshCw");
export const Rss = lineIcon(PhRss, "Rss");
export const Search = lineIcon(MagnifyingGlass, "Search");
export const Send = lineIcon(PaperPlaneRight, "Send");
export const Settings = lineIcon(Gear, "Settings");
export const Settings2 = lineIcon(GearSix, "Settings2");
export const Share = lineIcon(Export, "Share");
export const Share2 = lineIcon(ShareNetwork, "Share2");
export const Shield = lineIcon(PhShield, "Shield");
export const ShieldAlert = lineIcon(ShieldWarning, "ShieldAlert");
export const ShieldCheck = lineIcon(PhShieldCheck, "ShieldCheck");
export const ShoppingBag = lineIcon(PhShoppingBag, "ShoppingBag");
export const SlidersHorizontal = lineIcon(PhSlidersHorizontal, "SlidersHorizontal");
export const Sparkles = lineIcon(Sparkle, "Sparkles");
export const SquarePlus = lineIcon(PlusSquare, "SquarePlus");
export const Trash2 = lineIcon(Trash, "Trash2");
export const UserCircle = lineIcon(PhUserCircle, "UserCircle");
export const UserPlus = lineIcon(PhUserPlus, "UserPlus");
export const UserX = lineIcon(UserMinus, "UserX");
export const Users = lineIcon(PhUsers, "Users");
export const UsersRound = lineIcon(UsersThree, "UsersRound");
export const Video = lineIcon(VideoCamera, "Video");
export const Volume2 = lineIcon(SpeakerHigh, "Volume2");
export const VolumeX = lineIcon(SpeakerSlash, "VolumeX");
export const Wallet = lineIcon(PhWallet, "Wallet");
export const X = lineIcon(PhX, "X");
export const Zap = lineIcon(Lightning, "Zap");
