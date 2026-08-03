"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
	Phone,
	PhoneOff,
	Video,
	VideoOff,
	Mic,
	MicOff,
	X,
} from "lucide-react";
import Image from "next/image";
import clsx from "clsx";

interface CallModalProps {
	isOpen: boolean;
	isIncoming: boolean;
	isVideoCall: boolean;
	caller: {
		name: string;
		avatar: string;
		username: string;
	} | null;
	callStatus:
		| "ringing"
		| "connected"
		| "ended"
		| "calling"
		| "idle"
		| "connecting";
	localStream: MediaStream | null;
	remoteStream: MediaStream | null;
	onAccept: () => void;
	onReject: () => void;
	onEnd: () => void;
	onToggleMic: () => void;
	onToggleCam: () => void;
	isMicOn: boolean;
	isCamOn: boolean;
}

export const CallModal = ({
	isOpen,
	isIncoming,
	isVideoCall,
	caller,
	callStatus,
	localStream,
	remoteStream,
	onAccept,
	onReject,
	onEnd,
	onToggleMic,
	onToggleCam,
	isMicOn,
	isCamOn,
}: CallModalProps) => {
	if (!isOpen || !caller) return null;

	return (
		<AnimatePresence>
			{isOpen && (
				<motion.div
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					className="fixed inset-0 z-modal bg-page flex flex-col items-center justify-center p-4"
				>
					{/* Video Streams */}
					{callStatus === "connected" && isVideoCall && (
						<div className="absolute inset-0 w-full h-full bg-sunken">
							{/* Remote Stream (Full Screen) */}
							{remoteStream && (
								<video
									autoPlay
									playsInline
									className="w-full h-full object-cover"
									ref={(video) => {
										if (video) video.srcObject = remoteStream;
									}}
								/>
							)}

							{/* Local Stream (PiP) */}
							{localStream && (
								<div className="absolute top-4 right-4 w-32 h-48 bg-raised rounded-lg overflow-hidden border border-hairline shadow-nav z-10">
									<video
										autoPlay
										playsInline
										muted
										className="w-full h-full object-cover transform -scale-x-100"
										ref={(video) => {
											if (video) video.srcObject = localStream;
										}}
									/>
								</div>
							)}
						</div>
					)}

					{/* Avatar / Status UI (Visible if audio call or ringing) */}
					{(!isVideoCall || callStatus !== "connected") && (
						<div className="flex flex-col items-center z-10">
							<div className="relative mb-8">
								{/* Ripple effect for ringing */}
								{(callStatus === "ringing" || callStatus === "calling") && (
									<>
										<motion.div
											animate={{ scale: [1, 1.5], opacity: [0.5, 0] }}
											transition={{
												duration: 2,
												repeat: Infinity,
												ease: "easeOut",
											}}
											className="absolute inset-0 bg-raised rounded-full z-0"
										/>
										<motion.div
											animate={{ scale: [1, 1.2], opacity: [0.5, 0] }}
											transition={{
												duration: 2,
												repeat: Infinity,
												ease: "easeOut",
												delay: 0.5,
											}}
											className="absolute inset-0 bg-raised rounded-full z-0"
										/>
									</>
								)}
								<div className="relative z-10 w-32 h-32 rounded-full overflow-hidden border-4 border-raised">
									<Image
										src={caller.avatar}
										alt={caller.name}
										fill
										className="object-cover"
									/>
								</div>
							</div>
							<h2 className="font-display text-2xl font-semibold text-primary mb-2">
								{caller.name}
							</h2>
							{/* Status text stays still — the transient ripple above carries
							    the "ringing" motion (no perpetual text pulse). */}
							<p className="text-muted font-sans">
								{callStatus === "calling" && "Calling..."}
								{callStatus === "ringing" && "Incoming Call..."}
								{callStatus === "connecting" && "Connecting..."}
								{callStatus === "connected" && "Connected"}
								{callStatus === "ended" && "Call Ended"}
							</p>
						</div>
					)}

					{/* Controls */}
					<div className="absolute bottom-10 left-0 right-0 flex items-center justify-center gap-6 z-20">
						{callStatus === "ringing" && isIncoming ? (
							<>
								<button
									onClick={onReject}
									className="w-16 h-16 rounded-pill bg-danger hover:opacity-90 flex items-center justify-center text-primary transition-opacity cursor-pointer"
								>
									<PhoneOff className="w-8 h-8" />
								</button>
								<button
									onClick={onAccept}
									className="w-16 h-16 rounded-pill bg-success hover:opacity-90 flex items-center justify-center text-primary transition-opacity cursor-pointer"
								>
									<Phone className="w-8 h-8" />
								</button>
							</>
						) : (
							<>
								<button
									onClick={onToggleMic}
									className={clsx(
										"w-12 h-12 rounded-pill flex items-center justify-center text-primary transition-colors cursor-pointer",
										isMicOn
											? "bg-surface hover:bg-raised border border-hairline"
											: "bg-primary text-page",
									)}
								>
									{isMicOn ? (
										<Mic className="w-5 h-5" />
									) : (
										<MicOff className="w-5 h-5" />
									)}
								</button>

								<button
									onClick={onEnd}
									className="w-16 h-16 rounded-pill bg-danger hover:opacity-90 flex items-center justify-center text-primary transition-opacity cursor-pointer"
								>
									<PhoneOff className="w-8 h-8" />
								</button>

								{isVideoCall && (
									<button
										onClick={onToggleCam}
										className={clsx(
											"w-12 h-12 rounded-pill flex items-center justify-center text-primary transition-colors cursor-pointer",
											isCamOn
												? "bg-surface hover:bg-raised border border-hairline"
												: "bg-primary text-page",
										)}
									>
										{isCamOn ? (
											<Video className="w-5 h-5" />
										) : (
											<VideoOff className="w-5 h-5" />
										)}
									</button>
								)}
							</>
						)}
					</div>

					{/* Close button for safety if stuck */}
					<button
						onClick={onEnd}
						className="absolute top-6 right-6 p-2 rounded-pill bg-surface/50 hover:bg-raised text-muted hover:text-primary transition-colors cursor-pointer"
					>
						<X className="w-6 h-6" />
					</button>
				</motion.div>
			)}
		</AnimatePresence>
	);
};
