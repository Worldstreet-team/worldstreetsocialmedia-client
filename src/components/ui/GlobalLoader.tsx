import GlobeIcon from "@/assets/icons/GlobeIcon";

export const GlobalLoader = () => {
	return (
		<div className="fixed inset-0 z-[99999] flex items-center justify-center bg-white/90 backdrop-blur-lg">
			<div className="flex flex-col items-center gap-4">
				<div className="relative w-16 h-16">
					{/* Pulsing background circle */}
					<div className="absolute inset-0 rounded-full bg-primary/20 animate-ping"></div>

					{/* Spinner */}
					<div className="relative w-16 h-16 rounded-full border-4 border-gray-200 border-t-primary animate-spin"></div>

					{/* Logo/Icon in center (optional) */}
					<div className="absolute inset-0 flex items-center justify-center">
						<GlobeIcon />
					</div>
				</div>
				<div className="text-primary font-bold text-lg animate-pulse">
					Loading...
				</div>
			</div>
		</div>
	);
};
