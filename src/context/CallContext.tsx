"use client";

import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { useSocket } from "./SocketContext";
import { useAtomValue } from "jotai";
import { userAtom } from "@/store/user.atom";

interface CallContextType {
	callState: "idle" | "incoming" | "outgoing" | "connected" | "ended";
	localStream: MediaStream | null;
	remoteStream: MediaStream | null;
	incomingCallData: { from: string; name: string; signal: any } | null;
	startCall: (userId: string, isVideo: boolean) => void;
	answerCall: () => void;
	endCall: () => void;
	rejectCall: () => void;
	isVideoCall: boolean;
}

const CallContext = createContext<CallContextType | undefined>(undefined);

export const CallProvider = ({ children }: { children: React.ReactNode }) => {
	const { socket } = useSocket();
	const user = useAtomValue(userAtom);

	const [callState, setCallState] = useState<CallContextType["callState"]>("idle");
	const [localStream, setLocalStream] = useState<MediaStream | null>(null);
	const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
	const [incomingCallData, setIncomingCallData] = useState<{
		from: string;
		name: string;
		signal: any;
	} | null>(null);
	const [isVideoCall, setIsVideoCall] = useState(false);
	const [targetUserId, setTargetUserId] = useState<string | null>(null);

	const peerConnectionRef = useRef<RTCPeerConnection | null>(null);

	// Initialize Peer Connection
	const createPeerConnection = () => {
		const pc = new RTCPeerConnection({
			iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
		});

		pc.onicecandidate = (event) => {
			if (event.candidate && socket && targetUserId) {
				socket.emit("ice-candidate", {
					to: targetUserId,
					candidate: event.candidate,
				});
			}
		};

		pc.ontrack = (event) => {
			setRemoteStream(event.streams[0]);
		};

		peerConnectionRef.current = pc;
		return pc;
	};

	// Start Call
	const startCall = async (userId: string, video: boolean) => {
		if (!socket || !user) return;
		setTargetUserId(userId);
		setIsVideoCall(video);
		setCallState("outgoing");

		try {
			const stream = await navigator.mediaDevices.getUserMedia({
				video,
				audio: true,
			});
			setLocalStream(stream);

			const pc = createPeerConnection();
			stream.getTracks().forEach((track) => pc.addTrack(track, stream));

			const offer = await pc.createOffer();
			await pc.setLocalDescription(offer);

			socket.emit("call-user", {
				userToCall: userId,
				signalData: offer,
				from: user.userId,
				name: user.username,
			});
		} catch (err) {
			console.error("Error starting call:", err);
			endCall();
		}
	};

	// Answer Call
	const answerCall = async () => {
		if (!incomingCallData || !socket) return;
		setCallState("connected");
		setTargetUserId(incomingCallData.from);

		try {
			const stream = await navigator.mediaDevices.getUserMedia({
				video: isVideoCall, // Or determine from incoming data if passed
				audio: true,
			});
			setLocalStream(stream);

			const pc = createPeerConnection();
			stream.getTracks().forEach((track) => pc.addTrack(track, stream));

			await pc.setRemoteDescription(new RTCSessionDescription(incomingCallData.signal));
			const answer = await pc.createAnswer();
			await pc.setLocalDescription(answer);

			socket.emit("answer-call", {
				signal: answer,
				to: incomingCallData.from,
			});
		} catch (err) {
			console.error("Error answering call:", err);
			endCall();
		}
	};

	// End/Reject Call
	const endCall = () => {
		if (socket && targetUserId) {
			socket.emit("end-call", { to: targetUserId });
		}
		cleanupCall();
	};

	const rejectCall = () => {
		if (incomingCallData && socket) {
			socket.emit("end-call", { to: incomingCallData.from });
		}
		cleanupCall();
	};

	const cleanupCall = () => {
		if (peerConnectionRef.current) {
			peerConnectionRef.current.close();
			peerConnectionRef.current = null;
		}
		if (localStream) {
			localStream.getTracks().forEach((track) => track.stop());
			setLocalStream(null);
		}
		setRemoteStream(null);
		setCallState("idle");
		setIncomingCallData(null);
		setTargetUserId(null);
	};

	// Socket Events
	useEffect(() => {
		if (!socket) return;

		socket.on("call-user", (data) => {
			setIncomingCallData(data);
			setCallState("incoming");
			// Assume video for now, ideally signal contains call type
			setIsVideoCall(true); 
		});

		socket.on("call-accepted", async (signal) => {
			if (peerConnectionRef.current) {
				setCallState("connected");
				await peerConnectionRef.current.setRemoteDescription(
					new RTCSessionDescription(signal)
				);
			}
		});

		socket.on("ice-candidate", async (candidate) => {
			if (peerConnectionRef.current) {
				await peerConnectionRef.current.addIceCandidate(
					new RTCIceCandidate(candidate)
				);
			}
		});

		socket.on("call-ended", () => {
			cleanupCall();
		});

		return () => {
			socket.off("call-user");
			socket.off("call-accepted");
			socket.off("ice-candidate");
			socket.off("call-ended");
		};
	}, [socket]);

	return (
		<CallContext.Provider
			value={{
				callState,
				localStream,
				remoteStream,
				incomingCallData,
				startCall,
				answerCall,
				endCall,
				rejectCall,
				isVideoCall,
			}}
		>
			{children}
		</CallContext.Provider>
	);
};

export const useCall = () => {
	const context = useContext(CallContext);
	if (!context) {
		throw new Error("useCall must be used within a CallProvider");
	}
	return context;
};
