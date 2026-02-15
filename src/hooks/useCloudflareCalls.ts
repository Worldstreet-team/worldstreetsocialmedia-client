import { useState, useEffect, useRef, useCallback } from "react";
import { useChannel } from "ably/react";
import axios from "axios";
import { useAuth } from "@clerk/nextjs";
import { BACKEND_URL } from "@/const";

export type CallStatus = "idle" | "calling" | "ringing" | "connected" | "ended";

interface UseCloudflareCallsProps {
	myProfileId: string | null;
	activeConversationId: string | null;
}

export const useCloudflareCalls = ({
	myProfileId,
	activeConversationId,
}: UseCloudflareCallsProps) => {
	const { getToken } = useAuth();
	const [callStatus, setCallStatus] = useState<CallStatus>("idle");
	const [isIncoming, setIsIncoming] = useState(false);
	const [isVideoCall, setIsVideoCall] = useState(false);
	const [caller, setCaller] = useState<{
		name: string;
		avatar: string;
		username: string;
	} | null>(null);
	const [sessionId, setSessionId] = useState<string | null>(null);
	const [localStream, setLocalStream] = useState<MediaStream | null>(null);
	const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

	// Refs for WebRTC / Cloudflare
	const peerConnection = useRef<RTCPeerConnection | null>(null);
	const localTracksRef = useRef<MediaStreamTrack[]>([]);

	// --- Signal Handling (Ably) ---
	// Handlers moved to CallSignalListener component

	// --- Actions ---

	const startCall = async (video: boolean, recipientId: string) => {
		setIsVideoCall(video);
		setCallStatus("calling");

		try {
			// 1. Get Local Stream
			const stream = await navigator.mediaDevices.getUserMedia({
				audio: true,
				video: video,
			});
			setLocalStream(stream);

			// 2. Setup PeerConnection (Mock for now, will replace with Cloudflare SDK/API logic)
			// In Cloudflare Calls, we create a session and track on the server.
			// For now, we simulate the "Invite" signal.

			// Send Invite via Ably
			// We need a way to send message to the OTHER person.
			// Usually we publish to THEIR channel.
			// We can't use the hook 'channel' instance because that subscribes to OUR channel.
			// We need a publisher. We will use the existing axios send message or a dedicated signal endpoint?
			// Since we have an Ably instance in RealtimeProvider, we can use that, or just an API endpoint that publishes.
			// Let's assume we have an API endpoint `POST /api/calls/signal` that handles publishing to Ably.

			await signalCall(recipientId, "call:invite", {
				callerId: myProfileId,
				isVideo: video,
			});
		} catch (err) {
			console.error("Failed to start call", err);
			setCallStatus("idle");
		}
	};

	const acceptCall = async () => {
		setCallStatus("connected");
		try {
			// 1. Get Local Stream
			const stream = await navigator.mediaDevices.getUserMedia({
				audio: true,
				video: isVideoCall,
			});
			setLocalStream(stream);

			// 2. Signal Acceptance
			// await signalCall(caller.id, 'call:accept', { ... });
		} catch (e) {
			console.error(e);
			endCall();
		}
	};

	const rejectCall = async () => {
		// Signal Rejection
		// await signalCall(caller.id, 'call:reject', ...);
		setCallStatus("idle");
		setIsIncoming(false);
		setCaller(null);
	};

	const endCall = async () => {
		// Cleanup media
		localStream?.getTracks().forEach((t) => t.stop());
		setLocalStream(null);
		setRemoteStream(null);
		setCallStatus("ended"); // briefly show ended
		setTimeout(() => {
			setCallStatus("idle");
			setIsIncoming(false);
			setCaller(null);
		}, 2000);

		// Signal End if connected
	};

	// --- Helpers ---
	const handleIncomingCall = (data: any) => {
		if (callStatus !== "idle") {
			// Busy?
			return;
		}
		setCaller(data.caller); // { name, avatar, ... }
		setIsVideoCall(data.isVideo);
		setIsIncoming(true);
		setCallStatus("ringing");
	};

	const handleCallAccepted = (data: any) => {
		setCallStatus("connected");
		// Initialize Cloudflare Session connection here
	};

	const handleCallRejected = () => {
		setCallStatus("ended"); // "Busy" or "Rejected"
		setTimeout(() => setCallStatus("idle"), 2000);
	};

	const handleSignal = (data: any) => {
		// Handle exchange of tracks/session IDs
	};

	// Mock API call for signaling (Replace with actual)
	const signalCall = async (targetId: string, type: string, payload: any) => {
		const token = await getToken();
		const API_URL = process.env.NEXT_PUBLIC_API_URL || BACKEND_URL;
		// This endpoint will be implemented in Gateway
		await axios.post(
			`${API_URL}/api/calls/signal`,
			{
				targetId,
				type,
				payload,
			},
			{
				headers: { Authorization: `Bearer ${token}` },
			},
		);
	};

	return {
		callStatus,
		isIncoming,
		isVideoCall,
		caller,
		localStream,
		remoteStream,
		startCall,
		acceptCall,
		rejectCall,
		endCall,
		// Handlers to be passed to SignalListener
		handleIncomingCall,
		handleCallAccepted,
		handleCallRejected,
		handleSignal,
		signalCall, // Export signal function too if needed, or keep internal? signalCall uses axios, so safe.
	};
};

// Separate component to handle Ably subscription
// Renders only when isConnected is true in parent
export const CallSignalListener = ({
	myProfileId,
	activeConversationId,
	onIncomingCall,
	onCallAccepted,
	onCallRejected,
	onSignal,
}: {
	myProfileId: string | null;
	activeConversationId: string | null;
	onIncomingCall: (data: any) => void;
	onCallAccepted: (data: any) => void;
	onCallRejected: () => void;
	onSignal: (data: any) => void;
}) => {
	useChannel(
		myProfileId ? `calls:${myProfileId}` : "calls:public",
		async (message) => {
			if (!activeConversationId) return;

			switch (message.name) {
				case "call:invite":
					onIncomingCall(message.data);
					break;
				case "call:accept":
					onCallAccepted(message.data);
					break;
				case "call:reject":
					onCallRejected();
					break;
				case "call:end":
					// onEnd(); // We might need to handle end here too
					// But for now let's persist standard events
					break;
				case "call:signal":
					onSignal(message.data);
					break;
			}
		},
	);

	return null;
};
