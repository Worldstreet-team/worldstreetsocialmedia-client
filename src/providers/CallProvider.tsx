"use client";

import React, {
	createContext,
	useContext,
	useEffect,
	useState,
	ReactNode,
} from "react";
import { useAuth } from "@clerk/nextjs";
import { useRealtime } from "@/components/providers/RealtimeProvider";
import { callManager, CallState } from "@/lib/call-manager";
import { CallModal } from "@/components/messages/CallModal";
import axios from "axios";
import { BACKEND_URL } from "@/const";

// Context
interface CallContextType extends CallState {
	startCall: (
		isVideo: boolean,
		recipientId: string,
		recipientName: string,
		recipientAvatar: string,
		isGroup: boolean,
		caller: {
			id: string;
			name: string;
			avatar: string;
			username: string;
		},
	) => void;
	acceptCall: () => void;
	rejectCall: () => void;
	endCall: () => void;
	toggleMic: () => void;
	toggleCam: () => void;
	isMicOn: boolean;
	isCamOn: boolean;
}

const CallContext = createContext<CallContextType | null>(null);

const API_URL = process.env.NEXT_PUBLIC_API_URL || BACKEND_URL;

export const useCall = () => {
	const context = useContext(CallContext);
	if (!context) {
		throw new Error("useCall must be used within a CallProvider");
	}
	return context;
};

export const CallProvider = ({ children }: { children: ReactNode }) => {
	const { getToken } = useAuth();
	const { client } = useRealtime(); // Access existing Ably client
	const [state, setState] = useState<CallState>(callManager.getState());

	// 1. Sync Ably Client with Manager
	useEffect(() => {
		if (client) {
			callManager.setAblyClient(client);
		}
	}, [client]);

	// 2. Setup API function for Manager
	useEffect(() => {
		callManager.setSignalFunction(async (targetId, type, payload) => {
			try {
				const token = await getToken();
				await axios.post(
					`${API_URL}/api/calls/signal`,
					{ targetId, type, payload },
					{ headers: { Authorization: `Bearer ${token}` } },
				);
			} catch (error) {
				console.error("Failed to send signal", error);
			}
		});
	}, [getToken]);

	// 3. Subscribe to Manager State
	useEffect(() => {
		const unsubscribe = callManager.subscribe((newState) => {
			setState(newState);
		});
		return () => {
			unsubscribe();
		};
	}, []);

	// 4. Initialize Listener (needs profile ID)
	useEffect(() => {
		if (client && client.auth.clientId) {
			callManager.initialize(client.auth.clientId);
		}
	}, [client]);

	// Local state for mic/cam
	const [isMicOn, setIsMicOn] = useState(true);
	const [isCamOn, setIsCamOn] = useState(true);

	const startCall = (
		isVideo: boolean,
		recipientId: string,
		recipientName: string,
		recipientAvatar: string,
		isGroup: boolean,
		caller: {
			id: string;
			name: string;
			avatar: string;
			username: string;
		},
	) => {
		callManager.startCall(
			isVideo,
			recipientId,
			recipientName,
			recipientAvatar,
			isGroup,
			caller,
		);
	};

	const acceptCall = () => callManager.acceptCall();
	const rejectCall = () => callManager.rejectCall();
	const endCall = () => callManager.endCall();

	const toggleMic = () => {
		if (state.localStream) {
			state.localStream.getAudioTracks().forEach((track) => {
				track.enabled = !isMicOn;
			});
			setIsMicOn(!isMicOn);
		}
	};

	const toggleCam = () => {
		if (state.localStream) {
			state.localStream.getVideoTracks().forEach((track) => {
				track.enabled = !isCamOn;
			});
			setIsCamOn(!isCamOn);
		}
	};

	return (
		<CallContext.Provider
			value={{
				...state,
				startCall,
				acceptCall,
				rejectCall,
				endCall,
				toggleMic,
				toggleCam,
				isMicOn,
				isCamOn,
			}}
		>
			{children}
			<CallModal
				isOpen={state.status !== "idle"}
				isIncoming={state.isIncoming}
				caller={state.caller}
				onAccept={acceptCall}
				onReject={rejectCall}
				onEnd={endCall}
				callStatus={state.status as any}
				isVideoCall={state.isVideo}
				localStream={state.localStream}
				remoteStream={state.remoteStream}
				onToggleMic={toggleMic}
				onToggleCam={toggleCam}
				isMicOn={isMicOn}
				isCamOn={isCamOn}
			/>
		</CallContext.Provider>
	);
};
